import { useSession, useUser } from '@clerk/expo';

import { OnboardingSkippedKey, ProfileCompletedKey } from '@/constants/profile';

/**
 * Whether the signed-in user still needs onboarding, read from Clerk metadata
 * (see ProfileCompletedKey / OnboardingSkippedKey). Anyone without a completed
 * profile is sent there after every sign-in; "Skip for now" only covers the
 * current session.
 */
export function useOnboarding() {
  const { isLoaded: userLoaded, user } = useUser();
  const { isLoaded: sessionLoaded, session } = useSession();
  const profileCompleted = Boolean(user?.publicMetadata[ProfileCompletedKey]);
  const skippedThisSession = !!session && user?.unsafeMetadata[OnboardingSkippedKey] === session.id;

  const skip = async () => {
    if (!session) return;
    await user?.updateMetadata({ unsafeMetadata: { [OnboardingSkippedKey]: session.id } });
  };

  const isLoaded = userLoaded && sessionLoaded;
  return {
    isLoaded,
    profileCompleted,
    needsOnboarding: isLoaded && !!user && !profileCompleted && !skippedThisSession,
    skip,
  };
}
