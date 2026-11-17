import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { matchText } from '@/components/match-found/text-styles';
import { ReportResult, type ReportResultProps } from '@/components/match-result/report-result';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type ReportResultCardProps = ReportResultProps & {
  /** Opens the match (Match Found), which shows the same report. */
  onOpenMatch: () => void;
};

const t = en.reportResult;

// Home's "Report result" card for the player's match that's on: who and
// where, then the same report as Match Found's "You're on!" panel.
export function ReportResultCard({ onOpenMatch, ...report }: ReportResultCardProps) {
  const { opponent, court } = report.view;
  const settled = report.view.stage.kind === 'confirmed' || report.view.stage.kind === 'disputed';
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <BrandIcon name="scoreboard" color={Brand.lime} size={18} />
        <Text style={styles.title} accessibilityRole="header">
          {t.title}
        </Text>
      </View>
      <Text style={styles.matchup}>
        {[t.versus(opponent), court && t.atCourt(court)].filter(Boolean).join(t.separator)}
      </Text>
      <ReportResult {...report} />
      {!settled && (
        <Pressable
          onPress={onOpenMatch}
          accessibilityRole="link"
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
          <Text style={[matchText.label, styles.linkLabel]}>{t.openMatch}</Text>
          <BrandIcon name="arrowRight" color={Brand.lime} size={14} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: BrandSizes.gapSnug,
    padding: BrandSizes.panelPadding,
    borderRadius: BrandSizes.panelRadius,
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
  matchup: {
    fontFamily: BrandFonts.bodyMedium,
    fontSize: 15,
    lineHeight: 22,
    color: Brand.text,
  },
  link: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: BrandSizes.minTouch,
  },
  linkLabel: {
    color: Brand.lime,
  },
  pressed: {
    opacity: 0.8,
  },
});
