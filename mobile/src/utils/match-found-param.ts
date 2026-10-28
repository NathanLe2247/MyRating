import { z } from 'zod';

import { isR2PublicUrl } from '@/config/r2';
import { MatchFormats } from '@/constants/match';
import type { MatchFound } from '@/types/match-found';

// The Match Found route takes the match as a JSON string in its `match` param
// (route params are strings). The route is reachable by deep link, so the
// param is untrusted: required fields must be valid or the screen shows its
// empty state; an invalid optional field is dropped (the screen already has an
// empty state for each one) rather than rejecting the whole match.

/** An optional field: kept when valid, dropped (undefined) when missing or invalid. */
const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

const positiveInt = z.number().int().positive();
const nonNegative = z.number().nonnegative();

const PlayerSchema = z.object({
  name: z.string().trim().min(1),
  rating: z.number().nonnegative().nullable(),
  location: optional(z.string().trim().min(1)),
  // Only photos from the app's own bucket; anything else shows initials.
  avatarUrl: optional(z.string().refine(isR2PublicUrl)),
  winStreak: optional(z.number().int().nonnegative()),
});

const VenueSchema = z.object({
  name: z.string().trim().min(1),
  distanceMiles: nonNegative,
  driveMinutes: optional(nonNegative),
});

const RulesSchema = z.object({
  games: positiveInt,
  pointsTo: positiveInt,
  winBy: positiveInt,
});

const MatchFoundSchema = z.object({
  id: z.string().min(1),
  format: z.enum(MatchFormats),
  official: z.boolean(),
  player: PlayerSchema,
  opponent: PlayerSchema,
  searchRadiusMiles: z.number().positive(),
  elapsedSeconds: nonNegative,
  ratingsVerified: optional(z.boolean()),
  courtReady: optional(z.boolean()),
  autoCheckIn: optional(z.boolean()),
  winProbability: optional(z.number().min(0).max(1)),
  ratingImpact: optional(nonNegative),
  venue: optional(VenueSchema),
  rules: optional(RulesSchema),
});

/** Drops keys whose value is undefined (dropped optional fields). */
function compact<T extends object>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function serializeMatchFound(match: MatchFound): string {
  return JSON.stringify(match);
}

export function parseMatchFound(raw: string | string[] | undefined): MatchFound | null {
  if (typeof raw !== 'string') return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = MatchFoundSchema.safeParse(json);
  if (!parsed.success) return null;
  const match: MatchFound = parsed.data;
  return compact(match);
}
