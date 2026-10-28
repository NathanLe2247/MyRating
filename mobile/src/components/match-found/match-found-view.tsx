import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthButton } from '@/components/auth/auth-button';
import { BrandIcon } from '@/components/brand-icon';
import { HeadToHead } from '@/components/match-found/head-to-head';
import { LogisticsCard } from '@/components/match-found/logistics-card';
import { MatchFoundBanner } from '@/components/match-found/match-found-banner';
import { QueueStatus } from '@/components/match-found/queue-status';
import { SessionHeader } from '@/components/match-found/session-header';
import { matchText } from '@/components/match-found/text-styles';
import { Brand, BrandFonts, BrandSizes, MaxContentWidth, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { MatchFound } from '@/types/match-found';
import { formatRatingGap } from '@/utils/match-found-format';

type MatchFoundViewProps = {
  /** Null when there's no pairing to show (empty state). */
  match: MatchFound | null;
  onBack: () => void;
  onLeave: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onOpenMap?: () => void;
};

// Match Found — instant pairing (Figma 1:7334). Pure view: the route owns
// navigation and the (not yet built) matchmaking calls.
export function MatchFoundView({
  match,
  onBack,
  onLeave,
  onAccept,
  onDecline,
  onOpenMap,
}: MatchFoundViewProps) {
  const t = en.matchFound;
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <SessionHeader onBack={onBack} player={match?.player} />
      {match ? (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            <QueueStatus
              radiusMiles={match.searchRadiusMiles}
              elapsedSeconds={match.elapsedSeconds}
              onLeave={onLeave}
            />
            <MatchFoundBanner
              ratingGap={formatRatingGap(match.player.rating, match.opponent.rating)}
              verified={match.ratingsVerified}
              courtReady={match.courtReady}
            />
            <HeadToHead
              player={match.player}
              opponent={match.opponent}
              winProbability={match.winProbability}
              ratingImpact={match.ratingImpact}
            />
            <LogisticsCard
              format={match.format}
              official={match.official}
              venue={match.venue}
              rules={match.rules}
              autoCheckIn={match.autoCheckIn}
              onOpenMap={onOpenMap}
            />
          </ScrollView>
          <View style={styles.footer}>
            <View style={styles.footerButton}>
              <AuthButton label={t.decline} variant="secondary" onPress={onDecline} />
            </View>
            <View style={styles.footerButton}>
              <AuthButton label={t.accept} onPress={onAccept} />
            </View>
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <BrandIcon name="paddle" color={Brand.lime} size={28} />
          </View>
          <Text style={styles.emptyTitle} accessibilityRole="header">
            {t.empty.title}
          </Text>
          <Text style={[matchText.caption, styles.emptyBody]}>{t.empty.body}</Text>
          <View style={styles.emptyButton}>
            <AuthButton label={t.empty.back} variant="secondary" onPress={onBack} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  scroll: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.three,
    gap: BrandSizes.gapSnug,
  },
  footer: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: BrandSizes.gapSnug,
    paddingHorizontal: Spacing.three,
    paddingVertical: BrandSizes.gapSnug,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.border,
  },
  footerButton: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  emptyIcon: {
    width: BrandSizes.resultBadge,
    height: BrandSizes.resultBadge,
    borderRadius: BrandSizes.pillRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.limeSurface,
  },
  emptyTitle: {
    fontFamily: BrandFonts.display,
    fontSize: 28,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: BrandSizes.authMaxWidth,
  },
  emptyButton: {
    width: '100%',
    maxWidth: BrandSizes.authMaxWidth,
  },
});
