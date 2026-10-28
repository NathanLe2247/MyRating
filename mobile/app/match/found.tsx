import { router, useLocalSearchParams } from 'expo-router';

import { MatchFoundView } from '@/components/match-found/match-found-view';
import { parseMatchFound } from '@/utils/match-found-param';

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

// Match Found — instant pairing. Takes the match as JSON in the `match` param
// (see `serializeMatchFound`); shows the empty state without one.
export default function MatchFoundScreen() {
  const { match } = useLocalSearchParams<{ match?: string }>();

  return (
    <MatchFoundView
      match={parseMatchFound(match)}
      onBack={goBack}
      // TODO: leave the queue through matchmaking once it exists.
      onLeave={goBack}
      // TODO: confirm the pairing through matchmaking once it exists.
      onAccept={() => {}}
      // TODO: decline the pairing through matchmaking (and requeue) once it exists.
      onDecline={goBack}
    />
  );
}
