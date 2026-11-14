/**
 * Arguments for the `public.nearby_courts` RPC (see
 * agent/skills/courts-catalog). The RPC caps them at 100 000 m and 200 rows.
 */
export const NearbyCourtsRadiusMeters = 25_000;
export const NearbyCourtsMaxResults = 50;

export const MetersPerMile = 1609.344;

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
