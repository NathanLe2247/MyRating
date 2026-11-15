// cd backend/supabase/functions/matchmaking && deno test
//
// The store is an in-memory fake of the public.matchmaking_* functions
// (their SQL is covered by supabase/tests/matchmaking.test.sql): one waiting
// entry per player, pairing inside both radii nearest first, the bot after
// the wait, accept/decline/leave. Responses are parsed with the shared
// MatchmakingStateSchema by the handler itself, so a shape drift fails here.
//
// Locations are around the public anchor Columbia Local Park (39.1022, -76.9441).
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { DEMO_TESTER_USER_ID, type MatchmakingState } from '@myrating/shared';

import { createHandler, DEMO_BOT_WAIT_MS, MatchmakingRefusal, type MatchmakingStore } from './handler.ts';

const PLAYERS: Record<string, string> = {
  user_a: '6f1c2b8e-3d4a-4c5b-9e7f-0a1b2c3d4e5f',
  user_b: '7a2d3c9f-4e5b-4d6c-8f80-1b2c3d4e5f60',
  user_far: '9c4f5e1b-6a7d-4f8e-8b02-3d4e5f607182',
};
const NO_PROFILE = 'user_new';
const ANCHOR = { lat: 39.1022, lng: -76.9441 };

type Entry = { id: string; player_id: string; lat: number; lng: number; radius_m: number; status: string; created_at: number };
type MatchRow = {
  id: string;
  player_a_id: string;
  player_b_id: string;
  status: string;
  player_a_accepted_at: string | null;
  player_b_accepted_at: string | null;
};

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.hypot(x, y) * 6_371_000;
}

function fakeStore() {
  let now = Date.parse('2026-11-14T12:00:00Z');
  const iso = (t: number) => new Date(t).toISOString();
  const entries: Entry[] = [];
  const matches: MatchRow[] = [];
  const calls: string[] = [];
  const open = (playerId: string) =>
    matches.filter(
      (m) => [m.player_a_id, m.player_b_id].includes(playerId) && ['proposed', 'accepted'].includes(m.status),
    );
  const waiting = (playerId: string) => entries.find((e) => e.player_id === playerId && e.status === 'waiting');

  const store: MatchmakingStore = {
    playerIdFor: (clerkUserId) => Promise.resolve(PLAYERS[clerkUserId] ?? null),
    join(playerId, lat, lng, radius_m) {
      calls.push('join');
      if (open(playerId).some((m) => m.status === 'proposed')) throw new MatchmakingRefusal('match_pending');
      if (open(playerId).length > 0) throw new MatchmakingRefusal('match_open');
      const existing = waiting(playerId);
      if (existing) Object.assign(existing, { lat, lng, radius_m });
      else entries.push({ id: crypto.randomUUID(), player_id: playerId, lat, lng, radius_m, status: 'waiting', created_at: now });
      return Promise.resolve();
    },
    leave(playerId) {
      calls.push('leave');
      const e = waiting(playerId);
      if (e) e.status = 'left';
      // accepted matches here never have a reported result yet
      for (const m of open(playerId)) m.status = 'cancelled';
      return Promise.resolve();
    },
    pair(playerId) {
      calls.push('pair');
      const me = waiting(playerId);
      if (!me) return Promise.resolve(null);
      const other = entries
        .filter((e) => e.status === 'waiting' && e.player_id !== playerId)
        .filter((e) => metres(e, me) <= Math.min(e.radius_m, me.radius_m))
        .sort((x, y) => metres(x, me) - metres(y, me))[0];
      if (!other) return Promise.resolve(null);
      const m: MatchRow = {
        id: crypto.randomUUID(),
        player_a_id: other.player_id,
        player_b_id: playerId,
        status: 'proposed',
        player_a_accepted_at: null,
        player_b_accepted_at: null,
      };
      matches.push(m);
      me.status = other.status = 'matched';
      return Promise.resolve(m.id);
    },
    pairWithBot(playerId, minWaitMs) {
      calls.push('pairWithBot');
      const me = waiting(playerId);
      if (!me || now - me.created_at < minWaitMs) return Promise.resolve(null);
      const m: MatchRow = {
        id: crypto.randomUUID(),
        player_a_id: playerId,
        player_b_id: DEMO_TESTER_USER_ID,
        status: 'proposed',
        player_a_accepted_at: null,
        player_b_accepted_at: iso(now),
      };
      matches.push(m);
      me.status = 'matched';
      return Promise.resolve(m.id);
    },
    respond(playerId, matchId, accept) {
      calls.push('respond');
      const m = matches.find((x) => x.id === matchId);
      if (!m || ![m.player_a_id, m.player_b_id].includes(playerId)) throw new MatchmakingRefusal('match_not_found');
      if (m.status !== 'proposed') throw new MatchmakingRefusal('match_not_proposed');
      if (!accept) {
        m.status = 'declined';
      } else {
        if (playerId === m.player_a_id) m.player_a_accepted_at ??= iso(now);
        else m.player_b_accepted_at ??= iso(now);
        if (m.player_a_accepted_at && m.player_b_accepted_at) m.status = 'accepted';
      }
      return Promise.resolve();
    },
    state(playerId) {
      const e = waiting(playerId);
      const m = open(playerId).at(-1);
      const opponentId = m && (m.player_a_id === playerId ? m.player_b_id : m.player_a_id);
      return Promise.resolve({
        queue_entry: e
          ? {
            id: e.id,
            player_id: e.player_id,
            location: { type: 'Point', coordinates: [e.lng, e.lat] },
            radius_m: e.radius_m,
            status: e.status,
            created_at: iso(e.created_at),
            updated_at: iso(now),
          }
          : null,
        match: m ? { ...m, court_id: null, reported_by: null, created_at: iso(now), updated_at: iso(now) } : null,
        opponent: opponentId
          ? {
            id: opponentId,
            username: null,
            first_name: opponentId === DEMO_TESTER_USER_ID ? 'Demo' : null,
            rating: 1500,
            is_bot: opponentId === DEMO_TESTER_USER_ID,
          }
          : null,
        court: null,
      });
    },
  };
  return { store, calls, matches, advance: (ms: number) => (now += ms) };
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
      new Request('http://localhost/matchmaking', {
        method,
        headers: clerkUserId ? { Authorization: `Bearer ${clerkUserId}` } : {},
        body: method === 'POST' ? JSON.stringify(body) : undefined,
      }),
    );
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { ...fake, logs, call };
}

