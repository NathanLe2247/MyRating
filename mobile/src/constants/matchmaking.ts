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

/** React Query key prefix of the player's matchmaking state (plus the Clerk user id). */
export const MatchmakingQueryKey = 'matchmaking';
