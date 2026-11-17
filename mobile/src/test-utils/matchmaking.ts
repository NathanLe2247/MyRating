// Test-only builders for `matchmaking` function states (shared/src/matchmaking.ts).
// Neutral ids and the public anchor point only.
import { DEMO_TESTER_USER_ID, type MatchmakingState } from '@myrating/shared';

export const PlayerId = '11111111-1111-4111-8111-111111111111';
export const MatchId = '22222222-2222-4222-8222-222222222222';
export const CourtId = '33333333-3333-4333-8333-333333333333';
export const QueueEntryId = '44444444-4444-4444-8444-444444444444';

/** Columbia Local Park, Burtonsville, MD (the public anchor). */
export const AnchorPoint = { lat: 39.1022, lng: -76.9441 };

export const JoinedAt = '2026-11-14T12:00:00.000Z';
export const PairedAt = '2026-11-14T12:00:06.000Z';

export const idleState: MatchmakingState = { queue_entry: null, match: null, opponent: null, court: null };

export const searchingState: MatchmakingState = {
  ...idleState,
  queue_entry: {
    id: QueueEntryId,
    player_id: PlayerId,
    location: { type: 'Point', coordinates: [AnchorPoint.lng, AnchorPoint.lat] },
    radius_m: 25_000,
    status: 'waiting',
    created_at: JoinedAt,
    updated_at: JoinedAt,
  },
};

const botOpponent = {
  id: DEMO_TESTER_USER_ID,
  username: null,
  first_name: 'Demo',
  rating: 1500,
  is_bot: true,
};

const court = {
  id: CourtId,
  name: 'Anchor Park Courts',
  // ~1.1 km north of the anchor.
  location: { type: 'Point' as const, coordinates: [AnchorPoint.lng, AnchorPoint.lat + 0.01] as [number, number] },
  is_active: true,
  created_at: JoinedAt,
  google_place_id: null,
};

/** Paired with the Demo Tester (player_b), who has already accepted. */
export function matchState(
  status: 'proposed' | 'accepted' | 'awaiting_confirmation',
  { playerAccepted = status !== 'proposed', withCourt = true } = {},
): MatchmakingState {
  return {
    queue_entry: null,
    match: {
      id: MatchId,
      player_a_id: PlayerId,
      player_b_id: DEMO_TESTER_USER_ID,
      court_id: withCourt ? CourtId : null,
      status,
      player_a_accepted_at: playerAccepted ? PairedAt : null,
      player_b_accepted_at: PairedAt,
      reported_by: status === 'awaiting_confirmation' ? PlayerId : null,
      created_at: PairedAt,
      updated_at: PairedAt,
    },
    opponent: botOpponent,
    court: withCourt ? court : null,
  };
}
