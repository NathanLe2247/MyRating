import { useUser } from '@clerk/expo';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Linking } from 'react-native';

import type { MatchFoundPhase } from '@/components/match-found/match-found-view';
import { useDashboard } from '@/hooks/use-dashboard';
import { useMatchmaking } from '@/hooks/use-matchmaking';
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
 * goes back to Home's search) and Leave (which cancels the match).
 */
export function useMatchFoundScreen() {
  const { snapshot, phase, error, busy, accept, decline, leave, refresh } = useMatchmaking();
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
  const match = toMatchFound(snapshot, player);
  const court = snapshot?.court;

  return {
    match: VIEW_PHASE[phase] ? match : null,
    phase: VIEW_PHASE[phase] ?? 'proposed',
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
