import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/auth/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

type AuthCheckboxProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Rendered after the label, outside the tap target. */
  trailing?: ReactNode;
};

export function AuthCheckbox({ label, checked, onChange, trailing }: AuthCheckboxProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        hitSlop={Spacing.one}
        style={styles.touch}>
        <View style={[styles.box, checked && styles.boxChecked]}>
          {checked && <BrandIcon name="check" color={Brand.onLime} size={14} />}
        </View>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  touch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapSnug,
    flexShrink: 1,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Brand.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: {
    backgroundColor: Brand.lime,
    borderColor: Brand.lime,
  },
  label: {
    fontFamily: BrandFonts.body,
    fontSize: 13,
    color: Brand.textMuted,
    flexShrink: 1,
  },
});
