import { StyleSheet, View } from 'react-native';

import { CourtCard } from '@/components/play/court-card';
import { PlayEmptyState } from '@/components/play/play-empty-state';
import { PlaySection } from '@/components/play/play-section';
import { TournamentCard } from '@/components/play/tournament-card';
import { Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { PlayListings as PlayListingsData } from '@/types/play';

const copy = en.play;

// TODO: court and tournament detail screens don't exist yet. Tapping a card
// is a no-op, and the card actions (directions, check in, book) get no
// handler, so they show as disabled until those screens land.
const noop = () => {};

// Courts section then tournaments section, each with its designed empty state.
export function PlayListings({ courts, tournaments }: PlayListingsData) {
  return (
    <View style={styles.sections}>
      <PlaySection
        title={copy.courts.title}
        badge={courts.length > 0 ? copy.courts.nearYou(courts.length) : undefined}>
        {courts.length > 0 ? (
          courts.map((court) => <CourtCard key={court.id} court={court} onPress={noop} />)
        ) : (
          <PlayEmptyState
            icon="court"
            tag={copy.courts.emptyTag}
            title={copy.courts.emptyTitle}
            body={copy.courts.emptyBody}
          />
        )}
      </PlaySection>

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
