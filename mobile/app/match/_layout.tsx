import { Redirect, Stack } from 'expo-router';

import { useSignedInGate } from '@/hooks/use-route-gate';

// Match screens sit outside the tab bar (full screen), behind the same
// signed-in + onboarded gate as the tabs.
export default function MatchLayout() {
  const gate = useSignedInGate();

  if (gate.status === 'pending') return null;
  if (gate.status === 'redirect') return <Redirect href={gate.href} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
