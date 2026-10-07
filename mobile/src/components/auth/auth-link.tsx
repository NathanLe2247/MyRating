import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

type AuthLinkProps = {
  label: string;
  onPress: () => void;
  /**
   * `inline`: small lime text (e.g. "Forgot?" beside a label).
   * `cta`: lime uppercase display text with a trailing arrow ("SIGN UP →").
   * `muted`: grey body text with an optional leading icon.
   */
  variant?: 'inline' | 'cta' | 'muted';
  icon?: BrandIconName;
  /** Plain text shown before the link, outside the tap target. */
  prompt?: string;
};

export function AuthLink({ label, onPress, variant = 'inline', icon, prompt }: AuthLinkProps) {
  const link = (
    <Pressable
      onPress={onPress}
      hitSlop={Spacing.two}
      accessibilityRole="link"
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      {icon && <BrandIcon name={icon} color={Brand.textMuted} size={16} />}
      <Text style={styles[variant]}>{label}</Text>
      {variant === 'cta' && <BrandIcon name="arrowRight" color={Brand.lime} size={14} />}
    </Pressable>
  );

  if (!prompt) return link;

  return (
    <View style={styles.promptRow}>
      <Text style={styles.prompt}>{prompt}</Text>
      {link}
    </View>
  );
}

const styles = StyleSheet.create({
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapTight,
  },
  pressed: {
    opacity: 0.6,
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapSnug,
  },
  prompt: {
    fontFamily: BrandFonts.body,
    fontSize: 14,
    color: Brand.textMuted,
  },
  inline: {
    fontFamily: BrandFonts.bodyMedium,
    fontSize: 13,
    color: Brand.lime,
  },
  cta: {
    fontFamily: BrandFonts.display,
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.lime,
  },
  muted: {
    fontFamily: BrandFonts.body,
    fontSize: 14,
    color: Brand.textMuted,
  },
});
