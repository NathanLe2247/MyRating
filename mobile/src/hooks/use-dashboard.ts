import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';

import { useSupabaseClient } from '@/config/supabase';
import type { MatchFormat } from '@/constants/match';
import type { Dashboard } from '@/types/dashboard';

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
      // One-to-one embed: PostgREST returns an object (or null), but the
      // untyped client can't tell, so handle the array shape too.
      const embed = data?.player_ratings as { rating: number } | { rating: number }[] | null | undefined;
      const row = Array.isArray(embed) ? embed[0] : embed;
      // `numeric` columns come back as strings.
      return row ? Number(row.rating) : null;
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
