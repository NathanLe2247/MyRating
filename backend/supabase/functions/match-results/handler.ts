// Request handling for the match-results function, kept free of env and
// network setup (that's in index.ts) so it can be tested with fakes.
//
// POST /match-results with a MatchResultsRequest body (shared/src/match-results.ts):
//   { action: 'submit', match_id, games }   report the score of an accepted match
//   { action: 'confirm', match_id }         accept the other player's score: ratings update
//   { action: 'dispute', match_id }         reject it: no rating change
//   { action: 'state', match_id }           read it (poll while awaiting confirmation)
// Every 200 is a MatchResultsState. Errors are { error: <MatchResultsError> }.
import {
  DEMO_BOT_CONFIRM_DELAY_MS,
  DEMO_TESTER_USER_ID,
  type MatchGame,
  type MatchResultsError,
  MatchResultsRequestSchema,
  MatchResultsStateSchema,
} from '@myrating/shared';

import { confirmMatch, type RatingsStore } from '../ratings/confirm.ts';

/** A refusal from the match_results_* / ratings_* SQL functions (their exception message). */
export class MatchResultsRefusal extends Error {
  constructor(
    readonly code:
      | 'match_not_found'
      | 'match_not_accepted'
      | 'match_not_awaiting_confirmation'
      | 'own_report'
      | 'invalid_request',
  ) {
    super(code);
  }
}

/**
 * The database calls the handler needs; index.ts backs them with the
 * public.match_results_* and public.ratings_* functions (covered by
 * supabase/tests/match_results.test.sql). Refusals throw MatchResultsRefusal,
 * a moved rating throws RatingStale (ratings/confirm.ts), anything else is an
 * internal error.
 */
export type MatchResultsStore = RatingsStore & {
  /** public.users.id for a Clerk user, or null if they have no row yet. */
  playerIdFor(clerkUserId: string): Promise<string | null>;
  /** Games already validated with MatchResultSubmissionSchema. */
  submit(playerId: string, matchId: string, games: MatchGame[]): Promise<void>;
  dispute(playerId: string, matchId: string): Promise<void>;
  /** Whether a bot opponent should confirm this match's reported score now. */
  botConfirmDue(matchId: string, minWaitMs: number): Promise<boolean>;
  /** public.match_results_state, unparsed. Refuses non-players with match_not_found. */
  state(playerId: string, matchId: string): Promise<unknown>;
};

export type HandlerDeps = {
  /** Verifies the Clerk session token; returns the Clerk user id or null. */
  authenticate(req: Request): Promise<string | null>;
  store: MatchResultsStore;
  /** DEMO_BOT_ENABLED=true. Off: the Demo Tester never confirms. */
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

const error = (status: number, code: MatchResultsError, extra: Record<string, unknown> = {}) =>
  json(status, { error: code, ...extra });

const REFUSAL_STATUS: Record<MatchResultsRefusal['code'], number> = {
  invalid_request: 400,
  match_not_found: 404,
  match_not_accepted: 409,
  match_not_awaiting_confirmation: 409,
  own_report: 409,
};

export function createHandler({ authenticate, store, demoBotEnabled, log = console.log }: HandlerDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

    const clerkUserId = await authenticate(req);
    if (!clerkUserId) return error(401, 'unauthorized');

    // For `submit` this is MatchResultSubmissionSchema (safeExtend keeps its
    // scoring rules), so the games are valid results from here on.
    const parsed = MatchResultsRequestSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(400, 'invalid_request', { issues: parsed.error.issues });
    const request = parsed.data;
    const matchId = request.match_id;

    try {
      const playerId = await store.playerIdFor(clerkUserId);
      if (!playerId) return error(403, 'profile_required');

      switch (request.action) {
        case 'submit':
          await store.submit(playerId, matchId, request.games);
          break;
        case 'confirm': {
          const applied = await confirmMatch(store, matchId, playerId);
          log({ event: 'match_confirmed', match_id: matchId, player_id: playerId, applied, demo_bot: false });
          break;
        }
        case 'dispute':
          await store.dispute(playerId, matchId);
          break;
        case 'state':
          break;
      }
      log({ event: 'match_results_action', action: request.action, match_id: matchId, player_id: playerId });

      // Read first: it refuses anyone who isn't in the match.
      let state = await store.state(playerId, matchId);

      // The Demo Tester confirms on the first call after the delay rather
      // than on a timer, which hosted edge functions don't have; mobile polls
      // `state` while the match awaits confirmation. A concurrent poll that
      // confirms first just makes this one a no-op (confirmMatch is idempotent).
      if (demoBotEnabled && (await store.botConfirmDue(matchId, DEMO_BOT_CONFIRM_DELAY_MS))) {
        const applied = await confirmMatch(store, matchId, DEMO_TESTER_USER_ID);
        log({ event: 'match_confirmed', match_id: matchId, player_id: DEMO_TESTER_USER_ID, applied, demo_bot: true });
        state = await store.state(playerId, matchId);
      }

      return json(200, MatchResultsStateSchema.parse(state));
    } catch (err) {
      if (err instanceof MatchResultsRefusal) return error(REFUSAL_STATUS[err.code], err.code);
      console.error(
        JSON.stringify({ event: 'match_results_error', action: request.action, match_id: matchId, err: String(err) }),
      );
      return error(500, 'internal');
    }
  };
}
