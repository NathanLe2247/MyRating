/**
 * Signed-out routing. The public courts screen (`app/(public)/courts.tsx`) is
 * the only screen outside `(auth)` that works without an account: signed-out
 * visits to `/` land there, and every other gated route goes to sign-up.
 */
export const PublicCourtsHref = '/courts' as const;
export const SignUpHref = '/sign-up' as const;
export const SignInHref = '/sign-in' as const;
/** Where a signed-in visit to the public courts screen goes instead. */
export const SignedInCourtsHref = '/play' as const;

/** Where a signed-out visit to a gated route at `pathname` is sent. */
export function signedOutRedirect(pathname: string) {
  return pathname === '/' ? PublicCourtsHref : SignUpHref;
}
