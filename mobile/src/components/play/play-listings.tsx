import { StyleSheet, View } from 'react-native';

import { NearbyCourtsSection } from '@/components/courts/nearby-courts-section';
import { PlayEmptyState } from '@/components/play/play-empty-state';
import { PlaySection } from '@/components/play/play-section';
import { TournamentCard } from '@/components/play/tournament-card';
import { Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { NearbyCourtsState, TournamentCardData } from '@/types/play';

const copy = en.play;

// TODO: there's no tournament detail screen yet, so tapping a card is a no-op.
const noop = () => {};

type PlayListingsProps = {
  courts: NearbyCourtsState;
  tournaments: TournamentCardData[];
};

// Nearby courts (with their location / loading states) then tournaments,
// each with its designed empty state.
export function PlayListings({ courts, tournaments }: PlayListingsProps) {
  return (
    <View style={styles.sections}>
      <NearbyCourtsSection state={courts} />

      <PlaySection title={copy.tournaments.title}>
        {tournaments.length > 0 ? (
          tournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} onPress={noop} />
          ))
        ) : (
          <PlayEmptyState
            icon="trophy"
            tag={copy.tournaments.emptyTag}
            title={copy.tournaments.emptyTitle}
            body={copy.tournaments.emptyBody}
          />
        )}
      </PlaySection>
    </View>
  );
}

const styles = StyleSheet.create({
  sections: {
    gap: Spacing.five,
  },
});
