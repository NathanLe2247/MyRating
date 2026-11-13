import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon, type BrandIconName } from '@/components/brand-icon';
import { HealthProviders, type HealthProvider } from '@/constants/health';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

import { healthStyles } from './styles';

const PROVIDER_ICONS = {
  apple_health: 'heartFill',
  whoop: 'hrv',
} as const satisfies Record<HealthProvider, BrandIconName>;

type ConnectCardProps = {
  onConnect: (provider: HealthProvider) => void;
};

// "Not connected" state: a tile per wearable source to link.
export function ConnectCard({ onConnect }: ConnectCardProps) {
  const copy = en.health.connect;
  return (
    <View style={[healthStyles.card, styles.card]}>
      <View style={healthStyles.rowBetween}>
        <View style={healthStyles.rowTight}>
          <BrandIcon name="sensors" color={Brand.textMuted} size={16} />
          <Text style={healthStyles.eyebrow}>{copy.eyebrow}</Text>
        </View>
        <View style={[healthStyles.chip, styles.tag]}>
          <Text style={healthStyles.chipLabel}>{copy.tag}</Text>
        </View>
      </View>
      <Text style={[healthStyles.heading, styles.title]}>{copy.title}</Text>
      <Text style={healthStyles.caption}>{copy.body}</Text>
      <View style={styles.grid}>
        {HealthProviders.map((provider) => {
          const name = en.health.providers[provider];
          return (
            <Pressable
              key={provider}
              onPress={() => onConnect(provider)}
              accessibilityRole="button"
              accessibilityLabel={copy.label(name)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
              <View style={styles.iconCircle}>
                <BrandIcon name={PROVIDER_ICONS[provider]} color={Brand.text} size={18} />
              </View>
              <Text style={styles.tileName}>{name}</Text>
              <Text style={[healthStyles.caption, styles.tileAction]}>{copy.action}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.input,
  },
  tag: {
    backgroundColor: Brand.limeSurface,
  },
  title: {
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  grid: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginTop: Spacing.three,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    backgroundColor: Brand.card,
  },
  pressed: {
    opacity: 0.7,
  },
  iconCircle: {
    width: BrandSizes.headerButton,
    height: BrandSizes.headerButton,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: BrandSizes.gapTight,
  },
  tileName: {
    fontFamily: BrandFonts.displaySemiBold,
    fontSize: 15,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Brand.text,
  },
  tileAction: {
    color: Brand.lime,
  },
});
