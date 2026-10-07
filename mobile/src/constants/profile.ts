import type { DominantHand } from '@/types/profile';

// Handles are 3–20 lowercase letters, digits, or underscores. Keep in sync
// with the `player-profile` edge function and the users_username_format check.
export const UsernamePattern = /^[a-z0-9_]{3,20}$/;
export const UsernameMaxLength = 20;
// Wait this long after the last keystroke before checking availability.
export const UsernameCheckDebounceMs = 400;

// Lowercases and drops characters a handle can't contain, as the user types.
export function normalizeUsername(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, UsernameMaxLength);
}

export const DominantHands: readonly DominantHand[] = ['left', 'ambi', 'right'];

export const MinBirthYear = 1900;
export const BirthYearLength = 4;
export const BirthDayLength = 2;

// `YYYY-MM-DD` if month/day/year form a real date after MinBirthYear and
// before today, otherwise `null`. The edge function re-checks this.
export function toBirthDate(month: number | null, day: string, year: string): string | null {
  if (month === null || year.length !== BirthYearLength || !day) return null;
  const y = Number(year);
  const d = Number(day);
  const date = new Date(Date.UTC(y, month - 1, d));
  const isRealDate = date.getUTCFullYear() === y && date.getUTCMonth() === month - 1 && date.getUTCDate() === d;
  const iso = date.toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return isRealDate && y >= MinBirthYear && iso < today ? iso : null;
}

// Onboarding is three steps; only step 1 (profile) exists so far.
export const OnboardingStepCount = 3;

/**
 * Clerk metadata keys that gate onboarding. `publicMetadata.profileCompletedAt`
 * is set by the `player-profile` edge function once the profile is saved.
 * "Skip for now" stores the current session id in
 * `unsafeMetadata.onboardingSkippedSessionId`, so a skip only lasts until the
 * next sign-in.
 */
export const ProfileCompletedKey = 'profileCompletedAt';
export const OnboardingSkippedKey = 'onboardingSkippedSessionId';

// Image types the edge function will issue an upload URL for.
export const AvatarContentTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const AvatarQuality = 0.7;
