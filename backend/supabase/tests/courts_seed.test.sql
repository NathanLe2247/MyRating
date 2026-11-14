-- Local seed data for public.courts (backend/supabase/seed.sql), checked
-- through nearby_courts and the active-only RLS policy. Needs a seeded local
-- database, so run it after a reset:
--   cd backend && supabase db reset --local && supabase test db --local
begin;

create extension if not exists pgtap with schema extensions;

select plan(6);

-- As the migration owner (bypasses RLS): the seed loaded every row,
-- including the inactive court.
select is(
  (select count(*)::int from public.courts where id::text like 'a5000000-%' and is_active),
  7,
  'seed has 7 active Austin courts'
);

select is(
  (select is_active from public.courts where id = 'a5000000-0000-4000-8000-000000000099'),
  false,
  'seed has the inactive Austin court'
);

-- Signed out, from downtown Austin (the app's default area): every active
-- seeded court, nearest first; the inactive one (closest of all) is not there.
set local role anon;

select results_eq(
  $$select id from public.nearby_courts(30.2672, -97.7431, 25000, 50)$$,
  $$values ('a5000000-0000-4000-8000-000000000001'::uuid),
           ('a5000000-0000-4000-8000-000000000002'::uuid),
           ('a5000000-0000-4000-8000-000000000003'::uuid),
           ('a5000000-0000-4000-8000-000000000004'::uuid),
           ('a5000000-0000-4000-8000-000000000005'::uuid),
           ('a5000000-0000-4000-8000-000000000006'::uuid),
           ('a5000000-0000-4000-8000-000000000007'::uuid)$$,
  'anon: nearby_courts from downtown Austin returns the active seeded courts, nearest first'
);

select is(
  (select count(*)::int from public.courts_geojson where id = 'a5000000-0000-4000-8000-000000000099'),
  0,
  'anon cannot see the inactive seeded court in courts_geojson'
);

reset role;

set local role authenticated;

select results_eq(
  $$select id from public.nearby_courts(30.2672, -97.7431, 25000, 50)$$,
  $$values ('a5000000-0000-4000-8000-000000000001'::uuid),
           ('a5000000-0000-4000-8000-000000000002'::uuid),
           ('a5000000-0000-4000-8000-000000000003'::uuid),
           ('a5000000-0000-4000-8000-000000000004'::uuid),
           ('a5000000-0000-4000-8000-000000000005'::uuid),
           ('a5000000-0000-4000-8000-000000000006'::uuid),
           ('a5000000-0000-4000-8000-000000000007'::uuid)$$,
  'authenticated: same active seeded courts, nearest first'
);

reset role;

-- service_role bypasses RLS; nearby_courts still filters inactive courts.
set local role service_role;

select ok(
  not exists (
    select 1 from public.nearby_courts(30.2672, -97.7431, 25000, 50)
    where id = 'a5000000-0000-4000-8000-000000000099'
  ),
  'service_role: nearby_courts excludes the inactive seeded court'
);

reset role;

select * from finish();
rollback;
