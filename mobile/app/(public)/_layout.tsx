import { Redirect, Stack } from 'expo-router';

import { usePublicGate } from '@/hooks/use-route-gate';

// Screens that work without an account (only the courts list). Signed-in
// players are sent to Play, which shows the same list.
export default function PublicLayout() {
  const gate = usePublicGate();

  if (gate.status === 'pending') return null;
  if (gate.status === 'redirect') return <Redirect href={gate.href} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
