import type { MatchmakingError, MatchmakingState } from '@myrating/shared';

import type { GeoPoint } from '@/constants/courts';

/**
 * Why a matchmaking call failed: the function's `error` code, `network` when
 * it couldn't be reached (or answered with something unreadable), or
 * `location_unavailable` when the device position couldn't be read to join.
 */
export type MatchmakingErrorCode = MatchmakingError | 'network' | 'location_unavailable';

/**
 * Both players' ratings as they were when the device first saw a pairing, so
 * Match Found compares like with like for the whole match: the player's
 * rating from the dashboard cache (`PlayerRatingQueryKey`), the opponent's
 * from the function. Display-only; never sent anywhere.
 */
export type PairingRatings = {
  matchId: string;
  /**
   * Null while calibrating; undefined when the dashboard hadn't loaded yet
   * (filled on a later state, but only before a result is reported).
   */
  player: number | null | undefined;
  opponent: number | null;
};

/**
 * The function's latest `MatchmakingState` plus what only the device knows.
 * The extras are dropped once the player has neither a queue entry nor a
 * match (`pairingRatings` as soon as there's no match).
 */
export type MatchmakingSnapshot = MatchmakingState & {
  /** Where the player queued from, for the distance to the suggested court. */
  origin?: GeoPoint;
  /** `queue_entry.created_at` of the wait that led to the current match. */
  waitingSince?: string;
  /** Ratings at pairing time for the current match. */
  pairingRatings?: PairingRatings;
};

/**
 * Where the player is in the queue → match flow:
 * - `loading`: the first state hasn't arrived yet.
 * - `idle`: not queued, no open match.
 * - `searching`: waiting in the queue.
 * - `proposed`: paired; the player hasn't answered.
 * - `waiting_for_opponent`: the player accepted; the opponent hasn't yet.
 * - `accepted`: both accepted, the match is on (the result is reported from here).
 * - `awaiting_confirmation`: a result was reported and awaits the other player.
 */
export type MatchmakingPhase =
  | 'loading'
  | 'idle'
  | 'searching'
  | 'proposed'
  | 'waiting_for_opponent'
  | 'accepted'
  | 'awaiting_confirmation';

/** What the Home queue card shows. */
export type QueueCardStatus =
  | { kind: 'idle' }
  /** Waiting in the queue; `since` (ISO) starts the timer. */
  | { kind: 'searching'; since?: string; radiusMiles: number }
  /** Paired; `waiting` once the player accepted and the opponent hasn't. */
  | { kind: 'matched'; opponent: string; waiting: boolean }
  /** Both accepted: the match is on. */
  | { kind: 'on'; opponent: string };
