import { useUser } from '@clerk/expo';
import { useState } from 'react';

import { PlayerProfileApiError, usePlayerProfileApi } from '@/hooks/use-player-profile-api';
import type { PickedAvatar, PlayerProfileInput } from '@/types/profile';

/**
 * Saves onboarding step 1. On success the edge function has written
 * public.users and set Clerk `publicMetadata.profileCompletedAt`; the user is
 * reloaded so the onboarding gate sees it.
 */
export function useSavePlayerProfile() {
  const api = usePlayerProfileApi();
  const { user } = useUser();
  const [saving, setSaving] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const save = async (input: PlayerProfileInput, avatar: PickedAvatar | null) => {
    setSaving(true);
    setErrorCode(null);
    try {
      await api.saveProfile(input, avatar);
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
