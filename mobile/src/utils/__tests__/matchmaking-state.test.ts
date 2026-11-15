import { MATCHMAKING_ERRORS, MAX_GAMES, POINTS_TO_WIN, WIN_BY } from '@myrating/shared';

import { en } from '@/i18n/en';
import {
  AnchorPoint,
  idleState,
  JoinedAt,
  MatchId,
  matchState,
  searchingState,
} from '@/test-utils/matchmaking';
import { distanceMeters } from '@/utils/geo';
import { matchmakingErrorMessage } from '@/utils/matchmaking-error';
import {
  matchmakingPhase,
  mergeSnapshot,
  opponentName,
  QueueRadiusMiles,
  shouldPoll,
  toMatchFound,
} from '@/utils/matchmaking-state';

const player = { name: 'Sam', rating: null };

describe('matchmakingPhase / shouldPoll', () => {
  it.each([
    [undefined, 'loading', false],
    [idleState, 'idle', false],
    [searchingState, 'searching', true],
    [matchState('proposed'), 'proposed', true],
    [matchState('proposed', { playerAccepted: true }), 'waiting_for_opponent', true],
    [matchState('accepted'), 'accepted', false],
    [matchState('awaiting_confirmation'), 'awaiting_confirmation', false],
  ] as const)('%#: %s', (state, phase, polls) => {
    expect(matchmakingPhase(state)).toBe(phase);
    expect(shouldPoll(state)).toBe(polls);
  });

  it('reads the player’s acceptance from their own side when they are player_b', () => {
    const state = matchState('proposed');
    const flipped = {
      ...state,
      match: {
        ...state.match!,
        player_a_id: state.match!.player_b_id,
        player_b_id: state.match!.player_a_id,
        player_a_accepted_at: state.match!.player_b_accepted_at,
        player_b_accepted_at: null,
      },
    };
    expect(matchmakingPhase(flipped)).toBe('proposed');
  });
});

describe('mergeSnapshot', () => {
  it('keeps the origin and wait start through the match, and drops them when idle', () => {
    const searching = mergeSnapshot(searchingState, undefined, AnchorPoint);
    expect(searching).toMatchObject({ origin: AnchorPoint, waitingSince: JoinedAt });

    const matched = mergeSnapshot(matchState('proposed'), searching);
    expect(matched).toMatchObject({ origin: AnchorPoint, waitingSince: JoinedAt });

    const idle = mergeSnapshot(idleState, matched);
    expect(idle.origin).toBeUndefined();
    expect(idle.waitingSince).toBeUndefined();
  });
});

describe('opponentName', () => {
  it('names the bot, then first name, then username, then a fallback', () => {
    const base = { id: MatchId, rating: null, is_bot: false };
    expect(opponentName({ ...base, is_bot: true, first_name: 'Demo', username: null })).toBe(en.matchmaking.botName);
    expect(opponentName({ ...base, first_name: 'Rita', username: 'rita' })).toBe('Rita');
    expect(opponentName({ ...base, first_name: ' ', username: 'rita' })).toBe('rita');
    expect(opponentName({ ...base, first_name: null, username: null })).toBe(en.matchmaking.unnamedPlayer);
  });
});

describe('toMatchFound', () => {
  it('is null without a match', () => {
    expect(toMatchFound(undefined, player)).toBeNull();
    expect(toMatchFound(mergeSnapshot(searchingState, undefined), player)).toBeNull();
  });

  it('builds the view model from the match, court, and the device-side wait', () => {
    const snapshot = mergeSnapshot(matchState('proposed'), mergeSnapshot(searchingState, undefined, AnchorPoint));
    const match = toMatchFound(snapshot, player)!;

    const court = snapshot.court!.location.coordinates;
    expect(match).toEqual({
      id: MatchId,
      format: 'singles',
      official: false,
      player,
      opponent: { name: en.matchmaking.botName, rating: 1500 },
      searchRadiusMiles: QueueRadiusMiles,
      elapsedSeconds: 6,
      venue: {
        name: 'Anchor Park Courts',
        distanceMiles: distanceMeters(AnchorPoint, { lat: court[1], lng: court[0] }) / 1609.344,
      },
      rules: { games: MAX_GAMES, pointsTo: POINTS_TO_WIN, winBy: WIN_BY },
    });
    expect(match.venue!.distanceMiles).toBeCloseTo(0.69, 1);
  });

  it('leaves out what the device doesn’t know', () => {
    const match = toMatchFound(mergeSnapshot(matchState('accepted'), undefined), player)!;
    expect(match.elapsedSeconds).toBe(0);
    expect(match.venue).toEqual({ name: 'Anchor Park Courts', distanceMiles: undefined });

    const noCourt = toMatchFound(mergeSnapshot(matchState('accepted', { withCourt: false }), undefined), player)!;
    expect(noCourt.venue).toBeUndefined();
  });
});

describe('matchmakingErrorMessage', () => {
  it('has copy for every error code', () => {
    for (const code of [...MATCHMAKING_ERRORS, 'network', 'location_unavailable'] as const) {
      expect(matchmakingErrorMessage(code)).toMatch(/\w/);
    }
    expect(matchmakingErrorMessage('match_open')).toBe(en.matchmaking.errors.match_open);
  });
});

describe('distanceMeters', () => {
  it('is about 111 km per degree of latitude, and 0 for the same point', () => {
    expect(distanceMeters(AnchorPoint, AnchorPoint)).toBe(0);
    expect(distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -2);
  });
});
