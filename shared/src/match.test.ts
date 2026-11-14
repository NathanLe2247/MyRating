import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GAMES_TO_WIN_MATCH,
  MAX_GAMES,
  MatchGameSchema,
  MatchResultSubmissionSchema,
  MatchSchema,
  POINTS_TO_WIN,
  QueueEntrySchema,
  RatingChangeSchema,
  matchWinner,
  WIN_BY,
} from './index.ts';

const PLAYER_A = '6f1c2b8e-3d4a-4c5b-9e7f-0a1b2c3d4e5f';
const PLAYER_B = '7a2d3c9f-4e5b-4d6c-8f80-1b2c3d4e5f60';
const MATCH_ID = '8b3e4d0a-5f6c-4e7d-9a91-2c3d4e5f6071';

const game = (a: number, b: number) => ({ player_a_points: a, player_b_points: b });
const submission = (...games: [number, number][]) => ({
  match_id: MATCH_ID,
  games: games.map(([a, b]) => game(a, b)),
});
const messages = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues.map((i) => i.message) ?? [];

describe('rule constants', () => {
  it('are pickleball defaults', () => {
    assert.equal(POINTS_TO_WIN, 11);
    assert.equal(WIN_BY, 2);
    assert.equal(MAX_GAMES, 3);
    assert.equal(GAMES_TO_WIN_MATCH, 2);
  });
});

describe('QueueEntrySchema', () => {
  const entry = {
    id: MATCH_ID,
    player_id: PLAYER_A,
    location: { type: 'Point', coordinates: [-122.42, 37.77] },
    radius_m: 5000,
    status: 'waiting',
    created_at: '2026-11-14T10:00:00+00:00',
  };

  it('parses a waiting entry', () => {
    assert.deepEqual(QueueEntrySchema.parse(entry), entry);
  });

  it('accepts every status and rejects others', () => {
    for (const status of ['waiting', 'matched', 'left']) {
      assert.equal(QueueEntrySchema.safeParse({ ...entry, status }).success, true);
    }
    assert.equal(QueueEntrySchema.safeParse({ ...entry, status: 'playing' }).success, false);
  });

  it('rejects a non-positive radius and a non-uuid player', () => {
    assert.equal(QueueEntrySchema.safeParse({ ...entry, radius_m: 0 }).success, false);
    assert.equal(QueueEntrySchema.safeParse({ ...entry, player_id: 'user_2abc' }).success, false);
  });
});

describe('MatchSchema', () => {
  const match = {
    id: MATCH_ID,
    player_a_id: PLAYER_A,
    player_b_id: PLAYER_B,
    court_id: null,
    status: 'proposed',
    created_at: '2026-11-14T10:00:00+00:00',
    updated_at: '2026-11-14T10:00:00Z',
  };

  it('parses a proposed match without a court', () => {
    assert.deepEqual(MatchSchema.parse(match), match);
  });

  it('accepts every status', () => {
    for (const status of [
      'proposed',
      'accepted',
      'declined',
      'awaiting_result',
      'awaiting_confirmation',
      'confirmed',
      'disputed',
    ]) {
      assert.equal(MatchSchema.safeParse({ ...match, status }).success, true);
    }
    assert.equal(MatchSchema.safeParse({ ...match, status: 'finished' }).success, false);
  });

  it('rejects a player matched against themselves', () => {
    const result = MatchSchema.safeParse({ ...match, player_b_id: PLAYER_A });
    assert.equal(result.success, false);
    assert.deepEqual(messages(result), ['A match needs two different players.']);
  });
});

describe('MatchGameSchema', () => {
  for (const [a, b] of [
    [11, 7],
    [7, 11],
    [11, 0],
    [11, 9],
    [12, 10],
    [15, 13],
    [13, 15],
  ] as const) {
    it(`accepts ${a}–${b}`, () => {
      assert.equal(MatchGameSchema.safeParse(game(a, b)).success, true);
    });
  }

  for (const [a, b, why] of [
    [11, 10, 'won by'],
    [10, 8, 'go to 11'],
    [11, 11, 'tied'],
    [15, 11, 'ends as soon as'],
    [9, 12, 'ends as soon as'],
  ] as const) {
    it(`rejects ${a}–${b} with a clear message`, () => {
      const result = MatchGameSchema.safeParse(game(a, b));
      assert.equal(result.success, false);
      assert.match(messages(result).join(' '), new RegExp(why));
    });
  }

  it('rejects negative and fractional points', () => {
    assert.equal(MatchGameSchema.safeParse(game(11, -1)).success, false);
    assert.equal(MatchGameSchema.safeParse(game(11, 4.5)).success, false);
  });
});