const join = (lat = ANCHOR.lat, radius_m = 1000) => ({ action: 'join', lat, lng: ANCHOR.lng, radius_m });

Deno.test('rejects missing auth, unknown players and bad bodies', async () => {
  const { call } = setup();
  assertEquals((await call(null, { action: 'poll' })).status, 401);
  assertEquals((await call('user_forged', { action: 'poll' })).status, 401);
  assertEquals(await call(NO_PROFILE, { action: 'poll' }), { status: 403, body: { error: 'profile_required' } });
  assertEquals((await call('user_a', { action: 'tick' })).body.error, 'invalid_request');
  assertEquals((await call('user_a', join(91))).status, 400);
  assertEquals((await call('user_a', { ...join(), radius_m: 100_001 })).status, 400);
  assertEquals((await call('user_a', { action: 'accept', match_id: 'nope' })).status, 400);
  assertEquals((await call('user_a', {}, 'GET')).status, 405);
});

Deno.test('join waits, then a nearby player pairs on their join', async () => {
  const { call } = setup();
  const a = await call('user_a', join());
  assertEquals(a.status, 200);
  const stateA = a.body as MatchmakingState;
  assertEquals(stateA.queue_entry?.status, 'waiting');
  assertEquals(stateA.queue_entry?.location.coordinates, [ANCHOR.lng, ANCHOR.lat]);
  assertEquals(stateA.match, null);

  // ~500 m north, inside both 1 km radii.
  const b = (await call('user_b', join(39.1067))).body as MatchmakingState;
  assertEquals(b.queue_entry, null);
  assertEquals(b.match?.status, 'proposed');
  assertEquals(b.match?.player_a_id, PLAYERS.user_a);
  assertEquals(b.opponent?.id, PLAYERS.user_a);

  const polled = (await call('user_a', { action: 'poll' })).body as MatchmakingState;
  assertEquals(polled.match?.id, b.match?.id);
});

Deno.test('players outside each other\'s radius stay waiting', async () => {
  const { call } = setup();
  await call('user_a', join(ANCHOR.lat, 5000));
  // ~2 km away with a 1 km radius: the smaller radius decides.
  const far = (await call('user_far', join(39.1202, 1000))).body as MatchmakingState;
  assertEquals(far.match, null);
  assertEquals(far.queue_entry?.status, 'waiting');
});

Deno.test('accept by both players makes the match accepted', async () => {
  const { call } = setup();
  await call('user_a', join());
  const matchId = ((await call('user_b', join())).body as MatchmakingState).match!.id;

  const one = (await call('user_a', { action: 'accept', match_id: matchId })).body as MatchmakingState;
  assertEquals(one.match?.status, 'proposed');
  assert(one.match?.player_a_accepted_at);

  const both = (await call('user_b', { action: 'accept', match_id: matchId })).body as MatchmakingState;
  assertEquals(both.match?.status, 'accepted');

  assertEquals(await call('user_b', { action: 'decline', match_id: matchId }), {
    status: 409,
    body: { error: 'match_not_proposed' },
  });

  // One open match per player: no queueing while this one is on.
  assertEquals(await call('user_a', join()), { status: 409, body: { error: 'match_open' } });
});

