import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

type PlaySectionProps = {
  title: string;
  /** Lime status chip beside the title, e.g. "8 near you". */
  badge?: string;
  children: ReactNode;
};

// Section label row (the design's "Austin metro area · 8 near you") above a
// list of cards or its empty state.
export function PlaySection({ title, badge, children }: PlaySectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {badge && (
          <View style={styles.badge}>
            <View style={styles.dot} />
            <Text style={styles.badgeLabel}>{badge}</Text>
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.one,
  },
  title: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.limeSurface,
  },
  dot: {
    width: BrandSizes.dot,
    height: BrandSizes.dot,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
  },
  badgeLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 1.04,
    textTransform: 'uppercase',
    color: Brand.lime,
  },
});
