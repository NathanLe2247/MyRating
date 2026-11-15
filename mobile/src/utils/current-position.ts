import { Accuracy, getCurrentPositionAsync } from 'expo-location';

import { type GeoPoint, PositionStaleMs } from '@/constants/courts';

/**
 * React Query options for the device's position, shared by the nearby courts
 * list and joining the match queue so both reuse one GPS read for
 * `PositionStaleMs`. Needs foreground location permission; rejects without it.
 */
export const currentPositionQuery = {
  queryKey: ['current-position'] as const,
  staleTime: PositionStaleMs,
  queryFn: async (): Promise<GeoPoint> => {
    const { coords } = await getCurrentPositionAsync({ accuracy: Accuracy.Balanced });
    return { lat: coords.latitude, lng: coords.longitude };
  },
};
