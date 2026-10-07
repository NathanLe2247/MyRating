import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/auth/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

type AuthFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  icon: BrandIconName;
  /** Rendered at the right end of the label row (e.g. a "Forgot?" link). */
  labelAccessory?: ReactNode;
  /** Masks the value and shows an eye toggle to reveal it. */
  secure?: boolean;
  showLabel?: string;
  hideLabel?: string;
};

export function AuthField({
  label,
  icon,
  labelAccessory,
  secure,
  showLabel,
  hideLabel,
  ...inputProps
}: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelAccessory}
      </View>
      <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
        <BrandIcon name={icon} color={Brand.textMuted} size={18} />
        <TextInput
          {...inputProps}
          secureTextEntry={secure && !revealed}
          placeholderTextColor={Brand.placeholder}
          selectionColor={Brand.lime}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={styles.input}
        />
        {secure && (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            hitSlop={Spacing.two}
            accessibilityRole="button"
            accessibilityLabel={revealed ? hideLabel : showLabel}>
            <BrandIcon name={revealed ? 'eyeOff' : 'eye'} color={Brand.textMuted} size={20} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: BrandSizes.gapSnug,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    height: BrandSizes.control,
    paddingHorizontal: Spacing.three,
    borderRadius: BrandSizes.controlRadius,
    backgroundColor: Brand.input,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputWrapFocused: {
    borderColor: Brand.lime,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: BrandFonts.body,
    fontSize: 15,
    color: Brand.text,
  },
});
