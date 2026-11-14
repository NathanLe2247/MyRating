-- Catalog data, not test data: real public parks in eastern Montgomery
-- County, MD (Burtonsville / Colesville / Fairland / Calverton / Norbeck)
-- that have pickleball, so the hosted "Courts near you" demo area has rows.
--
-- Pickleball availability: Montgomery Parks pickleball page
-- (https://montgomeryparks.org/parks-and-trails/pickleball-courts/,
-- checked 2026-11-14). Dedicated courts at Columbia and East Norbeck; the
-- rest are tennis courts striped for pickleball (shared net).
-- Coordinates: OpenStreetMap park location (Nominatim), so they mark the
-- park, not the individual court.
--
-- Fixed ids, so backend/supabase/tests/courts_seed.test.sql can check them and
-- re-running is a no-op. location is geography(point, 4326): POINT(lng lat).

insert into public.courts (id, name, location, is_active)
values
  ('b1000000-0000-4000-8000-000000000001', 'Columbia Local Park',         'SRID=4326;POINT(-76.9441273 39.1022133)', true),
  ('b1000000-0000-4000-8000-000000000002', 'Good Hope Local Park',        'SRID=4326;POINT(-76.9854361 39.0961313)', true),
  ('b1000000-0000-4000-8000-000000000003', 'Cloverly Local Park',         'SRID=4326;POINT(-76.9922888 39.1073665)', true),
  ('b1000000-0000-4000-8000-000000000004', 'Peachwood Neighborhood Park', 'SRID=4326;POINT(-76.9973713 39.0973104)', true),
  ('b1000000-0000-4000-8000-000000000005', 'Fairland Recreational Park',  'SRID=4326;POINT(-76.9250284 39.0923775)', true),
  ('b1000000-0000-4000-8000-000000000006', 'Calverton-Galway Local Park', 'SRID=4326;POINT(-76.9499646 39.0640691)', true),
  ('b1000000-0000-4000-8000-000000000007', 'Meadowood Local Park',        'SRID=4326;POINT(-77.0034418 39.0630336)', true),
  ('b1000000-0000-4000-8000-000000000008', 'East Norbeck Local Park',     'SRID=4326;POINT(-77.0647272 39.1141337)', true)
on conflict (id) do nothing;
