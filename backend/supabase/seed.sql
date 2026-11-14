-- Local development seed, loaded by `supabase db reset` ([db.seed] in
-- config.toml). Never applied to the hosted project: the deploy workflow runs
-- `supabase db push` without --include-seed.
--
-- Real courts for the demo area come from the migration
-- 20261114120000_courts_silver_spring.sql (applied everywhere). This file
-- only adds an inactive test court at the test origin (39.1022, -76.9441,
-- by Columbia Local Park), closer than any real court, so a leak past the active-only RLS policy or the nearby_courts
-- filter would come back first (backend/supabase/tests/courts_seed.test.sql).
--
-- location is geography(point, 4326): EWKT is POINT(lng lat), longitude first.

insert into public.courts (id, name, location, is_active)
values
  ('a5000000-0000-4000-8000-000000000099', 'Closed Test Court', 'SRID=4326;POINT(-76.9441 39.1022)', false)
on conflict (id) do nothing;
