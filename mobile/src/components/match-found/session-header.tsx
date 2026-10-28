import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLogo } from '@/components/auth/brand-logo';
import { BrandIcon } from '@/components/brand-icon';
import { PlayerAvatar } from '@/components/match-found/player-avatar';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

const LOGO = 28;

type SessionHeaderProps = {
  onBack: () => void;
  /** The signed-in player; the photo is hidden when there's no match yet. */
  player?: { name: string; avatarUrl?: string };
};

// Top bar: back, brand mark, "Active match session", and the player's photo.
export function SessionHeader({ onBack, player }: SessionHeaderProps) {
  const t = en.matchFound;
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={t.back}
          hitSlop={Spacing.two}
          style={styles.back}>
          <BrandIcon name="back" color={Brand.text} size={18} />
        </Pressable>
        <BrandLogo size={LOGO} />
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {t.header}
        </Text>
      </View>
      {player && (
        <View style={styles.avatarRing}>
          <PlayerAvatar name={player.name} uri={player.avatarUrl} size={BrandSizes.headerAvatar} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: BrandSizes.topBar,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: BrandSizes.gapSnug,
    backgroundColor: Brand.background,
    boxShadow: `0 1px 8px ${Brand.shadowStrong}`,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  back: {
    minWidth: BrandSizes.minTouch,
    minHeight: BrandSizes.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.55,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  avatarRing: {
    borderRadius: BrandSizes.pillRadius,
    boxShadow: `0 0 0 1px ${Brand.border}`,
  },
});
