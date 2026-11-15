import { useAuth, useUser } from '@clerk/expo';
import type { MatchmakingAction, MatchmakingState } from '@myrating/shared';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { getCurrentPositionAsync } from 'expo-location';
import type { ReactNode } from 'react';

import { demoLocation } from '@/config/demo-location';
import { useSupabaseClient } from '@/config/supabase';
import { MatchmakingPollMs, QueueRadiusMeters } from '@/constants/matchmaking';
import { OnboardingCompletedKey, ProfileCompletedKey } from '@/constants/profile';
import { useMatchmaking } from '@/hooks/use-matchmaking';
import { MatchmakingProvider } from '@/providers/matchmaking-provider';
import {
  AnchorPoint,
  idleState,
  JoinedAt,
  MatchId,
  matchState,
  searchingState,
} from '@/test-utils/matchmaking';

jest.mock('@clerk/expo', () => ({ useAuth: jest.fn(), useUser: jest.fn() }));
jest.mock('@/config/supabase', () => ({ useSupabaseClient: jest.fn() }));
jest.mock('@/config/demo-location', () => ({ demoLocation: jest.fn() }));
jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getCurrentPositionAsync: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseUser = useUser as jest.Mock;
const mockDemoLocation = demoLocation as jest.Mock;
const mockGetPosition = getCurrentPositionAsync as jest.Mock;
const invoke = jest.fn();

type Reply = MatchmakingState | { error: string } | 'offline' | 'garbage';

/**
 * The `matchmaking` function at the network boundary (`functions.invoke`):
 * each action answers from its queue of replies, repeating the last one.
 */
function serve(replies: Partial<Record<MatchmakingAction, Reply[]>>) {
  invoke.mockImplementation(async (_name: string, { body }: { body: { action: MatchmakingAction } }) => {
    const queue = replies[body.action] ?? [];
    const reply = (queue.length > 1 ? queue.shift() : queue[0]) ?? idleState;
    if (reply === 'offline') return { data: null, error: new Error('Failed to fetch') };
    if (reply === 'garbage') return { data: { hello: 'world' }, error: null };
    if ('error' in reply) {
      return { data: null, error: new FunctionsHttpError({ json: async () => reply }) };
    }
    return { data: reply, error: null };
  });
}

const actions = () => invoke.mock.calls.map(([, { body }]) => body.action as MatchmakingAction);
const bodies = (action: MatchmakingAction) =>
  invoke.mock.calls.map(([, { body }]) => body).filter((b) => b.action === action);

function signedIn(onboarded = true) {
  mockUseAuth.mockReturnValue({ isSignedIn: true, userId: 'user_test' });
  mockUseUser.mockReturnValue({
    isLoaded: true,
    user: { publicMetadata: onboarded ? { [ProfileCompletedKey]: 'x', [OnboardingCompletedKey]: 'x' } : {} },
  });
}

let client: QueryClient;

function render() {
  // No garbage-collection timers, so nothing outlives the test.
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MatchmakingProvider>{children}</MatchmakingProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useMatchmaking(), { wrapper });
}

async function settled(result: { current: ReturnType<typeof useMatchmaking> }) {
  await waitFor(() => expect(result.current.phase).not.toBe('loading'));
}

const tick = (ms = MatchmakingPollMs) => act(() => jest.advanceTimersByTimeAsync(ms));

