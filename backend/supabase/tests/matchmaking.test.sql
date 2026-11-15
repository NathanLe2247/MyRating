-- queue_entries / matches: constraints, RLS, Realtime, the Demo Tester row,
-- and the matchmaking_* pairing functions
-- (20261114130000_queue_and_matches.sql). Run against the local stack only:
--   cd backend && supabase test db --local
--
-- Locations are around the public anchor Columbia Local Park
-- (39.1022, -76.9441), which is also a real catalog court (b1...01).
-- 0.0045 deg latitude ~ 500 m.
begin;

create extension if not exists pgtap with schema extensions;

select plan(74);

-- Players, inserted as the migration owner (bypasses RLS).
insert into public.users (id, clerk_user_id, username, login_method)
values
  ('e0000000-0000-4000-8000-0000000000a1', 'user_pgtap_a', 'pgtap_a', 'email'),
  ('e0000000-0000-4000-8000-0000000000b2', 'user_pgtap_b', 'pgtap_b', 'email'),
  ('e0000000-0000-4000-8000-0000000000c3', 'user_pgtap_c', 'pgtap_c', 'email'),
  ('e0000000-0000-4000-8000-0000000000d4', 'user_pgtap_d', 'pgtap_d', 'email'),
  ('e0000000-0000-4000-8000-0000000000e5', 'user_pgtap_e', 'pgtap_e', 'email'),
  ('e0000000-0000-4000-8000-0000000000f6', 'user_pgtap_f', 'pgtap_f', 'email'),
  ('e0000000-0000-4000-8000-000000000007', 'user_pgtap_g', 'pgtap_g', 'email'),
  ('e0000000-0000-4000-8000-000000000008', 'user_pgtap_h', 'pgtap_h', 'email');

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------

select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.queue_entries_geojson'::regclass),
  'queue_entries_geojson is security_invoker'
);

select ok(
  exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ),
  'matches is in the supabase_realtime publication'
);

select ok(
  not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'queue_entries'
  ),
  'queue_entries is not published'
);

select results_eq(
  $$select clerk_user_id, username, first_name, last_name, is_bot from public.users
     where id = '00000000-0000-4000-8000-0000000000d1'$$,
  $$values ('demo_tester'::text, null::text, 'Demo'::text, 'Tester'::text, true)$$,
  'the Demo Tester exists with its fixed id, no username, is_bot'
);

select is(
  (select count(*)::int from public.users where is_bot),
  1,
  'only the Demo Tester is a bot (is_bot defaults to false)'
);

select ok(
  (select rating between 1000 and 2000 from public.player_ratings
    where user_id = '00000000-0000-4000-8000-0000000000d1'),
  'the Demo Tester has a rating row'
);

select ok(
  not has_function_privilege('authenticated', 'public.matchmaking_pair(uuid)', 'execute')
    and not has_function_privilege('anon', 'public.matchmaking_pair(uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.matchmaking_join(uuid, double precision, double precision, integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.matchmaking_respond(uuid, uuid, boolean)', 'execute')
    and not has_function_privilege('authenticated', 'public.matchmaking_pair_with_bot(uuid, interval)', 'execute')
    and not has_function_privilege('authenticated', 'public.matchmaking_state(uuid)', 'execute'),
  'clients cannot call the matchmaking functions'
);

select ok(
  has_function_privilege('service_role', 'public.matchmaking_pair(uuid)', 'execute'),
  'service_role can call the matchmaking functions'
);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.queue_entries (player_id, location, radius_m)
    values ('e0000000-0000-4000-8000-000000000008', 'SRID=4326;POINT(-76.9441 39.1022)', 0)$$,
  '23514', null, 'radius_m 0 is rejected'
);

select throws_ok(
  $$insert into public.queue_entries (player_id, location, radius_m)
    values ('e0000000-0000-4000-8000-000000000008', 'SRID=4326;POINT(-76.9441 39.1022)', 100001)$$,
  '23514', null, 'radius_m over 100 km is rejected'
);

select throws_ok(
  $$insert into public.queue_entries (player_id, location, radius_m)
    values ('e0000000-0000-4000-8000-000000000008', 'SRID=4326;POINT EMPTY', 1000)$$,
  '23514', null, 'POINT EMPTY is rejected'
);

select lives_ok(
  $$insert into public.queue_entries (player_id, location, radius_m, status)
    values ('e0000000-0000-4000-8000-000000000008', 'SRID=4326;POINT(-76.9441 39.1022)', 1000, 'left'),
           ('e0000000-0000-4000-8000-000000000008', 'SRID=4326;POINT(-76.9441 39.1022)', 1000, 'left'),
           ('e0000000-0000-4000-8000-000000000008', 'SRID=4326;POINT(-76.9441 39.1022)', 1000, 'waiting')$$,
  'old left rows sit alongside one waiting row'
);

