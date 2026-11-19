-- Backfill courts.google_place_id (20261116120000) for the catalog courts
-- inserted by 20261114120000_courts_silver_spring.sql, so court-photo can
-- find a photo for them (#110). Only Place IDs are stored (Google allows it).
--
-- How they were found (2026-11-17, one request per court, $0): Places API
-- (New) Text Search, field mask `places.id` only (the "Text Search
-- Essentials (IDs Only)" SKU, unlimited free; displayName and location
-- would bill Text Search Pro), body:
--   textQuery = the court name, includedType = 'park',
--   strictTypeFiltering = true, pageSize = 5,
--   locationBias = 500 m circle around the court's coordinates.
-- Accepted only when exactly one park came back and the location encoded in
-- the Place ID (its S2 cell) is within 200 m of the court's coordinates.
-- Left null (no confident match):
--   Peachwood Neighborhood Park (…04): the one result is ~8 km away.
--   Fairland Recreational Park (…05): four parks came back, 0.5-1.4 km away,
--     none clearly the park itself.
--
-- `google_place_id is null` so a re-run (or a hand-set ID on the hosted
-- project) is never overwritten.

update public.courts set google_place_id = 'ChIJ_0XKchXbt4kRN1XsMDJa25o'
  where id = 'b1000000-0000-4000-8000-000000000001' and google_place_id is null; -- Columbia Local Park, ~50 m
update public.courts set google_place_id = 'ChIJ4cipz8fat4kR5rDr-wVJ-w4'
  where id = 'b1000000-0000-4000-8000-000000000002' and google_place_id is null; -- Good Hope Local Park, ~35 m
update public.courts set google_place_id = 'ChIJJY3v5pXat4kRpQgLq2Qj5LQ'
  where id = 'b1000000-0000-4000-8000-000000000003' and google_place_id is null; -- Cloverly Local Park, ~35 m
update public.courts set google_place_id = 'ChIJZZqXvsPEt4kRDXhlkSR9HUM'
  where id = 'b1000000-0000-4000-8000-000000000006' and google_place_id is null; -- Calverton-Galway Local Park, ~105 m
update public.courts set google_place_id = 'ChIJ7Y8A5GbFt4kRLWyDdaMP3KA'
  where id = 'b1000000-0000-4000-8000-000000000007' and google_place_id is null; -- Meadowood Local Park, ~100 m
update public.courts set google_place_id = 'ChIJFfr9rsnRt4kRv-an6kufDz0'
  where id = 'b1000000-0000-4000-8000-000000000008' and google_place_id is null; -- East Norbeck Local Park, ~180 m
