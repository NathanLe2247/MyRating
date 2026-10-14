import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandIcon, type BrandIconName } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type ComingSoonScreenProps = {
  title: string;
  body: string;
  icon: BrandIconName;
};

// Placeholder for a bottom tab whose feature hasn't been built yet.
export function ComingSoonScreen({ title, body, icon }: ComingSoonScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <BrandIcon name={icon} color={Brand.lime} size={28} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.chip}>
          <Text style={styles.chipLabel}>{en.comingSoon.tag}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
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
    fontFamily: BrandFonts.display,
    fontSize: 28,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  body: {
    fontFamily: BrandFonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: Brand.textMuted,
    textAlign: 'center',
    maxWidth: BrandSizes.authMaxWidth,
  },
  chip: {
    backgroundColor: Brand.chip,
    borderRadius: BrandSizes.pillRadius,
    paddingHorizontal: BrandSizes.gapSnug,
    paddingVertical: BrandSizes.chipPaddingY,
  },
  chipLabel: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
});
