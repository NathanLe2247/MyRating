import { z } from 'zod';

/** Postgres `uuid`. */
export const UuidSchema = z.uuid();

/** Postgres `date` as PostgREST returns it: `YYYY-MM-DD`. */
export const DateSchema = z.iso.date();

/**
 * Postgres `timestamptz` as PostgREST returns it, e.g.
 * `2026-10-06T12:00:00.123456+00:00`. Also accepts the `Z` form that
 * `Date#toISOString()` writes.
 */
export const TimestampSchema = z.iso.datetime({ offset: true });

/** Longitude in degrees, the range PostGIS `geography(..., 4326)` stores. */
export const LongitudeSchema = z.number().min(-180).max(180);

/** Latitude in degrees, the range PostGIS `geography(..., 4326)` stores. */
export const LatitudeSchema = z.number().min(-90).max(90);

/**
 * PostGIS `geography(point, 4326)` as GeoJSON, i.e. the output of
 * `ST_AsGeoJSON(location)::jsonb`. Coordinates are `[longitude, latitude]`
 * (GeoJSON order, not lat/lng). PostgREST returns a raw `geography` column as
 * WKB hex, so read points through a view or RPC that converts them.
 */
export const GeoJsonPointSchema = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([LongitudeSchema, LatitudeSchema]),
});
export type GeoJsonPoint = z.infer<typeof GeoJsonPointSchema>;
