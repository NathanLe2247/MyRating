import { useClerk, useUser } from '@clerk/expo';
import * as Device from 'expo-device';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

function AccountRow() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <ThemedView type="backgroundElement" style={styles.accountRow}>
      <ThemedText type="small" style={styles.accountEmail}>
        {user?.primaryEmailAddress?.emailAddress ?? en.home.signedInFallback}
      </ThemedText>
      <Pressable onPress={() => signOut()}>
        <ThemedText type="linkPrimary">{en.home.signOut}</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">{en.home.devMenu.web}</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        {en.home.devMenu.deviceHintBefore}{' '}
        <ThemedText type="code">{en.home.devMenu.deviceKey}</ThemedText>{' '}
        {en.home.devMenu.deviceHintAfter}
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? en.home.devMenu.androidShortcut : en.home.devMenu.iosShortcut;
  return (
    <ThemedText type="small">
      {en.home.devMenu.simulatorHintBefore} <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <AccountRow />

        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            {en.home.welcome}
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          {en.home.getStarted}
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title={en.home.tryEditingTitle}
            hint={<ThemedText type="code">{en.home.tryEditingHint}</ThemedText>}
          />
          <HintRow title={en.home.devToolsTitle} hint={getDevMenuHint()} />
          <HintRow
            title={en.home.freshStartTitle}
            hint={<ThemedText type="code">{en.home.freshStartHint}</ThemedText>}
          />
        </ThemedView>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  accountRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },
  accountEmail: {
    flexShrink: 1,
  },
});
