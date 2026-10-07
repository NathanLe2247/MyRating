import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Platform } from 'react-native';

type FinalizeArgs = {
  session?: { currentTask?: unknown } | null;
  decorateUrl: (url: string) => string;
};

/**
 * `navigate` callback for Clerk's `signIn.finalize()` / `signUp.finalize()`.
 * Session tasks (forced MFA enrollment, org selection) would need their own
 * screen; none are configured for this instance yet, so those just stay put.
 */
export function useAuthNavigate() {
  const router = useRouter();

  return useCallback(
    ({ session, decorateUrl }: FinalizeArgs) => {
      if (session?.currentTask) return;
      const url = decorateUrl('/');
      if (Platform.OS === 'web' && url.startsWith('http')) {
        window.location.href = url;
      } else {
        router.replace(url as never);
      }
    },
    [router]
  );
}
