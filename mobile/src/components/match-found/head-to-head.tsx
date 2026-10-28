import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { PlayerAvatar } from '@/components/match-found/player-avatar';
import { matchText } from '@/components/match-found/text-styles';
import { EvenMatchupMargin, MinStreakBadge } from '@/constants/match';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { MatchFoundPlayer } from '@/types/match-found';
import { formatRatingImpact, toPercent } from '@/utils/match-found-format';
import { formatRating } from '@/utils/rating-format';

const CENTER_WIDTH = 96;
const VS_TILT = '-6deg';

type HeadToHeadProps = {
  player: MatchFoundPlayer;
  opponent: MatchFoundPlayer;
  /** The player's win probability (0–1) from the ratings engine. */
  winProbability?: number;
  ratingImpact?: number;
};

type PlayerColumnProps = {
  player: MatchFoundPlayer;
  accent: string;
  badge?: string;
};

function PlayerColumn({ player, accent, badge }: PlayerColumnProps) {
  const t = en.matchFound;
  return (
    <View style={styles.player}>
      <View style={styles.avatarWrap}>
        <PlayerAvatar name={player.name} uri={player.avatarUrl} size={BrandSizes.matchAvatar} />
        {badge && (
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <Text style={[matchText.label, styles.badgeLabel]}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={[matchText.heading, styles.center]} numberOfLines={1}>
        {player.name}
      </Text>
      <View style={styles.ratingChip}>
        <Text style={[matchText.label, styles.ratingUnit]}>{t.ratingUnit}</Text>
        <Text style={[styles.rating, { color: accent }]}>
          {player.rating === null ? t.unrated : formatRating(player.rating)}
        </Text>
      </View>
      {player.location && (
        <Text style={[matchText.caption, styles.center]} numberOfLines={1}>
          {player.location}
        </Text>
      )}
    </View>
  );
}

// You vs. opponent: photos, ratings, the VS disc, and the win-probability gauge.
export function HeadToHead({ player, opponent, winProbability, ratingImpact }: HeadToHeadProps) {
  const t = en.matchFound;
  const streak = opponent.winStreak ?? 0;
  const even =
    winProbability !== undefined && Math.abs(winProbability - 0.5) <= EvenMatchupMargin;
  const subtext = [
    even && t.evenMatchup,
    ratingImpact !== undefined && t.ratingImpact(formatRatingImpact(ratingImpact)),
  ]
    .filter(Boolean)
    .join(t.subtextJoin);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <PlayerColumn player={player} accent={Brand.lime} badge={t.you} />
        <View style={styles.middle}>
          <View style={styles.vs}>
            <Text style={styles.vsLabel}>{t.vs}</Text>
          </View>
          {winProbability !== undefined && (
            <View
              style={styles.odds}
              accessible
              accessibilityLabel={`${t.winProbability} ${t.percent(toPercent(winProbability))}`}>
              <Text style={[matchText.label, styles.center]}>{t.winProbability}</Text>
              <View style={styles.oddsRow}>
                <Text style={[styles.odd, { color: Brand.lime }]}>
                  {t.percent(toPercent(winProbability))}
                </Text>
                <Text style={matchText.caption}>{t.winProbabilitySlash}</Text>
                <Text style={[styles.odd, { color: Brand.cyan }]}>
                  {t.percent(100 - toPercent(winProbability))}
                </Text>
              </View>
              <View style={styles.gauge}>
                <View style={[styles.gaugePart, { flex: toPercent(winProbability), backgroundColor: Brand.lime }]} />
                <View style={[styles.gaugePart, { flex: 100 - toPercent(winProbability), backgroundColor: Brand.cyan }]} />
              </View>
            </View>
          )}
        </View>
        <PlayerColumn
          player={opponent}
          accent={Brand.warm}
          badge={streak >= MinStreakBadge ? t.streak(streak) : undefined}
        />
      </View>
      {subtext.length > 0 && (
        <View style={styles.subtext}>
          <BrandIcon name="bolt" color={Brand.lime} size={12} />
          <Text style={[matchText.label, styles.subtextLabel]}>{subtext}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: BrandSizes.gapSnug,
    padding: Spacing.three,
    backgroundColor: Brand.card,
    boxShadow: `0 20px 25px -5px ${Brand.shadowSoft}`,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  player: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: BrandSizes.gapMid,
    paddingHorizontal: Spacing.one,
    backgroundColor: Brand.cardRaised,
  },
  avatarWrap: {
    marginBottom: Spacing.one,
  },
  badge: {
    position: 'absolute',
    right: -Spacing.one,
    bottom: -Spacing.one,
    paddingHorizontal: BrandSizes.gapTight,
    borderRadius: BrandSizes.pillRadius,
  },
  badgeLabel: {
    color: Brand.onLime,
    letterSpacing: 1.04,
  },
  center: {
    textAlign: 'center',
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: BrandSizes.gapMid,
    paddingVertical: Spacing.one,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.cardSelected,
  },
  ratingUnit: {
    textTransform: 'none',
    letterSpacing: 1.04,
  },
  rating: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.44,
  },
  middle: {
    width: CENTER_WIDTH,
    alignItems: 'center',
    paddingTop: Spacing.five,
    gap: Spacing.two,
  },
  vs: {
    width: BrandSizes.vsBadge,
    height: BrandSizes.vsBadge,
    borderRadius: BrandSizes.pillRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.lime,
    boxShadow: `0 0 10px ${Brand.limeGlow}`,
    transform: [{ rotate: VS_TILT }],
  },
  vsLabel: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 20,
    lineHeight: 20,
    color: Brand.onLime,
  },
  odds: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: Spacing.half,
  },
  oddsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  odd: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 15,
    lineHeight: 16,
    letterSpacing: 0.6,
  },
  gauge: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    height: BrandSizes.progressBar,
    marginTop: Spacing.two,
    borderRadius: BrandSizes.pillRadius,
    overflow: 'hidden',
    backgroundColor: Brand.cardSelected,
  },
  gaugePart: {
    height: '100%',
  },
  subtext: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: BrandSizes.gapSnug,
    paddingVertical: BrandSizes.gapMid,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
  },
  subtextLabel: {
    flexShrink: 1,
    color: Brand.text,
    textAlign: 'center',
  },
});
