import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type QueueCardProps = {
  /** Still playing placement matches (no rating yet). */
  calibrating: boolean;
  onPress?: () => void;
};

export function QueueCard({ calibrating, onPress }: QueueCardProps) {
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
          <Text style={styles.subtitle}>
            {calibrating ? en.home.queue.placement : en.home.queue.subtitle}
          </Text>
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
  subtitle: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.onLimeMuted,
  },
});
