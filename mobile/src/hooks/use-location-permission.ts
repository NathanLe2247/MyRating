import { PermissionStatus, useForegroundPermissions } from 'expo-location';
import { useEffect } from 'react';
import { Linking } from 'react-native';

import { demoLocation } from '@/config/demo-location';

/**
 * Foreground location permission for finding nearby courts and players. Asks
 * automatically the first time (status still undetermined); after a denial,
 * `request` re-prompts if the OS allows it, otherwise opens the app's settings.
 *
 * With a demo location configured (`EXPO_PUBLIC_DEMO_LAT` / `_LNG`, see
 * src/config/demo-location.ts) it never prompts and never reports a denial,
 * since the demo point stands in for the device's location.
 */
export function useLocationPermission() {
  const [permission, requestPermission] = useForegroundPermissions();
  const demo = demoLocation() !== undefined;

  useEffect(() => {
    if (
      !demo &&
      permission?.status === PermissionStatus.UNDETERMINED &&
      permission.canAskAgain
    ) {
      requestPermission();
    }
  }, [demo, permission, requestPermission]);

  const canAskAgain = permission?.canAskAgain ?? true;
  const request = () => (canAskAgain ? requestPermission() : Linking.openSettings());

  return {
    granted: permission?.status === PermissionStatus.GRANTED,
    /** Answered and not granted — show a prompt. False while still loading or asking, or in a demo. */
    denied: !demo && permission?.status === PermissionStatus.DENIED,
    canAskAgain,
    request,
  };
}
