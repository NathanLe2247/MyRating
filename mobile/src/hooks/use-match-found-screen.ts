import { useUser } from '@clerk/expo';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Linking } from 'react-native';

import type { MatchFoundPhase } from '@/components/match-found/match-found-view';
import { useDashboard } from '@/hooks/use-dashboard';
import { useMatchResult } from '@/hooks/use-match-result';
import { useMatchmaking } from '@/hooks/use-matchmaking';
import { useReportResult } from '@/hooks/use-report-result';
import { en } from '@/i18n/en';
import type { MatchmakingPhase } from '@/types/matchmaking';
import { courtDirectionsUrl } from '@/utils/maps';
import { matchmakingErrorMessage } from '@/utils/matchmaking-error';
import { toMatchFound } from '@/utils/matchmaking-state';

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

const VIEW_PHASE: Partial<Record<MatchmakingPhase, MatchFoundPhase>> = {
  proposed: 'proposed',
  waiting_for_opponent: 'waiting_for_opponent',
  accepted: 'on',
  // matchmaking_leave can't cancel a reported match, so no Cancel here.
  awaiting_confirmation: 'reported',
};

/**
 * Everything the Match Found screen shows and does, from the shared
 * matchmaking state: the live pairing, Accept, Decline (which requeues and
 * goes back to Home's search) and Leave (which cancels the match). Once the
 * match is on, `report` drives the score report in the "You're on!" panel
 * (`useReportResult`, shared with Home's card); a confirmed or disputed
 * result keeps showing (phase `settled`) from the match result's copy of the
 * match, since matchmaking stops returning it, until Done.
 */
export function useMatchFoundScreen() {
  const { snapshot, phase, error, busy, accept, decline, leave, refresh } = useMatchmaking();
  const { tracked } = useMatchResult();
  const report = useReportResult();
  const { user } = useUser();
  const rating = useDashboard('singles').data?.rating;

  // An open match is only polled slowly; re-read on open so a match settled
  // elsewhere isn't shown stale.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const player = {
    name: user?.firstName?.trim() || user?.username?.trim() || en.matchFound.you,
    rating: rating ?? null,
  };
  const stage = report?.view.stage.kind;
  const settled = stage === 'confirmed' || stage === 'disputed';
  const open = !!VIEW_PHASE[phase];
  const source = open ? snapshot : settled ? (tracked ?? undefined) : undefined;
  const match = toMatchFound(source, player);
  const court = source?.court;

  return {
    match,
    phase: settled ? 'settled' : (VIEW_PHASE[phase] ?? 'proposed'),
    report: report && {
      ...report,
      onDone: () => {
        report.onDone?.();
        goBack();
      },
    },
    loading: phase === 'loading',
    busy,
    error: error ? matchmakingErrorMessage(error) : undefined,
    onBack: goBack,
    onAccept: () => void accept(),
    onDecline: () => void decline().then((declined) => declined && goBack()),
    onLeave: () => void leave().then((left) => left && goBack()),
    onOpenMap: court
      ? () => {
          const [lng, lat] = court.location.coordinates;
          void Linking.openURL(courtDirectionsUrl({ lat, lng }, court.name));
        }
      : undefined,
  };
}
