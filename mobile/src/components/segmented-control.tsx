import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';

type SegmentedControlProps<T extends string> = {
  options: readonly T[];
  labels: Record<T, string>;
  value: T | null;
  onChange: (value: T) => void;
  /**
   * `choice` (default): full-width form control, a radio group.
   * `tabs`: compact, content-sized, a tab list (e.g. the home format filter).
   */
  variant?: 'choice' | 'tabs';
};

// Pill-shaped single choice; the selected segment is a lime pill.
export function SegmentedControl<T extends string>({
  options,
  labels,
  value,
  onChange,
  variant = 'choice',
}: SegmentedControlProps<T>) {
  const tabs = variant === 'tabs';
  return (
    <View style={styles.track} accessibilityRole={tabs ? 'tablist' : 'radiogroup'}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole={tabs ? 'tab' : 'radio'}
            accessibilityState={tabs ? { selected } : { checked: selected }}
            style={[tabs ? styles.tab : styles.segment, selected && (tabs ? styles.tabSelected : styles.selected)]}>
            <Text style={[styles.label, tabs && styles.tabLabel, selected && styles.selectedLabel]}>
              {labels[option]}
            </Text>
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
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.card,
  },
  segment: {
    flex: 1,
    height: BrandSizes.control - Spacing.two,
    borderRadius: BrandSizes.pillRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: Brand.lime,
    boxShadow: `0 0 16px ${Brand.limeGlow}`,
  },
  tab: {
    paddingHorizontal: BrandSizes.gapSnug,
    paddingVertical: BrandSizes.gapTight,
    borderRadius: BrandSizes.pillRadius,
  },
  tabSelected: {
    backgroundColor: Brand.lime,
  },
  label: {
    fontFamily: BrandFonts.display,
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  tabLabel: {
    fontSize: 14,
    color: Brand.textMuted,
  },
  selectedLabel: {
    color: Brand.onLime,
  },
});