describe('useMatchmaking', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockUseSupabaseClient();
    signedIn();
    mockDemoLocation.mockReturnValue(AnchorPoint);
  });
  afterEach(() => {
    client?.clear();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  function mockUseSupabaseClient() {
    (useSupabaseClient as jest.Mock).mockReturnValue({ functions: { invoke } });
  }

  it('reads the state once on start and stays quiet while idle', async () => {
    serve({ poll: [idleState] });
    const { result } = render();
    await settled(result);

    expect(result.current.phase).toBe('idle');
    expect(result.current.error).toBeNull();
    await tick(MatchmakingPollMs * 3);
    expect(actions()).toEqual(['poll']);
    expect(invoke).toHaveBeenCalledWith('matchmaking', { body: { action: 'poll' } });
  });

  it('does nothing until the player is onboarded', async () => {
    signedIn(false);
    serve({});
    const { result } = render();

    await tick();
    expect(result.current.phase).toBe('loading');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('joins from the demo location, polls, gets the Demo Tester, and accepts', async () => {
    serve({
      poll: [idleState, searchingState, matchState('proposed')],
      join: [searchingState],
      accept: [matchState('accepted')],
    });
    const { result } = render();
    await settled(result);

    await act(() => result.current.join());
    expect(bodies('join')).toEqual([
      { action: 'join', lat: AnchorPoint.lat, lng: AnchorPoint.lng, radius_m: QueueRadiusMeters },
    ]);
    expect(mockGetPosition).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('searching');
    expect(result.current.snapshot?.waitingSince).toBe(JoinedAt);
    expect(result.current.snapshot?.origin).toEqual(AnchorPoint);

    // Still searching on the next poll; the Demo Tester pairs on the one after.
    await tick();
    expect(result.current.phase).toBe('searching');
    await tick();
    await waitFor(() => expect(result.current.phase).toBe('proposed'));
    expect(bodies('poll').length).toBeGreaterThanOrEqual(2);
    expect(result.current.snapshot?.opponent?.is_bot).toBe(true);
    // Carried over from the wait, for the Match Found screen.
    expect(result.current.snapshot?.waitingSince).toBe(JoinedAt);
    expect(result.current.snapshot?.origin).toEqual(AnchorPoint);

    await act(() => result.current.accept());
    expect(bodies('accept')).toEqual([{ action: 'accept', match_id: MatchId }]);
    expect(result.current.phase).toBe('accepted');

    // Nothing left to wait for: polling stops.
    const calls = invoke.mock.calls.length;
    await tick(MatchmakingPollMs * 3);
    expect(invoke.mock.calls.length).toBe(calls);
  });

  it('keeps polling after accepting until the opponent answers', async () => {
    serve({
      poll: [matchState('proposed'), matchState('proposed', { playerAccepted: true }), matchState('accepted')],
      accept: [matchState('proposed', { playerAccepted: true })],
    });
    const { result } = render();
    await settled(result);

    await act(() => result.current.accept());
    expect(result.current.phase).toBe('waiting_for_opponent');
    await tick();
    expect(result.current.phase).toBe('waiting_for_opponent');
    await tick();
    await waitFor(() => expect(result.current.phase).toBe('accepted'));
  });

  it('joins from the GPS position without a demo location', async () => {
    mockDemoLocation.mockReturnValue(undefined);
    mockGetPosition.mockResolvedValue({ coords: { latitude: 40.5, longitude: -75.5 } });
    serve({ poll: [idleState], join: [searchingState] });
    const { result } = render();
    await settled(result);

    await act(() => result.current.join());
    expect(bodies('join')).toEqual([{ action: 'join', lat: 40.5, lng: -75.5, radius_m: QueueRadiusMeters }]);
  });

  it('reports location_unavailable when the position can’t be read, without joining', async () => {
    mockDemoLocation.mockReturnValue(undefined);
    mockGetPosition.mockRejectedValue(new Error('denied'));
    serve({ poll: [idleState] });
    const { result } = render();
    await settled(result);

    let joined: boolean | undefined;
    await act(async () => {
      joined = await result.current.join();
    });
    expect(joined).toBe(false);
    expect(result.current.error).toBe('location_unavailable');
    expect(bodies('join')).toEqual([]);
  });

  it('declines, then requeues to look for someone else', async () => {
    serve({ poll: [matchState('proposed')], decline: [idleState], join: [searchingState] });
    const { result } = render();
    await settled(result);
    expect(result.current.phase).toBe('proposed');

    await act(() => result.current.decline());
    expect(bodies('decline')).toEqual([{ action: 'decline', match_id: MatchId }]);
    await waitFor(() => expect(result.current.phase).toBe('searching'));
    expect(actions().slice(-2)).toEqual(['decline', 'join']);
  });

  it('leaves the queue and stops polling', async () => {
    serve({ poll: [searchingState], leave: [idleState] });
    const { result } = render();
    await settled(result);
    expect(result.current.phase).toBe('searching');

    await act(() => result.current.leave());
    expect(result.current.phase).toBe('idle');
    expect(result.current.snapshot?.waitingSince).toBeUndefined();

    const calls = invoke.mock.calls.length;
    await tick(MatchmakingPollMs * 3);
    expect(invoke.mock.calls.length).toBe(calls);
  });

  it('stops polling when unmounted', async () => {
    serve({ poll: [searchingState] });
    const { result, unmount } = render();
    await settled(result);
    await tick();
    const calls = invoke.mock.calls.length;
    expect(calls).toBeGreaterThan(1);

    unmount();
    await tick(MatchmakingPollMs * 4);
    expect(invoke.mock.calls.length).toBe(calls);
  });

  describe('errors', () => {
    it.each([
      ['match_open', matchState('accepted'), 'accepted'],
      ['match_pending', matchState('proposed'), 'proposed'],
    ] as const)('a %s join shows the open match instead of an error', async (code, open, phase) => {
      serve({ poll: [idleState, open], join: [{ error: code }] });
      const { result } = render();
      await settled(result);

      await act(() => result.current.join());
      await waitFor(() => expect(result.current.phase).toBe(phase));
      expect(result.current.error).toBeNull();
    });

    it.each(['match_not_found', 'match_not_proposed'] as const)(
      'an accept refused with %s shows the error and re-reads the state',
      async (code) => {
        serve({ poll: [matchState('proposed'), idleState], accept: [{ error: code }] });
        const { result } = render();
        await settled(result);

        await act(() => result.current.accept());
        expect(result.current.error).toBe(code);
        await waitFor(() => expect(result.current.phase).toBe('idle'));
      },
    );

    it.each(['unauthorized', 'profile_required', 'invalid_request', 'internal'] as const)(
      'a join refused with %s reports it',
      async (code) => {
        serve({ poll: [idleState], join: [{ error: code }] });
        const { result } = render();
        await settled(result);

        await act(() => result.current.join());
        expect(result.current.error).toBe(code);
        expect(result.current.phase).toBe('idle');
        expect(result.current.busy).toBe(false);
      },
    );

    it('reports network when the function can’t be reached', async () => {
      serve({ poll: [idleState], join: ['offline'] });
      const { result } = render();
      await settled(result);

      await act(() => result.current.join());
      expect(result.current.error).toBe('network');
    });

    it('treats an unreadable answer as a network error', async () => {
      serve({ poll: ['garbage'] });
      const { result } = render();

      await waitFor(() => expect(result.current.error).toBe('network'));
      expect(result.current.phase).toBe('idle');
    });

    it('surfaces a failed first check (e.g. profile_required) and clears it on refresh', async () => {
      serve({ poll: [{ error: 'profile_required' }, idleState] });
      const { result } = render();

      await waitFor(() => expect(result.current.error).toBe('profile_required'));
      expect(result.current.phase).toBe('idle');

      act(() => result.current.refresh());
      await waitFor(() => expect(result.current.error).toBeNull());
    });
  });
});
