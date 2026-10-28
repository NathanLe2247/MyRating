import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

type ChipProps = {
  label: string;
  /** Text, icon and dot color. */
  color: string;
  background?: string;
  icon?: BrandIconName;
  /** Status dot before the label, in `dotColor` (default `color`). */
  dot?: boolean;
  dotColor?: string;
  /** Tighter padding for count badges beside a title. */
  compact?: boolean;
};

// Pill label used across the Play tab: tags, count badges, status chips.
export function Chip({
  label,
  color,
  background = Brand.chip,
  icon,
  dot,
  dotColor = color,
  compact,
}: ChipProps) {
  return (
    <View style={[styles.chip, compact && styles.compact, { backgroundColor: background }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      {icon ? <BrandIcon name={icon} color={color} size={12} /> : null}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: BrandSizes.gapMid,
    paddingVertical: Spacing.one,
    borderRadius: BrandSizes.pillRadius,
  },
  compact: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  dot: {
    width: BrandSizes.dot,
    height: BrandSizes.dot,
    borderRadius: BrandSizes.pillRadius,
  },
  label: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 1.04,
    textTransform: 'uppercase',
  },
});
