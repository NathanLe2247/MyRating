import { useAuth } from '@clerk/expo';
import { PlayerRatingSchema, PlayerRatingSummarySchema } from '@myrating/shared';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { useSupabaseClient } from '@/config/supabase';
import type { MatchFormat } from '@/constants/match';
import type { Dashboard } from '@/types/dashboard';

// `users` → `player_ratings(rating)`: the row is null when the user has no
// `users` row yet, the embed is null until the player has a rating. It's a
// one-to-one embed, so PostgREST returns an object, but the untyped client
// can't tell, so accept a one-element array too.
const RatingEmbedSchema = PlayerRatingSchema.pick({ rating: true });
const RatingEmbedRowSchema = z
  .object({ player_ratings: z.union([RatingEmbedSchema, z.array(RatingEmbedSchema).max(1)]).nullable() })
  .nullable();

/**
 * Home dashboard data. The player's rating comes from Supabase
 * (`users` → `player_ratings`, own row via RLS) and is null until their
 * placement matches are rated. Recent matches stay empty until the matches
 * table exists.
 */
export function useDashboard(_format: MatchFormat) {
  const supabase = useSupabaseClient();
  const { userId } = useAuth();

  const ratingQuery = useQuery({
    queryKey: ['player-rating', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('player_ratings(rating)')
        .eq('clerk_user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      // A malformed row throws, so it surfaces as a load error (rating
      // undefined), never as calibrating.
      const row = RatingEmbedRowSchema.parse(data);
      const embed = Array.isArray(row?.player_ratings) ? row.player_ratings[0] : row?.player_ratings;
      return PlayerRatingSummarySchema.parse({ rating: embed?.rating ?? null }).rating;
    },
  });

  // Only the rating is fetched, so a failed fetch shouldn't hide the rest of
  // the dashboard. It renders with `error` set and the rating left undefined
  // (unknown), not null, which would mean calibrating. A failed refetch keeps
  // the last rating.
  // TODO: load recent matches once the matches table exists.
  const data: Dashboard | undefined = ratingQuery.isPending
    ? undefined
    : { rating: ratingQuery.data, recentMatches: [] };

  return {
    data,
    isLoading: ratingQuery.isLoading,
    error: ratingQuery.error,
    refetch: ratingQuery.refetch,
  };
}
