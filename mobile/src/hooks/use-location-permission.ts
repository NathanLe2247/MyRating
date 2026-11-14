import { PermissionStatus, useForegroundPermissions } from 'expo-location';
import { useEffect } from 'react';
import { Linking } from 'react-native';

/**
 * Foreground location permission for finding nearby courts and players. Asks
 * automatically the first time (status still undetermined) unless
 * `autoRequest` is false; after a denial,
 * `request` re-prompts if the OS allows it, otherwise opens the app's settings.
 */
export function useLocationPermission({ autoRequest = true }: { autoRequest?: boolean } = {}) {
  const [permission, requestPermission] = useForegroundPermissions();

  useEffect(() => {
    if (
      autoRequest &&
      permission?.status === PermissionStatus.UNDETERMINED &&
      permission.canAskAgain
    ) {
      requestPermission();
    }
  }, [autoRequest, permission, requestPermission]);

  const canAskAgain = permission?.canAskAgain ?? true;
  const request = () => (canAskAgain ? requestPermission() : Linking.openSettings());

  return {
    granted: permission?.status === PermissionStatus.GRANTED,
    /** Answered and not granted — show a prompt. False while still loading or asking. */
    denied: permission?.status === PermissionStatus.DENIED,
    canAskAgain,
    request,
  };
}
