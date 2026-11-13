import { StyleSheet, Text, View } from 'react-native';

import { PlacementGameCount } from '@/constants/profile';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import { formatRating } from '@/utils/rating-format';

type RatingCardProps = {
  /**
   * Null while the player is still playing placement matches; undefined when
   * the rating couldn't be loaded.
   */
  rating: number | null | undefined;
};

const copy = en.home.rating;

export function RatingCard({ rating }: RatingCardProps) {
  if (rating === null) {
    return (
      <View style={styles.card}>
        <View style={styles.badge}>
          <View style={styles.dot} />
          <Text style={styles.badgeLabel}>{copy.unranked}</Text>
        </View>
        <Text style={styles.calibrating}>{copy.calibrating}</Text>
        <Text style={styles.body}>{copy.calibratingBody(PlacementGameCount)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{copy.label}</Text>
      <View style={styles.ratingValue}>
        <Text style={styles.rating}>
          {rating === undefined ? copy.unavailable : formatRating(rating)}
        </Text>
        <Text style={styles.unit}>{copy.unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.card,
    borderRadius: BrandSizes.panelRadius,
    padding: BrandSizes.panelPadding,
    gap: Spacing.two,
    overflow: 'hidden',
    // Lime glow in the top-right corner, as in the mock.
    experimental_backgroundImage: `radial-gradient(circle at 85% 0%, ${Brand.limeSurface} 0%, transparent 60%)`,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapTight,
    borderWidth: 1,
    borderColor: Brand.limeBorder,
    backgroundColor: Brand.limeSurface,
    borderRadius: BrandSizes.pillRadius,
    paddingHorizontal: BrandSizes.gapMid,
    paddingVertical: Spacing.one,
  },
  dot: {
    width: BrandSizes.dot,
    height: BrandSizes.dot,
    borderRadius: BrandSizes.dot / 2,
    backgroundColor: Brand.lime,
  },
  badgeLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.lime,
  },
  calibrating: {
    fontFamily: BrandFonts.display,
    fontSize: 34,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  body: {
    fontFamily: BrandFonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: Brand.textMuted,
  },
  label: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  ratingValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  rating: {
    fontFamily: BrandFonts.display,
    fontSize: 56,
    lineHeight: 60,
    color: Brand.text,
  },
  unit: {
    fontFamily: BrandFonts.display,
    fontSize: 22,
    color: Brand.textMuted,
  },
});
