-- Demo-area courts: the real courts from 20261114120000_courts_silver_spring.sql
-- plus the inactive test court in backend/supabase/seed.sql, checked through
-- nearby_courts and the active-only RLS policy. Needs a seeded local
-- database, so run it after a reset:
--   cd backend && supabase db reset --local && supabase test db --local
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- As the migration owner (bypasses RLS): the migration and seed loaded.
select is(
  (select count(*)::int from public.courts where id::text like 'b1000000-%' and is_active),
  8,
  'migration has 8 active demo-area courts'
);

select is(
  (select is_active from public.courts where id = 'a5000000-0000-4000-8000-000000000099'),
  false,
  'seed has the inactive test court'
);

-- Signed out, from the test origin (39.1022, -76.9441, by Columbia Local
-- Park): every active demo court, nearest first; the inactive one (at the
-- origin, closest of all) is not there.
set local role anon;

select results_eq(
  $$select id from public.nearby_courts(39.1022, -76.9441, 25000, 50)$$,
  $$values ('b1000000-0000-4000-8000-000000000001'::uuid), -- Columbia, ~3 m
           ('b1000000-0000-4000-8000-000000000005'::uuid), -- Fairland, ~2.0 km
           ('b1000000-0000-4000-8000-000000000002'::uuid), -- Good Hope, ~3.6 km
           ('b1000000-0000-4000-8000-000000000003'::uuid), -- Cloverly, ~4.2 km
           ('b1000000-0000-4000-8000-000000000006'::uuid), -- Calverton-Galway, ~4.3 km
           ('b1000000-0000-4000-8000-000000000004'::uuid), -- Peachwood, ~4.6 km
           ('b1000000-0000-4000-8000-000000000007'::uuid), -- Meadowood, ~6.7 km
           ('b1000000-0000-4000-8000-000000000008'::uuid)$$, -- East Norbeck, ~10.5 km
  'anon: nearby_courts from the test origin returns the active demo courts, nearest first'
);

select is(
  (select count(*)::int from public.courts_geojson where id = 'a5000000-0000-4000-8000-000000000099'),
  0,
  'anon cannot see the inactive test court in courts_geojson'
);

reset role;

set local role authenticated;

select results_eq(
  $$select id from public.nearby_courts(39.1022, -76.9441, 25000, 50)$$,
  $$values ('b1000000-0000-4000-8000-000000000001'::uuid), -- Columbia, ~3 m
           ('b1000000-0000-4000-8000-000000000005'::uuid), -- Fairland, ~2.0 km
           ('b1000000-0000-4000-8000-000000000002'::uuid), -- Good Hope, ~3.6 km
           ('b1000000-0000-4000-8000-000000000003'::uuid), -- Cloverly, ~4.2 km
           ('b1000000-0000-4000-8000-000000000006'::uuid), -- Calverton-Galway, ~4.3 km
           ('b1000000-0000-4000-8000-000000000004'::uuid), -- Peachwood, ~4.6 km
           ('b1000000-0000-4000-8000-000000000007'::uuid), -- Meadowood, ~6.7 km
           ('b1000000-0000-4000-8000-000000000008'::uuid)$$, -- East Norbeck, ~10.5 km
  'authenticated: same active demo courts, nearest first'
);

reset role;

-- service_role bypasses RLS; nearby_courts still filters inactive courts.
set local role service_role;

select ok(
  not exists (
    select 1 from public.nearby_courts(39.1022, -76.9441, 25000, 50)
    where id = 'a5000000-0000-4000-8000-000000000099'
  ),
  'service_role: nearby_courts excludes the inactive test court'
);

reset role;

select * from finish();
rollback;
