import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { communityStyles, communityText } from '@/components/community/styles';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type CommunityEmptyStateProps = {
  /** Opens group discovery (#46). The button is disabled until it exists. */
  onDiscoverPress?: () => void;
};

// Shown in place of the room and chat when the player hasn't joined a group.
export function CommunityEmptyState({ onDiscoverPress }: CommunityEmptyStateProps) {
  const t = en.community.empty;
  return (
    <View style={styles.card}>
      <View style={styles.iconCircle}>
        <BrandIcon name="community" color={Brand.lime} size={26} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {t.title}
      </Text>
      <Text style={styles.body}>{t.body}</Text>
      <Pressable
        onPress={onDiscoverPress}
        disabled={!onDiscoverPress}
        accessibilityRole="button"
        accessibilityState={{ disabled: !onDiscoverPress }}
        style={[styles.cta, !onDiscoverPress && communityStyles.disabled]}>
        <BrandIcon name="explore" color={Brand.onLime} size={15} />
        <Text style={[communityText.button, communityText.onLime]}>{t.cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: BrandSizes.gapSnug,
    padding: BrandSizes.panelPadding,
    paddingVertical: Spacing.five,
    borderRadius: BrandSizes.panelRadius,
    backgroundColor: Brand.card,
  },
  iconCircle: {
    width: BrandSizes.resultBadge,
    height: BrandSizes.resultBadge,
    borderRadius: BrandSizes.pillRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.limeSurface,
  },
  title: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.44,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  body: {
    fontFamily: BrandFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: Brand.textMuted,
    textAlign: 'center',
    maxWidth: BrandSizes.authMaxWidth,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingVertical: BrandSizes.gapSnug,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
  },
});
