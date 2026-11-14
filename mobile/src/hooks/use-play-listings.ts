import type { PlayListings } from '@/types/play';

const NO_LISTINGS: PlayListings = { tournaments: [] };

/**
 * Tournaments for the Play tab. (Its courts come from `useNearbyCourts`.)
 *
 * TODO: there's no tournaments table or endpoint yet, so this always returns
 * an empty list and the screen shows its empty state. Once `Tournament`
 * exists in `shared/` and the backend serves it, query it here and map it
 * into the card display model. Never return placeholder events.
 */
export function usePlayListings(): PlayListings {
  return NO_LISTINGS;
}
