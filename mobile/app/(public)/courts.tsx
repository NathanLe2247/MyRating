import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NearbyCourtsSection } from '@/components/courts/nearby-courts-section';
import { SignUpCta } from '@/components/courts/sign-up-cta';
import { PlayHeader } from '@/components/play/play-header';
import { SignInHref, SignUpHref } from '@/constants/routes';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useNearbyCourts } from '@/hooks/use-nearby-courts';
import { en } from '@/i18n/en';

// Signed-out landing: courts near the device (anon key, no account) and a
// way into sign-up / log in. Pushed, so back returns here.
export default function PublicCourtsScreen() {
  const router = useRouter();
  const courts = useNearbyCourts();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PlayHeader title={en.courts.signedOut.tagline} />
        <SignUpCta
          onSignUp={() => router.push(SignUpHref)}
          onLogIn={() => router.push(SignInHref)}
        />
        <NearbyCourtsSection state={courts} />
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
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
});
