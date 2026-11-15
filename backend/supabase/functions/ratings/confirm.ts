// Confirming a reported result: the one code path that writes ratings
// (agent/skills/ratings-engine). Imported by the match-results function for
// player confirmations and the Demo Tester's auto-confirm. The state rules
// (who may confirm, which status, idempotency) and the single transaction
// live in public.ratings_apply; this computes the Glicko-2 updates it writes.
import { computeMatchUpdates, RatingMatchInputsSchema, type RatingUpdate } from './update.ts';

/** public.ratings_apply refused: a player's rating changed after it was read. */
export class RatingStale extends Error {
  constructor() {
    super('rating_stale');
  }
}

/** The database calls confirmMatch needs (index.ts backs them with public.ratings_*). */
export type RatingsStore = {
  /** public.ratings_match_inputs, unparsed. */
  ratingInputs(matchId: string): Promise<unknown>;
  /**
   * public.ratings_apply: in one transaction, confirms the match and writes
   * the updates plus rating_history. Resolves true when it applied them,
   * false when the match was already confirmed (nothing written). Throws
   * RatingStale when a rating moved since ratingInputs; other refusals
   * (wrong status, own report, not a player) pass through as the store's own
   * errors.
   */
  applyRatings(matchId: string, confirmerId: string, updates: RatingUpdate[]): Promise<boolean>;
};

/** Re-reads and recomputes this many times when a rating moved underneath. */
export const MAX_ATTEMPTS = 3;

/**
 * Confirms the match as `confirmerId` (a player, or the Demo Tester) and
 * applies the rating updates. Idempotent: returns false, writing nothing, if
 * the match was already confirmed.
 */
export async function confirmMatch(store: RatingsStore, matchId: string, confirmerId: string): Promise<boolean> {
  for (let attempt = 1; ; attempt++) {
    const inputs = RatingMatchInputsSchema.parse(await store.ratingInputs(matchId));
    // Not awaiting confirmation: no updates; ratings_apply returns false for
    // `confirmed` and refuses every other status.
    const updates = inputs.status === 'awaiting_confirmation' ? computeMatchUpdates(inputs) : [];
    try {
      return await store.applyRatings(matchId, confirmerId, updates);
    } catch (err) {
      if (err instanceof RatingStale && attempt < MAX_ATTEMPTS) continue;
      throw err;
    }
  }
}
