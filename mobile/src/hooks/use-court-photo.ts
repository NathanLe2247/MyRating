import { type CourtPhotoResponse, CourtPhotoResponseSchema } from '@myrating/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';

import { useSupabaseClient } from '@/config/supabase';
import { CourtPhotoFunction, CourtPhotoQueryKey, CourtPhotoStaleMs } from '@/constants/courts';
import type { CourtCardData } from '@/types/play';
import { edgeFunctionErrorCode } from '@/utils/edge-function-error';

/**
 * A court's photo from the `court-photo` edge function (contract in
 * shared/src/court-photo.ts). Resolves to null on a 404 `not_found` (no
 * place, no photo, or the free-tier cap is reached) or a 200 that doesn't
 * parse; throws on any other failure. Either way the card shows no photo.
 */
export async function fetchCourtPhoto(
  supabase: SupabaseClient,
  courtId: string,
): Promise<CourtPhotoResponse | null> {
  const { data, error } = await supabase.functions.invoke(
    `${CourtPhotoFunction}?court_id=${encodeURIComponent(courtId)}`,
    { method: 'GET' },
  );
  if (error) {
    if ((await edgeFunctionErrorCode(error)) === 'not_found') return null;
    throw error;
  }
  const parsed = CourtPhotoResponseSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/**
 * The photo for one court card, or undefined while it loads and whenever
 * there's none (no Place ID, any non-200, a bad body). Works signed out: the
 * function takes the anon key. Only courts with a `googlePlaceId` are asked
 * for, and only when `enabled` (the caller limits photos to the nearest
 * `CourtPhotoMaxCards`), so other courts cost no request.
 *
 * Kept in React Query's in-memory cache only (keyed by court id, reused for
 * `CourtPhotoStaleMs`). Never persist it: Google's terms forbid caching
 * photo URLs. No retries: a failure just leaves the card without a photo,
 * and each attempt can spend capped Google calls.
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
    queryFn: () => fetchCourtPhoto(supabase, court.id),
  });
  return data ?? undefined;
}
