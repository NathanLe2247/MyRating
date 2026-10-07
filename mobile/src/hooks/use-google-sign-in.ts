import { useSSO } from '@clerk/expo/experimental';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { useWarmUpBrowser } from '@/hooks/use-warm-up-browser';
import { en } from '@/i18n/en';

// Closes the OAuth popup on web when Google redirects back.
WebBrowser.maybeCompleteAuthSession();

/**
 * Browser-based Google OAuth via Clerk. Works for both new and existing
 * accounts (Clerk transfers between sign-in and sign-up internally) and
 * activates the session itself — the (auth) layout then redirects home.
 */
export function useGoogleSignIn() {
  const { startSSOFlow } = useSSO();
  useWarmUpBrowser();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setError(null);
    setPending(true);
    try {
      // A cancelled browser session resolves with no session — not an error.
      await startSSOFlow({ strategy: 'oauth_google' });
    } catch (err) {
      const message = (err as { longMessage?: string; message?: string })?.longMessage;
      setError(message ?? en.auth.google.failed);
    } finally {
      setPending(false);
    }
  };

  return { signInWithGoogle, pending, error };
}
