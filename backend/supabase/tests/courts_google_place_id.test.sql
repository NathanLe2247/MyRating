-- courts.google_place_id (20261116120000_courts_google_place_id.sql): the
-- column, its exposure through courts_geojson and nearby_courts, and that
-- recreating nearby_courts kept its grants. Run against the local stack only:
--   cd backend && supabase test db --local
begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

select has_column('public', 'courts', 'google_place_id', 'courts has google_place_id');
select col_type_is('public', 'courts', 'google_place_id', 'text', 'google_place_id is text');
select col_is_null('public', 'courts', 'google_place_id', 'google_place_id is nullable');
select has_column('public', 'courts_geojson', 'google_place_id', 'courts_geojson exposes google_place_id');

select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.courts_geojson'::regclass),
  'courts_geojson is still security_invoker'
);

-- Far from the catalog and courts_rls.test.sql courts (0.009 deg lat ~ 1 km).
insert into public.courts (id, name, location, is_active, google_place_id)
values
  ('c1000000-0000-4000-8000-000000000001', 'Place Court', 'SRID=4326;POINT(10 10)', true, 'ChIJ-test-place'),
  ('c1000000-0000-4000-8000-000000000002', 'No Place Court', 'SRID=4326;POINT(10 10.009)', true, null),
  ('c1000000-0000-4000-8000-000000000003', 'Closed Place Court', 'SRID=4326;POINT(10 10.001)', false, 'ChIJ-closed');

select throws_ok(
  $$insert into public.courts (name, location, google_place_id) values ('x', 'SRID=4326;POINT(0 0)', '')$$,
  '23514', null, 'an empty google_place_id is rejected'
);
select throws_ok(
  $$insert into public.courts (name, location, google_place_id) values ('x', 'SRID=4326;POINT(0 0)', ' ChIJ-x ')$$,
  '23514', null, 'a padded google_place_id is rejected'
);

-- anon (signed out): reads it, can't write it
set local role anon;

select is(
  (select google_place_id from public.courts_geojson where id = 'c1000000-0000-4000-8000-000000000001'),
  'ChIJ-test-place',
  'anon reads google_place_id from courts_geojson'
);

select is(
  (select google_place_id from public.courts_geojson where id = 'c1000000-0000-4000-8000-000000000002'),
  null,
  'a court without a place id reads as null'
);

select is(
  (select count(*)::int from public.courts where id = 'c1000000-0000-4000-8000-000000000003'),
  0,
  'anon still cannot see an inactive court (and so its place id)'
);

select results_eq(
  $$select id, google_place_id from public.nearby_courts(10, 10, 5000)$$,
  $$values ('c1000000-0000-4000-8000-000000000001'::uuid, 'ChIJ-test-place'::text),
           ('c1000000-0000-4000-8000-000000000002'::uuid, null::text)$$,
  'anon gets google_place_id from nearby_courts, nearest first, inactive excluded'
);

select ok(
  (select distance_m between 950 and 1050 from public.nearby_courts(10, 10, 5000)
    where id = 'c1000000-0000-4000-8000-000000000002'),
  'distance_m is still metres'
);

select throws_ok(
  $$update public.courts set google_place_id = 'ChIJ-hijack' where id = 'c1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'anon cannot write google_place_id'
);

reset role;

set local role authenticated;

select throws_ok(
  $$update public.courts set google_place_id = 'ChIJ-hijack' where id = 'c1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'authenticated cannot write google_place_id'
);

reset role;

set local role service_role;

select lives_ok(
  $$update public.courts set google_place_id = 'ChIJ-updated' where id = 'c1000000-0000-4000-8000-000000000002'$$,
  'service_role can set google_place_id'
);

select is(
  (select google_place_id from public.courts where id = 'c1000000-0000-4000-8000-000000000002'),
  'ChIJ-updated',
  'the service_role update took effect'
);

reset role;

-- Recreating nearby_courts must keep it callable signed out, and not by PUBLIC.
select ok(
  has_function_privilege('anon', 'public.nearby_courts(double precision, double precision, double precision, integer)', 'execute'),
  'anon can still execute nearby_courts'
);

select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(p.proacl) a
    where p.oid = 'public.nearby_courts(double precision, double precision, double precision, integer)'::regprocedure
      and a.grantee = 0 -- PUBLIC
  ),
  'nearby_courts is still not executable by PUBLIC'
);

-- matchmaking_nearest_court calls nearby_courts; it must survive the recreate.
select is(
  public.matchmaking_nearest_court('SRID=4326;POINT(10 10)'::extensions.geography),
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'matchmaking_nearest_court still works on the new nearby_courts'
);

select * from finish();
rollback;
