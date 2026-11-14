// Mobile match queue: join/leave, pairing (nearest player inside both radii,
// nearest active court), accept/decline, and the Demo Tester bot. Request
// handling is in handler.ts; this file wires Clerk, the DB and env.
//
// Clerk session tokens aren't Supabase JWTs, so verify_jwt is off for this
// function (supabase/config.toml) and the token is verified here with
// CLERK_SECRET_KEY, like player-profile.
//
// Secrets: CLERK_SECRET_KEY, DEMO_BOT_ENABLED ('true' turns the bot on;
// anything else, or unset, keeps it off).
import { verifyToken } from 'npm:@clerk/backend@3';
import { createClient, type PostgrestError } from 'npm:@supabase/supabase-js@2';

import { createHandler, MatchmakingRefusal, type MatchmakingStore } from './handler.ts';

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

const REFUSALS = new Set(['match_pending', 'match_not_found', 'match_not_proposed']);
const BAD_INPUT = new Set(['invalid_location', 'invalid_radius']);

/** Turns the SQL functions' refusals into MatchmakingRefusal; rethrows anything else. */
function check(error: PostgrestError | null) {
  if (!error) return;
  if (error.code === 'P0001' && REFUSALS.has(error.message)) {
    throw new MatchmakingRefusal(error.message as 'match_pending' | 'match_not_found' | 'match_not_proposed');
  }
  if (error.code === '22023' && BAD_INPUT.has(error.message)) throw new MatchmakingRefusal('invalid_request');
  throw new Error(`${error.code}: ${error.message}`);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  check(error);
  return data as T;
}

const store: MatchmakingStore = {
  async playerIdFor(clerkUserId) {
    const { data, error } = await db.from('users').select('id').eq('clerk_user_id', clerkUserId).maybeSingle();
    check(error);
    return (data?.id as string | undefined) ?? null;
  },
  async join(playerId, lat, lng, radiusM) {
    await rpc('matchmaking_join', { p_player_id: playerId, p_lat: lat, p_lng: lng, p_radius_m: radiusM });
  },
  async leave(playerId) {
    await rpc('matchmaking_leave', { p_player_id: playerId });
  },
  pair: (playerId) => rpc<string | null>('matchmaking_pair', { p_player_id: playerId }),
  pairWithBot: (playerId, minWaitMs) =>
    rpc<string | null>('matchmaking_pair_with_bot', { p_player_id: playerId, p_min_wait: `${minWaitMs} milliseconds` }),
  async respond(playerId, matchId, accept) {
    await rpc('matchmaking_respond', { p_player_id: playerId, p_match_id: matchId, p_accept: accept });
  },
  state: (playerId) => rpc<unknown>('matchmaking_state', { p_player_id: playerId }),
};

Deno.serve(
  createHandler({
    authenticate,
    store,
    demoBotEnabled: Deno.env.get('DEMO_BOT_ENABLED') === 'true',
    log: (event) => console.log(JSON.stringify(event)),
  }),
);
