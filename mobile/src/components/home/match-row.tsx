import { StyleSheet, Text, View } from 'react-native';

import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { RecentMatch } from '@/types/dashboard';
import { formatDelta, formatRating } from '@/utils/rating-format';

type MatchRowProps = {
  match: RecentMatch;
};

export function MatchRow({ match }: MatchRowProps) {
  const t = en.home.recent;
  const delta = match.ratingAfter - match.ratingBefore;
  const players = [
    match.partner && t.partner(match.partner),
    t.versus,
    match.opponents.join(t.opponentsJoin),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <View style={styles.row}>
      <View style={[styles.result, match.won ? styles.resultWin : styles.resultLoss]}>
        <Text style={[styles.resultLabel, { color: match.won ? Brand.lime : Brand.loss }]}>
          {match.won ? t.win : t.loss}
        </Text>
        <Text style={styles.score}>{match.score}</Text>
      </View>

      <View style={styles.details}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {match.title}
          </Text>
          {match.badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeLabel}>{match.badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.players} numberOfLines={1}>
          {players}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {match.venue}
          {t.separator}
          {match.when}
        </Text>
      </View>

      <View style={styles.change}>
        <Text style={[styles.delta, { color: delta >= 0 ? Brand.lime : Brand.loss }]}>
          {formatDelta(delta)}
        </Text>
        <Text style={styles.meta}>
          {t.ratingChange(formatRating(match.ratingBefore), formatRating(match.ratingAfter))}
        </Text>
      </View>
    </View>
  );
}

const ROW_RADIUS = 32;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapSnug,
    backgroundColor: Brand.cardRaised,
    borderRadius: ROW_RADIUS,
    padding: BrandSizes.gapMid,
  },
  result: {
    width: BrandSizes.resultBadge,
    height: BrandSizes.resultBadge,
    borderRadius: BrandSizes.resultBadge / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultWin: {
    backgroundColor: Brand.limeSurface,
  },
  resultLoss: {
    backgroundColor: Brand.lossSurface,
  },
  resultLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  score: {
    fontFamily: BrandFonts.bodyMedium,
    fontSize: 11,
    color: Brand.textMuted,
  },
  details: {
    flex: 1,
    gap: Spacing.half,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapTight,
  },
  title: {
    fontFamily: BrandFonts.bodySemiBold,
    fontSize: 15,
    color: Brand.text,
    flexShrink: 1,
  },
  badge: {
    backgroundColor: Brand.chip,
    borderRadius: BrandSizes.pillRadius,
    paddingHorizontal: BrandSizes.gapTight,
    paddingVertical: 1,
  },
  badgeLabel: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  players: {
    fontFamily: BrandFonts.body,
    fontSize: 12,
    color: Brand.text,
  },
  meta: {
    fontFamily: BrandFonts.body,
    fontSize: 11,
    color: Brand.textMuted,
  },
  change: {
    alignItems: 'flex-end',
    gap: Spacing.half,
  },
  delta: {
    fontFamily: BrandFonts.display,
    fontSize: 16,
  },
});
