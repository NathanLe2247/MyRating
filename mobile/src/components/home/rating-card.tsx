import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { RatingSummary } from '@/types/dashboard';
import { formatDelta, formatRating } from '@/utils/rating-format';

type RatingCardProps = {
  summary: RatingSummary;
};

export function RatingCard({ summary }: RatingCardProps) {
  const percent = Math.round(summary.progress * 100);
  const rating = summary.rating === null ? en.home.unrated : formatRating(summary.rating);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.badges}>
          {summary.certified && (
            <View style={styles.chip}>
              <BrandIcon name="verified" color={Brand.warm} size={12} />
              <Text style={[styles.chipLabel, styles.certified]}>{en.home.rating.certified}</Text>
            </View>
          )}
          <View style={styles.chip}>
            <Text style={styles.chipLabel}>{summary.location}</Text>
          </View>
        </View>
        <View style={styles.bracket}>
          <View style={styles.dot} />
          <Text style={styles.bracketLabel}>{summary.bracket}</Text>
        </View>
      </View>

      <Text style={styles.label}>{en.home.rating.label}</Text>

      <View style={styles.ratingRow}>
        <View style={styles.ratingValue}>
          <Text style={styles.rating}>{rating}</Text>
          <Text style={styles.unit}>{en.home.rating.unit}</Text>
        </View>
        <View style={styles.trend}>
          <View style={styles.trendChip}>
            <BrandIcon name="trendUp" color={Brand.lime} size={12} />
            <Text style={styles.trendValue}>{formatDelta(summary.trend)}</Text>
          </View>
          <Text style={styles.caption}>{en.home.rating.trajectory(summary.trendDays)}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.progressHeader}>
        <Text style={styles.caption}>
          {en.home.rating.tierTarget}{' '}
          <Text style={styles.captionStrong}>
            {formatRating(summary.target.rating)} {summary.target.label}
          </Text>
        </Text>
        <Text style={styles.achieved}>{en.home.rating.achieved(percent)}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
      <View style={styles.progressLabels}>
        <Text style={styles.caption}>{en.home.rating.current(rating)}</Text>
        <Text style={styles.caption}>
          {formatRating(summary.nextTier.rating)} {summary.nextTier.label} {en.home.rating.next}
        </Text>
        <Text style={styles.caption}>
          {formatRating(summary.target.rating)} {summary.target.shortLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.card,
    borderRadius: BrandSizes.panelRadius,
    padding: BrandSizes.panelPadding,
    overflow: 'hidden',
    // Lime glow in the top-right corner, as in the mock.
    experimental_backgroundImage: `radial-gradient(circle at 85% 0%, ${Brand.limeSurface} 0%, transparent 60%)`,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  badges: {
    flexDirection: 'row',
    gap: BrandSizes.gapTight,
    flexShrink: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: Brand.chip,
    borderRadius: BrandSizes.pillRadius,
    paddingHorizontal: Spacing.two,
    paddingVertical: BrandSizes.chipPaddingY,
  },
  chipLabel: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  certified: {
    color: Brand.warm,
  },
  bracket: {
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
  bracketLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.lime,
  },
  label: {
    marginTop: Spacing.two,
    fontFamily: BrandFonts.display,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
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
  trend: {
    alignItems: 'flex-end',
    gap: Spacing.one,
    paddingBottom: Spacing.one,
  },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: Brand.chip,
    borderRadius: BrandSizes.pillRadius,
    paddingHorizontal: Spacing.two,
    paddingVertical: BrandSizes.chipPaddingY,
  },
  trendValue: {
    fontFamily: BrandFonts.display,
    fontSize: 14,
    color: Brand.lime,
  },
  caption: {
    fontFamily: BrandFonts.body,
    fontSize: 12,
    color: Brand.textMuted,
  },
  captionStrong: {
    fontFamily: BrandFonts.bodySemiBold,
    color: Brand.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Brand.border,
    marginVertical: Spacing.three,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  achieved: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.lime,
  },
  progressTrack: {
    height: BrandSizes.ratingBar,
    borderRadius: BrandSizes.ratingBar / 2,
    backgroundColor: Brand.chip,
    marginVertical: BrandSizes.gapMid,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: BrandSizes.ratingBar / 2,
    backgroundColor: Brand.lime,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
