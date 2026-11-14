import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AuthLink } from '@/components/auth/auth-link';
import { LoadError } from '@/components/home/load-error';
import { LocationPrompt } from '@/components/home/location-prompt';
import { CourtCard } from '@/components/play/court-card';
import { PlayEmptyState } from '@/components/play/play-empty-state';
import { PlaySection } from '@/components/play/play-section';
import { NearbyCourtsRadiusMeters } from '@/constants/courts';
import { Brand, BrandFonts, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { NearbyCourtsState } from '@/types/play';
import { formatMiles } from '@/utils/courts-format';

const copy = en.courts;
const cardCopy = en.play.courts;

// TODO: there's no court detail screen yet, so tapping a card is a no-op and
// its actions (directions, check in, book) show as disabled.
const noop = () => {};

type NearbyCourtsSectionProps = {
  state: NearbyCourtsState;
};

// "Courts near you": the list from `useNearbyCourts` with a view for each
// state (asking for location, denied, loading, error, empty, loaded). Used
// by the signed-out courts screen and the Play tab.
export function NearbyCourtsSection({ state }: NearbyCourtsSectionProps) {
  const loaded = state.status === 'loaded' ? state : undefined;
  const title = loaded?.defaultArea ? copy.defaultArea.title : copy.title;
  const badge = loaded && loaded.courts.length > 0 ? cardCopy.nearYou(loaded.courts.length) : undefined;

  return (
    <PlaySection title={title} badge={badge}>
      <NearbyCourtsBody state={state} />
    </PlaySection>
  );
}

function NearbyCourtsBody({ state }: NearbyCourtsSectionProps) {
  switch (state.status) {
    case 'asking':
      return <Pending label={copy.asking} />;
    case 'loading':
      return <Pending label={copy.loading} />;
    case 'error':
      return <LoadError message={copy.loadError} onRetry={state.retry} />;
    case 'denied':
      return (
        <LocationPrompt
          canAskAgain={state.canAskAgain}
          onPress={state.requestPermission}
          copy={copy.denied}>
          <View style={styles.centered}>
            <AuthLink variant="cta" label={copy.denied.showDefaultArea} onPress={state.showDefaultArea} />
          </View>
        </LocationPrompt>
      );
    case 'loaded':
      return (
        <View style={styles.list}>
          {state.defaultArea ? (
            <View style={styles.areaNote}>
              <Text style={styles.areaNoteText}>{copy.defaultArea.body}</Text>
              <AuthLink
                label={state.defaultArea.canAskAgain ? copy.denied.allow : copy.denied.openSettings}
                onPress={state.defaultArea.requestPermission}
              />
            </View>
          ) : null}
          {state.courts.length > 0 ? (
            state.courts.map((court) => <CourtCard key={court.id} court={court} onPress={noop} />)
          ) : (
            <PlayEmptyState
              icon="court"
              tag={cardCopy.emptyTag}
              title={cardCopy.emptyTitle}
              body={cardCopy.emptyBody(formatMiles(NearbyCourtsRadiusMeters))}
            />
          )}
        </View>
      );
  }
}

function Pending({ label }: { label: string }) {
  return (
    <View style={styles.pending} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={Brand.lime} />
      <Text style={styles.pendingText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  centered: {
    alignItems: 'center',
  },
  pending: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  pendingText: {
    fontFamily: BrandFonts.body,
    fontSize: 14,
    color: Brand.textMuted,
  },
  areaNote: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  areaNoteText: {
    fontFamily: BrandFonts.body,
    fontSize: 13,
    color: Brand.textMuted,
  },
});
