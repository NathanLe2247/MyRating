// Match results: report a score, confirm or dispute it, read it back with the
// caller's rating change. Confirmation runs the Glicko-2 update from
// ../ratings/ (the only ratings writer). Request handling is in handler.ts;
// this file wires Clerk, the DB and env.
//
// Clerk session tokens aren't Supabase JWTs, so verify_jwt is off for this
// function (supabase/config.toml) and the token is verified here with
// CLERK_SECRET_KEY, like matchmaking.
//
// Secrets: CLERK_SECRET_KEY, DEMO_BOT_ENABLED ('true' lets the Demo Tester
// confirm results reported against it; anything else, or unset, it never does).
import { verifyToken } from 'npm:@clerk/backend@3';
import { createClient, type PostgrestError } from 'npm:@supabase/supabase-js@2';

import { createHandler, dbErrorToThrowable, type MatchResultsStore } from './handler.ts';

const secretKey = Deno.env.get('CLERK_SECRET_KEY')!;

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

async function authenticate(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = await verifyToken(token, { secretKey });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** Turns the SQL functions' refusals into MatchResultsRefusal / RatingStale (dbErrorToThrowable); anything else is internal. */
function check(error: PostgrestError | null) {
  if (!error) return;
  throw dbErrorToThrowable(error.code, error.message) ?? new Error(`${error.code}: ${error.message}`);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  check(error);
  return data as T;
}

const store: MatchResultsStore = {
  async playerIdFor(clerkUserId) {
    const { data, error } = await db.from('users').select('id').eq('clerk_user_id', clerkUserId).maybeSingle();
    check(error);
    return (data?.id as string | undefined) ?? null;
  },
  async submit(playerId, matchId, games) {
    await rpc('match_results_submit', { p_player_id: playerId, p_match_id: matchId, p_games: games });
  },
  async dispute(playerId, matchId) {
    await rpc('match_results_dispute', { p_player_id: playerId, p_match_id: matchId });
  },
  botConfirmDue: (matchId, minWaitMs) =>
    rpc<boolean>('match_results_bot_confirm_due', { p_match_id: matchId, p_min_wait: `${minWaitMs} milliseconds` }),
  state: (playerId, matchId) => rpc<unknown>('match_results_state', { p_player_id: playerId, p_match_id: matchId }),
  ratingInputs: (matchId) => rpc<unknown>('ratings_match_inputs', { p_match_id: matchId }),
  applyRatings: (matchId, confirmerId, updates) =>
    rpc<boolean>('ratings_apply', { p_match_id: matchId, p_confirmer_id: confirmerId, p_updates: updates }),
};

Deno.serve(
  createHandler({
    authenticate,
    store,
    demoBotEnabled: Deno.env.get('DEMO_BOT_ENABLED') === 'true',
    log: (event) => console.log(JSON.stringify(event)),
  }),
);
