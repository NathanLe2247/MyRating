import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthButton } from '@/components/auth/auth-button';
import { BrandIcon } from '@/components/brand-icon';
import { HeadToHead } from '@/components/match-found/head-to-head';
import { LogisticsCard } from '@/components/match-found/logistics-card';
import { MatchFoundBanner } from '@/components/match-found/match-found-banner';
import { MatchOnPanel } from '@/components/match-found/match-on-panel';
import { QueueStatus } from '@/components/match-found/queue-status';
import { SessionHeader } from '@/components/match-found/session-header';
import { matchText } from '@/components/match-found/text-styles';
import { Brand, BrandFonts, BrandSizes, MaxContentWidth, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { MatchFound } from '@/types/match-found';
import { pairingSubtitle } from '@/utils/match-found-format';

/**
 * - `proposed`: waiting for the player's answer (Accept / Decline).
 * - `waiting_for_opponent`: the player accepted; the opponent hasn't yet.
 * - `on`: both accepted; where to play, and the result is reported from here.
 *   The match can still be cancelled.
 * - `reported`: a score is in and awaits confirmation; it can't be cancelled.
 * - `settled`: the result was confirmed or disputed; the report shows how.
 */
export type MatchFoundPhase = 'proposed' | 'waiting_for_opponent' | 'on' | 'reported' | 'settled';

/** Phases where the match is on (both accepted), or just ended. */
const MatchOnPhases: readonly MatchFoundPhase[] = ['on', 'reported', 'settled'];

type MatchFoundViewProps = {
  /** Null when there's no pairing to show (empty state). */
  match: MatchFound | null;
  phase?: MatchFoundPhase;
  /** The match hasn't loaded yet: a spinner instead of the empty state. */
  loading?: boolean;
  /** An answer is in flight: the actions are disabled. */
  busy?: boolean;
  /** Copy for the last failed matchmaking call. */
  error?: string;
  /** Extra content while the match is on (the score report goes here). */
  matchOnContent?: ReactNode;
  onBack: () => void;
  onLeave: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onOpenMap?: () => void;
};

// Match Found — instant pairing (Figma 1:7334). Pure view: the route owns
// navigation and the matchmaking calls.
export function MatchFoundView({
  match,
  phase = 'proposed',
  loading,
  busy,
  error,
  matchOnContent,
  onBack,
  onLeave,
  onAccept,
  onDecline,
  onOpenMap,
}: MatchFoundViewProps) {
  const t = en.matchFound;
  const matchOn = MatchOnPhases.includes(phase);
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <SessionHeader onBack={onBack} player={match?.player} />
      {match ? (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {matchOn ? (
              <MatchOnPanel
                courtName={match.venue?.name}
                busy={busy}
                stage={phase === 'on' ? 'on' : phase === 'reported' ? 'reported' : 'settled'}
                onCancel={phase === 'on' ? onLeave : undefined}>
                {matchOnContent}
              </MatchOnPanel>
            ) : (
              <QueueStatus
                radiusMiles={match.searchRadiusMiles}
                elapsedSeconds={match.elapsedSeconds}
                onLeave={onLeave}
              />
            )}
            <MatchFoundBanner
              // Once settled the pairing line is history; the result panel shows
              // the before → after change instead.
              subtitle={
                phase === 'settled' ? null : pairingSubtitle(match.player.rating, match.opponent.rating)
              }
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
          {error && (
            <Text style={styles.error} accessibilityRole="alert">
              {error}
            </Text>
          )}
          <View style={styles.footer}>
            {matchOn ? (
              <View style={styles.footerButton}>
                <AuthButton label={t.on.home} variant="secondary" onPress={onBack} />
              </View>
            ) : (
              <>
                <View style={styles.footerButton}>
                  <AuthButton label={t.decline} variant="secondary" onPress={onDecline} disabled={busy} />
                </View>
                <View style={styles.footerButton}>
                  {phase === 'waiting_for_opponent' ? (
                    <AuthButton label={t.waitingForOpponent(match.opponent.name)} onPress={onAccept} disabled />
                  ) : (
                    <AuthButton label={t.accept} onPress={onAccept} disabled={busy} />
                  )}
                </View>
              </>
            )}
          </View>
        </>
      ) : loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={Brand.lime} accessibilityLabel={t.loading} />
        </View>
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <BrandIcon name="paddle" color={Brand.lime} size={28} />
          </View>
          <Text style={styles.emptyTitle} accessibilityRole="header">
            {t.empty.title}
          </Text>
          <Text style={[matchText.caption, styles.emptyBody]}>{error ?? t.empty.body}</Text>
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
  error: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    fontFamily: BrandFonts.bodyMedium,
    fontSize: 13,
    color: Brand.error,
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
