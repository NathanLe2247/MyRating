-- RLS and grants for public.courts / public.courts_geojson
-- (20261113120000_courts.sql). Run against the local stack only:
--   cd backend && supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(12);

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

reset role;

-- service_role: writes
set local role service_role;

select lives_ok(
  $$insert into public.courts (name, location) values ('service court', 'SRID=4326;POINT(-73.9857 40.7484)')$$,
  'service_role can insert into public.courts'
);

select lives_ok(
  $$update public.courts set is_active = false where name = 'service court'$$,
  'service_role can update public.courts'
);

reset role;

-- Schema-level guard that matches CourtSchema's name.min(1).
select throws_ok(
  $$insert into public.courts (name, location) values ('', 'SRID=4326;POINT(0 0)')$$,
  '23514',
  null,
  'empty court name is rejected'
);

select * from finish();
rollback;
