import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

// Without this the Stack starts on the alphabetically-first route
// (forgot-password) on Android instead of the redirect target.
export const unstable_settings = {
  initialRouteName: 'sign-in',
};

export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
