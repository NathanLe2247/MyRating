import { useAuth } from '@clerk/expo';
import { Redirect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator } from 'react-native';

import { AuthLink } from '@/components/auth/auth-link';
import { AuthScreen } from '@/components/auth/auth-screen';
import { Brand } from '@/constants/theme';
import { en } from '@/i18n/en';

// On web this page loads inside the OAuth popup; this hands the result back
// to the opener and closes it.
WebBrowser.maybeCompleteAuthSession();

// Where Google OAuth redirects back to (`myrating://sso-callback`, from
// useSSO's default redirect URL). Expo Router opens it as a route, so without
// this screen the app lands on "Unmatched Route". Once Clerk has activated the
// session, `/` sends the user on to onboarding or home.
export default function SsoCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  if (isLoaded && isSignedIn) return <Redirect href="/" />;

  return (
    <AuthScreen
      title={en.auth.google.finishing}
      subtitle={en.auth.google.finishingSubtitle}
      footer={
        <AuthLink
          variant="muted"
          label={en.auth.google.backToSignUp}
          onPress={() => router.replace('/sign-up')}
        />
      }>
      <ActivityIndicator color={Brand.lime} />
    </AuthScreen>
  );
}
