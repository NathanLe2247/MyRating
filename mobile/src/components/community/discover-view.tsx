import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { CommunityHeader } from '@/components/community/community-header';
import { CommunitySwitcher } from '@/components/community/community-switcher';
import { CreateSquadBanner } from '@/components/community/create-squad-banner';
import { DiscoverGroupCard } from '@/components/community/discover-group-card';
import { DiscoverSearchBar } from '@/components/community/discover-search-bar';
import { communityContent, communityText } from '@/components/community/styles';
import { BottomTabInset, Brand, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { DiscoverResults } from '@/types/community';

type DiscoverViewProps = {
  /** Number of groups the player has joined, for the switcher badge. */
  groupCount: number;
  onMinePress: () => void;
  query: string;
  onChangeQuery: (query: string) => void;
  results: DiscoverResults;
  onFilterPress?: () => void;
  onCreatePress?: () => void;
};

// Community tab, Discover & search half: search field, the "start your own
// squad" banner, and recommended groups or matches for the query.
export function DiscoverView({
  groupCount,
  onMinePress,
  query,
  onChangeQuery,
  results,
  onFilterPress,
  onCreatePress,
}: DiscoverViewProps) {
  const t = en.community.discover;
  const term = query.trim();
  const searching = term !== '';

  return (
    <ScrollView
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <CommunityHeader />
      <CommunitySwitcher groupCount={groupCount} section="discover" onMinePress={onMinePress} />
      <DiscoverSearchBar query={query} onChangeQuery={onChangeQuery} onFilterPress={onFilterPress} />
      {!searching && <CreateSquadBanner onCreatePress={onCreatePress} />}
      <View style={styles.sectionHeader}>
        <Text style={communityText.title} accessibilityRole="header">
          {searching ? t.results : t.recommended}
        </Text>
        <View style={styles.sectionDot} />
      </View>
      {results.loading ? (
        <View style={styles.status} accessible accessibilityRole="progressbar" accessibilityLabel={t.loading}>
          <ActivityIndicator color={Brand.lime} />
          <Text style={communityText.meta}>{t.loading}</Text>
        </View>
      ) : results.groups.length > 0 ? (
        results.groups.map((group) => <DiscoverGroupCard key={group.id} group={group} />)
      ) : searching ? (
        <StatusCard icon="search" title={t.noResults.title} body={t.noResults.body(term)} />
      ) : (
        <StatusCard icon="explore" title={t.empty.title} body={t.empty.body} />
      )}
    </ScrollView>
  );
}

function StatusCard({ icon, title, body }: { icon: 'search' | 'explore'; title: string; body: string }) {
  return (
    <View style={styles.statusCard}>
      <View style={styles.iconCircle}>
        <BrandIcon name={icon} color={Brand.lime} size={22} />
      </View>
      <Text style={communityText.title}>{title}</Text>
      <Text style={[communityText.body, styles.statusBody]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    ...communityContent,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapTight,
    paddingTop: Spacing.two,
  },
  sectionDot: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
  },
  status: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  statusCard: {
    alignItems: 'center',
    gap: BrandSizes.gapSnug,
    padding: BrandSizes.panelPadding,
    paddingVertical: Spacing.five,
    borderRadius: BrandSizes.discoverCardRadius,
    backgroundColor: Brand.card,
  },
  iconCircle: {
    width: BrandSizes.resultBadge,
    height: BrandSizes.resultBadge,
    borderRadius: BrandSizes.pillRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.limeSurface,
  },
  statusBody: {
    color: Brand.textMuted,
    textAlign: 'center',
    maxWidth: BrandSizes.authMaxWidth,
  },
});
