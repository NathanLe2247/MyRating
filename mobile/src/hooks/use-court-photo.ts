import { type CourtPhotoResponse, CourtPhotoResponseSchema } from '@myrating/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import { useSupabaseClient } from '@/config/supabase';
import { CourtPhotoFunction, CourtPhotoQueryKey, CourtPhotoStaleMs } from '@/constants/courts';
import type { CourtCardData } from '@/types/play';

/**
 * A court's photo from the `court-photo` edge function (contract in
 * shared/src/court-photo.ts), or null for anything else: any non-200 (404
 * `not_found`, 503 `unavailable`, 502 `upstream_error`, 500), a network
 * failure, or a 200 that doesn't parse. It never throws, so a failure is
 * cached for `CourtPhotoStaleMs` like a 404 instead of being retried on
 * every remount: a 502 after Place Details succeeded has already spent a
 * capped Google call.
 */
export async function fetchCourtPhoto(
  supabase: SupabaseClient,
  courtId: string,
): Promise<CourtPhotoResponse | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      `${CourtPhotoFunction}?court_id=${encodeURIComponent(courtId)}`,
      { method: 'GET' },
    );
    if (error) return null;
    const parsed = CourtPhotoResponseSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * The photo for one court card, or undefined while it loads and whenever
 * there's none (no Place ID, any failure). Works signed out: the function
 * takes the anon key. Only courts with a `googlePlaceId` are asked for, and
 * only when `enabled` (the caller limits photos to the nearest
 * `CourtPhotoMaxCards`), so other courts cost no request.
 *
 * Kept in React Query's in-memory cache only (keyed by court id, reused for
 * `CourtPhotoStaleMs`). Never persist it: Google's terms forbid caching
 * photo URLs. Each fetch can spend capped Google calls, so there are no
 * retries and no refetch on remount or reconnect: a result (photo or none)
 * is asked for again only once it's stale (on app focus), or after React
 * Query has dropped it from memory.
 */
export function useCourtPhoto(
  court: CourtCardData,
  enabled = true,
): CourtPhotoResponse | undefined {
  const supabase = useSupabaseClient();
  const { data } = useQuery({
    queryKey: [CourtPhotoQueryKey, court.id],
    enabled: enabled && !!court.googlePlaceId,
    staleTime: CourtPhotoStaleMs,
    retry: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    queryFn: () => fetchCourtPhoto(supabase, court.id),
  });
  return data ?? undefined;
}
