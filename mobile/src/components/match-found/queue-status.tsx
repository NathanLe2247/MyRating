import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { matchText } from '@/components/match-found/text-styles';
import { Brand, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import { formatElapsed } from '@/utils/match-found-format';

const PULSE = 12;

type QueueStatusProps = {
  radiusMiles: number;
  elapsedSeconds: number;
  onLeave: () => void;
};

// Queue pulse strip: search radius, time in queue, and "Leave".
export function QueueStatus({ radiusMiles, elapsedSeconds, onLeave }: QueueStatusProps) {
  const t = en.matchFound;
  return (
    <View style={styles.strip}>
      <View style={styles.left}>
        <View style={styles.pulse} />
        <View style={styles.text}>
          <Text style={[matchText.label, styles.searching]} numberOfLines={1}>
            {t.searching(radiusMiles)}
          </Text>
          <View style={styles.elapsedRow}>
            <BrandIcon name="timer" color={Brand.textMuted} size={12} />
            <Text style={matchText.caption}>{t.elapsed(formatElapsed(elapsedSeconds))}</Text>
          </View>
        </View>
      </View>
      <Pressable
        onPress={onLeave}
        accessibilityRole="button"
        accessibilityLabel={t.leaveLabel}
        style={({ pressed }) => [styles.leave, pressed && styles.pressed]}>
        <BrandIcon name="close" color={Brand.loss} size={10} />
        <Text style={[matchText.label, styles.leaveLabel]}>{t.leave}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: BrandSizes.gapSnug,
    backgroundColor: Brand.card,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: BrandSizes.gapMid,
  },
  pulse: {
    width: PULSE,
    height: PULSE,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
    boxShadow: `0 0 0 3px ${Brand.limeSurface}`,
  },
  text: {
    flexShrink: 1,
  },
  searching: {
    color: Brand.lime,
  },
  elapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  leave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: BrandSizes.gapSnug,
    paddingVertical: BrandSizes.gapTight,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
  },
  leaveLabel: {
    color: Brand.loss,
  },
  pressed: {
    opacity: 0.8,
  },
});
