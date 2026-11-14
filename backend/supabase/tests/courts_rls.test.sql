-- RLS, grants and the nearby_courts RPC for public.courts
-- (20261113120000_courts.sql). Run against the local stack only:
--   cd backend && supabase test db --local
begin;

create extension if not exists pgtap with schema extensions;

select plan(45);

-- If the view ran as its owner (security definer), it would bypass the
-- caller's grants and RLS, and every read assertion below would still pass.
select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.courts_geojson'::regclass),
  'courts_geojson is security_invoker'
);

-- Seeded as the migration owner, which bypasses RLS. All on the same
-- meridian so distances are easy to reason about (0.009 deg lat ~ 1 km).
--   ...01  origin                     active
--   ...03  ~1 km north                active
--   ...04  ~70 m north                INACTIVE
--   ...05  ~50 km north               active
insert into public.courts (id, name, location, is_active)
values
  ('c0000000-0000-4000-8000-000000000001', 'pgTAP Test Court', 'SRID=4326;POINT(-122.4862 37.7694)', true),
  ('c0000000-0000-4000-8000-000000000003', 'One Km Court', 'SRID=4326;POINT(-122.4862 37.7784)', true),
  ('c0000000-0000-4000-8000-000000000004', 'Closed Court', 'SRID=4326;POINT(-122.4862 37.7700)', false),
  ('c0000000-0000-4000-8000-000000000005', 'Fifty Km Court', 'SRID=4326;POINT(-122.4862 38.2194)', true);

-- anon: read active courts only, write nothing
set local role anon;

select is(
  (select count(*)::int from public.courts where id = 'c0000000-0000-4000-8000-000000000001'),
  1,
  'anon can select an active court from public.courts'
);

select is(
  (select location from public.courts_geojson where id = 'c0000000-0000-4000-8000-000000000001'),
  '{"type":"Point","coordinates":[-122.4862,37.7694]}'::jsonb,
  'anon reads location as a GeoJSON [lng, lat] point from courts_geojson'
);

select is(
  (select count(*)::int from public.courts where id = 'c0000000-0000-4000-8000-000000000004'),
  0,
  'anon cannot see an inactive court in public.courts'
);

select is(
  (select count(*)::int from public.courts_geojson where id = 'c0000000-0000-4000-8000-000000000004'),
  0,
  'anon cannot see an inactive court in courts_geojson'
);

select throws_ok(
  $$insert into public.courts (name, location) values ('anon court', 'SRID=4326;POINT(0 0)')$$,
  '42501',
  null,
  'anon cannot insert into public.courts'
);

select throws_ok(
  $$update public.courts set name = 'renamed' where id = 'c0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'anon cannot update public.courts'
);

select throws_ok(
  $$delete from public.courts where id = 'c0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'anon cannot delete from public.courts'
);

select throws_ok(
  $$update public.courts_geojson set name = 'renamed' where id = 'c0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'anon cannot write through courts_geojson'
);

reset role;

-- authenticated (any Clerk-signed-in user): same as anon
set local role authenticated;

select is(
  (select count(*)::int from public.courts_geojson where id = 'c0000000-0000-4000-8000-000000000001'),
  1,
  'authenticated can select an active court from courts_geojson'
);

select is(
  (select count(*)::int from public.courts where id = 'c0000000-0000-4000-8000-000000000004'),
  0,
  'authenticated cannot see an inactive court in public.courts'
);

select is(
  (select count(*)::int from public.courts_geojson where id = 'c0000000-0000-4000-8000-000000000004'),
  0,
  'authenticated cannot see an inactive court in courts_geojson'
);

select throws_ok(
  $$insert into public.courts (name, location) values ('user court', 'SRID=4326;POINT(0 0)')$$,
  '42501',
  null,
  'authenticated cannot insert into public.courts'
);

select throws_ok(
  $$update public.courts set is_active = false where id = 'c0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'authenticated cannot update public.courts'
);

select throws_ok(
  $$delete from public.courts where id = 'c0000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'authenticated cannot delete from public.courts'
);

reset role;

-- service_role: sees inactive courts; writes checked by their effect
-- (lives_ok alone passes on 0 rows)
set local role service_role;

select is(
  (select count(*)::int from public.courts where id = 'c0000000-0000-4000-8000-000000000004'),
  1,
  'service_role can see an inactive court in public.courts'
);

select is(
  (select count(*)::int from public.courts_geojson where id = 'c0000000-0000-4000-8000-000000000004'),
  1,
  'service_role can see an inactive court in courts_geojson'
);

select lives_ok(
  $$insert into public.courts (id, name, location)
    values ('c0000000-0000-4000-8000-000000000002', 'service court', 'SRID=4326;POINT(-73.9857 40.7484)')$$,
  'service_role can insert into public.courts'
);

select is(
  (select location from public.courts_geojson where id = 'c0000000-0000-4000-8000-000000000002'),
  '{"type":"Point","coordinates":[-73.9857,40.7484]}'::jsonb,
  'the service_role insert is visible'
);

select lives_ok(
  $$update public.courts set is_active = false where id = 'c0000000-0000-4000-8000-000000000002'$$,
  'service_role can update public.courts'
);

select is(
  (select is_active from public.courts where id = 'c0000000-0000-4000-8000-000000000002'),
  false,
  'the service_role update took effect'
);

