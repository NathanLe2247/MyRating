import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { BrandIcon } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type LocationPromptCopy = {
  title: string;
  body: string;
  allow: string;
  openSettings: string;
};

type LocationPromptProps = {
  /** False once the OS won't show the dialog again — the button opens Settings instead. */
  canAskAgain: boolean;
  onPress: () => void;
  /** Defaults to Home's wording. */
  copy?: LocationPromptCopy;
  /** Extra actions under the button, e.g. a fallback without location. */
  children?: ReactNode;
};

// Shown on Home and in the courts list when location access was denied.
export function LocationPrompt({
  canAskAgain,
  onPress,
  copy = en.home.location,
  children,
}: LocationPromptProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <BrandIcon name="location" color={Brand.lime} size={18} />
        </View>
        <View style={styles.text}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
        </View>
      </View>
      <AuthButton
        label={canAskAgain ? copy.allow : copy.openSettings}
        onPress={onPress}
        variant="secondary"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.card,
    borderRadius: BrandSizes.panelRadius,
    padding: BrandSizes.panelPadding,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconCircle: {
    width: BrandSizes.optionIcon,
    height: BrandSizes.optionIcon,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.limeSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontFamily: BrandFonts.display,
    fontSize: 18,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  body: {
    fontFamily: BrandFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: Brand.textMuted,
  },
});
