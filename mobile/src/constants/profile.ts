import {
  DOMINANT_HANDS,
  MIN_BIRTH_DATE,
  SUPPORTED_RATING_SOURCES,
  USERNAME_MAX_LENGTH,
  USERNAME_PATTERN,
  type DominantHand,
  type RatingSource,
} from '@myrating/shared';

// Handles are 3–20 lowercase letters, digits, or underscores; shared/ mirrors
// the users_username_format check.
export const UsernamePattern = USERNAME_PATTERN;
export const UsernameMaxLength = USERNAME_MAX_LENGTH;
// Wait this long after the last keystroke before checking availability.
export const UsernameCheckDebounceMs = 400;

// Lowercases and drops characters a handle can't contain, as the user types.
export function normalizeUsername(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, UsernameMaxLength);
}

export const DominantHands: readonly DominantHand[] = DOMINANT_HANDS;

export const MinBirthYear = Number(MIN_BIRTH_DATE.slice(0, 4));
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

// Onboarding is two steps: profile, then rating calibration.
export const OnboardingStepCount = 2;

/**
 * Clerk metadata keys that gate onboarding, both set by the `player-profile`
 * edge function: `publicMetadata.profileCompletedAt` once step 1 is saved and
 * `publicMetadata.onboardingCompletedAt` once step 2 is.
 */
export const ProfileCompletedKey = 'profileCompletedAt';
export const OnboardingCompletedKey = 'onboardingCompletedAt';

// Step 2 options the app can submit; the others render disabled.
export const SupportedRatingSources: readonly RatingSource[] = SUPPORTED_RATING_SOURCES;
export const PlacementGameCount = 3;

// Image types the edge function will issue an upload URL for.
export const AvatarContentTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const AvatarQuality = 0.7;