select lives_ok(
  $$delete from public.courts where id = 'c0000000-0000-4000-8000-000000000002'$$,
  'service_role can delete from public.courts'
);

select is(
  (select count(*)::int from public.courts where id = 'c0000000-0000-4000-8000-000000000002'),
  0,
  'the service_role delete took effect'
);

reset role;

-- Constraints that keep rows parseable by CourtSchema.
select throws_ok(
  $$insert into public.courts (name, location) values ('', 'SRID=4326;POINT(0 0)')$$,
  '23514',
  null,
  'empty court name is rejected'
);

-- POINT EMPTY would serialize as `coordinates: []`.
select throws_ok(
  $$insert into public.courts (name, location) values ('nowhere', 'SRID=4326;POINT EMPTY')$$,
  '23514',
  null,
  'empty point location is rejected'
);

-- nearby_courts: grants
select ok(
  has_function_privilege('anon', 'public.nearby_courts(double precision, double precision, double precision, integer)', 'execute'),
  'anon can execute nearby_courts'
);

select ok(
  not exists (
    select 1
    from pg_proc p, aclexplode(p.proacl) a
    where p.oid = 'public.nearby_courts(double precision, double precision, double precision, integer)'::regprocedure
      and a.grantee = 0 -- PUBLIC
  ),
  'nearby_courts is not executable by PUBLIC'
);

-- nearby_courts: results, called as anon (signed out)
set local role anon;

select results_eq(
  $$select id from public.nearby_courts(37.7694, -122.4862)$$,
  $$values ('c0000000-0000-4000-8000-000000000001'::uuid), ('c0000000-0000-4000-8000-000000000003'::uuid)$$,
  'default 25 km radius: nearest first, far and inactive courts excluded'
);

select results_eq(
  $$select id from public.nearby_courts(37.7784, -122.4862)$$,
  $$values ('c0000000-0000-4000-8000-000000000003'::uuid), ('c0000000-0000-4000-8000-000000000001'::uuid)$$,
  'ordering follows distance from the given origin'
);

select results_eq(
  $$select id from public.nearby_courts(37.7694, -122.4862, 100000)$$,
  $$values ('c0000000-0000-4000-8000-000000000001'::uuid),
           ('c0000000-0000-4000-8000-000000000003'::uuid),
           ('c0000000-0000-4000-8000-000000000005'::uuid)$$,
  '100 km radius includes the 50 km court'
);

select results_eq(
  $$select id from public.nearby_courts(37.7694, -122.4862, 500)$$,
  $$values ('c0000000-0000-4000-8000-000000000001'::uuid)$$,
  '500 m radius excludes the 1 km court'
);

select results_eq(
  $$select id from public.nearby_courts(37.7694, -122.4862, max_results => 1)$$,
  $$values ('c0000000-0000-4000-8000-000000000001'::uuid)$$,
  'max_results limits the rows'
);

select is(
  (select distance_m from public.nearby_courts(37.7694, -122.4862) where id = 'c0000000-0000-4000-8000-000000000001'),
  0::double precision,
  'distance_m is 0 at the origin'
);

select ok(
  (select distance_m between 950 and 1050 from public.nearby_courts(37.7694, -122.4862) where id = 'c0000000-0000-4000-8000-000000000003'),
  'distance_m is metres (~1 km court)'
);

select is(
  (select location from public.nearby_courts(37.7694, -122.4862) where id = 'c0000000-0000-4000-8000-000000000003'),
  '{"type":"Point","coordinates":[-122.4862,37.7784]}'::jsonb,
  'nearby_courts returns location as GeoJSON'
);

-- nearby_courts: bad input is rejected with 22023
select throws_ok($$select * from public.nearby_courts(91, 0)$$, '22023', null, 'lat > 90 is rejected');
select throws_ok($$select * from public.nearby_courts(null, 0)$$, '22023', null, 'null lat is rejected');
select throws_ok($$select * from public.nearby_courts('NaN', 0)$$, '22023', null, 'NaN lat is rejected');
select throws_ok($$select * from public.nearby_courts(0, -181)$$, '22023', null, 'lng < -180 is rejected');
select throws_ok($$select * from public.nearby_courts(0, 0, 0)$$, '22023', null, 'radius 0 is rejected');
select throws_ok($$select * from public.nearby_courts(0, 0, 100001)$$, '22023', null, 'radius over 100 km is rejected');
select throws_ok($$select * from public.nearby_courts(0, 0, 1000, 0)$$, '22023', null, 'max_results 0 is rejected');
select throws_ok($$select * from public.nearby_courts(0, 0, 1000, 201)$$, '22023', null, 'max_results over 200 is rejected');

reset role;

-- nearby_courts: authenticated can call it; service_role still gets no
-- inactive courts (explicit filter, since it bypasses RLS)
set local role authenticated;

select results_eq(
  $$select id from public.nearby_courts(37.7694, -122.4862)$$,
  $$values ('c0000000-0000-4000-8000-000000000001'::uuid), ('c0000000-0000-4000-8000-000000000003'::uuid)$$,
  'authenticated can call nearby_courts'
);

reset role;
set local role service_role;

select ok(
  not exists (
    select 1 from public.nearby_courts(37.7694, -122.4862) where id = 'c0000000-0000-4000-8000-000000000004'
  ),
  'nearby_courts excludes inactive courts for service_role too'
);

reset role;

select * from finish();
rollback;
