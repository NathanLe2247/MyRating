import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/brand-icon';
import { Chip } from '@/components/play/chip';
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
      <View style={styles.tagRow}>
        <Chip dot label={tag} color={Brand.lime} background={Brand.card} />
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
  tagRow: {
    flexDirection: 'row',
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
