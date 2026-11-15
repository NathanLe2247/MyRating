-- Match results, confirmation and Glicko-2 rating updates (issue #78).
--
-- * match_games: the reported per-game scores (MatchGameRowSchema).
-- * rating_history: one row per player per confirmed match
--   (RatingHistoryRowSchema), written in the same transaction as
--   player_ratings.
-- * The bot guard: the Demo Tester's (users.is_bot) rating never changes.
-- * match_results_* / ratings_* functions, service_role only, called by the
--   `match-results` edge function. Glicko-2 itself is computed in TypeScript
--   (backend/supabase/functions/ratings/, agent/skills/ratings-engine);
--   ratings_apply only checks the match state and writes what it is given.
--
-- Results reuse the existing match_status values: accepted (report the
-- result) -> awaiting_confirmation -> confirmed | disputed. Clients only read
-- (their own matches' games, their own rating history).

-- ---------------------------------------------------------------------------
-- match_games
-- ---------------------------------------------------------------------------

create table public.match_games (
  match_id uuid not null references public.matches (id) on delete cascade,
  game_number integer not null check (game_number between 1 and 3),
  -- In the match's a/b order. The scoring rules (to 11, win by 2, the match
  -- winner wins more games) are enforced by MatchResultSubmissionSchema in
  -- the edge function, not here.
  player_a_points integer not null check (player_a_points >= 0),
  player_b_points integer not null check (player_b_points >= 0),
  constraint match_games_match_game_unique unique (match_id, game_number)
);

comment on table public.match_games is
  'Reported game scores, in the match''s a/b order. Players read their own matches'' games; written only by the match-results edge function.';

alter table public.match_games enable row level security;

revoke all on public.match_games from anon, authenticated;
grant select on public.match_games to authenticated;
grant select, insert, update, delete on public.match_games to service_role;

create policy "Players read the games of their own matches"
  on public.match_games
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.matches m
      where m.id = match_id
        and (select u.id from public.users u where u.clerk_user_id = (select auth.jwt() ->> 'sub'))
          in (m.player_a_id, m.player_b_id)
    )
  );

-- ---------------------------------------------------------------------------
-- rating_history
-- ---------------------------------------------------------------------------

create table public.rating_history (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null references public.users (id) on delete cascade,
  -- Visible rating (player_ratings.rating) before and after the match.
  before numeric(7, 2) not null,
  after numeric(7, 2) not null,
  -- Same type as player_ratings.rating, so it is exactly rounded after
  -- minus rounded before.
  delta numeric(7, 2) generated always as (after - before) stored,
  created_at timestamptz not null default now(),
  -- One row per player per match: confirming twice can't add a second.
  primary key (match_id, player_id)
);

comment on table public.rating_history is
  'How each confirmed match moved a player''s visible rating. Players read their own rows; written only by ratings_apply (the ratings code path).';

create index rating_history_player_idx on public.rating_history (player_id, created_at desc);

alter table public.rating_history enable row level security;

revoke all on public.rating_history from anon, authenticated;
grant select on public.rating_history to authenticated;
grant select, insert, update, delete on public.rating_history to service_role;

create policy "Players read their own rating history"
  on public.rating_history
  for select
  to authenticated
  using (
    player_id = (select u.id from public.users u where u.clerk_user_id = (select auth.jwt() ->> 'sub'))
  );

-- ---------------------------------------------------------------------------
-- Bots never get a rating change
-- ---------------------------------------------------------------------------
-- A backstop for the rule the ratings code already follows (it skips is_bot
-- players): any insert or update of a bot's player_ratings row, or a
-- rating_history row for a bot, fails. The Demo Tester's seed row was
-- inserted by 20261114130000_queue_and_matches.sql, before this trigger.
-- To re-seed it deliberately, disable the trigger in that migration.

create function public.refuse_bot_rating_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.users u
    where u.id = (to_jsonb(new) ->> tg_argv[0])::uuid and u.is_bot
  ) then
    raise exception 'bot_rating_frozen' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.refuse_bot_rating_change() from public, anon, authenticated;

create trigger player_ratings_refuse_bot
  before insert or update on public.player_ratings
  for each row execute function public.refuse_bot_rating_change('user_id');

create trigger rating_history_refuse_bot
  before insert or update on public.rating_history
  for each row execute function public.refuse_bot_rating_change('player_id');

