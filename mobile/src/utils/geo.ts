import type { GeoPoint } from '@/constants/courts';

/** Mean Earth radius, in metres (the haversine convention). */
const EarthRadiusMeters = 6_371_008.8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance between two points, in metres. For display only
 * (e.g. how far a suggested court is); radius queries run in PostGIS.
 */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EarthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(h)));
}
