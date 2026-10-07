import { useClerk } from '@clerk/expo';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DashboardHeader } from '@/components/home/dashboard-header';
import { LoadError } from '@/components/home/load-error';
import { QueueCard } from '@/components/home/queue-card';
import { RatingCard } from '@/components/home/rating-card';
import { RecentMatches } from '@/components/home/recent-matches';
import { DashboardPlaceholderData } from '@/constants/dashboard-placeholder';
import type { MatchFormat } from '@/constants/match';
import { BottomTabInset, Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useDashboard } from '@/hooks/use-dashboard';
import { en } from '@/i18n/en';

export default function HomeScreen() {
  const { signOut } = useClerk();
  const [format, setFormat] = useState<MatchFormat>('doubles');
  const { data, error, refetch } = useDashboard(format);

  // TODO: the header's options button is the only place to sign out until
  // there's a profile/settings screen.
  const openAccountMenu = () => {
    // react-native-web's Alert.alert is a no-op, so web uses the browser dialog.
    if (Platform.OS === 'web') {
      if (window.confirm(en.home.account.confirmSignOut)) signOut();
      return;
    }
    Alert.alert(en.home.account.title, undefined, [
      { text: en.home.account.cancel, style: 'cancel' },
      { text: en.home.account.signOut, style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <DashboardHeader
          format={format}
          onFormatChange={setFormat}
          courts={DashboardPlaceholderData.courts}
          onMenuPress={openAccountMenu}
        />
        {data ? (
          <>
            <RatingCard summary={data.rating} />
            {/* TODO: navigate to the queue screen once it exists. */}
            <QueueCard summary={data.queue} />
            <RecentMatches matches={data.recentMatches} />
          </>
        ) : error ? (
          <LoadError message={en.home.loadFailed} onRetry={() => refetch()} />
        ) : (
          <ActivityIndicator color={Brand.lime} style={styles.loading} />
        )}
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
    gap: Spacing.four,
  },
  loading: {
    paddingVertical: Spacing.six,
  },
});
