// Request handling for the matchmaking function, kept free of env and
// network setup (that's in index.ts) so it can be tested with fakes.
//
// POST /matchmaking with a MatchmakingRequest body (shared/src/matchmaking.ts):
//   { action: 'join', lat, lng, radius_m }   start/update waiting, try to pair
//   { action: 'poll' }                       try to pair (and the bot), get state
//   { action: 'leave' }                      stop waiting, cancel a proposal
//   { action: 'accept' | 'decline', match_id }
// Every 200 is a MatchmakingState. Errors are { error: <MatchmakingError> }.
import { type MatchmakingError, MatchmakingRequestSchema, MatchmakingStateSchema } from '@myrating/shared';

/** How long a player waits unpaired before the Demo Tester steps in. */
export const DEMO_BOT_WAIT_MS = 5_000;

/** A refusal from the matchmaking_* SQL functions (their exception message). */
export class MatchmakingRefusal extends Error {
  constructor(readonly code: 'match_pending' | 'match_not_found' | 'match_not_proposed' | 'invalid_request') {
    super(code);
  }
}

/**
 * The database calls the handler needs; index.ts backs them with the
 * public.matchmaking_* functions (covered by supabase/tests/matchmaking.test.sql).
 * Refusals throw MatchmakingRefusal; anything else is an internal error.
 */
export type MatchmakingStore = {
  /** public.users.id for a Clerk user, or null if they have no row yet. */
  playerIdFor(clerkUserId: string): Promise<string | null>;
  join(playerId: string, lat: number, lng: number, radiusM: number): Promise<void>;
  leave(playerId: string): Promise<void>;
  /** Pairs a waiting player with another; returns the match id or null. */
  pair(playerId: string): Promise<string | null>;
  /** Pairs a player who has waited at least minWaitMs with the Demo Tester. */
  pairWithBot(playerId: string, minWaitMs: number): Promise<string | null>;
  respond(playerId: string, matchId: string, accept: boolean): Promise<void>;
  /** public.matchmaking_state, unparsed. */
  state(playerId: string): Promise<unknown>;
};

export type HandlerDeps = {
  /** Verifies the Clerk session token; returns the Clerk user id or null. */
  authenticate(req: Request): Promise<string | null>;
  store: MatchmakingStore;
  /** DEMO_BOT_ENABLED=true. Off: the bot never pairs. */
  demoBotEnabled: boolean;
  log?: (event: Record<string, unknown>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const error = (status: number, code: MatchmakingError, extra: Record<string, unknown> = {}) =>
  json(status, { error: code, ...extra });

const REFUSAL_STATUS: Record<MatchmakingRefusal['code'], number> = {
  invalid_request: 400,
  match_not_found: 404,
  match_pending: 409,
  match_not_proposed: 409,
};

export function createHandler({ authenticate, store, demoBotEnabled, log = console.log }: HandlerDeps) {
  // Pairing is checked on every join and poll rather than by a timer, so it
  // works on hosted edge functions (short-lived, no background jobs): a real
  // opponent first, then the bot once the player has waited long enough.
  async function tryPair(playerId: string) {
    let matchId = await store.pair(playerId);
    let bot = false;
    if (!matchId && demoBotEnabled) {
      matchId = await store.pairWithBot(playerId, DEMO_BOT_WAIT_MS);
      bot = matchId !== null;
    }
    if (matchId) log({ event: 'matchmaking_paired', player_id: playerId, match_id: matchId, demo_bot: bot });
  }

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

    const clerkUserId = await authenticate(req);
    if (!clerkUserId) return error(401, 'unauthorized');

    const parsed = MatchmakingRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(400, 'invalid_request', { issues: parsed.error.issues });
    const request = parsed.data;

    try {
      const playerId = await store.playerIdFor(clerkUserId);
      if (!playerId) return error(403, 'profile_required');

      switch (request.action) {
        case 'join':
          await store.join(playerId, request.lat, request.lng, request.radius_m);
          await tryPair(playerId);
          break;
        case 'poll':
          await tryPair(playerId);
          break;
        case 'leave':
          await store.leave(playerId);
          break;
        case 'accept':
        case 'decline':
          await store.respond(playerId, request.match_id, request.action === 'accept');
          break;
      }

      // No coordinates in logs: a player's location is personal data.
      log({ event: 'matchmaking_action', action: request.action, player_id: playerId });
      return json(200, MatchmakingStateSchema.parse(await store.state(playerId)));
    } catch (err) {
      if (err instanceof MatchmakingRefusal) return error(REFUSAL_STATUS[err.code], err.code);
      console.error(JSON.stringify({ event: 'matchmaking_error', action: request.action, err: String(err) }));
      return error(500, 'internal');
    }
  };
}
