import { Platform, type PlatformOSType } from 'react-native';

import type { GeoPoint } from '@/constants/courts';
import { AppleMapsBaseUrl, GoogleMapsApiVersion, GoogleMapsSearchUrl } from '@/constants/maps';

/**
 * Link that opens the platform's maps app at `point`, labelled `name`:
 * Apple Maps on iOS, Google Maps everywhere else (Android, web).
 *
 * Google's search URL takes a single `query`, which is either a place name
 * or coordinates. Coordinates are used so the pin lands on the court rather
 * than on whatever Google matches the name to; Google then labels the pin
 * with what it finds there, so `name` only shows on Apple Maps.
 */
export function courtDirectionsUrl(
  point: GeoPoint,
  name: string,
  os: PlatformOSType = Platform.OS,
): string {
  const coords = `${point.lat},${point.lng}`;
  if (os === 'ios') {
    return `${AppleMapsBaseUrl}?ll=${coords}&q=${encodeURIComponent(name)}`;
  }
  return `${GoogleMapsSearchUrl}?api=${GoogleMapsApiVersion}&query=${coords}`;
}
