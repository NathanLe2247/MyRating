import { useAuth, useUser } from '@clerk/expo';
import type { MatchmakingState, MatchResultsState } from '@myrating/shared';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { useSupabaseClient } from '@/config/supabase';
import { PlayerRatingQueryKey } from '@/constants/match';
import { MatchResultsFunction, MatchResultsPollMs } from '@/constants/match-results';
import { MatchmakingFunction, MatchmakingOpenMatchPollMs } from '@/constants/matchmaking';
import { OnboardingCompletedKey, ProfileCompletedKey } from '@/constants/profile';
import { useMatchResult } from '@/hooks/use-match-result';
import { en } from '@/i18n/en';
import { MatchResultProvider } from '@/providers/match-result-provider';
import { MatchmakingProvider } from '@/providers/matchmaking-provider';
import { asPlayerB, DemoRatingChange, resultState } from '@/test-utils/match-results';
import { idleState, MatchId, matchState, searchingState } from '@/test-utils/matchmaking';
import { addGame, stepPoints } from '@/utils/match-result';

jest.mock('@clerk/expo', () => ({ useAuth: jest.fn(), useUser: jest.fn() }));
jest.mock('@/config/supabase', () => ({ useSupabaseClient: jest.fn() }));
jest.mock('@/config/demo-location', () => ({ demoLocation: jest.fn() }));

const invoke = jest.fn();

type Reply<T> = T | { error: string } | 'offline';
type Replies = {
  matchmaking?: Reply<MatchmakingState>[];
  /** Keyed by match-results action; each answers from its queue, repeating the last. */
  results?: Partial<Record<'state' | 'submit' | 'confirm' | 'dispute', Reply<MatchResultsState>[]>>;
};

/** Both edge functions at the network boundary (`functions.invoke`). */
function serve({ matchmaking = [idleState], results = {} }: Replies) {
  const next = <T,>(queue: T[] | undefined) => (queue && (queue.length > 1 ? queue.shift() : queue[0])) as T;
  invoke.mockImplementation(async (name: string, { body }: { body: { action: string } }) => {
    const reply =
      name === MatchmakingFunction
        ? next(matchmaking)
        : next(results[body.action as keyof NonNullable<Replies['results']>]);
    if (reply === undefined) throw new Error(`no reply for ${name} ${body.action}`);
    if (reply === 'offline') return { data: null, error: new Error('Failed to fetch') };
    if ('error' in reply) return { data: null, error: new FunctionsHttpError({ json: async () => reply }) };
    return { data: reply, error: null };
  });
}

const resultCalls = () =>
  invoke.mock.calls.filter(([name]) => name === MatchResultsFunction).map(([, { body }]) => body);

let client: QueryClient;

function render() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MatchmakingProvider>
        <MatchResultProvider>{children}</MatchResultProvider>
      </MatchmakingProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useMatchResult(), { wrapper });
}

const tick = (ms: number) => act(() => jest.advanceTimersByTimeAsync(ms));

/** Enters 11–7, 11–9 the way the steppers and game tabs do. */
function enterDemoScore(result: { current: ReturnType<typeof useMatchResult> }) {
  const set = (you: number, opponent: number) =>
    act(() => result.current.editDraft((d) => stepPoints(stepPoints(d, 'you', you), 'opponent', opponent)));
  set(11, 7);
  act(() => result.current.editDraft(addGame));
  set(11, 9);
}

