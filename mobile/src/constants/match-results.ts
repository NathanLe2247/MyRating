/** Edge function that takes match results (backend/supabase/functions/match-results). */
export const MatchResultsFunction = 'match-results';

/**
 * How often the result is re-read while the player waits for the opponent to
 * confirm their score. The Demo Tester only confirms on a `match-results`
 * call (`DEMO_BOT_CONFIRM_DELAY_MS` after the report), so this is also how
 * fast its confirmation shows up. The fallback until matches arrive over
 * Realtime.
 */
export const MatchResultsPollMs = 2_000;

/** React Query key prefix of a match's result state (plus the Clerk user id and match id). */
export const MatchResultsQueryKey = 'match-results';

/** Highest score the −/+ steppers go to (deuce games past this are vanishingly rare). */
export const MaxStepperPoints = 30;
