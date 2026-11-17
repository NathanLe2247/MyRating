-- Concurrent first confirms for an unrated player (issue #100). Changes
-- ratings_apply from 20261115120000_ratings_hardening.sql without editing it.
--
-- Two different matches confirmed at the same time for a player with no
-- player_ratings row both saw "no row" (there is nothing to lock), so both
-- inserted one; the second insert waited on the first and then failed with a
-- unique violation (23505), which match-results answers with a 500. The
-- insert is now `on conflict do nothing`, and when no row was inserted the
-- player's row appeared after the caller read it: rating_stale, so
-- confirmMatch re-reads and recomputes (and match-results answers 409
-- rating_stale once its retries run out). Nothing else changes.
--
-- `create or replace` keeps the function's grants (service_role only).

-- ---------------------------------------------------------------------------
-- ratings_apply
-- ---------------------------------------------------------------------------
-- Confirms the match as p_confirmer_id and writes the rating updates, all in
-- this one transaction:
-- * already confirmed: returns false and writes nothing (idempotent);
-- * not awaiting_confirmation: match_not_awaiting_confirmation;
-- * the confirmer reported the score: own_report;
-- * no updates although the match awaits confirmation: match_changed (the
--   caller read it before the score was reported; it must not confirm a
--   score the player hasn't seen);
-- * p_updates must hold exactly one row per non-bot player of the match
--   (invalid_update otherwise); each row's expected_* must equal the
--   player's current player_ratings row (all null = no row yet), else
--   rating_stale and nothing is written (the caller recomputes and retries);
--   a player with no row whose row is inserted by a concurrent confirmation
--   before this one can insert it is rating_stale too;
--   each row's `before` must equal the player's current visible rating
--   (1500 with no row yet), else invalid_update.
-- Players are locked and written in player_id order, so concurrent
-- confirmations sharing a player can't deadlock. Each update upserts
-- player_ratings (rating = mmr = the new Glicko-2 rating, plus RD and
-- volatility), inserts rating_history (before, after), and bumps
-- users.games_played. Returns true.
create or replace function public.ratings_apply(p_match_id uuid, p_confirmer_id uuid, p_updates jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  m public.matches%rowtype;
  u record;
  cur public.player_ratings%rowtype;
  cur_before numeric;
  has_row boolean;
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
  -- Every match awaiting confirmation has a human player, so an empty update
  -- list means the caller computed from an earlier status (accepted).
  if (case
        when jsonb_typeof(p_updates) = 'array' then jsonb_array_length(p_updates) = 0
        else p_updates is null
      end) then
    raise exception 'match_changed' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(x.id order by x.id), '{}') into expected_players
  from public.users x
  where x.id in (m.player_a_id, m.player_b_id) and not x.is_bot;

  select coalesce(array_agg(x.player_id order by x.player_id), '{}') into given_players
  from jsonb_to_recordset(p_updates) as x (player_id uuid);

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
    -- One lock order for every confirmation: no deadlocks between two
    -- matches that share players.
    order by x.player_id
  loop
    select * into cur from public.player_ratings where user_id = u.player_id for update;
    has_row := found;
    if has_row then
      if (cur.rating, cur.mmr, cur.rating_deviation, cur.volatility)
         is distinct from (u.expected_rating, u.expected_mmr, u.expected_rating_deviation, u.expected_volatility) then
        raise exception 'rating_stale' using errcode = 'P0001';
      end if;
      cur_before := cur.rating;
    else
      if num_nonnulls(u.expected_rating, u.expected_mmr, u.expected_rating_deviation, u.expected_volatility) > 0 then
        raise exception 'rating_stale' using errcode = 'P0001';
      end if;
      -- The player_ratings.rating column default (DEFAULT_RATING in
      -- functions/ratings/update.ts).
      cur_before := 1500;
    end if;

    -- `before` is recorded from the database, not the caller; a mismatch
    -- means the caller computed from something else.
    if u.before is distinct from cur_before then
      raise exception 'invalid_update' using errcode = '22023';
    end if;

    if has_row then
      update public.player_ratings
         set rating = u.rating,
             mmr = u.rating,
             rating_deviation = u.rating_deviation,
             volatility = u.volatility,
             updated_at = now()
       where user_id = u.player_id;
    else
      -- With no row there was nothing to lock: a concurrent confirmation may
      -- have inserted the player's first row since the select above (this
      -- insert then waits for it to commit). Skip instead of failing with a
      -- unique violation, and refuse as rating_stale: this update was
      -- computed from the defaults, not from that row.
      insert into public.player_ratings (user_id, rating, mmr, rating_deviation, volatility)
      values (u.player_id, u.rating, u.rating, u.rating_deviation, u.volatility)
      on conflict (user_id) do nothing;
      if not found then
        raise exception 'rating_stale' using errcode = 'P0001';
      end if;
    end if;

    insert into public.rating_history (match_id, player_id, before, after)
    values (m.id, u.player_id, cur_before, u.rating);

    update public.users set games_played = games_played + 1, updated_at = now() where id = u.player_id;
  end loop;

  update public.matches set status = 'confirmed', updated_at = now() where id = m.id;
  return true;
end;
$$;
