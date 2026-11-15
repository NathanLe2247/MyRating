import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEMO_TESTER_USER_ID,
  MATCH_RESULTS_ACTIONS,
  MatchResultsRequestSchema,
  MatchResultsStateSchema,
} from './index.ts';

const MATCH_ID = '8b3e4d0a-5f6c-4e7d-9a91-2c3d4e5f6071';
const PLAYER = '6f1c2b8e-3d4a-4c5b-9e7f-0a1b2c3d4e5f';
const TS = '2026-11-14T10:00:00.123456+00:00';
const game = (a: number, b: number) => ({ player_a_points: a, player_b_points: b });

describe('MatchResultsRequestSchema', () => {
  it('parses every action', () => {
    const requests = [
      { action: 'submit', match_id: MATCH_ID, games: [game(11, 7)] },
      { action: 'confirm', match_id: MATCH_ID },
      { action: 'dispute', match_id: MATCH_ID },
      { action: 'state', match_id: MATCH_ID },
    ];
    assert.deepEqual(
      requests.map((r) => MatchResultsRequestSchema.parse(r).action),
      [...MATCH_RESULTS_ACTIONS],
    );
  });

  it('applies the submission scoring rules, game and match level', () => {
    const submit = (games: unknown[]) =>
      MatchResultsRequestSchema.safeParse({ action: 'submit', match_id: MATCH_ID, games });
    assert.equal(submit([game(11, 9), game(9, 11), game(13, 11)]).success, true);
    assert.equal(submit([]).success, false);
    assert.equal(submit([game(11, 10)]).success, false, 'not won by 2');
    const split = submit([game(11, 9), game(9, 11)]);
    assert.equal(split.success, false, 'split games');
    assert.match(split.error!.issues[0]!.message, /split/);
    const afterTwoNil = submit([game(11, 9), game(11, 5), game(5, 11)]);
    assert.equal(afterTwoNil.success, false, 'no 3rd game after 2–0');
    assert.deepEqual(afterTwoNil.error!.issues[0]!.path, ['games', 2]);
  });

  it('rejects a bad match id and an unknown action', () => {
    assert.equal(MatchResultsRequestSchema.safeParse({ action: 'confirm', match_id: 'm1' }).success, false);
    assert.equal(MatchResultsRequestSchema.safeParse({ action: 'report', match_id: MATCH_ID }).success, false);
  });
});

describe('MatchResultsStateSchema', () => {
  const state = {
    match: {
      id: MATCH_ID,
      player_a_id: PLAYER,
      player_b_id: DEMO_TESTER_USER_ID,
      court_id: null,
      status: 'confirmed',
      player_a_accepted_at: TS,
      player_b_accepted_at: TS,
      reported_by: PLAYER,
      created_at: TS,
      updated_at: TS,
    },
    games: [{ match_id: MATCH_ID, game_number: 1, ...game(11, 4) }],
    opponent: { id: DEMO_TESTER_USER_ID, username: null, first_name: 'Demo', rating: 1500, is_bot: true },
    rating_change: { match_id: MATCH_ID, player_id: PLAYER, before: 1500, after: 1662.31, delta: 162.31 },
  };

  it("parses a confirmed match with the caller's rating change", () => {
    assert.equal(MatchResultsStateSchema.parse(state).rating_change?.delta, 162.31);
  });

  it('allows no games and no rating change yet', () => {
    const accepted = {
      ...state,
      match: { ...state.match, status: 'accepted', reported_by: null },
      games: [],
      rating_change: null,
    };
    assert.equal(MatchResultsStateSchema.safeParse(accepted).success, true);
  });

  it('rejects a rating change whose delta is not after - before', () => {
    const bad = { ...state, rating_change: { ...state.rating_change, delta: 10 } };
    assert.equal(MatchResultsStateSchema.safeParse(bad).success, false);
  });
});
