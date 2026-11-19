import type { MatchFormat } from '@/constants/match';

/** Edge function behind the match queue (backend/supabase/functions/matchmaking). */
export const MatchmakingFunction = 'matchmaking';

/**
 * How far, in metres, a player will travel for a match when they queue. Same
 * reach as the nearby courts list (`NearbyCourtsRadiusMeters`); the function
 * caps it at `MAX_QUEUE_RADIUS_M`.
 */
export const QueueRadiusMeters = 25_000;

/**
 * How often the queue is re-checked while waiting or while a proposal is
 * unanswered. Pairing (and the Demo Tester) only happens on a `join` or
 * `poll` call, so this is also how fast a match shows up.
 */
export const MatchmakingPollMs = 2_500;

/**
 * How often an open match (`accepted` or `awaiting_confirmation`) is
 * re-checked, so the opponent cancelling or reporting the score shows up.
 * Slower than `MatchmakingPollMs`: nothing here is time-critical. It's the
 * fallback until matches arrive over Realtime.
 */
export const MatchmakingOpenMatchPollMs = 12_000;

/** React Query key prefix of the player's matchmaking state (plus the Clerk user id). */
export const MatchmakingQueryKey = 'matchmaking';

/**
 * The format the match queue pairs for: matchmaking is singles-only (one
 * player per side), so Home shows queue and match state on this tab only.
 */
export const QueueFormat = 'singles' satisfies MatchFormat;
