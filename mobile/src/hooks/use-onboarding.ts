import { useUser } from '@clerk/expo';

import { OnboardingCompletedKey, ProfileCompletedKey } from '@/constants/profile';

/**
 * Where the signed-in user is in onboarding, read from Clerk metadata (see
 * ProfileCompletedKey / OnboardingCompletedKey). Onboarding is required:
 * anyone who hasn't finished both steps is sent back to it.
 */
export function useOnboarding() {
  const { isLoaded, user } = useUser();
  const profileCompleted = Boolean(user?.publicMetadata[ProfileCompletedKey]);
  const onboardingCompleted = Boolean(user?.publicMetadata[OnboardingCompletedKey]);

  return {
    isLoaded,
    profileCompleted,
    onboardingCompleted,
    needsOnboarding: isLoaded && !!user && !onboardingCompleted,
    /** The first unfinished step. */
    nextStep: profileCompleted ? ('/onboarding/rating' as const) : ('/onboarding/profile' as const),
  };
}
