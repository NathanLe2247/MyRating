import { useAuth } from '@clerk/expo';
import { type Href, usePathname } from 'expo-router';

import { SignedInCourtsHref, signedOutRedirect } from '@/constants/routes';
import { useOnboarding } from '@/hooks/use-onboarding';

export type RouteGate =
  /** Auth or onboarding state still loading: render nothing. */
  | { status: 'pending' }
  | { status: 'redirect'; href: Href }
  | { status: 'allow' };

/**
 * Gate for the signed-in app (tabs and match screens): needs an account that
 * has finished onboarding. Signed out, `/` goes to the public courts screen
 * and anything else to sign-up, so no user or rating screen ever renders.
 */
export function useSignedInGate(): RouteGate {
  const { isLoaded, isSignedIn } = useAuth();
  const onboarding = useOnboarding();
  const pathname = usePathname();

  if (!isLoaded) return { status: 'pending' };
  if (!isSignedIn) return { status: 'redirect', href: signedOutRedirect(pathname) };
  if (!onboarding.isLoaded) return { status: 'pending' };
  // Onboarding is required: accounts (email, phone, or Google) land on it
  // until they finish both steps.
  if (onboarding.needsOnboarding) return { status: 'redirect', href: onboarding.nextStep };
  return { status: 'allow' };
}

/**
 * Gate for the public courts screen: open to signed-out visitors. Signed-in
 * players already have the same list on Play, so they go there.
 */
export function usePublicGate(): RouteGate {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return { status: 'pending' };
  if (isSignedIn) return { status: 'redirect', href: SignedInCourtsHref };
  return { status: 'allow' };
}
