import type { MatchResultsError, RatingChange } from '@myrating/shared';

/**
 * Why a `match-results` call failed: the function's `error` code, or
 * `network` when it couldn't be reached (or answered with something unreadable).
 */
export type MatchResultsErrorCode = MatchResultsError | 'network';

/** One game's score from the player's side. */
export type PlayerGame = { you: number; opponent: number };

/** The score being entered: the games so far and the selected game tab. */
export type ScoreDraft = { games: PlayerGame[]; active: number };

/**
 * What the report result card shows for a match that's on:
 * - `enter`: nobody has reported yet; the score form.
 * - `waiting`: the player reported; the opponent hasn't answered.
 * - `answer`: the opponent reported; Confirm or Dispute.
 * - `confirmed`: final score, and the player's rating change (null when the
 *   backend has none, e.g. for a bot).
 * - `disputed`: the score was rejected; no rating change.
 */
export type ReportResultStage =
  | { kind: 'enter' }
  | { kind: 'waiting'; games: PlayerGame[] }
  | { kind: 'answer'; games: PlayerGame[] }
  | { kind: 'confirmed'; games: PlayerGame[]; won: boolean; ratingChange: RatingChange | null }
  | { kind: 'disputed'; games: PlayerGame[] };

export type ReportResultStageKind = ReportResultStage['kind'];

/** The card's header and stage for the match being reported. */
export type ReportResultView = {
  matchId: string;
  opponent: string;
  /** Suggested court, when matchmaking found one. */
  court?: string;
  stage: ReportResultStage;
};
