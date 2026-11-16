// Test-only builders for `match-results` function states
// (shared/src/match-results.ts), for the match in ./matchmaking.ts: the
// player is player_a, the Demo Tester player_b.
import { DEMO_TESTER_USER_ID, type MatchResultsState, type MatchStatus } from '@myrating/shared';

import { MatchId, matchState, PlayerId } from '@/test-utils/matchmaking';

export const ReportedAt = '2026-11-14T12:30:00.000Z';

/** 11–7, 11–9 for the player (a). */
export const DemoGames = [
  { match_id: MatchId, game_number: 1, player_a_points: 11, player_b_points: 7 },
  { match_id: MatchId, game_number: 2, player_a_points: 11, player_b_points: 9 },
];

export const DemoRatingChange = {
  match_id: MatchId,
  player_id: PlayerId,
  before: 1500,
  after: 1523.45,
  delta: 23.45,
};

type ResultOptions = {
  /** Who reported: the player (default) or the opponent. */
  reportedBy?: 'player' | 'opponent';
  games?: MatchResultsState['games'];
};

export function resultState(
  status: Extract<MatchStatus, 'accepted' | 'awaiting_confirmation' | 'confirmed' | 'disputed' | 'cancelled'>,
  { reportedBy = 'player', games = DemoGames }: ResultOptions = {},
): MatchResultsState {
  const base = matchState('accepted');
  const reported = status !== 'accepted' && status !== 'cancelled';
  return {
    match: {
      ...base.match!,
      status,
      reported_by: reported ? (reportedBy === 'player' ? PlayerId : DEMO_TESTER_USER_ID) : null,
      updated_at: reported ? ReportedAt : base.match!.updated_at,
    },
    games: reported ? games : [],
    opponent: base.opponent!,
    rating_change: status === 'confirmed' ? DemoRatingChange : null,
  };
}
