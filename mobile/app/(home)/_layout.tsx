import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { useOnboarding } from '@/hooks/use-onboarding';

export default function HomeLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const onboarding = useOnboarding();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-up" />;
  if (!onboarding.isLoaded) return null;
  // New accounts (email, phone, or Google) land on onboarding until they
  // finish both steps or skip it.
  if (onboarding.needsOnboarding) return <Redirect href={onboarding.nextStep} />;

  return <AppTabs />;
}
