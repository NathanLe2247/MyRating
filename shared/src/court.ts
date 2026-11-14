import { z } from 'zod';

import { GeoJsonPointSchema, TimestampSchema, UuidSchema } from './common.ts';

/**
 * A row of the `public.courts_geojson` view (20261113120000_courts.sql): the
 * `public.courts` table with `location` converted to GeoJSON. Read courts
 * from that view, not from `public.courts`, whose `location` PostgREST
 * returns as WKB hex.
 *
 * Intentionally minimal until the courts catalog is designed (see
 * agent/skills/courts-catalog). Change this and the migration together.
 */
export const CourtSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1),
  location: GeoJsonPointSchema,
  is_active: z.boolean(),
  created_at: TimestampSchema,
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
