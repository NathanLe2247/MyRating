import { z } from 'zod';

import { LatitudeSchema, LongitudeSchema, UuidSchema } from './common.ts';
import { CourtSchema } from './court.ts';
import { MatchSchema, QueueEntrySchema } from './match.ts';

// Request and response shapes of the `matchmaking` edge function
// (backend/supabase/functions/matchmaking/). Mobile sends a
// `MatchmakingRequest` as the POST body and parses every 200 response with
// `MatchmakingStateSchema`; the function validates with the same schemas.

/**
 * `public.users.id` of the Demo Tester bot, inserted by
 * 20261114130000_queue_and_matches.sql. When the backend has the demo bot on,
 * a player who waits ~5 s unpaired is matched with this user, who accepts
 * immediately. Compare `opponent.id` with it to label the bot in the UI.
 */
export const DEMO_TESTER_USER_ID = '00000000-0000-4000-8000-0000000000d1';

export const MATCHMAKING_ACTIONS = ['join', 'leave', 'poll', 'accept', 'decline'] as const;
export type MatchmakingAction = (typeof MATCHMAKING_ACTIONS)[number];

/**
 * - `join`: start waiting at (`lat`, `lng`) for a player within `radius_m`
 *   metres (or update the area while already waiting). Tries to pair at once.
 * - `poll`: re-check for an opponent (and the Demo Tester, when enabled) and
 *   return the current state. Call it every few seconds while waiting.
 * - `leave`: stop waiting; also cancels an unanswered proposal.
 * - `accept` / `decline`: answer a `proposed` match.
 */
export const MatchmakingRequestSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('join'),
    lat: LatitudeSchema,
    lng: LongitudeSchema,
    radius_m: QueueEntrySchema.shape.radius_m,
  }),
  z.object({ action: z.literal('leave') }),
  z.object({ action: z.literal('poll') }),
  z.object({ action: z.literal('accept'), match_id: UuidSchema }),
  z.object({ action: z.literal('decline'), match_id: UuidSchema }),
]);
export type MatchmakingRequest = z.infer<typeof MatchmakingRequestSchema>;

/** The other player in a match, as much as the match screen shows. */
export const MatchOpponentSchema = z.object({
  id: UuidSchema,
  username: z.string().nullable(),
  first_name: z.string().nullable(),
  /** Visible rating (`player_ratings.rating`); null while unrated. */
  rating: z.number().nullable(),
});
export type MatchOpponent = z.infer<typeof MatchOpponentSchema>;

/**
 * What every successful `matchmaking` call returns:
 * - `queue_entry`: the player's `waiting` entry, or null.
 * - `match`: their newest open match (`proposed`, `accepted` or
 *   `awaiting_confirmation`), or null. Declined/cancelled matches drop out.
 * - `opponent` / `court`: for that match (`court` null if none was found
 *   within 100 km); both null when `match` is.
 */
export const MatchmakingStateSchema = z.object({
  queue_entry: QueueEntrySchema.nullable(),
  match: MatchSchema.nullable(),
  opponent: MatchOpponentSchema.nullable(),
  court: CourtSchema.nullable(),
});
export type MatchmakingState = z.infer<typeof MatchmakingStateSchema>;

/**
 * Error codes in a non-200 `{ error }` body. `invalid_request` (400) carries
 * the Zod `issues` too.
 */
export const MATCHMAKING_ERRORS = [
  'unauthorized', // 401: missing/invalid Clerk session token
  'profile_required', // 403: no public.users row yet (finish onboarding)
  'invalid_request', // 400
  'match_pending', // 409: join while a proposal is unanswered
  'match_not_found', // 404: unknown match, or not one of its players
  'match_not_proposed', // 409: accept/decline after it was settled
  'internal', // 500
] as const;
export type MatchmakingError = (typeof MATCHMAKING_ERRORS)[number];
