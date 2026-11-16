import { MAX_GAMES } from '@myrating/shared';

import { MatchResultsPollMs, MaxStepperPoints } from '@/constants/match-results';
import { en } from '@/i18n/en';
import { DemoGames, DemoRatingChange, resultState } from '@/test-utils/match-results';
import { MatchId } from '@/test-utils/matchmaking';
import type { ScoreDraft } from '@/types/match-results';
import {
  addGame,
  draftProblem,
  emptyDraft,
  formatGames,
  playerIsA,
  removeLastGame,
  resultPollMs,
  resultStage,
  selectGame,
  stepPoints,
  toMatchGames,
  toPlayerGames,
} from '@/utils/match-result';

const games = (...scores: [number, number][]) => scores.map(([you, opponent]) => ({ you, opponent }));

describe('draftProblem', () => {
  it.each([
    ['one game', games([11, 7])],
    ['two straight games', games([11, 7], [11, 9])],
    ['three games', games([11, 7], [5, 11], [12, 10])],
    ['a loss', games([7, 11], [9, 11])],
  ])('accepts %s', (_, g) => {
    expect(draftProblem(MatchId, g)).toBeUndefined();
  });

  it('prompts for a blank form instead of erroring', () => {
    expect(draftProblem(MatchId, games([0, 0]))).toBe(en.reportResult.problems.blank);
  });

  it.each([
    ['an unfinished game', games([9, 7]), /isn.t finished/],
    ['a game not won by two', games([11, 10]), /won by 2/],
    ['an impossible deuce score', games([15, 11]), /isn.t possible/],
    ['a tied game', games([5, 5]), /tied/],
  ])('rejects %s with the shared rule', (_, g, message) => {
    expect(draftProblem(MatchId, g)).toMatch(message);
  });

  it('names the game once there are several', () => {
    expect(draftProblem(MatchId, games([11, 7], [9, 7]))).toMatch(/^Game 2: .*isn.t finished/);
  });

  it('rejects split games and a game after the match was decided', () => {
    expect(draftProblem(MatchId, games([11, 7], [7, 11]))).toMatch(/split 1–1/);
    expect(draftProblem(MatchId, games([11, 7], [11, 9], [11, 0]))).toMatch(/^Game 3: .*already won 2–0/);
  });
});

describe('sides', () => {
  const state = resultState('confirmed');

  it('knows which side the player is from the opponent', () => {
    expect(playerIsA(state.match, state.opponent.id)).toBe(true);
    expect(playerIsA({ player_a_id: state.opponent.id }, state.opponent.id)).toBe(false);
  });

  it('maps games both ways', () => {
    expect(toPlayerGames(DemoGames, true)).toEqual(games([11, 7], [11, 9]));
    expect(toPlayerGames(DemoGames, false)).toEqual(games([7, 11], [9, 11]));
    expect(toMatchGames(games([11, 7]), false)).toEqual([{ player_a_points: 7, player_b_points: 11 }]);
  });

  it('orders games by number', () => {
    expect(toPlayerGames([...DemoGames].reverse(), true)).toEqual(games([11, 7], [11, 9]));
  });
});

describe('draft edits', () => {
  it('steps the selected game within 0 and the stepper max', () => {
    let d = stepPoints(emptyDraft(), 'you', 1);
    expect(d.games[0]).toEqual({ you: 1, opponent: 0 });
    d = stepPoints(d, 'opponent', -1);
    expect(d.games[0].opponent).toBe(0);
    const high: ScoreDraft = { games: games([MaxStepperPoints, 0]), active: 0 };
    expect(stepPoints(high, 'you', 1).games[0].you).toBe(MaxStepperPoints);
  });

  it('adds games up to the maximum and selects the new one', () => {
    let d = emptyDraft();
    for (let i = 0; i < MAX_GAMES + 1; i++) d = addGame(d);
    expect(d.games).toHaveLength(MAX_GAMES);
    expect(d.active).toBe(MAX_GAMES - 1);
    d = stepPoints(d, 'you', 2);
    expect(d.games.map((g) => g.you)).toEqual([0, 0, 2]);
  });

  it('removes the last game but never the first', () => {
    const d = removeLastGame(addGame(emptyDraft()));
    expect(d).toEqual(emptyDraft());
    expect(removeLastGame(d)).toEqual(d);
  });

  it('selects only existing games', () => {
    const d = addGame(emptyDraft());
    expect(selectGame(d, 0).active).toBe(0);
    expect(selectGame(d, 5).active).toBe(1);
  });
});

describe('resultStage', () => {
  it('enters a score for an accepted match', () => {
    expect(resultStage(resultState('accepted'))).toEqual({ kind: 'enter' });
  });

  it('waits on the opponent after the player reports, and answers their report', () => {
    expect(resultStage(resultState('awaiting_confirmation'))).toEqual({
      kind: 'waiting',
      games: games([11, 7], [11, 9]),
    });
    expect(resultStage(resultState('awaiting_confirmation', { reportedBy: 'opponent' }))?.kind).toBe('answer');
  });

  it('shows the final score with the backend rating change', () => {
    expect(resultStage(resultState('confirmed'))).toEqual({
      kind: 'confirmed',
      games: games([11, 7], [11, 9]),
      won: true,
      ratingChange: DemoRatingChange,
    });
  });

  it('shows disputes, and nothing for a cancelled match', () => {
    expect(resultStage(resultState('disputed'))?.kind).toBe('disputed');
    expect(resultStage(resultState('cancelled'))).toBeNull();
  });
});

describe('resultPollMs', () => {
  it('polls only while the player waits on a confirmation', () => {
    expect(resultPollMs(resultState('awaiting_confirmation'))).toBe(MatchResultsPollMs);
    expect(resultPollMs(resultState('awaiting_confirmation', { reportedBy: 'opponent' }))).toBe(false);
    expect(resultPollMs(resultState('accepted'))).toBe(false);
    expect(resultPollMs(resultState('confirmed'))).toBe(false);
    expect(resultPollMs(undefined)).toBe(false);
  });
});

it('formats games from the player side', () => {
  expect(formatGames(games([11, 7], [11, 9]))).toBe('11–7, 11–9');
});
