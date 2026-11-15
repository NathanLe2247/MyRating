// cd backend/supabase/functions/match-results && deno test
//
// The store is an in-memory fake of the public.match_results_* and
// public.ratings_* functions (their SQL is covered by
// supabase/tests/match_results.test.sql); the Glicko-2 updates are the real
// ones from ../ratings/. Responses are parsed with the shared
// MatchResultsStateSchema by the handler itself, so a shape drift fails here.
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { DEMO_BOT_CONFIRM_DELAY_MS, DEMO_TESTER_USER_ID, type MatchGame, type MatchResultsState } from '@myrating/shared';

import { RatingStale } from '../ratings/confirm.ts';
import type { RatingUpdate } from '../ratings/update.ts';
import { createHandler, MatchResultsRefusal, type MatchResultsStore } from './handler.ts';

const PLAYERS: Record<string, string> = {
  user_a: '6f1c2b8e-3d4a-4c5b-9e7f-0a1b2c3d4e5f',
  user_b: '7a2d3c9f-4e5b-4d6c-8f80-1b2c3d4e5f60',
  user_out: '9c4f5e1b-6a7d-4f8e-8b02-3d4e5f607182',
};
const A = PLAYERS.user_a!;
const B = PLAYERS.user_b!;
const NO_PROFILE = 'user_new';
const AB = '8b3e4d0a-5f6c-4e7d-9a91-2c3d4e5f6071';
const ABOT = '1d2e3f40-5a6b-4c7d-8e9f-a0b1c2d3e4f5';
const game = (a: number, b: number) => ({ player_a_points: a, player_b_points: b });

type Rating = { rating: number; mmr: number; rating_deviation: number; volatility: number };
type MatchRow = { id: string; a: string; b: string; status: string; reported_by: string | null; updated_at: number };

