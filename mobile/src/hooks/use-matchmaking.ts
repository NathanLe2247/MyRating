import { useAuth } from '@clerk/expo';
import type { MatchmakingState } from '@myrating/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { demoLocation } from '@/config/demo-location';
import type { GeoPoint } from '@/constants/courts';
import { PlayerRatingQueryKey } from '@/constants/match';
import { MatchmakingQueryKey, QueueRadiusMeters } from '@/constants/matchmaking';
import {
  MatchmakingApiError,
  matchmakingErrorCode,
  useMatchmakingApi,
} from '@/hooks/use-matchmaking-api';
import { useOnboarding } from '@/hooks/use-onboarding';
import type { MatchmakingErrorCode, MatchmakingPhase, MatchmakingSnapshot } from '@/types/matchmaking';
import { currentPositionQuery } from '@/utils/current-position';
import { matchmakingPhase, mergeSnapshot, pollIntervalMs } from '@/utils/matchmaking-state';

export type Matchmaking = {
  /** Latest state, or undefined before the first one arrives. */
  snapshot: MatchmakingSnapshot | undefined;
  phase: MatchmakingPhase;
  /** The last failed action, else a failed state check; null when fine. */
  error: MatchmakingErrorCode | null;
  /** An action (join, leave, accept, decline) is in flight. */
  busy: boolean;
  /** Joins the queue from the demo location or the device's GPS position. */
  join: () => Promise<boolean>;
  /** Leaves the queue, cancelling a proposed or unreported accepted match. */
  leave: () => Promise<boolean>;
  accept: () => Promise<boolean>;
  /** Declines the proposal, then rejoins the queue to look for someone else. */
  decline: () => Promise<boolean>;
  /** Re-reads the state (after an error, or when a screen opens). */
  refresh: () => void;
};

/**
 * Refusals that mean the device's view is stale: re-read the state. The
 * first two are answered by showing what's open (the proposal, or the match
 * already on), not as errors.
 */
const STALE_STATE: readonly MatchmakingErrorCode[] = [
  'match_pending',
  'match_open',
  'match_not_found',
  'match_not_proposed',
];
const SHOWN_AS_STATE: readonly MatchmakingErrorCode[] = ['match_pending', 'match_open'];

/**
 * Phases a previous app session can leave behind that the player never chose
 * in this one: a search, or a proposal nobody has accepted on this device.
 * The first state check after launch (or after a different player signs in)
 * leaves them, so queueing always starts from "Find a match". A match that's
 * on (accepted / awaiting confirmation) is a real game and is kept.
 */
const LEFTOVER_PHASES: readonly MatchmakingPhase[] = ['searching', 'proposed', 'waiting_for_opponent'];

export const MatchmakingContext = createContext<Matchmaking | null>(null);

/**
 * The player's queue / match state from the `matchmaking` function, shared by
 * every screen through `MatchmakingProvider`. Polls every `MatchmakingPollMs`
 * while searching or while a proposal is unanswered (pairing and the Demo
 * Tester only happen on a call), every `MatchmakingOpenMatchPollMs` while a
 * match is open (so the opponent's cancel or report shows up), and stops when
 * there's nothing to wait for or the provider unmounts.
 *
 * Realtime can be layered on later: subscribe to `public.matches` (see
 * agent/skills/geospatial-matching) and call `refresh()` on each event; the
 * events carry no opponent or court, so the state is always re-read here.
 */
export function useMatchmakingController(): Matchmaking {
  const api = useMatchmakingApi();
  const { isSignedIn, userId } = useAuth();
  const { onboardingCompleted } = useOnboarding();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => [MatchmakingQueryKey, userId] as const, [userId]);
  const [actionError, setActionError] = useState<MatchmakingErrorCode | null>(null);
  const [busy, setBusy] = useState(false);
  // The player whose leftover search this session has already dealt with.
  const leftoverCheckedFor = useRef<string | null>(null);
  // The player's rating as the dashboard last loaded it (undefined if it
  // hasn't), snapshotted into the state when a pairing first shows up.
  const playerRating = useCallback(
    () => queryClient.getQueryData<number | null>([PlayerRatingQueryKey, userId]),
    [queryClient, userId],
  );

  const query = useQuery({
    queryKey,
    // Without an onboarded account the function would only answer
    // profile_required.
    enabled: !!isSignedIn && !!userId && onboardingCompleted,
    queryFn: async () => {
      const prev = queryClient.getQueryData<MatchmakingSnapshot>(queryKey);
      let state = await api.poll();
      if (leftoverCheckedFor.current !== userId) {
        leftoverCheckedFor.current = userId ?? null;
        if (LEFTOVER_PHASES.includes(matchmakingPhase(state))) state = await api.leave();
      }
      return mergeSnapshot(state, prev, undefined, playerRating());
    },
    refetchInterval: (q) => pollIntervalMs(q.state.data),
    staleTime: 0,
    // The poll interval is the retry while waiting; otherwise the screen
    // offers one.
    retry: false,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const perform = useCallback(
    async (action: () => Promise<{ state: MatchmakingState; origin?: GeoPoint }>) => {
      setBusy(true);
      setActionError(null);
      // An older poll landing after this action would overwrite its result.
      await queryClient.cancelQueries({ queryKey });
      try {
        const { state, origin } = await action();
        queryClient.setQueryData<MatchmakingSnapshot>(queryKey, (prev) =>
          mergeSnapshot(state, prev, origin, playerRating()),
        );
        return true;
      } catch (err) {
        const code = matchmakingErrorCode(err);
        if (STALE_STATE.includes(code)) refresh();
        if (!SHOWN_AS_STATE.includes(code)) setActionError(code);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [queryClient, queryKey, refresh, playerRating],
  );

  const join = useCallback(
    () =>
      perform(async () => {
        leftoverCheckedFor.current = userId ?? null;
        const origin =
          demoLocation() ??
          (await queryClient.fetchQuery(currentPositionQuery).catch(() => {
            throw new MatchmakingApiError('location_unavailable');
          }));
        return { state: await api.join(origin, QueueRadiusMeters), origin };
      }),
    [api, perform, queryClient, userId],
  );

  const matchId = query.data?.match?.id;

  const leave = useCallback(() => perform(async () => ({ state: await api.leave() })), [api, perform]);

  const accept = useCallback(
    async () => (matchId ? perform(async () => ({ state: await api.accept(matchId) })) : false),
    [api, matchId, perform],
  );

  const decline = useCallback(async () => {
    if (!matchId) return false;
    const declined = await perform(async () => ({ state: await api.decline(matchId) }));
    if (declined) void join();
    return declined;
  }, [api, join, matchId, perform]);

  const { data, error: queryError } = query;

  return useMemo(
    () => ({
      snapshot: data,
      // No state to go on after a failed first check: idle (with the error),
      // so the player can retry.
      phase: data || !queryError ? matchmakingPhase(data) : 'idle',
      error: actionError ?? (queryError ? matchmakingErrorCode(queryError) : null),
      busy,
      join,
      leave,
      accept,
      decline,
      refresh,
    }),
    [data, queryError, actionError, busy, join, leave, accept, decline, refresh],
  );
}

/** The shared matchmaking state; needs `MatchmakingProvider` above it. */
export function useMatchmaking(): Matchmaking {
  const value = useContext(MatchmakingContext);
  if (!value) throw new Error('useMatchmaking must be used inside MatchmakingProvider');
  return value;
}
