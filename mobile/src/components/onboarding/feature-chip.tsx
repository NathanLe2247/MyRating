import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/auth/brand-icon';
import { Brand, BrandFonts, BrandSizes } from '@/constants/theme';

type FeatureChipProps = {
  icon: BrandIconName;
  iconColor: string;
  label: string;
};

// Small icon + label pill listing what an onboarding option unlocks.
export function FeatureChip({ icon, iconColor, label }: FeatureChipProps) {
  return (
    <View style={styles.chip}>
      <BrandIcon name={icon} color={iconColor} size={12} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapTight,
    backgroundColor: Brand.background,
    borderRadius: BrandSizes.gapSnug,
    paddingHorizontal: BrandSizes.gapMid,
    paddingVertical: BrandSizes.gapTight,
  },
  label: {
    fontFamily: BrandFonts.bodyMedium,
    fontSize: 13,
    color: Brand.text,
  },
});
