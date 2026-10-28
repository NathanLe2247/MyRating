import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { communityStyles, communityText } from '@/components/community/styles';
import { Brand, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { CommunityGroup } from '@/types/community';

type GroupChipsProps = {
  groups: CommunityGroup[];
  activeId: string;
  onSelect: (id: string) => void;
};

// "Joined squads" row plus a horizontal strip of the player's groups; the
// selected one is the room shown below.
export function GroupChips({ groups, activeId, onSelect }: GroupChipsProps) {
  const t = en.community;
  const active = groups.find((group) => group.id === activeId);
  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <View style={communityStyles.row}>
          <Text style={communityText.label}>{t.joined}</Text>
          {active?.area && (
            <View style={communityStyles.pill}>
              <Text style={communityText.stat}>{active.area}</Text>
            </View>
          )}
        </View>
        {active && (
          <Text style={[communityText.meta, styles.activeSquad]} numberOfLines={1}>
            {t.activeSquad}
            <Text style={styles.activeName}>{active.name}</Text>
          </Text>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        accessibilityRole="tablist">
        {groups.map((group) => {
          const selected = group.id === activeId;
          return (
            <Pressable
              key={group.id}
              onPress={() => onSelect(group.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={t.a11y.memberCount(group.name, group.memberCount)}
              style={[styles.chip, selected && styles.chipSelected]}>
              <BrandIcon name="community" color={selected ? Brand.onLime : Brand.textMuted} size={15} />
              <Text style={[communityText.button, selected && communityText.onLime]}>{group.name}</Text>
              <View style={[communityStyles.pill, selected && communityStyles.pillOnLime]}>
                <Text style={[communityText.stat, !selected && styles.countMuted]}>{group.memberCount}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  activeSquad: {
    flexShrink: 1,
  },
  activeName: {
    color: Brand.lime,
  },
  strip: {
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.cardSelected,
  },
  chipSelected: {
    backgroundColor: Brand.lime,
  },
  countMuted: {
    color: Brand.textMuted,
  },
});
