import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

import { MatchFoundRoute, type MatchFormat } from '@/constants/match';
import { QueueFormat } from '@/constants/matchmaking';
import { useMatchmaking } from '@/hooks/use-matchmaking';
import type { QueueCardStatus } from '@/types/matchmaking';
import { matchmakingErrorMessage } from '@/utils/matchmaking-error';
import { opponentName, QueueRadiusMiles } from '@/utils/matchmaking-state';

/**
 * Drives Home's queue card from the shared matchmaking state, and opens Match
 * Found once when a new proposal arrives (going back from it leaves the card
 * showing the pairing, which reopens it).
 *
 * The queue is singles-only (`QueueFormat`): on the other format tabs the
 * card stays at "Find a match", and pressing it switches to singles and joins.
 */
export function useQueueCard(format: MatchFormat, onFormatChange: (format: MatchFormat) => void) {
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
  const queueTab = format === QueueFormat;
  let status: QueueCardStatus;
  switch (queueTab ? phase : 'idle') {
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
    error: queueTab && error ? matchmakingErrorMessage(error) : undefined,
    onFindMatch: () => {
      if (!queueTab) onFormatChange(QueueFormat);
      void join();
    },
    onOpenMatch: () => router.push(MatchFoundRoute),
    onLeave: () => void leave(),
  };
}
