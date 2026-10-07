import { createClerkClient, verifyToken } from 'npm:@clerk/backend@3';

const secretKey = Deno.env.get('CLERK_SECRET_KEY')!;
const clerk = createClerkClient({ secretKey });

export type LoginMethod = 'phone' | 'email' | 'both';

export type ClerkIdentity = {
  clerkUserId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber: string | null;
  loginMethod: LoginMethod;
};

/**
 * Verifies the Clerk session token from `Authorization: Bearer …` and returns
 * the Clerk user id (`sub`), or null if it's missing/invalid. Verified here
 * rather than by Supabase's gateway (verify_jwt = false for this function) so
 * it works whether or not the Clerk third-party integration is enabled.
 */
export async function authenticate(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const payload = await verifyToken(token, { secretKey });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** What Clerk already knows about the user, read server-side so it can't be spoofed. */
export async function getClerkIdentity(clerkUserId: string): Promise<ClerkIdentity> {
  const user = await clerk.users.getUser(clerkUserId);
  const email = user.primaryEmailAddress?.emailAddress ?? null;
  const phoneNumber = user.primaryPhoneNumber?.phoneNumber ?? null;

  return {
    clerkUserId,
    firstName: user.firstName,
    lastName: user.lastName,
    email,
    phoneNumber,
    // Google sign-in counts as email (see public.users.login_method).
    loginMethod: email && phoneNumber ? 'both' : phoneNumber ? 'phone' : 'email',
  };
}

/**
 * Flags onboarding step 1 as done on the Clerk user, which is what the app's
 * onboarding gate reads (publicMetadata is backend-writable only). Key must
 * match ProfileCompletedKey in mobile/src/constants/profile.ts.
 */
export async function markProfileCompleted(clerkUserId: string, completedAt: string) {
  await clerk.users.updateUserMetadata(clerkUserId, { publicMetadata: { profileCompletedAt: completedAt } });
}

/**
 * Flags onboarding as finished (step 2 done). Key must match
 * OnboardingCompletedKey in mobile/src/constants/profile.ts.
 */
export async function markOnboardingCompleted(clerkUserId: string, completedAt: string) {
  await clerk.users.updateUserMetadata(clerkUserId, { publicMetadata: { onboardingCompletedAt: completedAt } });
}
