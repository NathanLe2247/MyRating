-- Match queue and matches for the demo flow (queue -> match -> accept), plus
-- the Demo Tester bot. Row shapes mirror QueueEntrySchema and MatchSchema in
-- shared/src/match.ts; change both together. Conventions:
-- agent/skills/geospatial-matching.
--
-- Clients only read (their own queue entry, the matches they're in). Every
-- write goes through the `matchmaking` edge function (service role), which
-- calls the matchmaking_* functions below.

-- ---------------------------------------------------------------------------
-- Enums (QUEUE_ENTRY_STATUSES / MATCH_STATUSES, same values, same order)
-- ---------------------------------------------------------------------------

create type public.queue_entry_status as enum ('waiting', 'matched', 'left');

create type public.match_status as enum (
  'proposed',
  'accepted',
  'awaiting_confirmation',
  'confirmed',
  'disputed',
  'declined',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- queue_entries
-- ---------------------------------------------------------------------------

create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.users (id) on delete cascade,
  -- [lng, lat] in WGS 84, geography so radii are metres. POINT EMPTY would
  -- serialize as `coordinates: []`, which QueueEntrySchema rejects.
  location extensions.geography(point, 4326) not null
    check (not extensions.st_isempty(location::extensions.geometry)),
  -- 1..MAX_QUEUE_RADIUS_M, the same cap as nearby_courts.
  radius_m integer not null check (radius_m > 0 and radius_m <= 100000),
  status public.queue_entry_status not null default 'waiting',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.queue_entries is
  'Players looking for a match. Players read their own rows through queue_entries_geojson; written only by the matchmaking edge function.';
comment on column public.queue_entries.created_at is
  'When the player started waiting. The Demo Tester pairs once this is ~5 s old (DEMO_BOT_ENABLED).';

-- One live entry per player; old matched/left rows are kept as history.
create unique index queue_entries_one_waiting_per_player
  on public.queue_entries (player_id)
  where status = 'waiting';

-- Radius search over waiting players only.
create index queue_entries_waiting_location_idx
  on public.queue_entries using gist (location)
  where status = 'waiting';

alter table public.queue_entries enable row level security;

-- Same reset-then-grant pattern as public.users. Never granted to anon.
revoke all on public.queue_entries from anon, authenticated;
grant select on public.queue_entries to authenticated;
grant select, insert, update, delete on public.queue_entries to service_role;

create policy "Players read their own queue entries"
  on public.queue_entries
  for select
  to authenticated
  using (
    player_id = (select u.id from public.users u where u.clerk_user_id = (select auth.jwt() ->> 'sub'))
  );

-- PostgREST returns geography as WKB hex; this view hands clients the
-- QueueEntrySchema shape. security_invoker so the caller's grants and RLS
-- apply (authenticated sees only its own rows).
create view public.queue_entries_geojson
  with (security_invoker = true)
  as
  select
    id,
    player_id,
    extensions.st_asgeojson(location)::jsonb as location,
    radius_m,
    status,
    created_at,
    updated_at
  from public.queue_entries;

comment on view public.queue_entries_geojson is
  'public.queue_entries with location as a GeoJSON Point. Rows match QueueEntrySchema in shared/src/match.ts.';

revoke all on public.queue_entries_geojson from anon, authenticated;
grant select on public.queue_entries_geojson to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- matches
-- ---------------------------------------------------------------------------

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  player_a_id uuid not null references public.users (id) on delete cascade,
  player_b_id uuid not null references public.users (id) on delete cascade,
  court_id uuid references public.courts (id) on delete set null,
  status public.match_status not null default 'proposed',
  player_a_accepted_at timestamptz,
  player_b_accepted_at timestamptz,
  reported_by uuid references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_two_players check (player_a_id <> player_b_id),
  constraint matches_reported_by_player
    check (reported_by is null or reported_by = player_a_id or reported_by = player_b_id),
  -- Past `proposed`, both players have accepted (declined/cancelled may not).
  constraint matches_accepted_by_both
    check (
      status not in ('accepted', 'awaiting_confirmation', 'confirmed', 'disputed')
      or (player_a_accepted_at is not null and player_b_accepted_at is not null)
    ),
  -- A result needs a reporter.
  constraint matches_reported_when_reporting
    check (status not in ('awaiting_confirmation', 'confirmed', 'disputed') or reported_by is not null)
);

comment on table public.matches is
  'Singles matches. Players read the matches they are in (and get them over Realtime); written only by edge functions.';

create index matches_player_a_idx on public.matches (player_a_id, created_at desc);
create index matches_player_b_idx on public.matches (player_b_id, created_at desc);

alter table public.matches enable row level security;

revoke all on public.matches from anon, authenticated;
grant select on public.matches to authenticated;
grant select, insert, update, delete on public.matches to service_role;

create policy "Players read their own matches"
  on public.matches
  for select
  to authenticated
  using (
    (select u.id from public.users u where u.clerk_user_id = (select auth.jwt() ->> 'sub'))
      in (player_a_id, player_b_id)
  );

-- "Match found" live on mobile: postgres_changes on public.matches, filtered
-- by the RLS policy above (agent/skills/community-realtime).
alter publication supabase_realtime add table public.matches;

-- ---------------------------------------------------------------------------
-- Demo Tester bot
-- ---------------------------------------------------------------------------
-- A fixed, non-Clerk user the matchmaking function pairs with a player who
-- has waited ~5 s, when the DEMO_BOT_ENABLED function secret is 'true'. The
-- id is v4-shaped so z.uuid() accepts it; it mirrors DEMO_TESTER_USER_ID in
-- shared/src/matchmaking.ts. Inserted here (not seed.sql) so the hosted
-- project has it.
--
-- * `clerk_user_id` is a placeholder (the column is not null unique). Clerk
--   ids always start with `user_`, so it can't collide with a real user and
--   clerk-webhook never touches it.
-- * `username` is null. Any name that passes users_username_format also
--   passes onboarding (both use the same pattern), so a real player could
--   already hold any handle we picked and the insert would abort on the
--   unique index. The app shows the bot by first_name/last_name.
-- * `is_bot`: leaderboards and any other player lists must filter it out,
--   and the bot's rating never changes (the `ratings` function must skip
--   is_bot players).

