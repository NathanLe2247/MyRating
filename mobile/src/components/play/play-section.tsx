import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/play/chip';
import { Brand, BrandFonts, Spacing } from '@/constants/theme';

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
        {badge ? (
          <Chip compact dot label={badge} color={Brand.lime} background={Brand.limeSurface} />
        ) : null}
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
});