describe('MatchResultSubmissionSchema', () => {
  it('accepts a 2–0 match', () => {
    assert.equal(MatchResultSubmissionSchema.safeParse(submission([11, 7], [12, 10])).success, true);
  });

  it('accepts a 2–1 match in either order', () => {
    assert.equal(MatchResultSubmissionSchema.safeParse(submission([11, 7], [13, 15], [11, 9])).success, true);
    assert.equal(MatchResultSubmissionSchema.safeParse(submission([7, 11], [11, 5], [10, 12])).success, true);
  });

  it('accepts a single game', () => {
    assert.equal(MatchResultSubmissionSchema.safeParse(submission([11, 7])).success, true);
  });

  it('rejects a 3rd game after 2–0', () => {
    const result = MatchResultSubmissionSchema.safeParse(submission([11, 7], [11, 9], [11, 3]));
    assert.equal(result.success, false);
    assert.deepEqual(messages(result), ["The match was already won 2–0; game 3 shouldn't have been played."]);
    assert.deepEqual(result.error?.issues[0]?.path, ['games', 2]);
  });

  it('rejects two winners (games split 1–1)', () => {
    const result = MatchResultSubmissionSchema.safeParse(submission([11, 7], [7, 11]));
    assert.equal(result.success, false);
    assert.match(messages(result).join(' '), /split 1–1/);
  });

  it('rejects an invalid game and points at it', () => {
    const result = MatchResultSubmissionSchema.safeParse(submission([11, 7], [11, 10]));
    assert.equal(result.success, false);
    assert.deepEqual(result.error?.issues[0]?.path, ['games', 1]);
  });

  it('rejects no games and more than 3 games', () => {
    assert.equal(MatchResultSubmissionSchema.safeParse(submission()).success, false);
    assert.equal(
      MatchResultSubmissionSchema.safeParse(submission([11, 7], [7, 11], [11, 9], [11, 9])).success,
      false,
    );
  });
});

describe('RatingChangeSchema', () => {
  it('parses a change whose delta is after - before', () => {
    const change = { match_id: MATCH_ID, player_id: PLAYER_A, before: 1500, after: 1523.45, delta: 23.45 };
    assert.deepEqual(RatingChangeSchema.parse(change), change);
  });

  it('parses a loss', () => {
    assert.equal(
      RatingChangeSchema.safeParse({ match_id: MATCH_ID, player_id: PLAYER_B, before: 1500, after: 1480, delta: -20 }).success,
      true,
    );
  });

  it('rejects a missing match_id', () => {
    assert.equal(
      RatingChangeSchema.safeParse({ player_id: PLAYER_A, before: 1500, after: 1520, delta: 20 }).success,
      false,
    );
  });

  it('rejects an inconsistent delta', () => {
    assert.equal(
      RatingChangeSchema.safeParse({ match_id: MATCH_ID, player_id: PLAYER_A, before: 1500, after: 1520, delta: 25 }).success,
      false,
    );
  });
});

describe('matchWinner', () => {
  const winnerOf = (...games: [number, number][]) =>
    matchWinner(MatchResultSubmissionSchema.parse(submission(...games)));

  it('returns the side that won 2–0', () => {
    assert.equal(winnerOf([11, 7], [12, 10]), 'a');
    assert.equal(winnerOf([7, 11], [13, 15]), 'b');
  });

  it('returns the side that won 2–1, whatever the game order', () => {
    assert.equal(winnerOf([7, 11], [11, 5], [12, 10]), 'a');
    assert.equal(winnerOf([11, 7], [5, 11], [10, 12]), 'b');
  });

  it('returns the winner of a single-game result', () => {
    assert.equal(winnerOf([9, 11]), 'b');
  });

  it('throws on split games instead of guessing', () => {
    assert.throws(() => matchWinner({ games: [game(11, 7), game(7, 11)] }), /split 1–1/);
  });
});
