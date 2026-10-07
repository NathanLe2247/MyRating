import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

type SegmentedControlProps<T extends string> = {
  options: readonly T[];
  labels: Record<T, string>;
  value: T | null;
  onChange: (value: T) => void;
};

// Pill-shaped single choice; the selected segment is a lime pill.
export function SegmentedControl<T extends string>({ options, labels, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={[styles.segment, selected && styles.selected]}>
            <Text style={[styles.label, selected && styles.selectedLabel]}>{labels[option]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: Spacing.one,
    borderRadius: BrandSizes.controlRadius,
    backgroundColor: Brand.card,
  },
  segment: {
    flex: 1,
    height: BrandSizes.control - Spacing.two,
    borderRadius: BrandSizes.controlRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: Brand.lime,
    boxShadow: `0 0 16px ${Brand.limeGlow}`,
  },
  label: {
    fontFamily: BrandFonts.display,
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  selectedLabel: {
    color: Brand.onLime,
  },
});