function fakeStore() {
  let now = Date.parse('2026-11-14T12:00:00Z');
  const iso = (t: number) => new Date(t).toISOString();
  const bots = new Set([DEMO_TESTER_USER_ID]);
  const ratings = new Map<string, Rating>([
    [A, { rating: 1500, mmr: 1500, rating_deviation: 200, volatility: 0.06 }],
    [DEMO_TESTER_USER_ID, { rating: 1500, mmr: 1500, rating_deviation: 60, volatility: 0.06 }],
    // B has no row yet: an unrated (calibration) player.
  ]);
  const matches = new Map<string, MatchRow>([
    [AB, { id: AB, a: A, b: B, status: 'accepted', reported_by: null, updated_at: now }],
    [ABOT, { id: ABOT, a: A, b: DEMO_TESTER_USER_ID, status: 'accepted', reported_by: null, updated_at: now }],
  ]);
  const games = new Map<string, MatchGame[]>();
  const history: { match_id: string; player_id: string; before: number; after: number }[] = [];
  const calls: string[] = [];
  let staleOnce = false;

  const find = (playerId: string, matchId: string) => {
    const m = matches.get(matchId);
    if (!m || ![m.a, m.b].includes(playerId)) throw new MatchResultsRefusal('match_not_found');
    return m;
  };
  const touch = (m: MatchRow, patch: Partial<MatchRow>) => Object.assign(m, patch, { updated_at: now });
  const playerInput = (id: string) => ({ id, is_bot: bots.has(id), ...(ratings.get(id) ?? { rating: null, mmr: null, rating_deviation: null, volatility: null }) });

  const store: MatchResultsStore = {
    playerIdFor: (clerkUserId) => Promise.resolve(PLAYERS[clerkUserId] ?? null),
    submit(playerId, matchId, g) {
      calls.push('submit');
      const m = find(playerId, matchId);
      if (m.status !== 'accepted') throw new MatchResultsRefusal('match_not_accepted');
      games.set(matchId, g);
      touch(m, { status: 'awaiting_confirmation', reported_by: playerId });
      return Promise.resolve();
    },
    dispute(playerId, matchId) {
      calls.push('dispute');
      const m = find(playerId, matchId);
      if (m.reported_by === playerId) throw new MatchResultsRefusal('own_report');
      if (m.status === 'disputed') return Promise.resolve();
      if (m.status !== 'awaiting_confirmation') throw new MatchResultsRefusal('match_not_awaiting_confirmation');
      touch(m, { status: 'disputed' });
      return Promise.resolve();
    },
    botConfirmDue(matchId, minWaitMs) {
      calls.push('botConfirmDue');
      const m = matches.get(matchId)!;
      const other = m.reported_by === m.a ? m.b : m.a;
      return Promise.resolve(m.status === 'awaiting_confirmation' && bots.has(other) && now - m.updated_at >= minWaitMs);
    },
    ratingInputs(matchId) {
      const m = matches.get(matchId)!;
      return Promise.resolve({
        match_id: matchId,
        status: m.status,
        games: games.get(matchId) ?? [],
        player_a: playerInput(m.a),
        player_b: playerInput(m.b),
      });
    },
    applyRatings(matchId, confirmerId, updates: RatingUpdate[]) {
      calls.push('applyRatings');
      const m = find(confirmerId, matchId);
      if (m.status === 'confirmed') return Promise.resolve(false);
      if (m.reported_by === confirmerId) throw new MatchResultsRefusal('own_report');
      if (m.status !== 'awaiting_confirmation') throw new MatchResultsRefusal('match_not_awaiting_confirmation');
      const humans = [m.a, m.b].filter((id) => !bots.has(id)).sort();
      assertEquals(updates.map((u) => u.player_id).sort(), humans, 'one update per non-bot player');
      if (staleOnce) {
        staleOnce = false;
        throw new RatingStale();
      }
      for (const u of updates) {
        const cur = ratings.get(u.player_id);
        assertEquals(cur?.mmr ?? null, u.expected_mmr);
        ratings.set(u.player_id, { rating: u.rating, mmr: u.rating, rating_deviation: u.rating_deviation, volatility: u.volatility });
        history.push({ match_id: matchId, player_id: u.player_id, before: u.before, after: u.rating });
      }
      touch(m, { status: 'confirmed' });
      return Promise.resolve(true);
    },
    state(playerId, matchId) {
      const m = find(playerId, matchId);
      const opponentId = m.a === playerId ? m.b : m.a;
      const h = history.find((x) => x.match_id === matchId && x.player_id === playerId);
      return Promise.resolve({
        match: {
          id: m.id,
          player_a_id: m.a,
          player_b_id: m.b,
          court_id: null,
          status: m.status,
          player_a_accepted_at: iso(now),
          player_b_accepted_at: iso(now),
          reported_by: m.reported_by,
          created_at: iso(now),
          updated_at: iso(m.updated_at),
        },
        games: (games.get(matchId) ?? []).map((g, i) => ({ match_id: matchId, game_number: i + 1, ...g })),
        opponent: {
          id: opponentId,
          username: null,
          first_name: bots.has(opponentId) ? 'Demo' : null,
          rating: ratings.get(opponentId)?.rating ?? null,
          is_bot: bots.has(opponentId),
        },
        rating_change: h ? { ...h, delta: Math.round((h.after - h.before) * 100) / 100 } : null,
      });
    },
  };
  return {
    store,
    calls,
    history,
    ratings,
    advance: (ms: number) => (now += ms),
    staleNext: () => (staleOnce = true),
  };
}

