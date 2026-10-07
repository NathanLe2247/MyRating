import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { MatchRow } from '@/components/home/match-row';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { RecentMatch } from '@/types/dashboard';

type RecentMatchesProps = {
  matches: RecentMatch[];
  onViewAll?: () => void;
};

export function RecentMatches({ matches, onViewAll }: RecentMatchesProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <BrandIcon name="history" color={Brand.lime} size={16} />
          <Text style={styles.title}>{en.home.recent.title}</Text>
        </View>
        <Pressable onPress={onViewAll} accessibilityRole="button" hitSlop={Spacing.two} style={styles.viewAll}>
          <Text style={styles.viewAllLabel}>{en.home.recent.viewAll}</Text>
          <BrandIcon name="arrowRight" color={Brand.lime} size={14} />
        </Pressable>
      </View>

      <View style={styles.list}>
        {matches.map((match) => (
          <MatchRow key={match.id} match={match} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.card,
    borderRadius: BrandSizes.panelRadius,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontFamily: BrandFonts.display,
    fontSize: 20,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  viewAllLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.lime,
  },
  list: {
    gap: BrandSizes.gapSnug,
  },
});
