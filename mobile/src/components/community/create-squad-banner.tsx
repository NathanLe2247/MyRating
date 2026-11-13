import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { communityStyles, communityText } from '@/components/community/styles';
import { Brand, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type CreateSquadBannerProps = {
  /** Starts creating a group. The button is disabled until that flow exists. */
  onCreatePress?: () => void;
};

// "Start your own squad" invitation at the top of Discover & search. The
// design's "N squads in <area>" count is left out until there's group data
// to back it.
export function CreateSquadBanner({ onCreatePress }: CreateSquadBannerProps) {
  const t = en.community.discover.builder;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.identity}>
          <View style={styles.iconCircle}>
            <BrandIcon name="personAdd" color={Brand.lime} size={15} />
          </View>
          <View style={styles.headings}>
            <Text style={[communityText.label, styles.tag]}>{t.tag}</Text>
            <Text style={communityText.title} accessibilityRole="header">
              {t.title}
            </Text>
          </View>
        </View>
        <View style={styles.badge}>
          <Text style={[communityText.stat, styles.badgeText]}>{t.badge}</Text>
        </View>
      </View>
      <Text style={[communityText.body, styles.body]}>{t.body}</Text>
      <Pressable
        onPress={onCreatePress}
        disabled={!onCreatePress}
        accessibilityRole="button"
        accessibilityState={{ disabled: !onCreatePress }}
        style={[styles.cta, !onCreatePress && communityStyles.disabled]}>
        <BrandIcon name="plusCircle" color={Brand.onLime} size={15} />
        <Text style={[communityText.button, communityText.onLime]}>{t.cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: BrandSizes.discoverCardRadius,
    overflow: 'hidden',
    backgroundColor: Brand.card,
    experimental_backgroundImage: [
      `radial-gradient(circle at 100% 100%, ${Brand.limeSurface} 0%, transparent 40%)`,
      `linear-gradient(147deg, ${Brand.cardRaised} 0%, ${Brand.card} 50%, ${Brand.background} 100%)`,
    ].join(', '),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  iconCircle: {
    width: BrandSizes.headerButton,
    height: BrandSizes.headerButton,
    borderRadius: BrandSizes.pillRadius,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.limeSurface,
  },
  headings: {
    flex: 1,
    gap: Spacing.half,
  },
  tag: {
    color: Brand.lime,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: BrandSizes.cardRadius,
    backgroundColor: Brand.background,
  },
  badgeText: {
    color: Brand.textMuted,
    textTransform: 'uppercase',
  },
  body: {
    color: Brand.textMuted,
  },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
  },
});
