import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { HealthProvider } from '@/constants/health';
import { Brand, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

import { healthStyles } from './styles';

type SampleDataNoteProps = {
  provider: HealthProvider;
  onDisconnect?: () => void;
};

// Dev-only demo connection: says the dashboard is sample data and offers a
// disconnect so the demo can be replayed.
export function SampleDataNote({ provider, onDisconnect }: SampleDataNoteProps) {
  const copy = en.health.sample;
  return (
    <View style={healthStyles.rowBetween}>
      <Text style={[healthStyles.caption, styles.note]}>{copy.note}</Text>
      {onDisconnect && (
        <Pressable
          onPress={onDisconnect}
          accessibilityRole="button"
          accessibilityLabel={copy.disconnectLabel(en.health.providers[provider])}
          hitSlop={Spacing.two}
          style={({ pressed }) => pressed && styles.pressed}>
          <Text style={[healthStyles.caption, styles.action]}>{copy.disconnect}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexShrink: 1,
  },
  action: {
    color: Brand.lime,
  },
  pressed: {
    opacity: 0.7,
  },
});
