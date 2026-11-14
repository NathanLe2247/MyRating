import { Redirect } from 'expo-router';

import AppTabs from '@/components/app-tabs';
import { useSignedInGate } from '@/hooks/use-route-gate';

// Signed out: `/` goes to the public courts screen, other tabs to sign-up.
// The tab bar only renders for signed-in, onboarded players.
export default function HomeLayout() {
  const gate = useSignedInGate();

  if (gate.status === 'pending') return null;
  if (gate.status === 'redirect') return <Redirect href={gate.href} />;
  return <AppTabs />;
}