select throws_ok(
  $$insert into public.queue_entries (player_id, location, radius_m)
    values ('e0000000-0000-4000-8000-000000000008', 'SRID=4326;POINT(-76.9441 39.1022)', 1000)$$,
  '23505', null, 'a second waiting row for the same player is rejected'
);

select throws_ok(
  $$insert into public.matches (player_a_id, player_b_id)
    values ('e0000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000008')$$,
  '23514', null, 'a match against yourself is rejected'
);

select throws_ok(
  $$insert into public.matches (player_a_id, player_b_id, reported_by)
    values ('e0000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000007',
            'e0000000-0000-4000-8000-0000000000a1')$$,
  '23514', null, 'reported_by must be one of the players'
);

select throws_ok(
  $$insert into public.matches (player_a_id, player_b_id, status, player_a_accepted_at)
    values ('e0000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000007', 'accepted', now())$$,
  '23514', null, 'accepted needs both acceptances'
);

select throws_ok(
  $$insert into public.matches (player_a_id, player_b_id, status, player_a_accepted_at, player_b_accepted_at)
    values ('e0000000-0000-4000-8000-000000000008', 'e0000000-0000-4000-8000-000000000007',
            'awaiting_confirmation', now(), now())$$,
  '23514', null, 'awaiting_confirmation needs reported_by'
);

-- Deletes: players cascade, courts set null.
insert into public.courts (id, name, location)
values ('c0000000-0000-4000-8000-0000000000aa', 'pgTAP Doomed Court', 'SRID=4326;POINT(-76.9441 39.1100)');
insert into public.matches (id, player_a_id, player_b_id, court_id)
values ('a0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000008',
        'e0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-0000000000aa');

delete from public.courts where id = 'c0000000-0000-4000-8000-0000000000aa';
select is(
  (select court_id from public.matches where id = 'a0000000-0000-4000-8000-000000000001'),
  null,
  'deleting a court clears matches.court_id'
);

delete from public.users where id = 'e0000000-0000-4000-8000-000000000008';
select is(
  (select count(*)::int from public.matches where id = 'a0000000-0000-4000-8000-000000000001'),
  0,
  'deleting a player deletes their matches'
);
select is(
  (select count(*)::int from public.queue_entries where player_id = 'e0000000-0000-4000-8000-000000000008'),
  0,
  'deleting a player deletes their queue entries'
);

-- ---------------------------------------------------------------------------
-- Pairing (as service_role, like the edge function)
-- ---------------------------------------------------------------------------
set local role service_role;

-- A at the anchor, B ~500 m north, both 1 km radius.
select lives_ok(
  $$select public.matchmaking_join('e0000000-0000-4000-8000-0000000000a1', 39.1022, -76.9441, 1000)$$,
  'A joins the queue'
);
select is(
  public.matchmaking_pair('e0000000-0000-4000-8000-0000000000a1'),
  null,
  'nobody else waiting: no match'
);

-- Rejoining updates the entry in place and keeps created_at.
update public.queue_entries set created_at = now() - interval '1 minute'
 where player_id = 'e0000000-0000-4000-8000-0000000000a1';
select public.matchmaking_join('e0000000-0000-4000-8000-0000000000a1', 39.1022, -76.9441, 2000);
select results_eq(
  $$select count(*)::int, max(radius_m), bool_and(created_at = now() - interval '1 minute')
      from public.queue_entries where player_id = 'e0000000-0000-4000-8000-0000000000a1'$$,
  $$values (1, 2000, true)$$,
  'rejoining updates the waiting entry and keeps created_at'
);
select public.matchmaking_join('e0000000-0000-4000-8000-0000000000a1', 39.1022, -76.9441, 1000);

select public.matchmaking_join('e0000000-0000-4000-8000-0000000000b2', 39.1067, -76.9441, 1000);

select is(
  public.matchmaking_state('e0000000-0000-4000-8000-0000000000b2') -> 'queue_entry' -> 'location',
  '{"type":"Point","coordinates":[-76.9441,39.1067]}'::jsonb,
  'state returns the waiting entry with a GeoJSON location'
);
select is(
  public.matchmaking_state('e0000000-0000-4000-8000-0000000000b2') -> 'match',
  'null'::jsonb,
  'state has no match while waiting'
);

create temp table ab as
  select public.matchmaking_pair('e0000000-0000-4000-8000-0000000000b2') as id;
