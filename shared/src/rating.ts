import { z } from 'zod';

import { TimestampSchema, UuidSchema } from './common.ts';

// Mirrors public.rating_source (20261007120000_rating_calibration.sql).
export const RATING_SOURCES = ['calibration', 'dupr', 'usa_pickleball'] as const;
export const RatingSourceSchema = z.enum(RATING_SOURCES);
export type RatingSource = z.infer<typeof RatingSourceSchema>;

/**
 * Subset of `rating_source` the app can submit today. DUPR and USA Pickleball
 * imports aren't implemented yet.
 */
export const SUPPORTED_RATING_SOURCES = ['calibration'] as const satisfies readonly RatingSource[];
export const SupportedRatingSourceSchema = z.enum(SUPPORTED_RATING_SOURCES);
export type SupportedRatingSource = z.infer<typeof SupportedRatingSourceSchema>;

/**
 * The `public.player_ratings` columns clients are granted. `mmr` and
 * `volatility` are service-role only and deliberately absent. The numeric
 * columns arrive as JSON numbers from PostgREST.
 */
export const PlayerRatingSchema = z.object({
  user_id: UuidSchema,
  rating: z.number(),
  rating_deviation: z.number(),
  updated_at: TimestampSchema,
});
export type PlayerRating = z.infer<typeof PlayerRatingSchema>;

/**
 * What Home shows: the player's own `player_ratings.rating`, read through
 * `users → player_ratings` (`select('player_ratings(rating)')`). `rating` is
 * null until the player has a ratings row: calibration players get one only
 * after their placement matches, and until then the embed comes back null.
 */
export const PlayerRatingSummarySchema = z.object({
  rating: PlayerRatingSchema.shape.rating.nullable(),
});
export type PlayerRatingSummary = z.infer<typeof PlayerRatingSummarySchema>;
