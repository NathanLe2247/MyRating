---
name: courts-catalog
description: Court data shape and read patterns, shared by mobile and frontend.
---

# courts-catalog

Conventions for the `Court` shape (defined in `shared/`) and how it's queried
and displayed.

Scope: shared by `frontend/` (courts directory) and `mobile/` (courts
directory + geospatial matching input).

## Shape

- Table: `public.courts` (`backend/supabase/migrations/20261113120000_courts.sql`).
  `location` is `geography(point, 4326)` with a GiST index.
- Types: `Court` / `CourtSchema` and `NearbyCourt` / `NearbyCourtSchema` in
  `shared/src/court.ts`. `location` is GeoJSON: `{ type: 'Point',
  coordinates: [lng, lat] }`. The order is longitude first, not lat/lng.
- Use the shared types, not `supabase gen types`. Generated types make every
  view column nullable.

## Reading courts

Never select `location` from `public.courts` directly, because PostgREST
returns geography as WKB hex. Use one of these instead:

- **Lists / directory:** read the `courts_geojson` view and parse the rows with
  `CourtSchema`.
  ```ts
  const { data } = await supabase.from('courts_geojson').select('*').order('name');
  const courts = CourtSchema.array().parse(data);
  ```
- **Near me:** call the `nearby_courts` RPC and parse the rows with
  `NearbyCourtSchema`. It returns the nearest courts first, with `distance_m`
  in metres.
  ```ts
  const { data } = await supabase.rpc('nearby_courts', { lat, lng, radius_m: 25000 });
  const nearby = NearbyCourtSchema.array().parse(data);
  ```
  Arguments are `lat` (±90), `lng` (±180), `radius_m` (default 25 000, at most
  100 000) and `max_results` (default 50, at most 200). An out-of-range
  argument fails with SQLSTATE `22023`.

## Access

- Both reads work with the **anon key**, so signed-out users can browse courts
  near them. This is the one place in the app that doesn't need sign-in.
- Clients (anon or signed in) only see **active** courts: the RLS policy is
  `using (is_active)`, and `nearby_courts` also filters on `is_active`.
- Only the service role writes, and it writes to `public.courts` (the view is
  read-only).

## Photos

- Court photos come only from **Google Places Photos**. Never copy photos
  from park websites or image search into the repo or R2: we don't have
  rights to them.
- `courts.google_place_id` (nullable, `20261116120000_courts_google_place_id.sql`)
  is the only Places data stored, because Google allows storing Place IDs and
  forbids caching photo names or URLs. It's returned by `courts_geojson` and
  `nearby_courts` (`Court.google_place_id`). Null means no confident match,
  so no photo.
- To show a photo, call the `court-photo` edge function (anon key works):
  `GET /functions/v1/court-photo?court_id=<uuid>`. Parse a 200 with
  `CourtPhotoResponseSchema` (`shared/src/court-photo.ts`). Any non-200
  (404 no place/photo/key, 502 Google error) means show the card without a
  photo. Responses carry `Cache-Control: max-age=3600`; keep `photoUri` in
  memory only (e.g. React Query keyed by court id), never persist it.
- Always show the attributions with the photo ("Photo: <displayName>",
  linking to `uri` when it's not null). Google's terms require it.
- Finding Place IDs: Places API (New) Text Search with the court name and
  its location as a location bias. Write them in a data migration (catalog
  courts reach the hosted project through migrations), and leave unconfident
  matches null.

TODO: source of truth for court data (manual entry vs. import), richer
catalog fields, and how `geospatial-matching` consumes courts.