grant select on ab to authenticated; -- read back in the RLS section

select isnt((select id from ab), null, 'B pairs with A');
select results_eq(
  $$select player_a_id, player_b_id, status::text, court_id, player_a_accepted_at, player_b_accepted_at, reported_by
      from public.matches where id = (select id from ab)$$,
  $$values ('e0000000-0000-4000-8000-0000000000a1'::uuid, 'e0000000-0000-4000-8000-0000000000b2'::uuid,
            'proposed'::text, 'b1000000-0000-4000-8000-000000000001'::uuid,
            null::timestamptz, null::timestamptz, null::uuid)$$,
  'proposed match: the found player is player_a, nearest active court to the midpoint'
);
select is(
  (select array_agg(status::text order by player_id) from public.queue_entries
    where player_id in ('e0000000-0000-4000-8000-0000000000a1', 'e0000000-0000-4000-8000-0000000000b2')),
  array['matched', 'matched'],
  'both queue entries are matched'
);
select is(
  public.matchmaking_pair('e0000000-0000-4000-8000-0000000000a1'),
  null,
  'a matched player is not paired again'
);

select results_eq(
  $$select s -> 'match' ->> 'id', s -> 'opponent' ->> 'username', s -> 'court' ->> 'name', s -> 'queue_entry'
      from (select public.matchmaking_state('e0000000-0000-4000-8000-0000000000a1') as s) x$$,
  $$select (select id::text from ab), 'pgtap_b'::text, 'Columbia Local Park'::text, 'null'::jsonb$$,
  'state returns the open match, the opponent and the court'
);

select throws_ok(
  $$select public.matchmaking_join('e0000000-0000-4000-8000-0000000000a1', 39.1022, -76.9441, 1000)$$,
  'P0001', 'match_pending', 'joining with an unanswered proposal is refused'
);

-- Accept / decline
select throws_ok(
  format($$select public.matchmaking_respond('e0000000-0000-4000-8000-0000000000c3', %L, true)$$, (select id from ab)),
  'P0001', 'match_not_found', 'a player outside the match cannot answer it'
);
select throws_ok(
  $$select public.matchmaking_respond('e0000000-0000-4000-8000-0000000000a1', 'a0000000-0000-4000-8000-00000000ffff', true)$$,
  'P0001', 'match_not_found', 'an unknown match is not found'
);

select public.matchmaking_respond('e0000000-0000-4000-8000-0000000000a1', (select id from ab), true);
select results_eq(
  $$select status::text, player_a_accepted_at is not null, player_b_accepted_at is null
      from public.matches where id = (select id from ab)$$,
  $$values ('proposed'::text, true, true)$$,
  'one acceptance keeps the match proposed'
);
select lives_ok(
  format($$select public.matchmaking_respond('e0000000-0000-4000-8000-0000000000a1', %L, true)$$, (select id from ab)),
  'accepting twice is a no-op'
);
select public.matchmaking_respond('e0000000-0000-4000-8000-0000000000b2', (select id from ab), true);
select results_eq(
  $$select status::text, player_a_accepted_at is not null, player_b_accepted_at is not null
      from public.matches where id = (select id from ab)$$,
  $$values ('accepted'::text, true, true)$$,
  'both acceptances make the match accepted'
);
select throws_ok(
  format($$select public.matchmaking_respond('e0000000-0000-4000-8000-0000000000b2', %L, false)$$, (select id from ab)),
  'P0001', 'match_not_proposed', 'an accepted match cannot be declined'
);
select is(
  public.matchmaking_state('e0000000-0000-4000-8000-0000000000b2') -> 'match' ->> 'status',
  'accepted',
  'state still shows the accepted match'
);
select throws_ok(
  $$select public.matchmaking_join('e0000000-0000-4000-8000-0000000000b2', 39.1022, -76.9441, 1000)$$,
  'P0001', 'match_open', 'joining with an accepted match is refused'
);

-- Radius: C (5 km radius) and D (1 km radius) ~2 km apart don't pair.
select public.matchmaking_join('e0000000-0000-4000-8000-0000000000c3', 39.1022, -76.9441, 5000);
select public.matchmaking_join('e0000000-0000-4000-8000-0000000000d4', 39.1202, -76.9441, 1000);
select is(
  public.matchmaking_pair('e0000000-0000-4000-8000-0000000000c3'),
  null,
  'players pair only within both radii (the smaller one decides)'
);
select is(
  public.matchmaking_pair('e0000000-0000-4000-8000-0000000000d4'),
  null,
  'same from the other side'
);

