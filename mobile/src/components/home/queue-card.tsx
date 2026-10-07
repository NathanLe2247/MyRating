import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { QueueSummary } from '@/types/dashboard';
import { formatRating } from '@/utils/rating-format';

type QueueCardProps = {
  summary: QueueSummary;
  onPress?: () => void;
};

export function QueueCard({ summary, onPress }: QueueCardProps) {
  const formats = summary.formats.map((f) => en.home.formats[f]).join(en.home.queue.formatsJoin);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.top}>
        <View style={styles.iconCircle}>
          <BrandIcon name="bolt" color={Brand.lime} size={22} />
        </View>
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{en.home.queue.title}</Text>
            <BrandIcon name="arrowRight" color={Brand.onLime} size={20} />
          </View>
          <Text style={styles.range}>
            {en.home.queue.range(formatRating(summary.min), formatRating(summary.max), formats)}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.bottom}>
        <View style={styles.active}>
          <View style={styles.dot} />
          <Text style={styles.activeLabel} numberOfLines={1}>
            {en.home.queue.active(summary.activePlayers, summary.courts)}
          </Text>
        </View>
        <View style={styles.waitChip}>
          <Text style={styles.waitLabel}>{en.home.queue.wait(summary.waitMinutes)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.lime,
    borderRadius: BrandSizes.panelRadius,
    padding: BrandSizes.panelPadding,
    overflow: 'hidden',
    experimental_backgroundImage: `linear-gradient(120deg, ${Brand.lime} 45%, ${Brand.limeHighlight} 100%)`,
    boxShadow: `0 8px 32px -8px ${Brand.limeGlow}`,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconCircle: {
    width: BrandSizes.control,
    height: BrandSizes.control,
    borderRadius: BrandSizes.controlRadius,
    backgroundColor: Brand.onLime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: {
    fontFamily: BrandFonts.display,
    fontSize: 26,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    color: Brand.onLime,
  },
  range: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.onLimeMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Brand.onLimeDivider,
    marginVertical: Spacing.three,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  active: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  dot: {
    width: BrandSizes.dot,
    height: BrandSizes.dot,
    borderRadius: BrandSizes.dot / 2,
    backgroundColor: Brand.onLime,
  },
  activeLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.onLime,
    flexShrink: 1,
  },
  waitChip: {
    backgroundColor: Brand.onLimeChip,
    borderRadius: BrandSizes.pillRadius,
    paddingHorizontal: BrandSizes.gapSnug,
    paddingVertical: Spacing.one,
  },
  waitLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.onLime,
  },
});
