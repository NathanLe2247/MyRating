import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { PlayerAvatar } from '@/components/community/player-avatar';
import { communityStyles, communityText } from '@/components/community/styles';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { ChatTextMessage } from '@/types/community';
import { formatRating } from '@/utils/rating-format';

type ChatMessageProps = {
  message: ChatTextMessage;
  onMorePress?: () => void;
};

export function ChatMessage({ message, onMorePress }: ChatMessageProps) {
  const t = en.community.chat;
  const { author } = message;
  return (
    <View>
      <View style={styles.row}>
        <PlayerAvatar
          name={author.name}
          photoUrl={author.avatarUrl}
          size={BrandSizes.chatAvatar}
          online={author.online}
        />
        <View style={styles.content}>
          <View style={styles.meta}>
            <View style={communityStyles.row}>
              <Text style={styles.author}>{author.name}</Text>
              <View style={[communityStyles.pill, styles.ratingPill]}>
                <Text style={communityText.stat}>
                  {author.rating === null ? t.unrated : t.rating(formatRating(author.rating))}
                </Text>
              </View>
            </View>
            <View style={communityStyles.row}>
              <Text style={communityText.meta}>{message.sentAt}</Text>
              <Pressable
                onPress={onMorePress}
                disabled={!onMorePress}
                accessibilityRole="button"
                accessibilityLabel={en.community.a11y.moreOptions}
                hitSlop={Spacing.two}>
                <BrandIcon name="more" color={Brand.textMuted} size={14} />
              </Pressable>
            </View>
          </View>
          <View style={styles.bubble}>
            <Text style={communityText.body}>{message.body}</Text>
          </View>
        </View>
      </View>
      {message.reactions && message.reactions.length > 0 && (
        <View style={styles.reactions}>
          {message.reactions.map((reaction) => (
            <View key={reaction.emoji} style={styles.reaction}>
              <Text style={[communityText.stat, styles.reactionLabel]}>
                {t.reaction(reaction.emoji, reaction.count)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingTop: Spacing.half,
  },
  content: {
    flex: 1,
    gap: Spacing.one,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  author: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 16,
    lineHeight: 16,
    letterSpacing: -0.16,
    color: Brand.text,
  },
  ratingPill: {
    backgroundColor: Brand.chip,
    paddingVertical: 0,
  },
  bubble: {
    padding: Spacing.two,
    backgroundColor: Brand.card,
  },
  reactions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.one,
    paddingRight: Spacing.two,
    marginTop: Spacing.one,
  },
  reaction: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
  },
  reactionLabel: {
    color: Brand.textMuted,
  },
});
