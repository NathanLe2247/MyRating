// English strings for the mobile app. Import as `en` and reference nested
// keys from screens/components instead of inlining literal UI text.
export const en = {
  tabs: {
    home: 'Home',
    explore: 'Explore',
  },
  auth: {
    signIn: {
      title: 'Welcome to myRating',
      subtitle: 'Sign in or create an account',
      emailPlaceholder: 'Email',
      passwordPlaceholder: 'Password',
      continue: 'Continue',
      pleaseWait: 'Please wait…',
      needsSecondFactor: 'This account needs a second verification step, which isn’t set up yet.',
      accountCreationFailed: 'Could not create your account.',
      signInFailed: 'Could not sign in.',
    },
    verifyEmail: {
      title: 'Check your email',
      subtitle: (email: string) => `Enter the code we sent to ${email}`,
      codePlaceholder: '123456',
      verify: 'Verify',
      verifying: 'Verifying…',
      back: 'Back',
      codeInvalid: 'That code didn’t work.',
    },
  },
  home: {
    signedInFallback: 'Signed in',
    signOut: 'Sign out',
    welcome: 'Welcome to Expo',
    getStarted: 'get started',
    tryEditingTitle: 'Try editing',
    tryEditingHint: 'app/(home)/index.tsx',
    devToolsTitle: 'Dev tools',
    freshStartTitle: 'Fresh start',
    freshStartHint: 'npm run reset-project',
    devMenu: {
      web: 'use browser devtools',
      deviceHintBefore: 'shake device or press',
      deviceKey: 'm',
      deviceHintAfter: 'in terminal',
      simulatorHintBefore: 'press',
      androidShortcut: 'cmd+m (or ctrl+m)',
      iosShortcut: 'cmd+d',
    },
  },
  hintRow: {
    defaultTitle: 'Try editing',
    defaultHint: 'app/index.tsx',
  },
  explore: {
    title: 'Explore',
    subtitle: 'This starter app includes example\ncode to help you get started.',
    expoDocsLink: 'Expo documentation',
    learnMore: 'Learn more',
    sections: {
      routing: {
        title: 'File-based routing',
        body1Before: 'This app has two screens:',
        body1ScreenOne: 'src/app/index.tsx',
        body1And: 'and',
        body1ScreenTwo: 'src/app/explore.tsx',
        body2Before: 'The layout file in',
        body2Layout: 'src/app/_layout.tsx',
        body2After: 'sets up the tab navigator.',
      },
      platforms: {
        title: 'Android, iOS, and web support',
        bodyBefore:
          'You can open this project on Android, iOS, and the web. To open the web version, press',
        webKey: 'w',
        bodyAfter: 'in the terminal running this project.',
      },
      images: {
        title: 'Images',
        bodyBefore: 'For static images, you can use the',
        suffixOne: '@2x',
        bodyAnd: 'and',
        suffixTwo: '@3x',
        bodyAfter: 'suffixes to provide files for different screen densities.',
      },
      colorScheme: {
        title: 'Light and dark mode components',
        bodyBefore: 'This template has light and dark mode support. The',
        hook: 'useColorScheme()',
        bodyAfter:
          "hook lets you inspect what the user's current color scheme is, and so you can adjust UI colors accordingly.",
      },
      animations: {
        title: 'Animations',
        bodyBefore: 'This template includes an example of an animated component. The',
        component: 'src/components/ui/collapsible.tsx',
        bodyMiddle: 'component uses the powerful',
        library: 'react-native-reanimated',
        bodyAfter: 'library to animate opening this hint.',
      },
    },
  },
};
