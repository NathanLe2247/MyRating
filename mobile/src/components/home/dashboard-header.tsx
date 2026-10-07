import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { SegmentedControl } from '@/components/segmented-control';
import { MatchFormats, type MatchFormat } from '@/constants/match';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type DashboardHeaderProps = {
  format: MatchFormat;
  onFormatChange: (format: MatchFormat) => void;
  courts: number;
  onCourtsPress?: () => void;
  onMenuPress: () => void;
};

// Format tabs on the left; nearby-courts picker and the options button on the right.
export function DashboardHeader({
  format,
  onFormatChange,
  courts,
  onCourtsPress,
  onMenuPress,
}: DashboardHeaderProps) {
  return (
    <View style={styles.row}>
      <SegmentedControl
        variant="tabs"
        options={MatchFormats}
        labels={en.home.formats}
        value={format}
        onChange={onFormatChange}
      />
      <View style={styles.actions}>
        <Pressable onPress={onCourtsPress} accessibilityRole="button" style={styles.courts}>
          <BrandIcon name="court" color={Brand.lime} size={14} />
          <Text style={styles.courtsLabel}>{en.home.courts(courts)}</Text>
          <BrandIcon name="chevronDown" color={Brand.lime} size={10} />
        </Pressable>
        <Pressable
          onPress={onMenuPress}
          accessibilityRole="button"
          accessibilityLabel={en.home.account.open}
          style={styles.menu}>
          <BrandIcon name="tune" color={Brand.textMuted} size={16} />
        </Pressable>
      </View>
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapTight,
  },
  courts: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapTight,
    backgroundColor: Brand.card,
    borderRadius: BrandSizes.panelRadius,
    paddingHorizontal: BrandSizes.gapSnug,
    height: BrandSizes.headerButton,
  },
  courtsLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.lime,
  },
  menu: {
    width: BrandSizes.headerButton,
    height: BrandSizes.headerButton,
    borderRadius: BrandSizes.headerButton / 2,
    backgroundColor: Brand.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
