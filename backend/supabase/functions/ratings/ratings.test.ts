// cd backend/supabase/functions/ratings && deno test
//
// The Glicko-2 math against Glickman's published worked example, how a
// match result maps onto it (rounding, bots, defaults), and confirmMatch's
// retry/idempotency contract with a fake store.
import { assert, assertAlmostEquals, assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert@1';
import { DEMO_TESTER_USER_ID, RatingChangeSchema } from '@myrating/shared';

import { confirmMatch, RatingStale, type RatingsStore } from './confirm.ts';
import { glicko2Update } from './glicko2.ts';
import { computeMatchUpdates, type RatingMatchInputs, type RatingPlayerInput, type RatingUpdate } from './update.ts';

const MATCH_ID = '8b3e4d0a-5f6c-4e7d-9a91-2c3d4e5f6071';
const A = '6f1c2b8e-3d4a-4c5b-9e7f-0a1b2c3d4e5f';
const B = '7a2d3c9f-4e5b-4d6c-8f80-1b2c3d4e5f60';
const game = (a: number, b: number) => ({ player_a_points: a, player_b_points: b });

Deno.test("Glickman's worked example: 1500/200 vs 1400/30 W, 1550/100 L, 1700/300 L", () => {
  const next = glicko2Update({ rating: 1500, deviation: 200, volatility: 0.06 }, [
    { opponentRating: 1400, opponentDeviation: 30, score: 1 },
    { opponentRating: 1550, opponentDeviation: 100, score: 0 },
    { opponentRating: 1700, opponentDeviation: 300, score: 0 },
  ]);
  // The paper rounds its Glicko-2-scale intermediates to 4 places (μ' = −0.2069,
  // φ' = 0.8722) before converting back, so 1464.06 / 151.52 carry up to
  // 0.00005 × 173.7178 ≈ 0.009 of rounding; full precision gives 1464.05.
  // Check the intermediates at the paper's precision, then the published values.
  assertAlmostEquals((next.rating - 1500) / 173.7178, -0.2069, 0.00005);
  assertAlmostEquals(next.deviation / 173.7178, 0.8722, 0.00005);
  assertAlmostEquals(next.rating, 1464.06, 0.01);
  assertAlmostEquals(next.deviation, 151.52, 0.01);
  // Published to 5 places (0.059996 at full precision).
  assertAlmostEquals(next.volatility, 0.05999, 0.00001);
});

Deno.test('no games: only the RD grows', () => {
  const next = glicko2Update({ rating: 1600, deviation: 50, volatility: 0.06 }, []);
  assertEquals(next.rating, 1600);
  assertEquals(next.volatility, 0.06);
  assertAlmostEquals(next.deviation, Math.sqrt(50 ** 2 + (0.06 * 173.7178) ** 2), 1e-9);
});

const player = (id: string, rating: number | null, rd: number | null = 60, extra: Partial<RatingPlayerInput> = {}) => ({
  id,
  is_bot: false,
  rating,
  mmr: rating,
  rating_deviation: rating === null ? null : rd,
  volatility: rating === null ? null : 0.06,
  ...extra,
});

const inputs = (games: ReturnType<typeof game>[], a: RatingPlayerInput, b: RatingPlayerInput): RatingMatchInputs => ({
  match_id: MATCH_ID,
  status: 'awaiting_confirmation',
  games,
  player_a: a,
  player_b: b,
});

const toChange = (u: RatingUpdate) => ({ match_id: MATCH_ID, player_id: u.player_id, before: u.before, after: u.rating, delta: Math.round((u.rating - u.before) * 100) / 100 });

Deno.test('a match is one game for Glicko-2: the winner scores 1, margins and game count ignored', () => {
  const a = player(A, 1500, 200);
  const b = player(B, 1400, 30);
  const oneGame = computeMatchUpdates(inputs([game(11, 0)], a, b));
  const threeGames = computeMatchUpdates(inputs([game(9, 11), game(11, 9), game(15, 13)], a, b));
  assertEquals(oneGame, threeGames);

  const expected = glicko2Update({ rating: 1500, deviation: 200, volatility: 0.06 }, [
    { opponentRating: 1400, opponentDeviation: 30, score: 1 },
  ]);
  const [ua, ub] = oneGame;
  assertEquals(ua!.player_id, A);
  assertEquals(ua!.rating, Math.round(expected.rating * 100) / 100);
  assert(ua!.rating > 1500 && ub!.rating < 1400, 'winner up, loser down');
});

Deno.test('updates are rounded to the column scales and delta = rounded after - rounded before', () => {
  const [ua, ub] = computeMatchUpdates(inputs([game(11, 7), game(11, 8)], player(A, 1512.37, 87.5), player(B, 1498.11, 140)));
  for (const u of [ua!, ub!]) {
    assertEquals(u.rating, Number(u.rating.toFixed(2)));
    assertEquals(u.rating_deviation, Number(u.rating_deviation.toFixed(2)));
    assertEquals(u.volatility, Number(u.volatility.toFixed(6)));
    assert(RatingChangeSchema.safeParse(toChange(u)).success);
  }
  assertEquals(ua!.before, 1512.37);
  assertEquals(ua!.expected_mmr, 1512.37);
});

Deno.test('a player with no ratings row starts at 1500 / 350 / 0.06', () => {
  const [ua] = computeMatchUpdates(inputs([game(11, 3)], player(A, null), player(B, 1500, 350)));
  const expected = glicko2Update({ rating: 1500, deviation: 350, volatility: 0.06 }, [
    { opponentRating: 1500, opponentDeviation: 350, score: 1 },
  ]);
  assertEquals(ua!.before, 1500);
  assertEquals(ua!.expected_rating, null);
  assertEquals(ua!.expected_volatility, null);
  assertEquals(ua!.rating, Math.round(expected.rating * 100) / 100);
  assert(ua!.rating_deviation <= 350);
});

Deno.test('the Demo Tester gets no update, but the human is rated against it', () => {
  const bot = player(DEMO_TESTER_USER_ID, 1500, 60, { is_bot: true });
  const updates = computeMatchUpdates(inputs([game(5, 11)], player(A, 1500, 60), bot));
  assertEquals(updates.length, 1);
  assertEquals(updates[0]!.player_id, A);
  assert(updates[0]!.rating < 1500, 'losing to the bot costs rating');
});

Deno.test('stored games that are not a valid result throw instead of rating', () => {
  assertThrows(() => computeMatchUpdates(inputs([game(11, 9), game(9, 11)], player(A, 1500), player(B, 1500))));
  assertThrows(() => computeMatchUpdates(inputs([], player(A, 1500), player(B, 1500))));
});

function fakeRatingsStore(opts: { status?: string; staleTimes?: number } = {}) {
  let status = opts.status ?? 'awaiting_confirmation';
  let stale = opts.staleTimes ?? 0;
  const applied: RatingUpdate[][] = [];
  let reads = 0;
  const store: RatingsStore = {
    ratingInputs() {
      reads++;
      return Promise.resolve({ ...inputs([game(11, 6)], player(A, 1500), player(B, 1500)), status });
    },
    applyRatings(_matchId, _confirmer, updates) {
      if (status === 'confirmed') return Promise.resolve(false);
      if (stale > 0) {
        stale--;
        return Promise.reject(new RatingStale());
      }
      applied.push(updates);
      status = 'confirmed';
      return Promise.resolve(true);
    },
  };
  return { store, applied, reads: () => reads };
}

Deno.test('confirmMatch applies once; confirming again writes nothing', async () => {
  const { store, applied } = fakeRatingsStore();
  assertEquals(await confirmMatch(store, MATCH_ID, B), true);
  assertEquals(await confirmMatch(store, MATCH_ID, B), false);
  assertEquals(applied.length, 1);
  assertEquals(applied[0]!.length, 2);
});

Deno.test('confirmMatch on an already-confirmed match sends no updates', async () => {
  const { store, applied } = fakeRatingsStore({ status: 'confirmed' });
  assertEquals(await confirmMatch(store, MATCH_ID, B), false);
  assertEquals(applied.length, 0);
});

Deno.test('confirmMatch re-reads and recomputes when a rating moved, then gives up', async () => {
  const retried = fakeRatingsStore({ staleTimes: 2 });
  assertEquals(await confirmMatch(retried.store, MATCH_ID, B), true);
  assertEquals(retried.reads(), 3);

  const stuck = fakeRatingsStore({ staleTimes: 5 });
  await assertRejects(() => confirmMatch(stuck.store, MATCH_ID, B), RatingStale);
});
