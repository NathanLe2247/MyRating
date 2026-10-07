import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  /** `primary` = lime call-to-action, `secondary` = dark (e.g. social sign-in). */
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function AuthButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  leading,
  trailing,
}: AuthButtonProps) {
  const primary = variant === 'primary';
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? Brand.onLime : Brand.text} />
      ) : (
        <>
          {leading}
          <Text style={primary ? styles.primaryLabel : styles.secondaryLabel}>{label}</Text>
          {trailing}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: BrandSizes.control,
    borderRadius: BrandSizes.controlRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  primary: {
    backgroundColor: Brand.lime,
    boxShadow: `0 6px 24px ${Brand.limeGlow}`,
  },
  secondary: {
    backgroundColor: Brand.input,
  },
  inactive: {
    opacity: 0.5,
    boxShadow: 'none',
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  primaryLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 15,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: Brand.onLime,
  },
  secondaryLabel: {
    fontFamily: BrandFonts.bodySemiBold,
    fontSize: 15,
    color: Brand.text,
  },
});
