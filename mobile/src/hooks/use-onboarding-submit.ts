import { useUser } from '@clerk/expo';
import { useState } from 'react';

import { PlayerProfileApiError } from '@/hooks/use-player-profile-api';

/**
 * Submit state shared by the onboarding steps: runs `action`, then reloads the
 * Clerk user so the onboarding gate sees the metadata the edge function just
 * set. `errorCode` is the edge function's error (or `network`). `save`
 * resolves true on success.
 */
export function useOnboardingSubmit<A extends unknown[]>(action: (...args: A) => Promise<void>) {
  const { user } = useUser();
  const [saving, setSaving] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const save = async (...args: A) => {
    setSaving(true);
    setErrorCode(null);
    try {
      await action(...args);
      await user?.reload();
      return true;
    } catch (err) {
      setErrorCode(err instanceof PlayerProfileApiError ? err.code : 'network');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { save, saving, errorCode };
}
