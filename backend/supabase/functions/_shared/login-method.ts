// Mirrors the public.login_method enum. Shared by every function that writes
// public.users so the derivation can't drift between writers.
//
// Source of truth: LOGIN_METHODS / LoginMethod in shared/src/profile.ts (and
// the enum in the users migration). Edge functions don't import shared/
// today, so this copy must be kept in sync with it by hand.
export type LoginMethod = 'phone' | 'email' | 'both';

/** Google sign-in counts as email (see public.users.login_method). */
export function loginMethodFor(email: string | null, phoneNumber: string | null): LoginMethod {
  return email && phoneNumber ? 'both' : phoneNumber ? 'phone' : 'email';
}
