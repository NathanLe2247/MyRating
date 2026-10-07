/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * myRating brand palette. Auth screens are always dark (they don't follow the
 * system light/dark setting), so these are fixed values rather than a
 * light/dark pair.
 */
export const Brand = {
  lime: '#D4FF00',
  limeGlow: 'rgba(212, 255, 0, 0.35)',
  onLime: '#0B0E10',
  background: '#0B0E10',
  card: '#151A1F',
  input: '#0E1216',
  border: '#1F262D',
  logoRing: '#262C33',
  text: '#E8ECEF',
  textMuted: '#A7AFB6',
  textFaint: '#5B646C',
  placeholder: '#58616A',
  error: '#FF6B6B',
} as const;

/**
 * Brand font families — loaded in `app/_layout.tsx` via `useFonts`. The keys
 * here must match the keys passed to `useFonts` there.
 */
export const BrandFonts = {
  display: 'BarlowCondensed_700Bold',
  displaySemiBold: 'BarlowCondensed_600SemiBold',
  body: 'HankenGrotesk_400Regular',
  bodyMedium: 'HankenGrotesk_500Medium',
  bodySemiBold: 'HankenGrotesk_600SemiBold',
} as const;

/**
 * Sizes shared by the brand-styled (auth) components, so inputs and buttons
 * line up and the shell width is defined once.
 */
export const BrandSizes = {
  /** Height of text inputs and buttons. */
  control: 48,
  /** Pill radius for `control`-height elements. */
  controlRadius: 24,
  cardRadius: 16,
  /** Max width of the auth card column (narrower than `MaxContentWidth`). */
  authMaxWidth: 480,
  /** Gaps between `Spacing` steps: icon↔text and label↔control. */
  gapTight: 6,
  gapSnug: 12,
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
