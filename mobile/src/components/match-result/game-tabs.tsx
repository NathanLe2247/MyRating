import { MAX_GAMES } from '@myrating/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type GameTabsProps = {
  count: number;
  active: number;
  disabled?: boolean;
  onSelect: (index: number) => void;
  onAdd: () => void;
};

const t = en.reportResult;

// Game 1 · Game 2 · + Game (up to MAX_GAMES).
export function GameTabs({ count, active, disabled, onSelect, onAdd }: GameTabsProps) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {Array.from({ length: count }, (_, i) => (
        <Pressable
          key={i}
          onPress={() => onSelect(i)}
          disabled={disabled}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === active, disabled: !!disabled }}
          style={({ pressed }) => [styles.tab, i === active && styles.tabActive, pressed && styles.pressed]}>
          <Text style={[styles.label, i === active && styles.labelActive]}>{t.game(i + 1)}</Text>
        </Pressable>
      ))}
      {count < MAX_GAMES && (
        <Pressable
          onPress={onAdd}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={t.addGameLabel}
          accessibilityState={{ disabled: !!disabled }}
          style={({ pressed }) => [styles.tab, styles.add, pressed && styles.pressed]}>
          <Text style={styles.label}>{t.addGame}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tab: {
    minHeight: BrandSizes.minTouch,
    justifyContent: 'center',
    paddingHorizontal: BrandSizes.gapSnug,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
  },
  tabActive: {
    backgroundColor: Brand.lime,
  },
  add: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Brand.border,
  },
  label: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  labelActive: {
    color: Brand.onLime,
  },
  pressed: {
    opacity: 0.8,
  },
});
