import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

import { useOnboarding } from '@/hooks/use-onboarding';

// Match screens sit outside the tab bar (full screen), behind the same
// signed-in + onboarded gate as the tabs.
export default function MatchLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const onboarding = useOnboarding();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-up" />;
  if (!onboarding.isLoaded) return null;
  if (onboarding.needsOnboarding) return <Redirect href={onboarding.nextStep} />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
