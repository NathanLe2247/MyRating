import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type LoadErrorProps = {
  message: string;
  onRetry: () => void;
};

export function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retry}>
        <Text style={styles.retryLabel}>{en.home.retry}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.six,
  },
  message: {
    fontFamily: BrandFonts.body,
    fontSize: 15,
    color: Brand.textMuted,
    textAlign: 'center',
  },
  retry: {
    backgroundColor: Brand.lime,
    borderRadius: BrandSizes.panelRadius,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  retryLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.onLime,
  },
});
