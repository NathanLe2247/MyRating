import { useUser } from '@clerk/expo';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';

import { useMatchFoundScreen } from '@/hooks/use-match-found-screen';
import { type MatchResult, useMatchResult } from '@/hooks/use-match-result';
import { type Matchmaking, useMatchmaking } from '@/hooks/use-matchmaking';
import { en } from '@/i18n/en';
import { AnchorPoint, idleState, MatchId, matchState, searchingState } from '@/test-utils/matchmaking';
import { matchmakingPhase, mergeSnapshot } from '@/utils/matchmaking-state';
import type { ReportResultView } from '@/types/match-results';

// useMatchmaking is tested against the network boundary in
// use-matchmaking.test.tsx; here it's the screen's input.
jest.mock('@/hooks/use-matchmaking', () => ({ useMatchmaking: jest.fn() }));
// The match result is tested in use-match-result.test.tsx; here it's an input.
jest.mock('@/hooks/use-match-result', () => ({ useMatchResult: jest.fn() }));
jest.mock('@clerk/expo', () => ({ useUser: jest.fn() }));
jest.mock('expo-router', () => ({
  router: { canGoBack: jest.fn(() => true), back: jest.fn(), replace: jest.fn() },
}));

const mockUseMatchmaking = useMatchmaking as jest.Mock;
const mockUseMatchResult = useMatchResult as jest.Mock;

function matchResult(extra: Partial<MatchResult> = {}): MatchResult {
  return {
    view: null,
    tracked: null,
    draft: { games: [{ you: 0, opponent: 0 }], active: 0 },
    problem: undefined,
    busy: false,
    error: undefined,
    editDraft: jest.fn(),
    submit: jest.fn(),
    confirm: jest.fn(),
    dispute: jest.fn(),
    dismiss: jest.fn(),
    ...extra,
  };
}

const view = (stage: ReportResultView['stage']): ReportResultView => ({
  matchId: MatchId,
  opponent: en.matchmaking.botName,
  stage,
});

function matchmaking(state: Parameters<typeof mergeSnapshot>[0] | undefined, extra: Partial<Matchmaking> = {}): Matchmaking {
  return {
    // Paired while the player was at PlayerRating.
    snapshot: state && mergeSnapshot(state, mergeSnapshot(searchingState, undefined, AnchorPoint), undefined, PlayerRating),
    phase: matchmakingPhase(state),
    error: null,
    busy: false,
    join: jest.fn(),
    leave: jest.fn().mockResolvedValue(true),
    accept: jest.fn().mockResolvedValue(true),
    decline: jest.fn().mockResolvedValue(true),
    refresh: jest.fn(),
    ...extra,
  };
}

const PlayerRating = 1480;