-- Nearest first: E ~300 m and F ~100 m from C; C pairs with F.
select public.matchmaking_join('e0000000-0000-4000-8000-0000000000e5', 39.1049, -76.9441, 1000);
select public.matchmaking_join('e0000000-0000-4000-8000-0000000000f6', 39.1031, -76.9441, 1000);
create temp table cf as
  select public.matchmaking_pair('e0000000-0000-4000-8000-0000000000c3') as id;
select results_eq(
  $$select player_a_id, player_b_id from public.matches where id = (select id from cf)$$,
  $$values ('e0000000-0000-4000-8000-0000000000f6'::uuid, 'e0000000-0000-4000-8000-0000000000c3'::uuid)$$,
  'the nearest waiting player is picked'
);

-- Decline
select public.matchmaking_respond('e0000000-0000-4000-8000-0000000000f6', (select id from cf), false);
select is(
  (select status::text from public.matches where id = (select id from cf)),
  'declined',
  'declining ends the match'
);
select is(
  public.matchmaking_state('e0000000-0000-4000-8000-0000000000c3') -> 'match',
  'null'::jsonb,
  'a declined match is no longer the open match'
);
select lives_ok(
  $$select public.matchmaking_join('e0000000-0000-4000-8000-0000000000c3', 39.1022, -76.9441, 1000)$$,
  'after a decline the player can rejoin'
);

-- Leave: cancels the waiting entry and unanswered proposals.
create temp table ce as
  select public.matchmaking_pair('e0000000-0000-4000-8000-0000000000c3') as id;
select results_eq(
  $$select player_a_id, player_b_id from public.matches where id = (select id from ce)$$,
  $$values ('e0000000-0000-4000-8000-0000000000e5'::uuid, 'e0000000-0000-4000-8000-0000000000c3'::uuid)$$,
  'C pairs with E'
);
select public.matchmaking_leave('e0000000-0000-4000-8000-0000000000e5');
select is(
  (select status::text from public.matches where id = (select id from ce)),
  'cancelled',
  'leaving cancels a proposed match'
);
select public.matchmaking_leave('e0000000-0000-4000-8000-0000000000d4');
select is(
  (select status::text from public.queue_entries where player_id = 'e0000000-0000-4000-8000-0000000000d4'),
  'left',
  'leaving marks the waiting entry left'
);
select public.matchmaking_leave('e0000000-0000-4000-8000-0000000000a1');
select is(
  (select status::text from public.matches where id = (select id from ab)),
  'cancelled',
  'leaving cancels an accepted match nobody has reported'
);
select lives_ok(
  $$select public.matchmaking_join('e0000000-0000-4000-8000-0000000000b2', 39.1022, -76.9441, 1000)$$,
  'after the cancel the other player can rejoin'
);
select public.matchmaking_leave('e0000000-0000-4000-8000-0000000000b2');

-- A reported match is past backing out; leave leaves it alone, and join is refused.
insert into public.matches (id, player_a_id, player_b_id, status, player_a_accepted_at, player_b_accepted_at, reported_by)
values ('a0000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-0000000000c3',
        'e0000000-0000-4000-8000-0000000000f6', 'awaiting_confirmation', now(), now(),
        'e0000000-0000-4000-8000-0000000000c3');
select public.matchmaking_leave('e0000000-0000-4000-8000-0000000000c3');
select is(
  (select status::text from public.matches where id = 'a0000000-0000-4000-8000-000000000002'),
  'awaiting_confirmation',
  'leaving does not cancel a match with a reported result'
);
select throws_ok(
  $$select public.matchmaking_join('e0000000-0000-4000-8000-0000000000c3', 39.1022, -76.9441, 1000)$$,
  'P0001', 'match_open', 'joining while awaiting confirmation is refused'
);

-- Bad input
select throws_ok(
  $$select public.matchmaking_join('e0000000-0000-4000-8000-0000000000d4', 91, 0, 1000)$$,
  '22023', 'invalid_location', 'lat out of range is rejected'
);
select throws_ok(
  $$select public.matchmaking_join('e0000000-0000-4000-8000-0000000000d4', 0, 0, 0)$$,
  '22023', 'invalid_radius', 'radius 0 is rejected'
);

-- Demo Tester: D waits; no bot before the wait is up.
select public.matchmaking_join('e0000000-0000-4000-8000-0000000000d4', 39.1202, -76.9441, 1000);
select is(
  public.matchmaking_pair_with_bot('e0000000-0000-4000-8000-0000000000d4', interval '5 seconds'),
  null,
  'the bot does not pair before the wait is up'
);
update public.queue_entries set created_at = now() - interval '6 seconds'
 where player_id = 'e0000000-0000-4000-8000-0000000000d4' and status = 'waiting';
