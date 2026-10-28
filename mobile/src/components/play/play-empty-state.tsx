import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

type PlayEmptyStateProps = {
  icon: BrandIconName;
  /** Small live-style chip in the corner, like the design's radar label. */
  tag: string;
  title: string;
  body: string;
};

// Stands in for the courts radar / tournament list while there's nothing to
// show. Styled after the design's radar card.
export function PlayEmptyState({ icon, tag, title, body }: PlayEmptyStateProps) {
  return (
    <View style={styles.card}>
      <View style={styles.tag}>
        <View style={styles.dot} />
        <Text style={styles.tagLabel}>{tag}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <BrandIcon name={icon} color={Brand.lime} size={22} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.input,
    borderRadius: BrandSizes.cardRadius,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: BrandSizes.gapSnug,
    gap: Spacing.two,
  },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapTight,
    paddingHorizontal: BrandSizes.gapMid,
    paddingVertical: Spacing.one,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.card,
  },
  dot: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
  },
  tagLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 1.04,
    textTransform: 'uppercase',
    color: Brand.lime,
  },
  content: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
  },
  iconCircle: {
    width: BrandSizes.control,
    height: BrandSizes.control,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.limeSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: BrandFonts.display,
    fontSize: 22,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  body: {
    fontFamily: BrandFonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: Brand.textMuted,
    textAlign: 'center',
  },
});