describe('useMatchFoundScreen', () => {
  beforeEach(() => {
    (useUser as jest.Mock).mockReturnValue({ user: { firstName: 'Sam', username: 'sam' } });
    mockUseMatchResult.mockReturnValue(matchResult());
  });
  afterEach(() => jest.clearAllMocks());

  it('shows the live proposal with the player and re-reads the state on open', () => {
    const mm = matchmaking(matchState('proposed'));
    mockUseMatchmaking.mockReturnValue(mm);
    const { result } = renderHook(() => useMatchFoundScreen());

    expect(mm.refresh).toHaveBeenCalled();
    expect(result.current.phase).toBe('proposed');
    expect(result.current.match?.player).toEqual({ name: 'Sam', rating: PlayerRating });
    expect(result.current.match?.opponent.rating).toBe(1500);
    expect(result.current.match?.opponent.name).toBe(en.matchmaking.botName);
    expect(result.current.match?.venue?.name).toBe('Anchor Park Courts');
  });

  it('accepts', () => {
    const mm = matchmaking(matchState('proposed'));
    mockUseMatchmaking.mockReturnValue(mm);
    const { result } = renderHook(() => useMatchFoundScreen());

    act(() => result.current.onAccept());
    expect(mm.accept).toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it.each(['onDecline', 'onLeave'] as const)('%s goes back once it succeeds', async (handler) => {
    const mm = matchmaking(matchState('proposed'));
    mockUseMatchmaking.mockReturnValue(mm);
    const { result } = renderHook(() => useMatchFoundScreen());

    act(() => result.current[handler]());
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(handler === 'onDecline' ? mm.decline : mm.leave).toHaveBeenCalled();
  });

  it('stays put when declining fails', async () => {
    const mm = matchmaking(matchState('proposed'), {
      decline: jest.fn().mockResolvedValue(false),
      error: 'match_not_proposed',
    });
    mockUseMatchmaking.mockReturnValue(mm);
    const { result } = renderHook(() => useMatchFoundScreen());

    act(() => result.current.onDecline());
    await waitFor(() => expect(mm.decline).toHaveBeenCalled());
    expect(router.back).not.toHaveBeenCalled();
    expect(result.current.error).toBe(en.matchmaking.errors.match_not_proposed);
  });

  it.each([
    [matchState('proposed', { playerAccepted: true }), 'waiting_for_opponent'],
    [matchState('accepted'), 'on'],
    [matchState('awaiting_confirmation'), 'reported'],
  ] as const)('maps %#: to the %s view', (state, phase) => {
    mockUseMatchmaking.mockReturnValue(matchmaking(state));
    const { result } = renderHook(() => useMatchFoundScreen());

    expect(result.current.phase).toBe(phase);
    expect(result.current.match).not.toBeNull();
  });

  it('is loading before the first state, and empty without a match', () => {
    mockUseMatchmaking.mockReturnValue(matchmaking(undefined));
    const { result, rerender } = renderHook(() => useMatchFoundScreen());
    expect(result.current.loading).toBe(true);
    expect(result.current.match).toBeNull();

    mockUseMatchmaking.mockReturnValue(matchmaking(idleState));
    rerender({});
    expect(result.current.loading).toBe(false);
    expect(result.current.match).toBeNull();
  });

  it('opens directions to the suggested court', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockUseMatchmaking.mockReturnValue(matchmaking(matchState('accepted')));
    const { result } = renderHook(() => useMatchFoundScreen());

    result.current.onOpenMap?.();
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining(`${AnchorPoint.lat + 0.01},${AnchorPoint.lng}`));
  });

  it('has no map button without a court', () => {
    mockUseMatchmaking.mockReturnValue(matchmaking(matchState('accepted', { withCourt: false })));
    const { result } = renderHook(() => useMatchFoundScreen());

    expect(result.current.onOpenMap).toBeUndefined();
  });

  it('passes the score report for a match that is on', () => {
    mockUseMatchmaking.mockReturnValue(matchmaking(matchState('accepted')));
    mockUseMatchResult.mockReturnValue(matchResult({ view: view({ kind: 'enter' }) }));
    const { result } = renderHook(() => useMatchFoundScreen());

    expect(result.current.phase).toBe('on');
    expect(result.current.report?.view.stage.kind).toBe('enter');
  });

  it('has no report before the match is on', () => {
    mockUseMatchmaking.mockReturnValue(matchmaking(matchState('proposed')));
    const { result } = renderHook(() => useMatchFoundScreen());

    expect(result.current.report).toBeNull();
  });

  it('keeps showing a confirmed match after matchmaking forgets it, until Done', () => {
    const proposed = mergeSnapshot(matchState('proposed'), undefined, AnchorPoint, PlayerRating);
    // The last state before the result was confirmed; the dashboard had
    // already moved on.
    const settledMatch = mergeSnapshot(matchState('awaiting_confirmation'), proposed, undefined, PlayerRating + 16);
    const mr = matchResult({
      tracked: settledMatch,
      view: view({ kind: 'confirmed', games: [{ you: 11, opponent: 7 }], won: true, ratingChange: null }),
    });
    mockUseMatchResult.mockReturnValue(mr);
    mockUseMatchmaking.mockReturnValue(matchmaking(idleState));
    const { result } = renderHook(() => useMatchFoundScreen());

    expect(result.current.phase).toBe('settled');
    expect(result.current.match?.opponent.name).toBe(en.matchmaking.botName);
    // Head-to-Head still compares the two pairing-time ratings.
    expect(result.current.match?.player.rating).toBe(PlayerRating);
    expect(result.current.match?.opponent.rating).toBe(1500);
    expect(result.current.match?.venue?.name).toBe('Anchor Park Courts');

    act(() => result.current.report?.onDone?.());
    expect(mr.dismiss).toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  it('shows a disputed result as settled while matchmaking still has the match', () => {
    mockUseMatchmaking.mockReturnValue(matchmaking(matchState('awaiting_confirmation')));
    mockUseMatchResult.mockReturnValue(matchResult({ view: view({ kind: 'disputed', games: [] }) }));
    const { result } = renderHook(() => useMatchFoundScreen());

    expect(result.current.phase).toBe('settled');
    expect(result.current.match).not.toBeNull();
  });
});
