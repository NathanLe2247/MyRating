import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/auth/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

type RatingOptionCardProps = {
  icon: BrandIconName;
  iconColor: string;
  title: string;
  subtitle: string;
  body: string;
  /** Pill next to the title, e.g. "Fastest" (lime) or "Unranked" (muted). */
  tag?: { label: string; variant: 'lime' | 'muted' };
  /** Extra content under the body: feature chips, a placement note. */
  children?: ReactNode;
  selected: boolean;
  onPress: () => void;
  /** Shown in place of the radio when the option can't be picked yet. */
  disabledLabel?: string;
};

// One choice on onboarding step 2. Behaves as a radio button; disabled
// options are dimmed and show `disabledLabel` instead of the radio.
export function RatingOptionCard({
  icon,
  iconColor,
  title,
  subtitle,
  body,
  tag,
  children,
  selected,
  onPress,
  disabledLabel,
}: RatingOptionCardProps) {
  const disabled = !!disabledLabel;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      // aria-* rather than accessibilityState: react-native-web only maps these to ARIA.
      aria-checked={selected}
      aria-disabled={disabled}
      style={[styles.card, selected && styles.cardSelected, disabled && styles.cardDisabled]}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <BrandIcon name={icon} color={iconColor} size={20} />
        </View>
        <View style={styles.heading}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {tag && (
              <View style={[styles.tag, tag.variant === 'lime' ? styles.tagLime : styles.tagMuted]}>
                <Text style={[styles.tagLabel, tag.variant === 'lime' && styles.tagLabelLime]}>{tag.label}</Text>
              </View>
            )}
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {disabled ? (
          <Text style={styles.disabledLabel}>{disabledLabel}</Text>
        ) : (
          <View style={[styles.radio, selected && styles.radioSelected]}>
            {selected && <View style={styles.radioDot} />}
          </View>
        )}
      </View>
      <Text style={styles.body}>{body}</Text>
      {children}
    </Pressable>
  );
}

const RADIO_DOT = 10;

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.card,
    borderRadius: BrandSizes.cardRadius + Spacing.two,
    borderWidth: 1,
    borderColor: Brand.border,
    padding: BrandSizes.panelPadding,
    gap: Spacing.three,
    overflow: 'hidden',
  },
  cardSelected: {
    backgroundColor: Brand.cardSelected,
    borderColor: Brand.limeBorder,
    // Lime glow behind the radio, as in the mock.
    experimental_backgroundImage: `radial-gradient(circle at 100% 0%, ${Brand.limeSurface} 0%, transparent 45%)`,
  },
  cardDisabled: {
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  icon: {
    width: BrandSizes.optionIcon,
    height: BrandSizes.optionIcon,
    borderRadius: BrandSizes.optionIcon / 2,
    backgroundColor: Brand.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.half,
  },
  heading: {
    flex: 1,
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontFamily: BrandFonts.display,
    fontSize: 24,
    lineHeight: 26,
    color: Brand.text,
    flexShrink: 1,
  },
  tag: {
    borderRadius: BrandSizes.gapSnug,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  tagLime: {
    backgroundColor: Brand.lime,
  },
  tagMuted: {
    backgroundColor: Brand.border,
  },
  tagLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  tagLabelLime: {
    color: Brand.onLime,
  },
  subtitle: {
    fontFamily: BrandFonts.body,
    fontSize: 13,
    color: Brand.textMuted,
  },
  disabledLabel: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.textMuted,
    marginTop: Spacing.one,
  },
  radio: {
    width: BrandSizes.radio,
    height: BrandSizes.radio,
    borderRadius: BrandSizes.radio / 2,
    borderWidth: 2,
    borderColor: Brand.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  radioSelected: {
    borderColor: Brand.lime,
    boxShadow: `0 0 12px ${Brand.limeGlow}`,
  },
  radioDot: {
    width: RADIO_DOT,
    height: RADIO_DOT,
    borderRadius: RADIO_DOT / 2,
    backgroundColor: Brand.lime,
  },
  body: {
    fontFamily: BrandFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: Brand.text,
  },
});
