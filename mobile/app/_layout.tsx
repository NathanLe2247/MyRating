import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
} from '@expo-google-fonts/barlow-condensed';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from '@expo-google-fonts/hanken-grotesk';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Slot, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { LogBox, useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";

if (!publishableKey) {
  throw new Error("Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY. Add your key to .env.local.\nRun: 1) clerk auth login  2) clerk link  3) clerk env pull — then restart the dev server.");
}

// Expected while using a pk_test_ key; goes away with a production (pk_live_) instance.
LogBox.ignoreLogs(['Clerk: Clerk has been loaded with development keys']);

SplashScreen.preventAutoHideAsync();

// Routing (sign-in vs. tabs) is decided by the (auth) and (home) group
// layouts below, based on Clerk auth state — see app/(auth)/_layout.tsx and
// app/(home)/_layout.tsx.
export default function RootLayout() {
  const colorScheme = useColorScheme();
  // Keys must match `BrandFonts` in src/constants/theme.ts.
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
  });

  // Keep the native splash up until fonts are ready (or failed — then fall
  // back to system fonts rather than hanging on the splash).
  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <Slot />
      </ThemeProvider>
    </ClerkProvider>
  );
}
