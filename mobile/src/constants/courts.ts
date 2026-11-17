import { COURT_PHOTO_CACHE_SECONDS } from '@myrating/shared';

/**
 * Arguments for the `public.nearby_courts` RPC (see
 * agent/skills/courts-catalog). The RPC caps them at 100 000 m and 200 rows.
 */
export const NearbyCourtsRadiusMeters = 25_000;
export const NearbyCourtsMaxResults = 50;

export const MetersPerMile = 1609.344;

/** How long a device position is reused before asking the OS again. */
export const PositionStaleMs = 5 * 60 * 1000;

/** A point to search from: `lat` ±90, `lng` ±180. */
export type GeoPoint = { lat: number; lng: number };

/**
 * Where the courts list searches when location access is denied: Columbia
 * Local Park, Burtonsville, MD (a public anchor). The screen names the area
 * (`en.courts.defaultArea`) so the list isn't mistaken for the user's own.
 */
export const DefaultCourtsArea: GeoPoint = {
  lat: 39.1022,
  lng: -76.9441,
};

/** Edge function that resolves a court's Google Places photo (backend/supabase/functions/court-photo). */
export const CourtPhotoFunction = 'court-photo';

/** React Query key prefix of a court's photo (plus the court id). */
export const CourtPhotoQueryKey = 'court-photo';

/**
 * How long a fetched court photo is reused before asking the function again:
 * the function's own `Cache-Control` max-age. Every photo costs two Google
 * calls against a capped free tier (`PLACES_MONTHLY_CAPS`), so it's long. A
 * `photoUri` that stops loading sooner falls back to the card without a photo.
 */
export const CourtPhotoStaleMs = COURT_PHOTO_CACHE_SECONDS * 1000;

/**
 * How many of the nearest courts (the list is nearest first) get a photo.
 * Each photo is 2 Google calls against a 900/month cap per SKU, so a cold
 * session spends at most 2 × this (12), not 2 × every court in range (up to
 * 100). Cards past it make no request.
 */
export const CourtPhotoMaxCards = 6;
