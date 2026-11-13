import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { communityStyles, communityText } from '@/components/community/styles';
import type { CommunitySection } from '@/constants/community';
import { Brand, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type CommunitySwitcherProps = {
  groupCount: number;
  /** Which half of the Community tab is showing. */
  section?: CommunitySection;
  /** Switches back to the player's own groups. */
  onMinePress?: () => void;
  /** Opens group discovery. Shown disabled when not wired. */
  onDiscoverPress?: () => void;
};

// "My communities" and "Discover & search" halves of the Community tab.
export function CommunitySwitcher({
  groupCount,
  section = 'mine',
  onMinePress,
  onDiscoverPress,
}: CommunitySwitcherProps) {
  const t = en.community.sections;
  const mineSelected = section === 'mine';
  return (
    <View style={styles.track} accessibilityRole="tablist">
      <Segment selected={mineSelected} onPress={onMinePress}>
        <BrandIcon name="community" color={mineSelected ? Brand.onLime : Brand.textMuted} size={16} />
        <Text style={[communityText.button, mineSelected && communityText.onLime]} numberOfLines={1}>
          {t.mine}
        </Text>
        <View style={[communityStyles.pill, mineSelected && communityStyles.pillOnLime]}>
          <Text style={communityText.stat}>{groupCount}</Text>
        </View>
      </Segment>
      <Segment selected={!mineSelected} onPress={onDiscoverPress}>
        <BrandIcon name="explore" color={mineSelected ? Brand.textMuted : Brand.onLime} size={15} />
        <Text style={[communityText.button, !mineSelected && communityText.onLime]} numberOfLines={1}>
          {t.discover}
        </Text>
      </Segment>
    </View>
  );
}

function Segment({
  selected,
  onPress,
  children,
}: {
  selected: boolean;
  onPress?: () => void;
  children: ReactNode;
}) {
  // The selected segment is the current view, so it's never "disabled"; an
  // unselected one without a handler has nowhere to go yet.
  const disabled = !selected && !onPress;
  return (
    <Pressable
      onPress={selected ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="tab"
      accessibilityState={{ selected, disabled }}
      style={[styles.segment, selected && styles.selected, disabled && communityStyles.disabled]}>
      {children}
    </Pressable>
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