function setup({ demoBotEnabled = false } = {}) {
  const fake = fakeStore();
  const logs: Record<string, unknown>[] = [];
  const handler = createHandler({
    authenticate: (req) => {
      const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
      return Promise.resolve(token && (token in PLAYERS || token === NO_PROFILE) ? token : null);
    },
    store: fake.store,
    demoBotEnabled,
    log: (e) => logs.push(e),
  });
  const call = async (clerkUserId: string | null, body: unknown, method = 'POST') => {
    const res = await handler(
      new Request('http://localhost/match-results', {
        method,
        headers: clerkUserId ? { Authorization: `Bearer ${clerkUserId}` } : {},
        body: method === 'POST' ? JSON.stringify(body) : undefined,
      }),
    );
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { ...fake, logs, call };
}

const submit = (match_id: string, games: unknown[]) => ({ action: 'submit', match_id, games });

Deno.test('rejects missing auth, unknown players and bad bodies', async () => {
  const { call } = setup();
  assertEquals((await call(null, { action: 'state', match_id: AB })).status, 401);
  assertEquals((await call('user_forged', { action: 'state', match_id: AB })).status, 401);
  assertEquals(await call(NO_PROFILE, { action: 'state', match_id: AB }), { status: 403, body: { error: 'profile_required' } });
  assertEquals((await call('user_a', { action: 'report', match_id: AB })).body.error, 'invalid_request');
  assertEquals((await call('user_a', { action: 'confirm', match_id: 'nope' })).status, 400);
  assertEquals((await call('user_a', {}, 'GET')).status, 405);
});

Deno.test('score validation uses the shared rules and stores nothing on failure', async () => {
  const { call, calls } = setup();
  const cases: [unknown[], RegExp][] = [
    [[], /at least one game/],
    [[game(11, 10)], /won by 2/],
    [[game(11, 11)], /tied/],
    [[game(11, 9), game(9, 11)], /split/],
    [[game(11, 9), game(11, 5), game(11, 3)], /shouldn't have been played/],
    [[game(11, 1), game(11, 2), game(11, 3), game(11, 4)], /at most 3/],
  ];
  for (const [games, message] of cases) {
    const res = await call('user_a', submit(AB, games));
    assertEquals(res.status, 400, JSON.stringify(games));
    assertEquals(res.body.error, 'invalid_request');
    assert(message.test(res.body.issues[0].message), res.body.issues[0].message);
  }
  assert(!calls.includes('submit'));
});

Deno.test('submit moves the match to awaiting_confirmation with the reporter and games', async () => {
  const { call } = setup();
  const res = await call('user_a', submit(AB, [game(11, 7)]));
  assertEquals(res.status, 200);
  const state = res.body as MatchResultsState;
  assertEquals(state.match.status, 'awaiting_confirmation');
  assertEquals(state.match.reported_by, A);
  assertEquals(state.games, [{ match_id: AB, game_number: 1, ...game(11, 7) }]);
  assertEquals(state.rating_change, null);

  assertEquals(await call('user_b', submit(AB, [game(7, 11)])), { status: 409, body: { error: 'match_not_accepted' } });
  assertEquals(await call('user_out', submit(AB, [game(11, 7)])), { status: 404, body: { error: 'match_not_found' } });
});

Deno.test('the other player confirms: both ratings update once, confirming again is a no-op', async () => {
  const { call, history, ratings } = setup();
  await call('user_a', submit(AB, [game(9, 11), game(11, 6), game(11, 8)]));

  assertEquals(await call('user_a', { action: 'confirm', match_id: AB }), { status: 409, body: { error: 'own_report' } });
  assertEquals(await call('user_out', { action: 'confirm', match_id: AB }), { status: 404, body: { error: 'match_not_found' } });

  const confirmed = (await call('user_b', { action: 'confirm', match_id: AB })).body as MatchResultsState;
  assertEquals(confirmed.match.status, 'confirmed');
  // B was unrated: starts from 1500 and loses.
  assertEquals(confirmed.rating_change?.player_id, B);
  assertEquals(confirmed.rating_change?.before, 1500);
  assert(confirmed.rating_change!.delta < 0);

  const forA = (await call('user_a', { action: 'state', match_id: AB })).body as MatchResultsState;
  assert(forA.rating_change!.delta > 0, 'the winner goes up');
  assertEquals(forA.rating_change!.after, ratings.get(A)!.rating);

  const again = await call('user_b', { action: 'confirm', match_id: AB });
  assertEquals(again.status, 200);
  assertEquals(history.length, 2, 'no second application');
  assertEquals((await call('user_b', { action: 'dispute', match_id: AB })).body.error, 'match_not_awaiting_confirmation');
});

Deno.test('a moved rating is re-read and recomputed', async () => {
  const { call, history, staleNext } = setup();
  await call('user_a', submit(AB, [game(11, 7)]));
  staleNext();
  assertEquals((await call('user_b', { action: 'confirm', match_id: AB })).status, 200);
  assertEquals(history.length, 2);
});

Deno.test('dispute: no rating change, idempotent, and the reporter cannot dispute', async () => {
  const { call, history } = setup();
  assertEquals((await call('user_b', { action: 'dispute', match_id: AB })).body.error, 'match_not_awaiting_confirmation');
  await call('user_a', submit(AB, [game(11, 7)]));
  assertEquals(await call('user_a', { action: 'dispute', match_id: AB }), { status: 409, body: { error: 'own_report' } });

  const disputed = (await call('user_b', { action: 'dispute', match_id: AB })).body as MatchResultsState;
  assertEquals(disputed.match.status, 'disputed');
  assertEquals(disputed.rating_change, null);
  assertEquals((await call('user_b', { action: 'dispute', match_id: AB })).status, 200);
  assertEquals(await call('user_b', { action: 'confirm', match_id: AB }), {
    status: 409,
    body: { error: 'match_not_awaiting_confirmation' },
  });
  assertEquals(history.length, 0);
});

Deno.test('bot on: the Demo Tester confirms on the first call after the delay; its rating never moves', async () => {
  const { call, advance, ratings, history, logs } = setup({ demoBotEnabled: true });
  const botBefore = { ...ratings.get(DEMO_TESTER_USER_ID)! };

  const submitted = (await call('user_a', submit(ABOT, [game(11, 4)]))).body as MatchResultsState;
  assertEquals(submitted.match.status, 'awaiting_confirmation');
  assertEquals(submitted.opponent.is_bot, true);

  advance(DEMO_BOT_CONFIRM_DELAY_MS - 1);
  assertEquals(((await call('user_a', { action: 'state', match_id: ABOT })).body as MatchResultsState).match.status, 'awaiting_confirmation');

  advance(1);
  const confirmed = (await call('user_a', { action: 'state', match_id: ABOT })).body as MatchResultsState;
  assertEquals(confirmed.match.status, 'confirmed');
  assert(confirmed.rating_change!.delta > 0, 'beating the bot counts');
  assertEquals(ratings.get(DEMO_TESTER_USER_ID), botBefore);
  assertEquals(history.map((h) => h.player_id), [A]);
  assert(logs.some((l) => l.event === 'match_confirmed' && l.demo_bot === true));

  // Later polls don't apply it again.
  advance(10_000);
  await call('user_a', { action: 'state', match_id: ABOT });
  assertEquals(history.length, 1);
});

Deno.test('bot off: the Demo Tester never confirms, never asked', async () => {
  const { call, advance, calls } = setup({ demoBotEnabled: false });
  await call('user_a', submit(ABOT, [game(11, 4)]));
  advance(60_000);
  const polled = (await call('user_a', { action: 'state', match_id: ABOT })).body as MatchResultsState;
  assertEquals(polled.match.status, 'awaiting_confirmation');
  assert(!calls.includes('botConfirmDue'));
});

Deno.test('an outsider cannot read a match', async () => {
  const { call } = setup({ demoBotEnabled: true });
  assertEquals(await call('user_out', { action: 'state', match_id: AB }), { status: 404, body: { error: 'match_not_found' } });
});

Deno.test('an invalid state from the database is a 500, not a bad payload', async () => {
  const fake = fakeStore();
  const handler = createHandler({
    authenticate: () => Promise.resolve('user_a'),
    store: { ...fake.store, state: () => Promise.resolve({ match: { nope: true } }) },
    demoBotEnabled: false,
    log: () => {},
  });
  const res = await handler(
    new Request('http://localhost/match-results', { method: 'POST', body: JSON.stringify({ action: 'state', match_id: AB }) }),
  );
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'internal' });
});
