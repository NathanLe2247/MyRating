import { z } from 'zod';

import { UuidSchema } from './common.ts';
import { MatchGameRowSchema, MatchResultSubmissionSchema, MatchSchema, RatingChangeSchema } from './match.ts';
import { MatchOpponentSchema } from './matchmaking.ts';

// Request and response shapes of the `match-results` edge function
// (backend/supabase/functions/match-results/): reporting a score, confirming
// or disputing it, and reading the result with the caller's rating change.
// Mobile sends a `MatchResultsRequest` as the POST body and parses every 200
// response with `MatchResultsStateSchema`; the function validates with the
// same schemas.

export const MATCH_RESULTS_ACTIONS = ['submit', 'confirm', 'dispute', 'state'] as const;
export type MatchResultsAction = (typeof MATCH_RESULTS_ACTIONS)[number];

/**
 * - `submit`: a `MatchResultSubmission` (`match_id`, `games`) plus the
 *   action, with all of its scoring rules. Either player of an `accepted`
 *   match reports; it becomes `awaiting_confirmation` with `reported_by` set.
 * - `confirm`: the other player accepts the reported score. The match becomes
 *   `confirmed` and both ratings update (bots excepted). Confirming an
 *   already-confirmed match is a no-op that returns the same state.
 * - `dispute`: the other player rejects it. The match becomes `disputed` and
 *   no rating changes. Disputing twice is a no-op.
 * - `state`: read the match. Poll it every couple of seconds while the match
 *   is `awaiting_confirmation`; against the Demo Tester this is also what
 *   lets the bot confirm (see `DEMO_BOT_CONFIRM_DELAY_MS`).
 */
export const MatchResultsRequestSchema = z.discriminatedUnion('action', [
  // safeExtend keeps the submission's cross-game checks (split games, a game
  // after 2–0), so the request is validated by MatchResultSubmissionSchema.
  MatchResultSubmissionSchema.safeExtend({ action: z.literal('submit') }),
  z.object({ action: z.literal('confirm'), match_id: UuidSchema }),
  z.object({ action: z.literal('dispute'), match_id: UuidSchema }),
  z.object({ action: z.literal('state'), match_id: UuidSchema }),
]);
export type MatchResultsRequest = z.infer<typeof MatchResultsRequestSchema>;

/**
 * How long after a result is reported the Demo Tester confirms it (when the
 * backend has the demo bot on). There is no timer: the bot confirms on the
 * first `match-results` call for that match after this delay, so keep polling
 * `state` while waiting.
 */
export const DEMO_BOT_CONFIRM_DELAY_MS = 3_000;

/**
 * What every successful `match-results` call returns, for the match named in
 * the request (any status, including terminal ones):
 * - `match`: the match row; `reported_by` is who reported the score.
 * - `games`: the reported games in order (empty until someone reports).
 * - `opponent`: the other player; `rating` is their current rating.
 * - `rating_change`: the caller's rating change from this match, once it is
 *   `confirmed`; null before that, after a dispute, and for bots.
 */
export const MatchResultsStateSchema = z.object({
  match: MatchSchema,
  games: z.array(MatchGameRowSchema).max(3),
  opponent: MatchOpponentSchema,
  rating_change: RatingChangeSchema.nullable(),
});
export type MatchResultsState = z.infer<typeof MatchResultsStateSchema>;

/**
 * Error codes in a non-200 `{ error }` body. `invalid_request` (400) carries
 * the Zod `issues` too, whose messages can be shown verbatim.
 */
export const MATCH_RESULTS_ERRORS = [
  'unauthorized', // 401: missing/invalid Clerk session token
  'profile_required', // 403: no public.users row yet (finish onboarding)
  'invalid_request', // 400
  'match_not_found', // 404: unknown match, or not one of its players
  'match_not_accepted', // 409: submit when the match isn't `accepted` (not on yet, or already reported)
  'match_not_awaiting_confirmation', // 409: confirm/dispute when there is no reported score to answer
  'own_report', // 409: the reporter can't confirm or dispute their own score
  'internal', // 500
] as const;
export type MatchResultsError = (typeof MATCH_RESULTS_ERRORS)[number];
