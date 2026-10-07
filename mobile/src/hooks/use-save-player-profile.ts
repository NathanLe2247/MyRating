import { useOnboardingSubmit } from '@/hooks/use-onboarding-submit';
import { usePlayerProfileApi } from '@/hooks/use-player-profile-api';

/**
 * Saves onboarding step 1. On success the edge function has written
 * public.users and set Clerk `publicMetadata.profileCompletedAt`.
 */
export function useSavePlayerProfile() {
  return useOnboardingSubmit(usePlayerProfileApi().saveProfile);
}
