import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/brand-icon';
import { matchText } from '@/components/match-found/text-styles';
import type { MatchFormat } from '@/constants/match';
import { Brand, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { MatchFoundRules, MatchFoundVenue } from '@/types/match-found';
import { formatMiles } from '@/utils/match-found-format';

type LogisticsCardProps = {
  format: MatchFormat;
  official: boolean;
  venue?: MatchFoundVenue;
  rules?: MatchFoundRules;
  autoCheckIn?: boolean;
  onOpenMap?: () => void;
};

type InfoRowProps = {
  icon: BrandIconName;
  title: string;
  children: ReactNode;
  action?: ReactNode;
};

function InfoRow({ icon, title, children, action }: InfoRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <BrandIcon name={icon} color={Brand.lime} size={18} />
      </View>
      <View style={styles.rowText}>
        <Text style={matchText.heading} numberOfLines={2}>
          {title}
        </Text>
        {children}
      </View>
      {action}
    </View>
  );
}

// Where and how the match is played: venue + distance, then format + scoring.
export function LogisticsCard({
  format,
  official,
  venue,
  rules,
  autoCheckIn,
  onOpenMap,
}: LogisticsCardProps) {
  const t = en.matchFound;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={matchText.label}>{t.logistics}</Text>
        {autoCheckIn && (
          <View style={styles.checkIn}>
            <BrandIcon name="navigation" color={Brand.lime} size={10} />
            <Text style={[matchText.caption, styles.lime]}>{t.autoCheckIn}</Text>
          </View>
        )}
      </View>
      <View style={styles.rows}>
        {venue ? (
          <InfoRow
            icon="location"
            title={venue.name}
            action={
              onOpenMap && (
                <Pressable
                  onPress={onOpenMap}
                  accessibilityRole="button"
                  accessibilityLabel={t.openMap}
                  style={styles.mapButton}>
                  <BrandIcon name="map" color={Brand.text} size={14} />
                </Pressable>
              )
            }>
            <View style={styles.inline}>
              <Text style={matchText.caption}>{t.distance(formatMiles(venue.distanceMiles))}</Text>
              {venue.driveMinutes !== undefined && (
                <>
                  <Text style={matchText.caption}>{t.dot}</Text>
                  <Text style={[matchText.caption, styles.lime]}>{t.drive(venue.driveMinutes)}</Text>
                </>
              )}
            </View>
          </InfoRow>
        ) : (
          <InfoRow icon="location" title={t.venueEmpty}>
            <Text style={matchText.caption}>{t.venueEmptyBody}</Text>
          </InfoRow>
        )}
        <InfoRow icon="scoreboard" title={t.formatTitle(en.home.formats[format], official, rules?.games)}>
          <Text style={matchText.caption}>
            {rules ? t.rules(rules.games, rules.pointsTo, rules.winBy) : t.rulesEmpty}
          </Text>
        </InfoRow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: BrandSizes.gapSnug,
    padding: Spacing.three,
    backgroundColor: Brand.card,
    boxShadow: `0 4px 6px -1px ${Brand.shadowSoft}`,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  checkIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  lime: {
    color: Brand.lime,
  },
  rows: {
    gap: BrandSizes.gapMid,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapSnug,
    padding: BrandSizes.gapSnug,
    backgroundColor: Brand.cardRaised,
  },
  rowIcon: {
    width: BrandSizes.optionIcon,
    height: BrandSizes.optionIcon,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.chip,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  mapButton: {
    width: BrandSizes.headerAvatar,
    height: BrandSizes.headerAvatar,
    borderRadius: BrandSizes.pillRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.cardSelected,
  },
});
