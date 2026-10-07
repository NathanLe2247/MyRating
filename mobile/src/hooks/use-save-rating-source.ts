import { useUser } from '@clerk/expo';
import { useState } from 'react';

import { PlayerProfileApiError, usePlayerProfileApi } from '@/hooks/use-player-profile-api';
import type { RatingSource } from '@/types/profile';

/**
 * Saves onboarding step 2. On success the edge function has recorded the
 * rating source and set Clerk `publicMetadata.onboardingCompletedAt`; the user
 * is reloaded so the onboarding gate sees it.
 */
export function useSaveRatingSource() {
  const api = usePlayerProfileApi();
  const { user } = useUser();
  const [saving, setSaving] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const save = async (source: RatingSource) => {
    setSaving(true);
    setErrorCode(null);
    try {
      await api.saveRatingSource(source);
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
