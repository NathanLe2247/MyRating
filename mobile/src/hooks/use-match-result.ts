import { useAuth } from '@clerk/expo';
import type { MatchResultsState, MatchStatus } from '@myrating/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { PlayerRatingQueryKey } from '@/constants/match';
import { MatchResultsQueryKey } from '@/constants/match-results';
import { matchResultsErrorCode, useMatchResultsApi } from '@/hooks/use-match-results-api';
import { useMatchmaking } from '@/hooks/use-matchmaking';
import type { MatchResultsErrorCode, ReportResultView, ScoreDraft } from '@/types/match-results';
import type { MatchmakingSnapshot } from '@/types/matchmaking';
import {
  draftProblem,
  emptyDraft,
  matchResultsErrorMessage,
  playerIsA,
  resultPollMs,
  resultStage,
  toMatchGames,
} from '@/utils/match-result';
import { opponentName } from '@/utils/matchmaking-state';

export type MatchResult = {
  /** What the report card shows; null when there's no match to report. */
  view: ReportResultView | null;
  /**
   * The matchmaking state of the match being reported. Kept after the match
   * is confirmed or disputed (matchmaking only returns open matches) until
   * it's dismissed or the player queues again, so its screen can still show it.
   */
  tracked: MatchmakingSnapshot | null;
  /** The score being entered (shared by Home's card and Match Found). */
  draft: ScoreDraft;
  /** Why `draft` can't be submitted yet; undefined when it can. */
  problem: string | undefined;
  /** A submit, confirm or dispute is in flight. */
  busy: boolean;
  /** Copy for the last failed call, or undefined. */
  error: string | undefined;
  editDraft: (change: (draft: ScoreDraft) => ScoreDraft) => void;
  submit: () => Promise<boolean>;
  confirm: () => Promise<boolean>;
  dispute: () => Promise<boolean>;
  /** Hides a confirmed or disputed result. */
  dismiss: () => void;
};

/** Matchmaking statuses where the result is reported or answered. */
const REPORTING: readonly MatchStatus[] = ['accepted', 'awaiting_confirmation'];

/** Refusals that mean the device's view is stale: re-read both states. */
const STALE: readonly MatchResultsErrorCode[] = [
  'match_not_found',
  'match_not_accepted',
  'match_not_awaiting_confirmation',
  'own_report',
  'match_changed',
];

/** State that belongs to one player's one match (reset when either changes). */
type Scoped<T> = { userId: string; matchId: string } & T;

/** The form before anything is entered (one stable object, so memos hold). */
const BlankDraft = emptyDraft();

export const MatchResultContext = createContext<MatchResult | null>(null);

/**
 * The result of the player's current match, from the `match-results`
 * function, shared by Home's report card and Match Found through
 * `MatchResultProvider`. The match comes from `useMatchmaking()`: once it's
 * `accepted` the result is read; it's re-read whenever matchmaking sees the
 * match change (the opponent's report arrives that way) and polled every
 * `MatchResultsPollMs` while the player waits on the opponent's confirmation
 * (`resultPollMs`). Confirming refreshes the player's rating. Ratings and
 * rating changes come only from the backend.
 */
