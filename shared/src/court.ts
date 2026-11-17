import { z } from 'zod';

import { GeoJsonPointSchema, TimestampSchema, UuidSchema } from './common.ts';

/**
 * A Google Places (New) place id (`courts.google_place_id`,
 * 20261116120000_courts_google_place_id.sql). Opaque, never empty or padded
 * with whitespace: the same `^\S(.*\S)?$` pattern as that column's check.
 * It is the only Places data we store: photo names and URLs expire and
 * Google's terms forbid caching them, so the `court-photo` edge function
 * resolves a fresh photo from this id on each request.
 */
export const GooglePlaceIdSchema = z
  .string()
  .regex(/^\S(.*\S)?$/s, 'must be non-empty with no leading or trailing whitespace');

/**
 * A row of the `public.courts_geojson` view (20261113120000_courts.sql): the
 * `public.courts` table with `location` converted to GeoJSON. Read courts
 * from that view, not from `public.courts`, whose `location` PostgREST
 * returns as WKB hex.
 *
 * Intentionally minimal until the courts catalog is designed (see
 * agent/skills/courts-catalog). Change this and the migration together.
 *
 * `google_place_id` is null when the court has no confident Places match
 * (then it has no photo). The view, the RPC and the matchmaking state's
 * `court` always include it, so it's required (nullable, not optional).
 */
export const CourtSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1),
  location: GeoJsonPointSchema,
  is_active: z.boolean(),
  created_at: TimestampSchema,
  google_place_id: GooglePlaceIdSchema.nullable(),
});
export type Court = z.infer<typeof CourtSchema>;

/**
 * A row of the `public.nearby_courts(lat, lng, radius_m, max_results)` RPC:
 * a court plus its distance in metres from the requested point. Rows arrive
 * nearest first, and only active courts are returned.
 */
export const NearbyCourtSchema = CourtSchema.extend({
  distance_m: z.number().nonnegative(),
});
export type NearbyCourt = z.infer<typeof NearbyCourtSchema>;
