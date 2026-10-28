import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { PlayerAvatar } from '@/components/community/player-avatar';
import { communityStyles, communityText } from '@/components/community/styles';
import { Brand, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { CommunityGroup } from '@/types/community';

type RoomHeaderProps = {
  group: CommunityGroup;
  onDetailsPress?: () => void;
  onNotificationsPress?: () => void;
};

// The selected group's photo, name, member and online counts, and its actions.
export function RoomHeader({ group, onDetailsPress, onNotificationsPress }: RoomHeaderProps) {
  const t = en.community;
  return (
    <View style={styles.card}>
      <View style={styles.identity}>
        <PlayerAvatar name={group.name} photoUrl={group.photoUrl} size={BrandSizes.groupAvatar} online shaded />
        <View style={styles.text}>
          <View style={communityStyles.row}>
            <Text style={[communityText.title, styles.name]} numberOfLines={1} accessibilityRole="header">
              {group.name}
            </Text>
            {group.verified && (
              <View accessible accessibilityLabel={t.a11y.verified}>
                <BrandIcon name="verified" color={Brand.lime} size={14} />
              </View>
            )}
          </View>
          <View style={communityStyles.row}>
            <Text style={communityText.meta}>{t.members(group.memberCount)}</Text>
            <View style={styles.separator} />
            <View style={styles.onlineDot} />
            <Text style={communityText.stat}>{t.online(group.onlineCount)}</Text>
          </View>
        </View>
      </View>
      <View style={communityStyles.row}>
        <Pressable
          onPress={onDetailsPress}
          disabled={!onDetailsPress}
          accessibilityRole="button"
          accessibilityLabel={t.a11y.groupDetails}
          style={communityStyles.iconButton}>
          <BrandIcon name="info" color={Brand.textMuted} size={17} />
        </Pressable>
        <Pressable
          onPress={onNotificationsPress}
          disabled={!onNotificationsPress}
          accessibilityRole="button"
          accessibilityLabel={t.a11y.notifications}
          style={communityStyles.iconButton}>
          <BrandIcon name="bell" color={Brand.textMuted} size={17} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.three,
    backgroundColor: Brand.card,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  text: {
    flex: 1,
  },
  name: {
    flexShrink: 1,
    lineHeight: 27.5,
  },
  separator: {
    width: Spacing.one,
    height: Spacing.one,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.textMuted,
  },
  onlineDot: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
  },
});
