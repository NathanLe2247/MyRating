import { StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import type { HealthProvider } from '@/constants/health';
import { Brand, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';
import { formatSyncedAgo } from '@/utils/health-format';

import { healthStyles } from './styles';

type SyncBarProps = {
  provider: HealthProvider;
  syncedAt: string;
};

// Pill showing which wearable the data came from and when it last synced.
export function SyncBar({ provider, syncedAt }: SyncBarProps) {
  const copy = en.health.sync;
  return (
    <View style={styles.bar}>
      <View style={styles.dot} />
      <BrandIcon name="watch" color={Brand.text} size={12} />
      <Text style={[healthStyles.caption, styles.source]} numberOfLines={1}>
        {copy.synced(en.health.providers[provider])}
        <Text style={healthStyles.caption}>
          {copy.separator}
          {formatSyncedAgo(syncedAt)}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Brand.input,
    borderRadius: BrandSizes.pillRadius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dot: {
    width: Spacing.two,
    height: Spacing.two,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
  },
  source: {
    flexShrink: 1,
    color: Brand.text,
  },
});
