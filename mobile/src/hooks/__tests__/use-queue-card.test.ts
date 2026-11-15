import { act, renderHook } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { MatchFoundRoute } from '@/constants/match';
import { type Matchmaking, useMatchmaking } from '@/hooks/use-matchmaking';
import { useQueueCard } from '@/hooks/use-queue-card';
import { en } from '@/i18n/en';
import { idleState, matchState, searchingState } from '@/test-utils/matchmaking';
import { matchmakingPhase, mergeSnapshot, QueueRadiusMiles } from '@/utils/matchmaking-state';

// useMatchmaking itself is tested against the network boundary in
// use-matchmaking.test.tsx; here it's the card's input.
jest.mock('@/hooks/use-matchmaking', () => ({ useMatchmaking: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));

const mockUseMatchmaking = useMatchmaking as jest.Mock;
const push = jest.fn();

function matchmaking(state: Parameters<typeof mergeSnapshot>[0], extra: Partial<Matchmaking> = {}): Matchmaking {
  return {
    snapshot: mergeSnapshot(state, undefined),
    phase: matchmakingPhase(state),
    error: null,
    busy: false,
    join: jest.fn().mockResolvedValue(true),
    leave: jest.fn().mockResolvedValue(true),
    accept: jest.fn(),
    decline: jest.fn(),
    refresh: jest.fn(),
    ...extra,
  };
}

describe('useQueueCard', () => {
  beforeEach(() => (useRouter as jest.Mock).mockReturnValue({ push }));
  afterEach(() => jest.clearAllMocks());

  it('idle: Find a match joins', () => {
    const mm = matchmaking(idleState);
    mockUseMatchmaking.mockReturnValue(mm);
    const { result } = renderHook(() => useQueueCard());

    expect(result.current.status).toEqual({ kind: 'idle' });
    act(() => result.current.onFindMatch());
    expect(mm.join).toHaveBeenCalled();
  });

  it('searching: timer from the queue entry, and Leave leaves', () => {
    const mm = matchmaking(searchingState);
    mockUseMatchmaking.mockReturnValue(mm);
    const { result } = renderHook(() => useQueueCard());

    expect(result.current.status).toEqual({
      kind: 'searching',
      since: searchingState.queue_entry!.created_at,
      radiusMiles: QueueRadiusMiles,
    });
    act(() => result.current.onLeave());
    expect(mm.leave).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('opens Match Found once when a proposal arrives, and again from the card', () => {
    mockUseMatchmaking.mockReturnValue(matchmaking(searchingState));
    const { result, rerender } = renderHook(() => useQueueCard());

    mockUseMatchmaking.mockReturnValue(matchmaking(matchState('proposed')));
    rerender({});
    rerender({});
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(MatchFoundRoute);
    expect(result.current.status).toEqual({ kind: 'matched', opponent: en.matchmaking.botName, waiting: false });

    act(() => result.current.onOpenMatch());
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('shows the waiting and match-on states without navigating', () => {
    mockUseMatchmaking.mockReturnValue(matchmaking(matchState('proposed', { playerAccepted: true })));
    const { result, rerender } = renderHook(() => useQueueCard());
    expect(result.current.status).toEqual({ kind: 'matched', opponent: en.matchmaking.botName, waiting: true });

    mockUseMatchmaking.mockReturnValue(matchmaking(matchState('accepted')));
    rerender({});
    expect(result.current.status).toEqual({ kind: 'on', opponent: en.matchmaking.botName });
    expect(push).not.toHaveBeenCalled();
  });

  it('turns an error code into copy', () => {
    mockUseMatchmaking.mockReturnValue(matchmaking(idleState, { error: 'profile_required', busy: true }));
    const { result } = renderHook(() => useQueueCard());

    expect(result.current.error).toBe(en.matchmaking.errors.profile_required);
    expect(result.current.busy).toBe(true);
  });
});
