import { StyleSheet, Text, View } from 'react-native';

import { AuthButton } from '@/components/auth/auth-button';
import { matchText } from '@/components/match-found/text-styles';
import { GameTabs } from '@/components/match-result/game-tabs';
import { ScoreStepper } from '@/components/match-result/score-stepper';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { PlayerGame, ReportResultView, ScoreDraft } from '@/types/match-results';
import { formatGames } from '@/utils/match-result';
import { formatDelta, formatRating } from '@/utils/rating-format';

export type ReportResultProps = {
  view: ReportResultView;
  draft: ScoreDraft;
  /** Why the draft can't be submitted yet (one line under the form). */
  problem?: string;
  busy?: boolean;
  /** Copy for the last failed call. */
  error?: string;
  onStep: (side: keyof PlayerGame, delta: number) => void;
  onSelectGame: (index: number) => void;
  onAddGame: () => void;
  onRemoveGame: () => void;
  onSubmit: () => void;
  onConfirm: () => void;
  onDispute: () => void;
  /** Hides a confirmed or disputed result; no Done button without it. */
  onDone?: () => void;
};

const t = en.reportResult;

// The score report for a match that's on, in every stage: the score form
// (game tabs, −/+ steppers, Submit with the reason it's disabled), waiting
// for the opponent, answering the opponent's report, and the final result
// with the rating change from the backend. Pure view: `useReportResult`
// drives it.
export function ReportResult({
  view,
  draft,
  problem,
  busy,
  error,
  onStep,
  onSelectGame,
  onAddGame,
  onRemoveGame,
  onSubmit,
  onConfirm,
  onDispute,
  onDone,
}: ReportResultProps) {
  const { stage, opponent } = view;
  const errorNote = error ? (
    <Text style={styles.error} accessibilityRole="alert">
      {error}
    </Text>
  ) : null;

  switch (stage.kind) {
    case 'enter': {
      const game = draft.games[draft.active];
      const removable = draft.games.length > 1 && draft.active === draft.games.length - 1;
      return (
        <View style={styles.body}>
          <GameTabs
            count={draft.games.length}
            active={draft.active}
            disabled={busy}
            onSelect={onSelectGame}
            onAdd={onAddGame}
          />
          <View style={styles.steppers}>
            <ScoreStepper
              label={t.you}
              who={t.youLabel}
              points={game.you}
              disabled={busy}
              onStep={(d) => onStep('you', d)}
            />
            <ScoreStepper
              label={opponent}
              who={opponent}
              points={game.opponent}
              disabled={busy}
              onStep={(d) => onStep('opponent', d)}
            />
          </View>
          {removable && (
            <AuthButton label={t.removeGame} variant="secondary" onPress={onRemoveGame} disabled={busy} />
          )}
          {problem && <Text style={matchText.caption}>{problem}</Text>}
          <AuthButton label={t.submit} onPress={onSubmit} disabled={!!problem} loading={busy} />
          {errorNote}
        </View>
      );
    }
    case 'waiting':
      return (
        <View style={styles.body}>
          <Text style={styles.score}>{t.yourScore(formatGames(stage.games))}</Text>
          <Text style={styles.status} accessibilityRole="text">
            {t.waiting(opponent)}
          </Text>
          {errorNote}
        </View>
      );
    case 'answer':
      return (
        <View style={styles.body}>
          <Text style={styles.score}>{t.reported(opponent, formatGames(stage.games))}</Text>
          <Text style={matchText.caption}>{t.answerHint}</Text>
          <View style={styles.actions}>
            <View style={styles.action}>
              <AuthButton label={t.dispute} variant="secondary" onPress={onDispute} disabled={busy} />
            </View>
            <View style={styles.action}>
              <AuthButton label={t.confirm} onPress={onConfirm} loading={busy} />
            </View>
          </View>
          {errorNote}
        </View>
      );
    case 'confirmed': {
      const score = formatGames(stage.games);
      const change = stage.ratingChange;
      return (
        <View style={styles.body}>
          <Text style={styles.heading} accessibilityRole="header">
            {t.confirmed}
          </Text>
          <Text style={styles.score}>{stage.won ? t.won(score) : t.lost(score)}</Text>
          {change && (
            <View style={styles.rating}>
              <Text style={matchText.label}>{t.ratingLabel}</Text>
              <Text style={[styles.delta, change.delta < 0 && styles.deltaDown]}>
                {t.ratingChange(formatRating(change.before), formatRating(change.after), formatDelta(change.delta))}
              </Text>
            </View>
          )}
          {onDone && <AuthButton label={t.done} variant="secondary" onPress={onDone} />}
        </View>
      );
    }
    case 'disputed':
      return (
        <View style={styles.body}>
          <Text style={[styles.heading, styles.headingDisputed]} accessibilityRole="header">
            {t.disputed}
          </Text>
          <Text style={matchText.caption}>{t.disputedBody(formatGames(stage.games))}</Text>
          {onDone && <AuthButton label={t.done} variant="secondary" onPress={onDone} />}
        </View>
      );
  }
}

const styles = StyleSheet.create({
  body: {
    gap: BrandSizes.gapSnug,
  },
  steppers: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: BrandSizes.gapSnug,
  },
  action: {
    flex: 1,
  },
  heading: {
    fontFamily: BrandFonts.display,
    fontSize: 22,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Brand.lime,
  },
  headingDisputed: {
    color: Brand.loss,
  },
  score: {
    fontFamily: BrandFonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: Brand.text,
  },
  status: {
    fontFamily: BrandFonts.bodyMedium,
    fontSize: 14,
    color: Brand.textMuted,
  },
  rating: {
    gap: Spacing.one,
  },
  delta: {
    fontFamily: BrandFonts.display,
    fontSize: 24,
    color: Brand.lime,
  },
  deltaDown: {
    color: Brand.loss,
  },
  error: {
    fontFamily: BrandFonts.bodyMedium,
    fontSize: 13,
    color: Brand.error,
  },
});
