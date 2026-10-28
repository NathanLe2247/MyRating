import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlayHeader } from '@/components/play/play-header';
import { PlayListings } from '@/components/play/play-listings';
import { BottomTabInset, Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePlayListings } from '@/hooks/use-play-listings';

export default function PlayScreen() {
  const listings = usePlayListings();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PlayHeader />
        <PlayListings courts={listings.courts} tournaments={listings.tournaments} />
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
});
