import { MatchFoundView } from '@/components/match-found/match-found-view';
import { ReportResult } from '@/components/match-result/report-result';
import { useMatchFoundScreen } from '@/hooks/use-match-found-screen';

// Match Found — the player's current pairing from matchmaking (opened by
// Home's queue card). Accept, Decline (requeues) and Leave call the
// `matchmaking` function; once both accept it shows the match that's on,
// with the score report (`match-results`) in the "You're on!" panel.
export default function MatchFoundScreen() {
  const { report, ...screen } = useMatchFoundScreen();
  return <MatchFoundView {...screen} matchOnContent={report && <ReportResult {...report} />} />;
}
