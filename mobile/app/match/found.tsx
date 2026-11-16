import { MatchFoundView } from '@/components/match-found/match-found-view';
import { useMatchFoundScreen } from '@/hooks/use-match-found-screen';

// Match Found — the player's current pairing from matchmaking (opened by
// Home's queue card). Accept, Decline (requeues) and Leave call the
// `matchmaking` function; once both accept it shows the match that's on.
export default function MatchFoundScreen() {
  return <MatchFoundView {...useMatchFoundScreen()} />;
}
