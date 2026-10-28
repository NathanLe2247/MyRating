import { StyleSheet, Text, View } from 'react-native';

import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

import { healthStyles } from './styles';

// "MYRATING •" wordmark with the screen name underneath.
export function HealthHeader() {
  return (
    <View style={styles.header}>
      <View style={healthStyles.rowTight}>
        <Text style={styles.brand}>{en.health.brand}</Text>
        <View style={styles.dot} />
      </View>
      <Text style={healthStyles.eyebrow} accessibilityRole="header">
        {en.health.title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.half,
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
});
