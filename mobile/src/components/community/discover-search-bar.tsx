import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { communityStyles } from '@/components/community/styles';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type DiscoverSearchBarProps = {
  query: string;
  onChangeQuery: (query: string) => void;
  /** Opens group filters. Shown disabled until filters exist. */
  onFilterPress?: () => void;
};

// Pill search field with a clear button and the filter trigger.
export function DiscoverSearchBar({ query, onChangeQuery, onFilterPress }: DiscoverSearchBarProps) {
  const t = en.community.discover;
  return (
    <View style={styles.bar}>
      <BrandIcon name="search" color={Brand.textMuted} size={16} />
      <TextInput
        value={query}
        onChangeText={onChangeQuery}
        placeholder={t.searchPlaceholder}
        placeholderTextColor={Brand.textMuted}
        accessibilityLabel={t.searchLabel}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
      {query.length > 0 && (
        <Pressable
          onPress={() => onChangeQuery('')}
          accessibilityRole="button"
          accessibilityLabel={t.clearSearch}
          hitSlop={Spacing.two}>
          <BrandIcon name="close" color={Brand.textMuted} size={14} />
        </Pressable>
      )}
      <View style={styles.divider} />
      <Pressable
        onPress={onFilterPress}
        disabled={!onFilterPress}
        accessibilityRole="button"
        accessibilityLabel={t.filter}
        accessibilityState={{ disabled: !onFilterPress }}
        hitSlop={Spacing.two}
        style={!onFilterPress && communityStyles.disabled}>
        <BrandIcon name="tune" color={Brand.textMuted} size={15} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: BrandSizes.control,
    paddingHorizontal: Spacing.three,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.card,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontFamily: BrandFonts.body,
    fontSize: 14,
    color: Brand.text,
  },
  divider: {
    width: 1,
    height: BrandSizes.searchDivider,
    backgroundColor: Brand.border,
  },
});
