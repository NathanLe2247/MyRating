import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { PlayerAvatar } from '@/components/community/player-avatar';
import { communityStyles, communityText } from '@/components/community/styles';
import { Brand, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { DiscoverGroup, GroupRatingRange } from '@/types/community';
import { formatRating } from '@/utils/rating-format';

type DiscoverGroupCardProps = {
  group: DiscoverGroup;
};

// One group on Discover & search: photo, name, members and who's online, its
// rating band, home courts and schedule, and vibe tags.
export function DiscoverGroupCard({ group }: DiscoverGroupCardProps) {
  const t = en.community;
  const hasDetails = !!group.courts || !!group.schedule;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <PlayerAvatar name={group.name} photoUrl={group.photoUrl} size={BrandSizes.groupAvatar} />
          <View style={styles.text}>
            <View style={communityStyles.row}>
              <Text style={[communityText.title, styles.name]} numberOfLines={1} accessibilityRole="header">
                {group.name}
              </Text>
              {group.verified && (
                <View accessible accessibilityLabel={t.a11y.verified}>
                  <BrandIcon name="verified" color={Brand.lime} size={14} />
                </View>
              )}
            </View>
            <View style={styles.meta}>
              <View style={communityStyles.row}>
                <BrandIcon name="community" color={Brand.textMuted} size={12} />
                <Text style={communityText.meta}>{t.members(group.memberCount)}</Text>
              </View>
              {group.onlineCount > 0 && (
                <View style={communityStyles.row}>
                  <View style={styles.onlineDot} />
                  <Text style={[communityText.meta, styles.online]}>{t.online(group.onlineCount)}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {group.ratingRange && (
          <View style={communityStyles.pill}>
            <Text style={[communityText.stat, styles.range]}>{ratingRangeLabel(group.ratingRange)}</Text>
          </View>
        )}
      </View>
      {hasDetails && (
        <View style={styles.details}>
          {group.courts && <DetailRow icon="location" text={group.courts} primary />}
          {group.schedule && <DetailRow icon="calendar" text={group.schedule} />}
        </View>
      )}
      {group.tags && group.tags.length > 0 && (
        <View style={styles.tags}>
          {group.tags.map((tag) => (
            <View key={tag} style={communityStyles.pill}>
              <Text style={[communityText.label, styles.tag]}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function ratingRangeLabel({ min, max }: GroupRatingRange): string {
  const t = en.community.discover;
  return max === null ? t.ratingMin(formatRating(min)) : t.ratingRange(formatRating(min), formatRating(max));
}

function DetailRow({ icon, text, primary }: { icon: 'location' | 'calendar'; text: string; primary?: boolean }) {
  return (
    <View style={styles.detailRow}>
      <BrandIcon name={icon} color={Brand.lime} size={12} />
      <Text style={[communityText.meta, primary && styles.detailPrimary, styles.detailText]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: BrandSizes.discoverCardRadius,
    backgroundColor: Brand.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  text: {
    flex: 1,
  },
  name: {
    flexShrink: 1,
    lineHeight: 30,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  onlineDot: {
    width: BrandSizes.dot,
    height: BrandSizes.dot,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
  },
  online: {
    color: Brand.lime,
  },
  range: {
    letterSpacing: 0.65,
    textTransform: 'uppercase',
  },
  details: {
    gap: Spacing.one,
    padding: BrandSizes.gapMid,
    borderRadius: BrandSizes.insetRadius,
    backgroundColor: Brand.inset,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapTight,
  },
  detailText: {
    flexShrink: 1,
  },
  detailPrimary: {
    color: Brand.text,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  tag: {
    fontSize: 11,
    letterSpacing: 0.55,
  },
});
