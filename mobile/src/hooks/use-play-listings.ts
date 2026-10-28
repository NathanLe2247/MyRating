import type { PlayListings } from '@/types/play';

const NO_LISTINGS: PlayListings = { courts: [], tournaments: [] };

/**
 * Courts and tournaments for the Play tab.
 *
 * TODO: there's no courts or tournaments table or endpoint yet, so this
 * always returns empty lists and the screen shows its empty states. Once
 * `Court`/`Tournament` exist in `shared/` and the backend serves them, query
 * them here (nearby courts per `agent/skills/courts-catalog`) and map them
 * into the card display models. Never return placeholder venues.
 */
export function usePlayListings(): PlayListings {
  return NO_LISTINGS;
}
