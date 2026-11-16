import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { MatchFoundRoute } from '@/constants/match';
import { useMatchmaking } from '@/hooks/use-matchmaking';
import type { QueueCardStatus } from '@/types/matchmaking';
import { matchmakingErrorMessage } from '@/utils/matchmaking-error';
import { opponentName, QueueRadiusMiles } from '@/utils/matchmaking-state';

/**
 * Drives Home's queue card from the shared matchmaking state, and opens Match
 * Found once when a new proposal arrives (going back from it leaves the card
 * showing the pairing, which reopens it).
 */
export function useQueueCard() {
  const router = useRouter();
  const { snapshot, phase, error, busy, join, leave } = useMatchmaking();
  const openedMatch = useRef<string | null>(null);

  const proposedId = phase === 'proposed' ? snapshot?.match?.id : undefined;
  useEffect(() => {
    if (proposedId && openedMatch.current !== proposedId) {
      openedMatch.current = proposedId;
      router.push(MatchFoundRoute);
    }
  }, [proposedId, router]);

  const opponent = snapshot?.opponent ? opponentName(snapshot.opponent) : '';
  let status: QueueCardStatus;
  switch (phase) {
    case 'searching':
      status = { kind: 'searching', since: snapshot?.waitingSince, radiusMiles: QueueRadiusMiles };
      break;
    case 'proposed':
    case 'waiting_for_opponent':
      status = { kind: 'matched', opponent, waiting: phase === 'waiting_for_opponent' };
      break;
    case 'accepted':
    case 'awaiting_confirmation':
      status = { kind: 'on', opponent };
      break;
    default:
      status = { kind: 'idle' };
  }

  return {
    status,
    busy,
    error: error ? matchmakingErrorMessage(error) : undefined,
    onFindMatch: () => void join(),
    onOpenMatch: () => router.push(MatchFoundRoute),
    onLeave: () => void leave(),
  };
}