export function useMatchResultController(): MatchResult {
  const api = useMatchResultsApi();
  const { userId } = useAuth();
  const { snapshot, refresh: refreshMatchmaking } = useMatchmaking();
  const queryClient = useQueryClient();

  // The match being reported: matchmaking's while it's open, else the last
  // one seen (matchmaking forgets settled matches) unless the player has
  // moved on (queued, a new pairing) or dismissed it.
  const live = snapshot?.match && REPORTING.includes(snapshot.match.status) ? snapshot : undefined;
  const [kept, setKept] = useState<{ userId: string; snapshot: MatchmakingSnapshot } | null>(null);
  if (live && userId && kept?.snapshot !== live) setKept({ userId, snapshot: live });
  const [dismissed, setDismissed] = useState<Scoped<object> | null>(null);
  const movedOn = !!snapshot?.queue_entry || !!snapshot?.match;
  const candidate = live ?? (kept && kept.userId === userId && !movedOn ? kept.snapshot : null);
  const tracked =
    candidate?.match && !(dismissed && dismissed.userId === userId && dismissed.matchId === candidate.match.id)
      ? candidate
      : null;
  const matchId = tracked?.match?.id;
  /** Whether scoped state is for this player's current match. */
  const current = useCallback(
    (scoped: Scoped<object> | null): boolean => !!scoped && scoped.userId === userId && scoped.matchId === matchId,
    [userId, matchId],
  );

  const queryKey = useMemo(() => [MatchResultsQueryKey, userId, matchId] as const, [userId, matchId]);
  const query = useQuery({
    queryKey,
    enabled: !!userId && !!matchId,
    queryFn: () => api.state(matchId!),
    refetchInterval: (q) => resultPollMs(q.state.data),
    staleTime: 0,
    retry: false,
  });
  const state = query.data;

  // Re-read when matchmaking sees the match change (a report, a cancel, or
  // the match leaving the open list), not on the first sight of it.
  const liveKey = live?.match ? `${live.match.id}:${live.match.status}:${live.match.updated_at}` : null;
  const lastLiveKey = useRef(liveKey);
  useEffect(() => {
    if (lastLiveKey.current === liveKey) return;
    const first = lastLiveKey.current === null && liveKey !== null;
    lastLiveKey.current = liveKey;
    if (!first && matchId) void queryClient.invalidateQueries({ queryKey });
  }, [liveKey, matchId, queryClient, queryKey]);

  const opponent = state?.opponent ?? tracked?.opponent ?? null;
  // Before the first read, an accepted match can already take a score.
  const liveStatus = live?.match?.status;
  const stage = useMemo(
    () => (state ? resultStage(state) : liveStatus === 'accepted' ? { kind: 'enter' as const } : null),
    [state, liveStatus],
  );

  // A settled result ends the match for matchmaking too, and a confirmed one
  // moves the player's rating.
  const stageKind = stage?.kind;
  useEffect(() => {
    if (stageKind !== 'confirmed' && stageKind !== 'disputed') return;
    refreshMatchmaking();
    if (stageKind === 'confirmed') void queryClient.invalidateQueries({ queryKey: [PlayerRatingQueryKey] });
  }, [stageKind, matchId, queryClient, refreshMatchmaking]);

  const [draftState, setDraftState] = useState<Scoped<{ draft: ScoreDraft }> | null>(null);
  const draft = draftState && current(draftState) ? draftState.draft : BlankDraft;
  const editDraft = useCallback(
    (change: (d: ScoreDraft) => ScoreDraft) => {
      if (!userId || !matchId) return;
      setDraftState((prev) => ({
        userId,
        matchId,
        draft: change(prev && current(prev) ? prev.draft : BlankDraft),
      }));
    },
    [userId, matchId, current],
  );
  const problem = matchId ? draftProblem(matchId, draft.games) : undefined;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Scoped<{ code: MatchResultsErrorCode }> | null>(null);

  const perform = useCallback(
    async (action: (id: string) => Promise<MatchResultsState>) => {
      if (!matchId || !userId) return false;
      setBusy(true);
      setError(null);
      // An older poll landing after this call would overwrite its result.
      await queryClient.cancelQueries({ queryKey });
      try {
        queryClient.setQueryData(queryKey, await action(matchId));
        refreshMatchmaking();
        return true;
      } catch (err) {
        const code = matchResultsErrorCode(err);
        setError({ userId, matchId, code });
        if (STALE.includes(code)) {
          void queryClient.invalidateQueries({ queryKey });
          refreshMatchmaking();
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [matchId, userId, queryClient, queryKey, refreshMatchmaking],
  );

  // Which side the player is comes from the opponent; without one there's
  // no telling, so nothing is sent rather than guessing (a wrong guess would
  // record the wrong winner).
  const isA = tracked?.match && opponent ? playerIsA(tracked.match, opponent.id) : undefined;
  const submit = useCallback(async () => {
    if (problem || isA === undefined) return false;
    return perform((id) => api.submit(id, toMatchGames(draft.games, isA)));
  }, [api, draft.games, isA, perform, problem]);
  const confirm = useCallback(() => perform((id) => api.confirm(id)), [api, perform]);
  const dispute = useCallback(() => perform((id) => api.dispute(id)), [api, perform]);
  const dismiss = useCallback(() => {
    if (userId && matchId) setDismissed({ userId, matchId });
  }, [userId, matchId]);

  const courtName = tracked?.court?.name;
  const view = useMemo<ReportResultView | null>(
    () =>
      matchId && stage && opponent
        ? { matchId, opponent: opponentName(opponent), court: courtName, stage }
        : null,
    [matchId, stage, opponent, courtName],
  );

  const errorMessage = error && current(error) ? matchResultsErrorMessage(error.code) : undefined;

  return useMemo(
    () => ({
      view,
      tracked,
      draft,
      problem,
      busy,
      error: errorMessage,
      editDraft,
      submit,
      confirm,
      dispute,
      dismiss,
    }),
    [view, tracked, draft, problem, busy, errorMessage, editDraft, submit, confirm, dispute, dismiss],
  );
}

/** The shared match result state; needs `MatchResultProvider` above it. */
export function useMatchResult(): MatchResult {
  const value = useContext(MatchResultContext);
  if (!value) throw new Error('useMatchResult must be used inside MatchResultProvider');
  return value;
}
