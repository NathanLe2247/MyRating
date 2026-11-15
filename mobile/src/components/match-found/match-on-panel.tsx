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
  onCancel: () => void;
  /** Extra content for the match that's on, e.g. the score report. */
  children?: ReactNode;
};

// Shown in place of the queue strip once both players accepted: where to go,
// and a way to call the match off before anyone reports a result.
export function MatchOnPanel({ courtName, busy, onCancel, children }: MatchOnPanelProps) {
  const t = en.matchFound.on;
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <BrandIcon name="paddle" color={Brand.lime} size={18} />
        <Text style={styles.title} accessibilityRole="header">
          {t.title}
        </Text>
      </View>
      <Text style={styles.body}>{courtName ? t.court(courtName) : t.noCourt}</Text>
      <Text style={matchText.caption}>{t.report}</Text>
      {children}
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
