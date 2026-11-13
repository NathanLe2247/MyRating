import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { Chip } from '@/components/play/chip';
import { MetaLine } from '@/components/play/meta-line';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import type { TournamentCardData } from '@/types/play';
import { formatEventDate } from '@/utils/date-format';

const copy = en.play.tournaments;

type TournamentCardProps = {
  tournament: TournamentCardData;
  onPress?: () => void;
};

// The Figma frame only details court cards, so this follows their type and
// chip styles: title, date and venue line, and a division / spots chip row.
export function TournamentCard({ tournament, onPress }: TournamentCardProps) {
  const date = formatEventDate(tournament.startsAt, tournament.timeZone) ?? copy.dateTbd;

  // Ternaries, not `&&`, so an empty string can't render as a bare text node.
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
        <MetaLine icon="calendar" parts={[date, tournament.venue]} />
        {tournament.division || tournament.spotsLeft !== undefined ? (
          <View style={styles.chips}>
            {tournament.division ? <Chip label={tournament.division} color={Brand.warm} /> : null}
            {tournament.spotsLeft !== undefined ? (
              <Chip label={copy.spotsLeft(tournament.spotsLeft)} color={Brand.textMuted} />
            ) : null}
          </View>
        ) : null}
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
