import { useOnboardingSubmit } from '@/hooks/use-onboarding-submit';
import { usePlayerProfileApi } from '@/hooks/use-player-profile-api';

/**
 * Saves onboarding step 2. On success the edge function has recorded the
 * rating source and set Clerk `publicMetadata.onboardingCompletedAt`.
 */
export function useSaveRatingSource() {
  return useOnboardingSubmit(usePlayerProfileApi().saveRatingSource);
}