-- ---------------------------------------------------------------------------
-- Functions (service_role only; called by the match-results edge function)
-- ---------------------------------------------------------------------------
-- Refusals are SQLSTATE P0001 with a snake_case message the function returns
-- as { error } (MATCH_RESULTS_ERRORS in shared/src/match-results.ts), except
-- rating_stale, which the function retries. Every function that changes a
-- match locks its row (select ... for update), so a submit, a confirm, a
-- dispute and matchmaking_leave on the same match run one at a time.

-- Records the reporter's games and moves the match to awaiting_confirmation.
-- Games are already validated with MatchResultSubmissionSchema.
create function public.match_results_submit(p_player_id uuid, p_match_id uuid, p_games jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or p_player_id not in (m.player_a_id, m.player_b_id) then
    raise exception 'match_not_found' using errcode = 'P0001';
  end if;
  if m.status <> 'accepted' then
    raise exception 'match_not_accepted' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_games) is distinct from 'array' or jsonb_array_length(p_games) not between 1 and 3 then
    raise exception 'invalid_result' using errcode = '22023';
  end if;

  insert into public.match_games (match_id, game_number, player_a_points, player_b_points)
  select p_match_id, g.ord::integer, (g.game ->> 'player_a_points')::integer, (g.game ->> 'player_b_points')::integer
  from jsonb_array_elements(p_games) with ordinality as g (game, ord);

  update public.matches
     set status = 'awaiting_confirmation', reported_by = p_player_id, updated_at = now()
   where id = m.id;
end;
$$;