alter table public.users
  add column is_bot boolean not null default false;

comment on column public.users.is_bot is
  'True only for the Demo Tester. Leaderboards must exclude is_bot users; their rating never changes.';

insert into public.users (
  id, clerk_user_id, username, first_name, last_name, login_method, is_bot,
  profile_completed_at, onboarding_completed_at
)
values (
  '00000000-0000-4000-8000-0000000000d1', 'demo_tester', null, 'Demo', 'Tester', 'email', true,
  now(), now()
)
on conflict (id) do nothing;

-- Near the median visible rating at migration time (1500, the default, if
-- nobody is rated yet). A settled deviation so the bot isn't provisional.
-- This is the one player_ratings write outside the `ratings` edge function.
insert into public.player_ratings (user_id, rating, mmr, rating_deviation)
select
  '00000000-0000-4000-8000-0000000000d1',
  m.median,
  m.median,
  60
from (
  select coalesce(round(percentile_cont(0.5) within group (order by rating)::numeric, 2), 1500) as median
  from public.player_ratings
) m
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Matchmaking functions (service_role only; called by the edge function)
-- ---------------------------------------------------------------------------
-- Errors are raised with SQLSTATE P0001 and a snake_case message that the
-- edge function returns to the client as `{ error: <message> }`.
--
-- Pairing and match updates take one transaction-scoped advisory lock, so
-- two concurrent polls can't pair the same player twice. Fine at demo scale;
-- shard the lock (e.g. by area) if it ever becomes a bottleneck.

-- Nearest active court to a point (within the 100 km nearby_courts cap), or null.
create function public.matchmaking_nearest_court(p_point extensions.geography)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id
  from public.nearby_courts(
    extensions.st_y(p_point::extensions.geometry),
    extensions.st_x(p_point::extensions.geometry),
    100000,
    1
  ) c;
