import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { matchText } from '@/components/match-found/text-styles';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type MatchFoundBannerProps = {
  /** Rating gap shown as the parity delta; null while either player is unrated. */
  ratingGap: string | null;
  verified?: boolean;
  courtReady?: boolean;
};

// "Match found!" hero: lime icon, parity line, and verified / court-ready tags.
export function MatchFoundBanner({ ratingGap, verified, courtReady }: MatchFoundBannerProps) {
  const t = en.matchFound;
  return (
    <View style={styles.banner}>
      <View style={styles.main}>
        <View style={styles.icon}>
          <BrandIcon name="paddle" color={Brand.onLime} size={20} />
        </View>
        <View style={styles.text}>
          <View style={styles.titleRow}>
            <Text style={styles.title} accessibilityRole="header">
              {t.title}
            </Text>
            <Text style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
              {t.celebrate}
            </Text>
          </View>
          <Text style={matchText.caption}>
            {ratingGap === null ? t.parityCalibrating : t.parity(ratingGap)}
          </Text>
        </View>
      </View>
      {(verified || courtReady) && (
        <View style={styles.tags}>
          {verified && (
            <View style={styles.verified}>
              <Text style={[matchText.label, styles.verifiedLabel]}>{t.verified}</Text>
            </View>
          )}
          {courtReady && <Text style={[matchText.caption, styles.right]}>{t.courtReady}</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.three,
    overflow: 'hidden',
    backgroundColor: Brand.cardRaised,
    experimental_backgroundImage: `radial-gradient(circle at 100% 0%, ${Brand.limeSurface} 0%, transparent 60%)`,
    boxShadow: `0 20px 25px -5px ${Brand.shadowSoft}`,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapSnug,
  },
  icon: {
    width: BrandSizes.optionIcon,
    height: BrandSizes.optionIcon,
    borderRadius: BrandSizes.pillRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.lime,
    boxShadow: `0 0 8px ${Brand.limeGlow}`,
  },
  text: {
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapTight,
  },
  title: {
    fontFamily: BrandFonts.display,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.7,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  emoji: {
    fontSize: 20,
    lineHeight: 28,
  },
  tags: {
    alignItems: 'flex-end',
    gap: Spacing.half,
    maxWidth: '30%',
  },
  verified: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.cardSelected,
  },
  verifiedLabel: {
    color: Brand.lime,
  },
  right: {
    textAlign: 'right',
  },
});