Deno.test('leave backs out of an accepted match before any result', async () => {
  const { call } = setup();
  await call('user_a', join());
  const matchId = ((await call('user_b', join())).body as MatchmakingState).match!.id;
  await call('user_a', { action: 'accept', match_id: matchId });
  await call('user_b', { action: 'accept', match_id: matchId });

  const left = (await call('user_a', { action: 'leave' })).body as MatchmakingState;
  assertEquals(left.match, null);
  assertEquals(((await call('user_b', { action: 'poll' })).body as MatchmakingState).match, null);
  assertEquals((await call('user_a', join())).status, 200);
});

Deno.test('decline ends the match and lets the player rejoin', async () => {
  const { call } = setup();
  await call('user_a', join());
  const matchId = ((await call('user_b', join())).body as MatchmakingState).match!.id;

  assertEquals(await call('user_a', join()), { status: 409, body: { error: 'match_pending' } });
  assertEquals(await call('user_far', { action: 'decline', match_id: matchId }), {
    status: 404,
    body: { error: 'match_not_found' },
  });

  const declined = (await call('user_a', { action: 'decline', match_id: matchId })).body as MatchmakingState;
  assertEquals(declined.match, null);
  assertEquals((await call('user_a', join())).status, 200);
});

Deno.test('leave stops waiting and cancels a proposal', async () => {
  const { call, matches } = setup();
  const left = (await call('user_a', join()).then(() => call('user_a', { action: 'leave' }))).body as MatchmakingState;
  assertEquals(left.queue_entry, null);

  await call('user_a', join());
  await call('user_b', join());
  await call('user_b', { action: 'leave' });
  assertEquals(matches[0]?.status, 'cancelled');
  assertEquals(((await call('user_a', { action: 'poll' })).body as MatchmakingState).match, null);
});

Deno.test('bot on: pairs after the wait and has already accepted', async () => {
  const { call, advance, logs } = setup({ demoBotEnabled: true });
  const joined = (await call('user_a', join())).body as MatchmakingState;
  assertEquals(joined.match, null, 'no bot before the wait');

  advance(DEMO_BOT_WAIT_MS - 1);
  assertEquals(((await call('user_a', { action: 'poll' })).body as MatchmakingState).match, null);

  advance(1);
  const paired = (await call('user_a', { action: 'poll' })).body as MatchmakingState;
  assertEquals(paired.match?.player_b_id, DEMO_TESTER_USER_ID);
  assertEquals(paired.opponent?.id, DEMO_TESTER_USER_ID);
  assertEquals(paired.opponent?.is_bot, true);
  assert(paired.match?.player_b_accepted_at, 'the bot auto-accepts');
  assertEquals(paired.match?.status, 'proposed');
  assert(logs.some((l) => l.event === 'matchmaking_paired' && l.demo_bot === true));

  const accepted = (await call('user_a', { action: 'accept', match_id: paired.match!.id })).body as MatchmakingState;
  assertEquals(accepted.match?.status, 'accepted');
});

Deno.test('bot on: a real nearby player is preferred over the bot', async () => {
  const { call, advance } = setup({ demoBotEnabled: true });
  await call('user_a', join());
  advance(DEMO_BOT_WAIT_MS * 2);
  const b = (await call('user_b', join())).body as MatchmakingState;
  assertEquals(b.opponent?.id, PLAYERS.user_a);
});

Deno.test('bot off: never pairs, never asked', async () => {
  const { call, advance, calls } = setup({ demoBotEnabled: false });
  await call('user_a', join());
  advance(60_000);
  const polled = (await call('user_a', { action: 'poll' })).body as MatchmakingState;
  assertEquals(polled.match, null);
  assertEquals(polled.queue_entry?.status, 'waiting');
  assert(!calls.includes('pairWithBot'));
});

Deno.test('logs carry no coordinates', async () => {
  const { call, logs } = setup();
  await call('user_a', join());
  const text = JSON.stringify(logs);
  assert(!text.includes(String(ANCHOR.lat)) && !text.includes(String(ANCHOR.lng)));
});

Deno.test('an invalid state from the database is a 500, not a bad payload', async () => {
  const fake = fakeStore();
  const handler = createHandler({
    authenticate: () => Promise.resolve('user_a'),
    store: { ...fake.store, state: () => Promise.resolve({ queue_entry: { nope: true } }) },
    demoBotEnabled: false,
    log: () => {},
  });
  const res = await handler(new Request('http://localhost/matchmaking', { method: 'POST', body: '{"action":"poll"}' }));
  assertEquals(res.status, 500);
  assertEquals(await res.json(), { error: 'internal' });
});