$$;

-- Starts (or updates) the player's waiting entry. Keeps created_at when the
-- player is already waiting, so moving doesn't restart the bot timer.
create function public.matchmaking_join(
  p_player_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_radius_m integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  point extensions.geography;
begin
  if p_lat is null or not (p_lat between -90 and 90) then
    raise exception 'invalid_location' using errcode = '22023';
  end if;
  if p_lng is null or not (p_lng between -180 and 180) then
    raise exception 'invalid_location' using errcode = '22023';
  end if;
  if p_radius_m is null or not (p_radius_m between 1 and 100000) then
    raise exception 'invalid_radius' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('public.matchmaking'));

  -- One open match per player: answer (or leave) a proposal first, and
  -- finish (or leave) an accepted match before queueing again.
  if exists (
    select 1 from public.matches m
    where m.status = 'proposed' and p_player_id in (m.player_a_id, m.player_b_id)
  ) then
    raise exception 'match_pending' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.matches m
    where m.status in ('accepted', 'awaiting_confirmation') and p_player_id in (m.player_a_id, m.player_b_id)
  ) then
    raise exception 'match_open' using errcode = 'P0001';
  end if;

  point := extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography;

  update public.queue_entries
     set location = point, radius_m = p_radius_m, updated_at = now()
   where player_id = p_player_id and status = 'waiting';
  if not found then
    insert into public.queue_entries (player_id, location, radius_m)
    values (p_player_id, point, p_radius_m);
  end if;
end;
$$;

-- Leaves the queue and backs out of the player's match before any result:
-- a `proposed` match, or an `accepted` one nobody has reported yet, becomes
-- `cancelled` (the other player has to rejoin). Matches with a reported
-- result are untouched.
create function public.matchmaking_leave(p_player_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('public.matchmaking'));

  update public.queue_entries
     set status = 'left', updated_at = now()
   where player_id = p_player_id and status = 'waiting';

  update public.matches
     set status = 'cancelled', updated_at = now()
   where (status = 'proposed' or (status = 'accepted' and reported_by is null))
     and p_player_id in (player_a_id, player_b_id);
end;
$$;

-- Pairs the player's waiting entry with the nearest other waiting player
-- inside BOTH players' radii (distance <= the smaller radius). Ties go to
-- whoever has waited longest. The court is the nearest active court to the
-- midpoint. player_a is the player found, player_b the caller (the one whose
-- join/poll made the pair). Returns the new match id,
-- or null if the player isn't waiting or nobody fits.
create function public.matchmaking_pair(p_player_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me public.queue_entries%rowtype;
  other public.queue_entries%rowtype;
  midpoint extensions.geography;
  new_match_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('public.matchmaking'));

  select * into me
  from public.queue_entries
  where player_id = p_player_id and status = 'waiting';
  if not found then
    return null;
  end if;

  select q.* into other
  from public.queue_entries q
  where q.status = 'waiting'
    and q.player_id <> me.player_id
    and extensions.st_dwithin(q.location, me.location, least(q.radius_m, me.radius_m))
  order by extensions.st_distance(q.location, me.location), q.created_at, q.id
  limit 1;
  if not found then
    return null;
  end if;

  midpoint := extensions.st_centroid(
    extensions.st_collect(me.location::extensions.geometry, other.location::extensions.geometry)
  )::extensions.geography;

  insert into public.matches (player_a_id, player_b_id, court_id)
  values (other.player_id, me.player_id, public.matchmaking_nearest_court(midpoint))
  returning id into new_match_id;

  update public.queue_entries
     set status = 'matched', updated_at = now()
   where id in (me.id, other.id);

  return new_match_id;
end;
$$;

