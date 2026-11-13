// Mirrors the public.login_method enum. Shared by every function that writes
// public.users so the derivation can't drift between writers.
export type LoginMethod = 'phone' | 'email' | 'both';

/** Google sign-in counts as email (see public.users.login_method). */
export function loginMethodFor(email: string | null, phoneNumber: string | null): LoginMethod {
  return email && phoneNumber ? 'both' : phoneNumber ? 'phone' : 'email';
}
