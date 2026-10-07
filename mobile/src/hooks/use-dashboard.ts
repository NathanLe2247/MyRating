import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';

import { useSupabaseClient } from '@/config/supabase';
import { DashboardPlaceholderData } from '@/constants/dashboard-placeholder';
import type { MatchFormat } from '@/constants/match';
import type { Dashboard } from '@/types/dashboard';

/**
 * Home dashboard data. The player's rating comes from Supabase
 * (`users` → `player_ratings`, own row via RLS); everything else is still
 * `DashboardPlaceholderData` until its table exists.
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
  // the dashboard: it renders with the rating as unrated and `error` set.
  const placeholder = DashboardPlaceholderData;
  const data: Dashboard | undefined = ratingQuery.isPending
    ? undefined
    : { ...placeholder, rating: { ...placeholder.rating, rating: ratingQuery.data ?? null } };

  return {
    data,
    isLoading: ratingQuery.isLoading,
    error: ratingQuery.error,
    refetch: ratingQuery.refetch,
  };
}