-- Pairs the player with the Demo Tester once their entry has waited at least
-- p_min_wait. The bot accepts on the spot (player_b_accepted_at = now()).
-- The edge function only calls this when DEMO_BOT_ENABLED=true, after
-- matchmaking_pair found nobody. Returns the match id, or null.
create function public.matchmaking_pair_with_bot(p_player_id uuid, p_min_wait interval)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  bot_id constant uuid := '00000000-0000-4000-8000-0000000000d1';
  me public.queue_entries%rowtype;
  new_match_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('public.matchmaking'));

  select * into me
  from public.queue_entries
  where player_id = p_player_id and status = 'waiting' and created_at <= now() - p_min_wait;
  if not found or p_player_id = bot_id then
    return null;
  end if;

  insert into public.matches (player_a_id, player_b_id, court_id, player_b_accepted_at)
  values (me.player_id, bot_id, public.matchmaking_nearest_court(me.location), now())
  returning id into new_match_id;

  update public.queue_entries
     set status = 'matched', updated_at = now()
   where id = me.id;

  return new_match_id;
end;
$$;

-- Accepts or declines a proposed match. Accepting twice is a no-op; the match
-- becomes `accepted` once both players have. Declining ends it (`declined`);
-- both players have to rejoin the queue.
create function public.matchmaking_respond(p_player_id uuid, p_match_id uuid, p_accept boolean)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  m public.matches%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('public.matchmaking'));

  select * into m from public.matches where id = p_match_id for update;
  if not found or p_player_id not in (m.player_a_id, m.player_b_id) then
    raise exception 'match_not_found' using errcode = 'P0001';
  end if;
  if m.status <> 'proposed' then
    raise exception 'match_not_proposed' using errcode = 'P0001';
  end if;

  if not p_accept then
    update public.matches set status = 'declined', updated_at = now() where id = m.id;
    return;
  end if;

  if p_player_id = m.player_a_id then
    m.player_a_accepted_at := coalesce(m.player_a_accepted_at, now());
  else
    m.player_b_accepted_at := coalesce(m.player_b_accepted_at, now());
  end if;

  update public.matches
     set player_a_accepted_at = m.player_a_accepted_at,
         player_b_accepted_at = m.player_b_accepted_at,
         status = case
           when m.player_a_accepted_at is not null and m.player_b_accepted_at is not null
             then 'accepted'::public.match_status
           else 'proposed'::public.match_status
         end,
         updated_at = now()
   where id = m.id;
end;
$$;

-- What the player's matchmaking screen shows (MatchmakingStateSchema in
-- shared/src/matchmaking.ts): their waiting entry, their newest open match
-- (proposed / accepted / awaiting_confirmation), the opponent and the court.
create function public.matchmaking_state(p_player_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with entry as (
    select to_jsonb(q) as j
    from public.queue_entries_geojson q
    where q.player_id = p_player_id and q.status = 'waiting'
  ),
  open_match as (
    select m.*
    from public.matches m
    where p_player_id in (m.player_a_id, m.player_b_id)
      and m.status in ('proposed', 'accepted', 'awaiting_confirmation')
    order by m.created_at desc, m.id
    limit 1
  )
  select jsonb_build_object(
    'queue_entry', (select j from entry),
    'match', (select to_jsonb(om) from open_match om),
    'opponent', (
      select jsonb_build_object(
        'id', u.id,
        'username', u.username,
        'first_name', u.first_name,
        'rating', r.rating,
        'is_bot', u.is_bot
      )
      from open_match om
      join public.users u
        on u.id = case when om.player_a_id = p_player_id then om.player_b_id else om.player_a_id end
      left join public.player_ratings r on r.user_id = u.id
    ),
    'court', (
      select to_jsonb(c)
      from open_match om
      join public.courts_geojson c on c.id = om.court_id
    )
  );
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.matchmaking_nearest_court(extensions.geography)',
    'public.matchmaking_join(uuid, double precision, double precision, integer)',
    'public.matchmaking_leave(uuid)',
    'public.matchmaking_pair(uuid)',
    'public.matchmaking_pair_with_bot(uuid, interval)',
    'public.matchmaking_respond(uuid, uuid, boolean)',
    'public.matchmaking_state(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end;
$$;
