import type { GeoPoint } from '@/constants/courts';

/**
 * A fixed "device location" for demos, from `EXPO_PUBLIC_DEMO_LAT` /
 * `EXPO_PUBLIC_DEMO_LNG`. When both are set to valid coordinates, the nearby
 * courts list uses them as the user's location and never asks for location
 * permission or reads GPS. Unset (or invalid), it returns undefined.
 */
export function demoLocation(): GeoPoint | undefined {
  // Read each var by its full name: Expo only inlines static
  // `process.env.EXPO_PUBLIC_*` accesses into the bundle.
  return parseDemoLocation(process.env.EXPO_PUBLIC_DEMO_LAT, process.env.EXPO_PUBLIC_DEMO_LNG);
}

export function parseDemoLocation(
  lat: string | undefined,
  lng: string | undefined,
): GeoPoint | undefined {
  if (!lat?.trim() || !lng?.trim()) return undefined;
  const point = { lat: Number(lat), lng: Number(lng) };
  const valid =
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lng) <= 180;
  return valid ? point : undefined;
}
