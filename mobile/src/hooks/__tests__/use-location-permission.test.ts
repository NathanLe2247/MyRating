import { renderHook } from '@testing-library/react-native';
import { useForegroundPermissions } from 'expo-location';

import { demoLocation } from '@/config/demo-location';
import { useLocationPermission } from '@/hooks/use-location-permission';

jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  useForegroundPermissions: jest.fn(),
}));
jest.mock('@/config/demo-location', () => ({
  demoLocation: jest.fn(),
}));

const mockUsePermissions = useForegroundPermissions as jest.Mock;
const mockDemoLocation = demoLocation as jest.Mock;
const requestPermission = jest.fn();

function setPermission(status: 'granted' | 'denied' | 'undetermined') {
  mockUsePermissions.mockReturnValue([{ status, canAskAgain: true }, requestPermission]);
}

// Home and the courts list both use this hook, so it decides whether the OS
// prompt appears.
describe('useLocationPermission', () => {
  afterEach(() => jest.clearAllMocks());

  it('prompts once while undetermined', () => {
    mockDemoLocation.mockReturnValue(undefined);
    setPermission('undetermined');
    renderHook(() => useLocationPermission());

    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('reports a denial', () => {
    mockDemoLocation.mockReturnValue(undefined);
    setPermission('denied');

    expect(renderHook(() => useLocationPermission()).result.current.denied).toBe(true);
  });

  it('never prompts or reports a denial while a demo location is set', () => {
    mockDemoLocation.mockReturnValue({ lat: 40, lng: -75 });
    setPermission('undetermined');
    renderHook(() => useLocationPermission());
    expect(requestPermission).not.toHaveBeenCalled();

    setPermission('denied');
    expect(renderHook(() => useLocationPermission()).result.current.denied).toBe(false);
  });
});
