import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

import { useOnboarding } from '@/hooks/use-onboarding';

export default function OnboardingLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const onboarding = useOnboarding();

  if (!isLoaded || !onboarding.isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/sign-up" />;
  if (onboarding.onboardingCompleted) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
