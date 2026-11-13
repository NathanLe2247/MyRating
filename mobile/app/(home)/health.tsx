import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HealthDashboard } from '@/components/health/health-dashboard';
import type { HealthProvider } from '@/constants/health';
import { BottomTabInset, Brand, MaxContentWidth, Spacing } from '@/constants/theme';

// TODO: wire up HealthKit (iOS) and WHOOP OAuth (whoop-oauth edge function).
// Until then there's no data source, so the tab always shows "not connected".
const connectProvider = (_provider: HealthProvider) => {};

export default function HealthScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <HealthDashboard summary={null} onConnect={connectProvider} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Brand.background,
  },
  scroll: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
  },
});
