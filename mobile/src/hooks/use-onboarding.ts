import { useUser } from '@clerk/expo';

import { OnboardingSkippedKey, ProfileCompletedKey } from '@/constants/profile';

/**
 * Whether the signed-in user still needs onboarding, read from Clerk metadata
 * (see ProfileCompletedKey / OnboardingSkippedKey). `pending` is false until
 * the user has loaded.
 */
export function useOnboarding() {
  const { isLoaded, user } = useUser();
  const profileCompleted = Boolean(user?.publicMetadata[ProfileCompletedKey]);
  const skipped = Boolean(user?.unsafeMetadata[OnboardingSkippedKey]);

  // "Skip for now" — remembered on the Clerk user so it survives reinstalls.
  const skip = async () => {
    await user?.updateMetadata({ unsafeMetadata: { [OnboardingSkippedKey]: new Date().toISOString() } });
  };

  return {
    isLoaded,
    profileCompleted,
    needsOnboarding: isLoaded && !!user && !profileCompleted && !skipped,
    skip,
  };
}
