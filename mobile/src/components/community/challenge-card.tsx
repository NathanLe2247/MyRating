import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/brand-icon';
import { PlayerAvatar } from '@/components/community/player-avatar';
import { communityStyles, communityText } from '@/components/community/styles';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { ChatChallenge } from '@/types/community';
import { formatRating } from '@/utils/rating-format';

type ChallengeCardProps = {
  challenge: ChatChallenge;
  onAccept?: () => void;
  onDecline?: () => void;
};

// An open challenge embedded in the chat: challenger vs. an open seat, with
// court/time details and accept/decline actions.
export function ChallengeCard({ challenge, onAccept, onDecline }: ChallengeCardProps) {
  const t = en.community.challenge;
  const { challenger } = challenge;
  return (
    <View style={styles.indent}>
      <View style={styles.card}>
        <View style={styles.accent} />
        <View style={styles.body}>
          <View style={styles.flags}>
            <View style={[communityStyles.pill, styles.flag]}>
              <View style={styles.liveDot} />
              <Text style={[communityText.label, styles.live]}>{t.live}</Text>
            </View>
            {challenge.rated && (
              <View style={[communityStyles.pill, styles.flag, styles.ratedFlag]}>
                <Text style={[communityText.label, styles.rated]}>{t.rated}</Text>
              </View>
            )}
          </View>

          <View style={styles.matchup}>
            <View style={styles.side}>
              <PlayerAvatar name={challenger.name} photoUrl={challenger.avatarUrl} size={BrandSizes.groupAvatar} />
              <Text style={communityText.title} numberOfLines={1}>
                {challenger.name}
              </Text>
              {challenger.rating !== null && (
                <Text style={communityText.stat}>{t.rating(formatRating(challenger.rating))}</Text>
              )}
            </View>
            <View style={styles.versus}>
              <View style={styles.versusBadge}>
                <Text style={styles.versusLabel}>{t.versus}</Text>
              </View>
              <Text style={communityText.label}>{t.format}</Text>
            </View>
            <View style={styles.side}>
              <View style={styles.openSeat}>
                <BrandIcon name="personAdd" color={Brand.lime} size={20} />
              </View>
              <Text style={[communityText.title, styles.you]}>{t.you}</Text>
              <Text style={[communityText.stat, styles.openSeatLabel]}>{t.openSeat}</Text>
            </View>
          </View>

          <View style={styles.details}>
            <Detail icon="location" label={t.court} value={challenge.court} />
            <Detail icon="clock" label={t.time} value={challenge.startsAt} />
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onAccept}
              disabled={!onAccept}
              accessibilityRole="button"
              style={[styles.accept, !onAccept && communityStyles.disabled]}>
              <BrandIcon name="checkCircle" color={Brand.onLime} size={15} />
              <Text style={[communityText.button, communityText.onLime]}>{t.accept}</Text>
            </Pressable>
            <Pressable
              onPress={onDecline}
              disabled={!onDecline}
              accessibilityRole="button"
              style={[styles.decline, !onDecline && communityStyles.disabled]}>
              <Text style={communityText.button}>{t.decline}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function Detail({ icon, label, value }: { icon: BrandIconName; label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <BrandIcon name={icon} color={Brand.lime} size={14} />
      <View style={styles.detailText}>
        <Text style={communityText.label}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  indent: {
    paddingLeft: BrandSizes.chatIndent,
  },
  card: {
    overflow: 'hidden',
    backgroundColor: Brand.card,
  },
  accent: {
    height: BrandSizes.challengeAccent,
    backgroundColor: Brand.lime,
    experimental_backgroundImage: `linear-gradient(to right, ${Brand.lime}, ${Brand.challengeAmber}, ${Brand.challengeSky})`,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  flags: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    backgroundColor: Brand.chip,
  },
  liveDot: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
  },
  live: {
    color: Brand.lime,
  },
  ratedFlag: {
    backgroundColor: Brand.cardSelected,
  },
  rated: {
    color: Brand.challengeAmber,
  },
  matchup: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    backgroundColor: Brand.input,
  },
  side: {
    flex: 2,
    alignItems: 'center',
    gap: Spacing.one,
  },
  versus: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  versusBadge: {
    width: BrandSizes.versusBadge,
    height: BrandSizes.versusBadge,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  versusLabel: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 16,
    letterSpacing: -0.16,
    color: Brand.textMuted,
  },
  openSeat: {
    width: BrandSizes.groupAvatar,
    height: BrandSizes.groupAvatar,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  you: {
    color: Brand.lime,
  },
  openSeatLabel: {
    color: Brand.textMuted,
  },
  details: {
    flexDirection: 'row',
    gap: Spacing.one,
    padding: Spacing.one,
    backgroundColor: Brand.chip,
  },
  detail: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  detailText: {
    flexShrink: 1,
  },
  detailValue: {
    fontFamily: BrandFonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.12,
    color: Brand.text,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  accept: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: BrandSizes.gapSnug,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
  },
  decline: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: BrandSizes.gapSnug,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
  },
});
