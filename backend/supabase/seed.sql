-- Local development seed, loaded by `supabase db reset` ([db.seed] in
-- config.toml). Never applied to the hosted project: the deploy workflow runs
-- `supabase db push` without --include-seed.
--
-- Sample pickleball courts around downtown Austin, TX (30.2672, -97.7431),
-- the default "Courts near you" area, so the courts screens have rows locally.
-- Fixed ids so tests can refer to them (backend/supabase/tests/courts_seed.test.sql).
-- Locations are approximate, for development only.
--
-- location is geography(point, 4326): EWKT is POINT(lng lat), longitude first.

insert into public.courts (id, name, location, is_active)
values
  -- active, nearest first from downtown
  ('a5000000-0000-4000-8000-000000000001', 'Butler Park Pickleball',             'SRID=4326;POINT(-97.7520 30.2625)', true),
  ('a5000000-0000-4000-8000-000000000002', 'Pease District Park Courts',         'SRID=4326;POINT(-97.7550 30.2850)', true),
  ('a5000000-0000-4000-8000-000000000003', 'Zilker Park Pickleball',             'SRID=4326;POINT(-97.7729 30.2669)', true),
  ('a5000000-0000-4000-8000-000000000004', 'Givens District Park Courts',        'SRID=4326;POINT(-97.6900 30.2800)', true),
  ('a5000000-0000-4000-8000-000000000005', 'Mueller Lake Park Courts',           'SRID=4326;POINT(-97.7065 30.3090)', true),
  ('a5000000-0000-4000-8000-000000000006', 'South Austin Recreation Center',     'SRID=4326;POINT(-97.7890 30.2290)', true),
  ('a5000000-0000-4000-8000-000000000007', 'North Austin Pickleball Ranch',      'SRID=4326;POINT(-97.7180 30.3960)', true),
  -- inactive, and the closest to downtown, so a leak past the active-only RLS
  -- policy or nearby_courts filter would show up first
  ('a5000000-0000-4000-8000-000000000099', 'Downtown Rooftop Courts (closed)',   'SRID=4326;POINT(-97.7440 30.2700)', false)
on conflict (id) do nothing;
