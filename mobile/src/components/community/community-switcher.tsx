import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { communityStyles, communityText } from '@/components/community/styles';
import { Brand, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type CommunitySwitcherProps = {
  groupCount: number;
  /** Opens group discovery (#46). Shown disabled until that screen exists. */
  onDiscoverPress?: () => void;
};

// "My communities" (this screen, always selected) and the entry point to
// discover & search.
export function CommunitySwitcher({ groupCount, onDiscoverPress }: CommunitySwitcherProps) {
  const t = en.community.sections;
  return (
    <View style={styles.track} accessibilityRole="tablist">
      <View
        accessible
        accessibilityRole="tab"
        accessibilityState={{ selected: true }}
        style={[styles.segment, styles.selected]}>
        <BrandIcon name="community" color={Brand.onLime} size={16} />
        <Text style={[communityText.button, communityText.onLime]} numberOfLines={1}>
          {t.mine}
        </Text>
        <View style={[communityStyles.pill, communityStyles.pillOnLime]}>
          <Text style={communityText.stat}>{groupCount}</Text>
        </View>
      </View>
      <Pressable
        onPress={onDiscoverPress}
        disabled={!onDiscoverPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: false, disabled: !onDiscoverPress }}
        style={[styles.segment, !onDiscoverPress && communityStyles.disabled]}>
        <BrandIcon name="explore" color={Brand.textMuted} size={15} />
        <Text style={communityText.button} numberOfLines={1}>
          {t.discover}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: Spacing.one,
    padding: Spacing.one,
    borderRadius: BrandSizes.pillRadius,
    borderWidth: 1,
    borderColor: Brand.border,
    backgroundColor: Brand.input,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.two,
    borderRadius: BrandSizes.pillRadius,
  },
  selected: {
    backgroundColor: Brand.lime,
  },
});
