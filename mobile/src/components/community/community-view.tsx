import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ChallengeCard } from '@/components/community/challenge-card';
import { ChatInputBar } from '@/components/community/chat-input-bar';
import { ChatMessage } from '@/components/community/chat-message';
import { CommunityEmptyState } from '@/components/community/community-empty-state';
import { CommunityHeader } from '@/components/community/community-header';
import { CommunitySwitcher } from '@/components/community/community-switcher';
import { GroupChips } from '@/components/community/group-chips';
import { PostMatchPrompt } from '@/components/community/post-match-prompt';
import { RoomHeader } from '@/components/community/room-header';
import { communityText } from '@/components/community/styles';
import { BottomTabInset, Brand, BrandSizes, MaxContentWidth, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { ChatItem, CommunityGroup } from '@/types/community';

type CommunityViewProps = {
  groups: CommunityGroup[];
  /** The group whose room is shown; falls back to the first group. */
  activeGroupId: string | undefined;
  onSelectGroup: (id: string) => void;
  /** Chat for the active group. */
  messages: ChatItem[];
  onDiscoverPress?: () => void;
};

// The Community tab: the player's groups, the selected group's room and its
// live chat, or an empty state when they haven't joined any group.
export function CommunityView({
  groups,
  activeGroupId,
  onSelectGroup,
  messages,
  onDiscoverPress,
}: CommunityViewProps) {
  const active = groups.find((group) => group.id === activeGroupId) ?? groups[0];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.scroll, !active && styles.scrollEmpty]} showsVerticalScrollIndicator={false}>
        <CommunityHeader />
        <CommunitySwitcher groupCount={groups.length} onDiscoverPress={onDiscoverPress} />
        {active ? (
          <>
            <GroupChips groups={groups} activeId={active.id} onSelect={onSelectGroup} />
            <RoomHeader group={active} />
            <View style={styles.chat}>
              {messages.length === 0 ? (
                <Text style={[communityText.meta, styles.chatEmpty]}>{en.community.chat.empty}</Text>
              ) : (
                messages.map((item) => <ChatRow key={item.id} item={item} />)
              )}
            </View>
          </>
        ) : (
          <CommunityEmptyState onDiscoverPress={onDiscoverPress} />
        )}
      </ScrollView>
      {active && (
        // TODO: wire send/challenge/photo once chat has a backend
        // (agent/skills/community-realtime); until then the bar is read-only.
        <View style={styles.footer}>
          <PostMatchPrompt />
          <ChatInputBar />
        </View>
      )}
    </View>
  );
}

function ChatRow({ item }: { item: ChatItem }) {
  switch (item.kind) {
    case 'divider':
      return (
        <View style={styles.divider}>
          <View style={styles.dividerPill}>
            <Text style={communityText.label}>{item.label}</Text>
          </View>
        </View>
      );
    case 'challenge':
      return <ChallengeCard challenge={item} />;
    case 'text':
      return <ChatMessage message={item} />;
  }
}

const content = {
  width: '100%',
  maxWidth: MaxContentWidth,
  alignSelf: 'center',
  paddingHorizontal: Spacing.three,
} as const;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    ...content,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
    gap: Spacing.three,
  },
  scrollEmpty: {
    paddingBottom: BottomTabInset + Spacing.four,
  },
  chat: {
    gap: Spacing.three,
  },
  chatEmpty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  divider: {
    alignItems: 'center',
  },
  dividerPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
  },
  footer: {
    ...content,
    gap: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.two,
  },
});
