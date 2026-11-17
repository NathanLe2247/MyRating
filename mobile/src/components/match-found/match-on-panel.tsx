import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { matchText } from '@/components/match-found/text-styles';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type MatchOnPanelProps = {
  /** Suggested court, when matchmaking found one. */
  courtName?: string;
  busy?: boolean;
  /**
   * - `on` (default): nobody has reported yet.
   * - `reported`: a score is in and awaits confirmation; the title and caption
   *   say so, and there's no Cancel (the backend can't cancel a reported match).
   * - `settled`: the result was confirmed or disputed.
   */
  stage?: 'on' | 'reported' | 'settled';
  /** Calls the match off; omitted (no button) once it can't be cancelled. */
  onCancel?: () => void;
  /** Extra content for the match that's on, e.g. the score report. */
  children?: ReactNode;
};

// Shown in place of the queue strip once both players accepted: where to go,
// the score report (children), and a way to call the match off before anyone
// reports a result.
export function MatchOnPanel({ courtName, busy, stage = 'on', onCancel, children }: MatchOnPanelProps) {
  const t = en.matchFound.on;
  const copy =
    stage === 'on' ? { title: t.title, body: t.report } : { title: t[stage].title, body: t[stage].body };
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <BrandIcon name="paddle" color={Brand.lime} size={18} />
        <Text style={styles.title} accessibilityRole="header">
          {copy.title}
        </Text>
      </View>
      {/* "Head to … and play" only while the match is still to be played. */}
      {stage !== 'settled' ? (
        <Text style={styles.body}>{courtName ? t.court(courtName) : t.noCourt}</Text>
      ) : (
        courtName ? <Text style={styles.body}>{t.settled.court(courtName)}</Text> : null
      )}
      <Text style={matchText.caption}>{copy.body}</Text>
      {children}
      {onCancel && (
        <Pressable
          onPress={onCancel}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t.cancel}
          accessibilityState={{ disabled: !!busy }}
          style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}>
          <BrandIcon name="close" color={Brand.loss} size={10} />
          <Text style={[matchText.label, styles.cancelLabel]}>{t.cancel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: Spacing.two,
    padding: Spacing.three,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.limeBorder,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontFamily: BrandFonts.display,
    fontSize: 24,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Brand.lime,
  },
  body: {
    fontFamily: BrandFonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: Brand.text,
  },
  cancel: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: BrandSizes.minTouch,
    paddingHorizontal: BrandSizes.gapSnug,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
  },
  cancelLabel: {
    color: Brand.loss,
  },
  pressed: {
    opacity: 0.8,
  },
});
