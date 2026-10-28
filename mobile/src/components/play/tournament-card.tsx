import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { TournamentCardData } from '@/types/play';

const copy = en.play.tournaments;

type TournamentCardProps = {
  tournament: TournamentCardData;
  onPress?: () => void;
};

// The Figma frame only details court cards, so this follows their type and
// chip styles: title, date and venue line, and a division / spots chip row.
export function TournamentCard({ tournament, onPress }: TournamentCardProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={tournament.name}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.iconCircle}>
        <BrandIcon name="trophy" color={Brand.lime} size={20} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {tournament.name}
        </Text>
        <View style={styles.metaRow}>
          <BrandIcon name="calendar" color={Brand.textMuted} size={11} />
          <Text style={styles.meta}>{copy.date(tournament.startsAt)}</Text>
          <Text style={[styles.meta, styles.separator]}>{en.play.separator}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {tournament.venue}
          </Text>
        </View>
        {(tournament.division || tournament.spotsLeft !== undefined) && (
          <View style={styles.chips}>
            {tournament.division && (
              <View style={styles.chip}>
                <Text style={[styles.chipLabel, styles.division]}>{tournament.division}</Text>
              </View>
            )}
            {tournament.spotsLeft !== undefined && (
              <View style={styles.chip}>
                <Text style={styles.chipLabel}>{copy.spotsLeft(tournament.spotsLeft)}</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: BrandSizes.gapSnug,
    backgroundColor: Brand.card,
    borderRadius: BrandSizes.cardRadius,
    padding: Spacing.three,
  },
  pressed: {
    opacity: 0.85,
  },
  iconCircle: {
    width: BrandSizes.optionIcon,
    height: BrandSizes.optionIcon,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.limeSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: BrandSizes.gapTight,
  },
  name: {
    fontFamily: BrandFonts.display,
    fontSize: 22,
    lineHeight: 24,
    letterSpacing: -0.3,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  meta: {
    flexShrink: 1,
    fontFamily: BrandFonts.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.12,
    color: Brand.textMuted,
  },
  separator: {
    opacity: 0.4,
    paddingHorizontal: Spacing.one,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: BrandSizes.gapMid,
    paddingVertical: Spacing.one,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
  },
  chipLabel: {
    fontFamily: BrandFonts.display,
    fontSize: 13,
    lineHeight: 14,
    letterSpacing: 1.04,
    textTransform: 'uppercase',
    color: Brand.textMuted,
  },
  division: {
    color: Brand.warm,
  },
});
