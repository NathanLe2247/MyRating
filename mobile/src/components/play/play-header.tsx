import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

// Brand mark with the tab name under it. The design's streak chip and avatar
// are left out until there's match-history and profile data to back them.
export function PlayHeader() {
  return (
    <View style={styles.row}>
      <View style={styles.logo}>
        <BrandIcon name="paddle" color={Brand.onLime} size={18} />
      </View>
      <View>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>{en.play.brand}</Text>
          <View style={styles.dot} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {en.play.title}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  logo: {
    width: BrandSizes.headerButton,
    height: BrandSizes.headerButton,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  brand: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 22,
    lineHeight: 22,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  dot: {
    width: BrandSizes.dot,
    height: BrandSizes.dot,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
  },
  title: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    lineHeight: 13,
    letterSpacing: 0.65,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
});
