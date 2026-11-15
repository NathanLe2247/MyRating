import { NearbyCourtSchema } from '@myrating/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { demoLocation } from '@/config/demo-location';
import { useSupabaseClient } from '@/config/supabase';
import {
  DefaultCourtsArea,
  type GeoPoint,
  NearbyCourtsMaxResults,
  NearbyCourtsRadiusMeters,
} from '@/constants/courts';
import { useLocationPermission } from '@/hooks/use-location-permission';
import type { CourtCardData, NearbyCourtsState } from '@/types/play';
import { toCourtCardData } from '@/utils/courts-format';
import { currentPositionQuery } from '@/utils/current-position';

/**
 * Active courts near `origin`, nearest first, as card display models. Calls
 * the `nearby_courts` RPC per agent/skills/courts-catalog; it works with the
 * anon key, so this needs no Clerk session.
 */
export async function fetchNearbyCourts(
  supabase: SupabaseClient,
  origin: GeoPoint,
): Promise<CourtCardData[]> {
  const { data, error } = await supabase.rpc('nearby_courts', {
    lat: origin.lat,
    lng: origin.lng,
    radius_m: NearbyCourtsRadiusMeters,
    max_results: NearbyCourtsMaxResults,
  });
  if (error) throw error;
  return NearbyCourtSchema.array().parse(data).map(toCourtCardData);
}

/**
 * Courts near the device, for the public courts screen and the Play tab.
 * Asks for foreground location the first time. While it waits for an answer,
 * after a denial, or when the device position can't be read, the user can
 * list courts around `DefaultCourtsArea` instead (and still switch back to
 * their own location from there).
 *
 * With a demo location configured (`EXPO_PUBLIC_DEMO_LAT` / `_LNG`, see
 * src/config/demo-location.ts), that point stands in for the device: no
 * permission prompt, no GPS, and the list is labelled as the user's own.
 */
export function useNearbyCourts(): NearbyCourtsState {
  const supabase = useSupabaseClient();
  const demo = demoLocation();
  const location = useLocationPermission();
  const [defaultAreaChosen, setDefaultAreaChosen] = useState(false);

  const positionQuery = useQuery({
    ...currentPositionQuery,
    enabled: !demo && location.granted,
  });

  // Location granted but the device couldn't report a position.
  const positionFailed = location.granted && positionQuery.isError && !positionQuery.data;
  const useDefaultArea = !demo && defaultAreaChosen && (!location.granted || positionFailed);
  const origin = demo
    ? demo
    : useDefaultArea
      ? DefaultCourtsArea
      : location.granted
        ? positionQuery.data
        : undefined;

  const courtsQuery = useQuery({
    queryKey: ['nearby-courts', origin?.lat, origin?.lng],
    enabled: origin !== undefined,
    queryFn: () => fetchNearbyCourts(supabase, origin!),
  });

  const showDefaultArea = () => setDefaultAreaChosen(true);
  const retryPosition = () => {
    setDefaultAreaChosen(false);
    void positionQuery.refetch();
  };
  // How to get back from the default area to the user's own location.
  const access = positionFailed
    ? { canAskAgain: true, requestPermission: retryPosition }
    : {
        canAskAgain: location.canAskAgain,
        requestPermission: () => {
          void location.request();
        },
      };

  // A demo location skips the permission and GPS states entirely.
  if (!demo && !useDefaultArea) {
    if (!location.granted) {
      // Undetermined can last forever (a dismissed web prompt, or an OS that
      // won't ask), so the default area is offered while waiting too.
      if (!location.denied) return { status: 'asking', showDefaultArea };
      return { status: 'denied', ...access, showDefaultArea };
    }
    if (positionFailed) return { status: 'error', retry: retryPosition, showDefaultArea };
  }

  // A failed refetch keeps the last list on screen.
  if (courtsQuery.data) {
    return {
      status: 'loaded',
      courts: courtsQuery.data,
      defaultArea: useDefaultArea ? access : undefined,
    };
  }
  if (courtsQuery.isError) return { status: 'error', retry: () => void courtsQuery.refetch() };
  return { status: 'loading' };
}