describe('useMatchResult', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (useSupabaseClient as jest.Mock).mockReturnValue({ functions: { invoke } });
    (useAuth as jest.Mock).mockReturnValue({ isSignedIn: true, userId: 'user_test' });
    (useUser as jest.Mock).mockReturnValue({
      isLoaded: true,
      user: { publicMetadata: { [ProfileCompletedKey]: 'x', [OnboardingCompletedKey]: 'x' } },
    });
  });
  afterEach(() => {
    client?.clear();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('has nothing to report without a match that is on', async () => {
    serve({ matchmaking: [matchState('proposed')] });
    const { result } = render();
    await tick(0);

    expect(result.current.view).toBeNull();
    expect(resultCalls()).toEqual([]);
  });

  it('reports 11–7, 11–9, waits, and shows the confirmation with the rating change', async () => {
    serve({
      matchmaking: [matchState('accepted'), matchState('awaiting_confirmation'), idleState],
      results: {
        state: [resultState('accepted'), resultState('awaiting_confirmation'), resultState('confirmed')],
        submit: [resultState('awaiting_confirmation')],
      },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('enter'));
    expect(result.current.view).toMatchObject({ opponent: en.matchmaking.botName, court: 'Anchor Park Courts' });
    expect(result.current.problem).toBe(en.reportResult.problems.blank);

    enterDemoScore(result);
    expect(result.current.problem).toBeUndefined();
    await act(() => result.current.submit());
    expect(resultCalls()).toContainEqual({
      action: 'submit',
      match_id: MatchId,
      games: [
        { player_a_points: 11, player_b_points: 7 },
        { player_a_points: 11, player_b_points: 9 },
      ],
    });
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('waiting'));

    // Polled while waiting; the Demo Tester confirms on a later read.
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    await tick(MatchResultsPollMs);
    await tick(MatchResultsPollMs);
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('confirmed'));
    expect(result.current.view?.stage).toMatchObject({ won: true, ratingChange: DemoRatingChange });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [PlayerRatingQueryKey] });

    // Matchmaking forgets the settled match; the result stays until Done.
    await waitFor(() => expect(result.current.tracked?.match?.id).toBe(MatchId));
    await tick(MatchResultsPollMs * 3);
    expect(result.current.view?.stage.kind).toBe('confirmed');
    const calls = resultCalls().length;
    await tick(MatchResultsPollMs * 3);
    expect(resultCalls()).toHaveLength(calls);

    act(() => result.current.dismiss());
    expect(result.current.view).toBeNull();
    expect(result.current.tracked).toBeNull();
  });

  it("sends the player's score on their own side when they're player_b", async () => {
    serve({
      matchmaking: [asPlayerB(matchState('accepted'))],
      results: {
        state: [asPlayerB(resultState('accepted'))],
        submit: [asPlayerB(resultState('awaiting_confirmation'))],
      },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('enter'));

    // The player won 11–7, 11–9: as player_b that's b = 11 in both games.
    enterDemoScore(result);
    expect(await act(() => result.current.submit())).toBe(true);
    expect(resultCalls()).toContainEqual({
      action: 'submit',
      match_id: MatchId,
      games: [
        { player_a_points: 7, player_b_points: 11 },
        { player_a_points: 9, player_b_points: 11 },
      ],
    });
    // Read back from the player's side too.
    expect(result.current.view?.stage).toEqual({
      kind: 'waiting',
      games: [
        { you: 11, opponent: 7 },
        { you: 11, opponent: 9 },
      ],
    });
  });

  it("doesn't carry a draft or error over to another account on the same device", async () => {
    serve({
      matchmaking: [matchState('accepted')],
      results: { state: [resultState('accepted')], submit: ['offline'] },
    });
    const { result, rerender } = render();
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('enter'));
    enterDemoScore(result);
    await act(() => result.current.submit());
    expect(result.current.error).toBeDefined();

    (useAuth as jest.Mock).mockReturnValue({ isSignedIn: true, userId: 'user_other' });
    rerender({});
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('enter'));
    expect(result.current.draft.games).toEqual([{ you: 0, opponent: 0 }]);
    expect(result.current.error).toBeUndefined();
  });

  it("answers the opponent's report: confirm", async () => {
    serve({
      matchmaking: [matchState('accepted'), matchState('awaiting_confirmation')],
      results: {
        state: [resultState('accepted'), resultState('awaiting_confirmation', { reportedBy: 'opponent' })],
        confirm: [resultState('confirmed', { reportedBy: 'opponent' })],
      },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('enter'));

    // The opponent's report arrives through the slow matchmaking poll.
    await tick(MatchmakingOpenMatchPollMs);
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('answer'));

    await act(() => result.current.confirm());
    expect(resultCalls()).toContainEqual({ action: 'confirm', match_id: MatchId });
    expect(result.current.view?.stage.kind).toBe('confirmed');
  });

  it("answers the opponent's report: dispute", async () => {
    serve({
      matchmaking: [matchState('awaiting_confirmation')],
      results: {
        state: [resultState('awaiting_confirmation', { reportedBy: 'opponent' })],
        dispute: [resultState('disputed', { reportedBy: 'opponent' })],
      },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('answer'));

    await act(() => result.current.dispute());
    expect(resultCalls()).toContainEqual({ action: 'dispute', match_id: MatchId });
    expect(result.current.view?.stage.kind).toBe('disputed');
  });

  it("doesn't submit an invalid score", async () => {
    serve({ matchmaking: [matchState('accepted')], results: { state: [resultState('accepted')] } });
    const { result } = render();
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('enter'));

    act(() => result.current.editDraft((d) => stepPoints(d, 'you', 9)));
    expect(result.current.problem).toMatch(/isn.t finished/);
    expect(await act(() => result.current.submit())).toBe(false);
    expect(resultCalls().map((b) => b.action)).not.toContain('submit');
  });

  it('shows a failed submit and keeps the score', async () => {
    serve({
      matchmaking: [matchState('accepted')],
      results: { state: [resultState('accepted')], submit: ['offline'] },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('enter'));
    enterDemoScore(result);

    expect(await act(() => result.current.submit())).toBe(false);
    expect(result.current.error).toBe(en.reportResult.errors.network);
    expect(result.current.draft.games).toHaveLength(2);
    expect(result.current.view?.stage.kind).toBe('enter');
  });

  it('re-reads when a report was already in (match_not_accepted)', async () => {
    serve({
      matchmaking: [matchState('accepted')],
      results: {
        state: [resultState('accepted'), resultState('awaiting_confirmation', { reportedBy: 'opponent' })],
        submit: [{ error: 'match_not_accepted' }],
      },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('enter'));
    enterDemoScore(result);

    await act(() => result.current.submit());
    expect(result.current.error).toBe(en.reportResult.errors.match_not_accepted);
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('answer'));
  });

  it('drops a match the opponent cancelled', async () => {
    serve({
      matchmaking: [matchState('accepted'), idleState],
      results: { state: [resultState('accepted'), resultState('cancelled')] },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('enter'));

    await tick(MatchmakingOpenMatchPollMs);
    await waitFor(() => expect(result.current.view).toBeNull());
  });

  it('forgets a settled match once the player queues again', async () => {
    serve({
      matchmaking: [matchState('awaiting_confirmation'), idleState, searchingState],
      results: { state: [resultState('awaiting_confirmation'), resultState('confirmed')] },
    });
    const { result } = render();
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('waiting'));
    await tick(MatchResultsPollMs);
    await waitFor(() => expect(result.current.view?.stage.kind).toBe('confirmed'));
    await waitFor(() => expect(result.current.tracked).not.toBeNull());

    // A new search (the next matchmaking read) replaces the old result.
    await act(() => client.invalidateQueries({ queryKey: ['matchmaking'] }));
    await waitFor(() => expect(result.current.view).toBeNull());
  });
});
