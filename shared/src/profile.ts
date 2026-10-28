import { z } from 'zod';

import { DateSchema, TimestampSchema, UuidSchema } from './common.ts';

// Mirrors public.login_method (20260924223014_users_and_ratings.sql).
export const LOGIN_METHODS = ['phone', 'email', 'both'] as const;
export const LoginMethodSchema = z.enum(LOGIN_METHODS);
export type LoginMethod = z.infer<typeof LoginMethodSchema>;

// Mirrors public.dominant_hand (20261006120000_player_profile.sql).
export const DOMINANT_HANDS = ['left', 'ambi', 'right'] as const;
export const DominantHandSchema = z.enum(DOMINANT_HANDS);
export type DominantHand = z.infer<typeof DominantHandSchema>;

// Mirrors the users_username_format check: 3–20 lowercase letters, digits, or
// underscores.
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const USERNAME_PATTERN = new RegExp(`^[a-z0-9_]{${USERNAME_MIN_LENGTH},${USERNAME_MAX_LENGTH}}$`);
export const UsernameSchema = z.string().regex(USERNAME_PATTERN);

// Mirrors the users_date_of_birth_range check.
export const MIN_BIRTH_DATE = '1900-01-01';

/**
 * The `public.users` columns written by onboarding step 1 ("Create your
 * profile"): the player-entered fields plus the Clerk identifiers copied over
 * at the same time. Names and nullability match the migrations; every
 * player-entered column is nullable because the row exists (from the Clerk
 * webhook) before step 1 is done. `profile_completed_at` null = step 1 not
 * finished yet.
 */
export const PlayerProfileSchema = z.object({
  id: UuidSchema,
  clerk_user_id: z.string(),
  username: UsernameSchema.nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string().nullable(),
  phone_number: z.string().nullable(),
  login_method: LoginMethodSchema,
  date_of_birth: DateSchema.refine((d) => d >= MIN_BIRTH_DATE).nullable(),
  dominant_hand: DominantHandSchema.nullable(),
  /** R2 object key under `avatars/<clerk_user_id>/`. */
  avatar_key: z.string().nullable(),
  profile_completed_at: TimestampSchema.nullable(),
});
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;