-- The other player rejects the reported score: disputed, no rating change.
-- Disputing a disputed match again is a no-op.
create function public.match_results_dispute(p_player_id uuid, p_match_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or p_player_id not in (m.player_a_id, m.player_b_id) then
    raise exception 'match_not_found' using errcode = 'P0001';
  end if;
  if m.reported_by = p_player_id then
    raise exception 'own_report' using errcode = 'P0001';
  end if;
  if m.status = 'disputed' then
    return;
  end if;
  if m.status <> 'awaiting_confirmation' then
    raise exception 'match_not_awaiting_confirmation' using errcode = 'P0001';
  end if;

  update public.matches set status = 'disputed', updated_at = now() where id = m.id;
end;
$$;

-- Whether the Demo Tester should confirm this match now: it is awaiting
-- confirmation of a score the human reported at least p_min_wait ago (the
-- report is the match's last update), and the other player is a bot. The
-- edge function only asks when DEMO_BOT_ENABLED=true.
create function public.match_results_bot_confirm_due(p_match_id uuid, p_min_wait interval)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    join public.users bot
      on bot.id = case when m.reported_by = m.player_a_id then m.player_b_id else m.player_a_id end
    where m.id = p_match_id
      and m.status = 'awaiting_confirmation'
      and bot.is_bot
      and m.updated_at <= now() - p_min_wait
  );
$$;

-- What the match-results function returns for one match
-- (MatchResultsStateSchema): the match, its games, the opponent, and the
-- caller's rating change once confirmed.
create function public.match_results_state(p_player_id uuid, p_match_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match_id;
  if not found or p_player_id not in (m.player_a_id, m.player_b_id) then
    raise exception 'match_not_found' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'match', to_jsonb(m),
    'games', coalesce(
      (select jsonb_agg(to_jsonb(g) order by g.game_number) from public.match_games g where g.match_id = m.id),
      '[]'::jsonb
    ),
    'opponent', (
      select jsonb_build_object(
        'id', u.id,
        'username', u.username,
        'first_name', u.first_name,
        'rating', r.rating,
        'is_bot', u.is_bot
      )
      from public.users u
      left join public.player_ratings r on r.user_id = u.id
      where u.id = case when m.player_a_id = p_player_id then m.player_b_id else m.player_a_id end
    ),
    'rating_change', (
      select jsonb_build_object(
        'match_id', h.match_id, 'player_id', h.player_id, 'before', h.before, 'after', h.after, 'delta', h.delta
      )
      from public.rating_history h
      where h.match_id = m.id and h.player_id = p_player_id
    )
  );
end;
$$;

-- What the Glicko-2 update for a match is computed from: its status, games,
-- and both players' current rating rows (nulls when a player has none yet).
create function public.ratings_match_inputs(p_match_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match_id;
  if not found then
    raise exception 'match_not_found' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'match_id', m.id,
    'status', m.status,
    'games', coalesce(
      (select jsonb_agg(
         jsonb_build_object('player_a_points', g.player_a_points, 'player_b_points', g.player_b_points)
         order by g.game_number)
       from public.match_games g where g.match_id = m.id),
      '[]'::jsonb
    ),
    'player_a', (
      select jsonb_build_object(
        'id', u.id, 'is_bot', u.is_bot, 'rating', r.rating, 'mmr', r.mmr,
        'rating_deviation', r.rating_deviation, 'volatility', r.volatility
      )
      from public.users u left join public.player_ratings r on r.user_id = u.id
      where u.id = m.player_a_id
    ),
    'player_b', (
      select jsonb_build_object(
        'id', u.id, 'is_bot', u.is_bot, 'rating', r.rating, 'mmr', r.mmr,
        'rating_deviation', r.rating_deviation, 'volatility', r.volatility
      )
      from public.users u left join public.player_ratings r on r.user_id = u.id
      where u.id = m.player_b_id
    )
  );
end;
$$;

-- Confirms the match as p_confirmer_id and writes the rating updates, all in
-- this one transaction:
-- * already confirmed: returns false and writes nothing (idempotent);
-- * not awaiting_confirmation: match_not_awaiting_confirmation;
-- * the confirmer reported the score: own_report;
-- * p_updates must hold exactly one row per non-bot player of the match
--   (invalid_update otherwise); each row's expected_* must equal the
--   player's current player_ratings row (all null = no row yet), else
--   rating_stale and nothing is written (the caller recomputes and retries).
-- Each update upserts player_ratings (rating = mmr = the new Glicko-2
-- rating, plus RD and volatility), inserts rating_history (before, after),
-- and bumps users.games_played. Returns true.
create function public.ratings_apply(p_match_id uuid, p_confirmer_id uuid, p_updates jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  m public.matches%rowtype;
  u record;
  cur public.player_ratings%rowtype;
  expected_players uuid[];
  given_players uuid[];
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or p_confirmer_id not in (m.player_a_id, m.player_b_id) then
    raise exception 'match_not_found' using errcode = 'P0001';
  end if;
  if m.status = 'confirmed' then
    return false;
  end if;
  if m.reported_by = p_confirmer_id then
    raise exception 'own_report' using errcode = 'P0001';
  end if;
  if m.status <> 'awaiting_confirmation' then
    raise exception 'match_not_awaiting_confirmation' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(x.id order by x.id), '{}') into expected_players
  from public.users x
  where x.id in (m.player_a_id, m.player_b_id) and not x.is_bot;

  select coalesce(array_agg(x.player_id order by x.player_id), '{}') into given_players
  from jsonb_to_recordset(coalesce(p_updates, '[]'::jsonb)) as x (player_id uuid);

  if given_players is distinct from expected_players then
    raise exception 'invalid_update' using errcode = '22023';
  end if;

  for u in
    select *
    from jsonb_to_recordset(p_updates) as x (
      player_id uuid,
      expected_rating numeric,
      expected_mmr numeric,
      expected_rating_deviation numeric,
      expected_volatility numeric,
      before numeric,
      rating numeric,
      rating_deviation numeric,
      volatility numeric
    )
  loop
    select * into cur from public.player_ratings where user_id = u.player_id for update;
    if found then
      if (cur.rating, cur.mmr, cur.rating_deviation, cur.volatility)
         is distinct from (u.expected_rating, u.expected_mmr, u.expected_rating_deviation, u.expected_volatility) then
        raise exception 'rating_stale' using errcode = 'P0001';
      end if;
      update public.player_ratings
         set rating = u.rating,
             mmr = u.rating,
             rating_deviation = u.rating_deviation,
             volatility = u.volatility,
             updated_at = now()
       where user_id = u.player_id;
    else
      if num_nonnulls(u.expected_rating, u.expected_mmr, u.expected_rating_deviation, u.expected_volatility) > 0 then
        raise exception 'rating_stale' using errcode = 'P0001';
      end if;
      insert into public.player_ratings (user_id, rating, mmr, rating_deviation, volatility)
      values (u.player_id, u.rating, u.rating, u.rating_deviation, u.volatility);
    end if;

    insert into public.rating_history (match_id, player_id, before, after)
    values (m.id, u.player_id, u.before, u.rating);

    update public.users set games_played = games_played + 1, updated_at = now() where id = u.player_id;
  end loop;

  update public.matches set status = 'confirmed', updated_at = now() where id = m.id;
  return true;
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.match_results_submit(uuid, uuid, jsonb)',
    'public.match_results_dispute(uuid, uuid)',
    'public.match_results_bot_confirm_due(uuid, interval)',
    'public.match_results_state(uuid, uuid)',
    'public.ratings_match_inputs(uuid)',
    'public.ratings_apply(uuid, uuid, jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