create temp table bot as
  select public.matchmaking_pair_with_bot('e0000000-0000-4000-8000-0000000000d4', interval '5 seconds') as id;
select results_eq(
  $$select player_a_id, player_b_id, status::text, player_a_accepted_at is null, player_b_accepted_at is not null,
           court_id is not null
      from public.matches where id = (select id from bot)$$,
  $$values ('e0000000-0000-4000-8000-0000000000d4'::uuid, '00000000-0000-4000-8000-0000000000d1'::uuid,
            'proposed'::text, true, true, true)$$,
  'after the wait the bot pairs as player_b, already accepted, with a court'
);
select is(
  (select count(*)::int from public.queue_entries
    where player_id = 'e0000000-0000-4000-8000-0000000000d4' and status = 'waiting'),
  0,
  'the bot-paired entry is no longer waiting'
);
select is(
  public.matchmaking_pair_with_bot('e0000000-0000-4000-8000-0000000000d4', interval '5 seconds'),
  null,
  'the bot does not pair the same player twice'
);
select results_eq(
  $$select s ->> 'first_name', (s ->> 'is_bot')::boolean
      from (select public.matchmaking_state('e0000000-0000-4000-8000-0000000000d4') -> 'opponent' as s) x$$,
  $$values ('Demo'::text, true)$$,
  'state names the Demo Tester as the opponent and flags it as a bot'
);
select public.matchmaking_respond('e0000000-0000-4000-8000-0000000000d4', (select id from bot), true);
select is(
  (select status::text from public.matches where id = (select id from bot)),
  'accepted',
  'the player accepting a bot match makes it accepted'
);

reset role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- State now: A and B share match ab (cancelled); nobody else is in it. G (no
-- matches) gets a waiting entry here.
insert into public.queue_entries (player_id, location, radius_m)
values ('e0000000-0000-4000-8000-000000000007', 'SRID=4326;POINT(-76.9441 39.1022)', 1000);

set local role anon;

select throws_ok($$select * from public.queue_entries$$, '42501', null, 'anon cannot read queue_entries');
select throws_ok($$select * from public.queue_entries_geojson$$, '42501', null, 'anon cannot read queue_entries_geojson');
select throws_ok($$select * from public.matches$$, '42501', null, 'anon cannot read matches');

reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "user_pgtap_g", "role": "authenticated"}';

select is(
  (select count(*)::int from public.queue_entries),
  1,
  'a player sees only their own queue entries'
);
select is(
  (select location from public.queue_entries_geojson),
  '{"type":"Point","coordinates":[-76.9441,39.1022]}'::jsonb,
  'a player reads their own entry as GeoJSON through the view'
);
select is(
  (select count(*)::int from public.matches),
  0,
  'a player sees no matches they are not in'
);

set local request.jwt.claims = '{"sub": "user_pgtap_a", "role": "authenticated"}';

select is(
  (select array_agg(id) from public.matches),
  array[(select id from ab)],
  'a player sees the matches they are in'
);
select is(
  (select count(*)::int from public.queue_entries_geojson where player_id <> 'e0000000-0000-4000-8000-0000000000a1'),
  0,
  'the view hides other players'' entries'
);

set local request.jwt.claims = '{"sub": "user_pgtap_b", "role": "authenticated"}';
select is(
  (select count(*)::int from public.matches),
  1,
  'player_b sees the match too'
);

select throws_ok(
  $$insert into public.queue_entries (player_id, location, radius_m)
    values ('e0000000-0000-4000-8000-0000000000b2', 'SRID=4326;POINT(-76.9441 39.1022)', 1000)$$,
  '42501', null, 'players cannot insert queue entries'
);
select throws_ok(
  $$update public.matches set status = 'cancelled'$$,
  '42501', null, 'players cannot update matches'
);
select throws_ok(
  $$insert into public.matches (player_a_id, player_b_id)
    values ('e0000000-0000-4000-8000-0000000000b2', 'e0000000-0000-4000-8000-0000000000a1')$$,
  '42501', null, 'players cannot insert matches'
);
select throws_ok(
  $$select public.matchmaking_pair('e0000000-0000-4000-8000-0000000000b2')$$,
  '42501', null, 'players cannot call matchmaking_pair'
);

set local request.jwt.claims = '{"sub": "user_nobody", "role": "authenticated"}';
select is(
  (select count(*)::int from public.matches) + (select count(*)::int from public.queue_entries),
  0,
  'a signed-in user without a users row sees nothing'
);

reset role;

select * from finish();
rollback;
