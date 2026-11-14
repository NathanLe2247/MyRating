import { NearbyCourtSchema } from '@myrating/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { Accuracy, getCurrentPositionAsync } from 'expo-location';
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

/** How long a device position is reused before asking the OS again. */
const PositionStaleMs = 5 * 60 * 1000;

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
 * Asks for foreground location the first time. If location is denied, the
 * user can list courts around `DefaultCourtsArea` instead (and still turn
 * location on from there).
 *
 * With a demo location configured (`EXPO_PUBLIC_DEMO_LAT` / `_LNG`, see
 * src/config/demo-location.ts), that point stands in for the device: no
 * permission prompt, no GPS, and the list is labelled as the user's own.
 */
export function useNearbyCourts(): NearbyCourtsState {
  const supabase = useSupabaseClient();
  const demo = demoLocation();
  const location = useLocationPermission({ autoRequest: !demo });
  const [defaultAreaChosen, setDefaultAreaChosen] = useState(false);

  const positionQuery = useQuery({
    queryKey: ['current-position'],
    enabled: !demo && location.granted,
    staleTime: PositionStaleMs,
    queryFn: async (): Promise<GeoPoint> => {
      const { coords } = await getCurrentPositionAsync({ accuracy: Accuracy.Balanced });
      return { lat: coords.latitude, lng: coords.longitude };
    },
  });

  const useDefaultArea = !demo && !location.granted && location.denied && defaultAreaChosen;
  const origin = demo
    ? demo
    : location.granted
      ? positionQuery.data
      : useDefaultArea
        ? DefaultCourtsArea
        : undefined;

  const courtsQuery = useQuery({
    queryKey: ['nearby-courts', origin?.lat, origin?.lng],
    enabled: origin !== undefined,
    queryFn: () => fetchNearbyCourts(supabase, origin!),
  });

  const access = {
    canAskAgain: location.canAskAgain,
    requestPermission: () => {
      void location.request();
    },
  };

  // A demo location skips the permission and GPS states entirely.
  if (!demo && !location.granted) {
    if (!location.denied) return { status: 'asking' };
    if (!defaultAreaChosen) {
      return { status: 'denied', ...access, showDefaultArea: () => setDefaultAreaChosen(true) };
    }
  }
  if (!demo && location.granted && positionQuery.isError && !positionQuery.data) {
    return { status: 'error', retry: () => void positionQuery.refetch() };
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
