-- RLS and grants for public.courts / public.courts_geojson
-- (20261113120000_courts.sql). Run against the local stack only:
--   cd backend && supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(19);

-- If the view ran as its owner (security definer), it would bypass the
-- caller's grants and RLS, and every read assertion below would still pass.
select ok(
  (select reloptions @> array['security_invoker=true'] from pg_class where oid = 'public.courts_geojson'::regclass),
  'courts_geojson is security_invoker'
);

-- Seeded as the migration owner, which bypasses RLS.
insert into public.courts (id, name, location)
values (
  'c0000000-0000-4000-8000-000000000001',
  'pgTAP Test Court',
  'SRID=4326;POINT(-122.4862 37.7694)'
);

-- anon: read yes, write no
set local role anon;

select is(
  (select count(*)::int from public.courts where id = 'c0000000-0000-4000-8000-000000000001'),
  1,
  'anon can select from public.courts'
);

select is(
  (select location from public.courts_geojson where id = 'c0000000-0000-4000-8000-000000000001'),
  '{"type":"Point","coordinates":[-122.4862,37.7694]}'::jsonb,
  'anon reads location as a GeoJSON [lng, lat] point from courts_geojson'
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

-- authenticated (any Clerk-signed-in user): read yes, write no
set local role authenticated;

select is(
  (select count(*)::int from public.courts_geojson where id = 'c0000000-0000-4000-8000-000000000001'),
  1,
  'authenticated can select from courts_geojson'
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

-- service_role: writes, checked by their effect (lives_ok alone passes on 0 rows)
set local role service_role;

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

-- Schema-level guard that matches CourtSchema's name.min(1).
select throws_ok(
  $$insert into public.courts (name, location) values ('', 'SRID=4326;POINT(0 0)')$$,
  '23514',
  null,
  'empty court name is rejected'
);

-- POINT EMPTY would serialize as `coordinates: []`, which CourtSchema rejects.
select throws_ok(
  $$insert into public.courts (name, location) values ('nowhere', 'SRID=4326;POINT EMPTY')$$,
  '23514',
  null,
  'empty point location is rejected'
);

select * from finish();
rollback;
