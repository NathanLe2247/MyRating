import type { NearbyCourt } from '@myrating/shared';

import { MetersPerMile } from '@/constants/courts';
import type { CourtCardData } from '@/types/play';

/** Metres → miles, one decimal place, e.g. 1931 → "1.2". */
export function formatMiles(meters: number): string {
  return (meters / MetersPerMile).toFixed(1);
}

/**
 * Maps a `nearby_courts` row into the court card's display model. The shared
 * `Court` shape is still minimal (no neighborhood, court count, setting or
 * photos; see agent/skills/courts-catalog), so those stay unset and the card
 * leaves them out rather than guessing.
 */
export function toCourtCardData(court: NearbyCourt): CourtCardData {
  return {
    id: court.id,
    name: court.name,
    distanceMiles: formatMiles(court.distance_m),
    tags: [],
  };
}
