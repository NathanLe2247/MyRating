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
  (404 no place/photo, 503 no key configured, 502 Google error) means show
  the card without a photo. 200s and 404s carry
  `Cache-Control: private, max-age=3600`; keep `photoUri` in memory only
  (e.g. React Query keyed by court id), never persist it. Google doesn't
  document how long `photoUri` stays valid, so handle the image failing to
  load the same way as no photo.
- **Photos must never cost money.** `court-photo` caps its Google calls
  below the free monthly usage: `PLACES_MONTHLY_CAPS` (900 each for Place
  Details and Place Photo, against 1,000 free), counted per UTC calendar
  month in `public.places_usage` through `public.places_reserve_call`
  (service role only). Once a cap is reached the function skips Google
  and returns 404 until the next month, so clients see "no photo". Don't
  raise a cap above the SKU's free threshold, and don't add fields to the
  Place Details field mask (`photos` only), because extra fields can bill
  a pricier SKU. Any other Places use (e.g. a Text Search backfill) runs
  by hand with a local key and is not covered by this counter.
- Always show the attributions with the photo ("Photo: <displayName>",
  linking to `uri` when it's not null), plus a "Google Maps" source label:
  Places (New) policy requires it wherever Places content appears outside
  a Google map. Google's terms require both.
- "Never persist" includes the image bytes: render the photo with an
  in-memory image cache only (mobile's expo-image `<Image>` uses
  `cachePolicy="memory"`; its default `'disk'` survives restarts). On the
  web, don't put the photo through a service worker or any persistent
  cache.
- Clients treat every failure as "no photo" and keep that result as long
  as a photo (mobile: `useCourtPhoto`, no retries, no refetch on remount
  or reconnect), since a failed request can already have spent a capped
  Google call.
- **Finding Place IDs** (the catalog courts are backfilled by
  `20261117150000_courts_backfill_place_ids.sql`: 6 of 8; Peachwood and
  Fairland stay null because no match was confident). To add more:
  - Run by hand with the key from the gitignored
    `backend/supabase/functions/.env`, sent only in the `X-Goog-Api-Key`
    header (never in a URL, log or commit). One request per court.
  - Use only `POST https://places.googleapis.com/v1/places:searchText` with
    `X-Goog-FieldMask: places.id`. That is the "Text Search Essentials (IDs
    Only)" SKU, which is unlimited free. Adding `places.displayName` or
    `places.location` bills Text Search Pro, and Place Details is capped
    for `court-photo`, so don't use either for lookups.
  - Body: `textQuery` = the court name, `includedType: "park"`,
    `strictTypeFiltering: true`, `pageSize: 5`, `locationBias` = a 500 m
    circle around the court's coordinates.
  - Since the response has no name or location, judge confidence by: exactly
    one park comes back, and the location encoded in the Place ID is close.
    A `ChIJ…` ID is base64url protobuf whose first fixed64 (bytes 3–10,
    little-endian) is a level-30 S2 cell id; decode it to lat/lng (e.g. the
    `s2sphere` Python package) and accept only within ~200 m of the court.
    This encoding is undocumented, so it is a sanity check, not a guarantee.
    Anything else stays null.
  - Write the IDs in a new data migration
    (`update public.courts set google_place_id = '<id>' where id = '<uuid>'
    and google_place_id is null`), since catalog courts reach the hosted
    project through migrations, and extend
    `backend/supabase/tests/courts_place_ids_backfill.test.sql`.

TODO: source of truth for court data (manual entry vs. import), richer
catalog fields, and how `geospatial-matching` consumes courts.
