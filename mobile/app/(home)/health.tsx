import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HealthDashboard } from '@/components/health/health-dashboard';
import { BottomTabInset, Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useHealthConnection } from '@/hooks/use-health-connection';

export default function HealthScreen() {
  const health = useHealthConnection();
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <HealthDashboard
          summary={health.summary}
          onConnect={health.connect}
          connecting={health.connecting}
          sample={health.sample}
          onDisconnect={health.disconnect}
        />
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
