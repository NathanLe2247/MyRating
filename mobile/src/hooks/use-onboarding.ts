import { useSession, useUser } from '@clerk/expo';

import { OnboardingCompletedKey, OnboardingSkippedKey, ProfileCompletedKey } from '@/constants/profile';

/**
 * Where the signed-in user is in onboarding, read from Clerk metadata (see
 * ProfileCompletedKey / OnboardingCompletedKey / OnboardingSkippedKey). Anyone
 * who hasn't finished both steps is sent back after every sign-in; "Skip for
 * now" only covers the current session.
 */
export function useOnboarding() {
  const { isLoaded: userLoaded, user } = useUser();
  const { isLoaded: sessionLoaded, session } = useSession();
  const profileCompleted = Boolean(user?.publicMetadata[ProfileCompletedKey]);
  const onboardingCompleted = Boolean(user?.publicMetadata[OnboardingCompletedKey]);
  const skippedThisSession = !!session && user?.unsafeMetadata[OnboardingSkippedKey] === session.id;

  const skip = async () => {
    if (!session) return;
    await user?.updateMetadata({ unsafeMetadata: { [OnboardingSkippedKey]: session.id } });
  };

  const isLoaded = userLoaded && sessionLoaded;
  return {
    isLoaded,
    profileCompleted,
    onboardingCompleted,
    needsOnboarding: isLoaded && !!user && !onboardingCompleted && !skippedThisSession,
    /** The first unfinished step. */
    nextStep: profileCompleted ? ('/onboarding/rating' as const) : ('/onboarding/profile' as const),
    skip,
  };
}
