import {
  MAX_GAMES,
  type MatchmakingState,
  type MatchOpponent,
  POINTS_TO_WIN,
  WIN_BY,
} from '@myrating/shared';

import { type GeoPoint, MetersPerMile } from '@/constants/courts';
import { QueueRadiusMeters } from '@/constants/matchmaking';
import { en } from '@/i18n/en';
import type { MatchFound, MatchFoundPlayer } from '@/types/match-found';
import type { MatchmakingPhase, MatchmakingSnapshot } from '@/types/matchmaking';
import { distanceMeters } from '@/utils/geo';

// Pure helpers over the `matchmaking` function's state
// (shared/src/matchmaking.ts): which phase the player is in, when to poll, and
// the Match Found view model.

/**
 * Whether the player (not the opponent) has accepted the current match. The
 * state names the opponent, so the player is the other side.
 */
export function playerAccepted({ match, opponent }: MatchmakingState): boolean {
  if (!match || !opponent) return false;
  const accepted = match.player_a_id === opponent.id ? match.player_b_accepted_at : match.player_a_accepted_at;
  return accepted !== null;
}

export function matchmakingPhase(state: MatchmakingState | undefined): MatchmakingPhase {
  if (!state) return 'loading';
  const { match } = state;
  if (match) {
    switch (match.status) {
      case 'proposed':
        return playerAccepted(state) ? 'waiting_for_opponent' : 'proposed';
      case 'accepted':
        return 'accepted';
      case 'awaiting_confirmation':
        return 'awaiting_confirmation';
      // The function only returns open matches; anything else reads as none.
      default:
        break;
    }
  }
  return state.queue_entry ? 'searching' : 'idle';
}

/** Phases that only change on a `poll` (pairing, or the opponent answering). */
const POLLING_PHASES: readonly MatchmakingPhase[] = ['searching', 'proposed', 'waiting_for_opponent'];

export function shouldPoll(state: MatchmakingState | undefined): boolean {
  return POLLING_PHASES.includes(matchmakingPhase(state));
}

/**
 * Folds a new state from the function into the previous snapshot, carrying
 * the device-only fields forward while there's still a queue entry or match.
 * `origin` is set by a `join`.
 */
export function mergeSnapshot(
  next: MatchmakingState,
  prev: MatchmakingSnapshot | undefined,
  origin?: GeoPoint,
): MatchmakingSnapshot {
  const active = next.queue_entry !== null || next.match !== null;
  return {
    ...next,
    origin: origin ?? (active ? prev?.origin : undefined),
    waitingSince: next.queue_entry?.created_at ?? (next.match ? prev?.waitingSince : undefined),
  };
}

/** How the opponent is named on screen. The Demo Tester has no username. */
export function opponentName(opponent: MatchOpponent): string {
  if (opponent.is_bot) return en.matchmaking.botName;
  return opponent.first_name?.trim() || opponent.username?.trim() || en.matchmaking.unnamedPlayer;
}

/** The queue radius in whole miles, for "Searching nearby · N mile radius". */
export const QueueRadiusMiles = Math.round(QueueRadiusMeters / MetersPerMile);

/**
 * The Match Found view model for the current match, or null without one.
 * Matches are singles, scored by the shared rules. Win probability and rating
 * impact aren't provided by matchmaking, so they stay unset (the screen hides
 * them) rather than being computed here.
 */
export function toMatchFound(snapshot: MatchmakingSnapshot | undefined, player: MatchFoundPlayer): MatchFound | null {
  const { match, opponent, court } = snapshot ?? {};
  if (!snapshot || !match || !opponent) return null;

  const waited = snapshot.waitingSince
    ? (Date.parse(match.created_at) - Date.parse(snapshot.waitingSince)) / 1000
    : 0;
  // GeoJSON orders coordinates [lng, lat].
  const courtPoint = court && { lat: court.location.coordinates[1], lng: court.location.coordinates[0] };

  return {
    id: match.id,
    format: 'singles',
    official: false,
    player,
    opponent: { name: opponentName(opponent), rating: opponent.rating },
    searchRadiusMiles: QueueRadiusMiles,
    elapsedSeconds: Number.isFinite(waited) ? Math.max(0, waited) : 0,
    venue:
      court && courtPoint
        ? {
            name: court.name,
            distanceMiles: snapshot.origin
              ? distanceMeters(snapshot.origin, courtPoint) / MetersPerMile
              : undefined,
          }
        : undefined,
    rules: { games: MAX_GAMES, pointsTo: POINTS_TO_WIN, winBy: WIN_BY },
  };
}
