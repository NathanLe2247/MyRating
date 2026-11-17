import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { getCurrentPositionAsync, useForegroundPermissions } from 'expo-location';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';

import { demoLocation } from '@/config/demo-location';
import { useSupabaseClient } from '@/config/supabase';
import {
  DefaultCourtsArea,
  NearbyCourtsMaxResults,
  NearbyCourtsRadiusMeters,
} from '@/constants/courts';
import { useNearbyCourts } from '@/hooks/use-nearby-courts';
import type { NearbyCourtsState } from '@/types/play';

jest.mock('expo-location', () => ({
  PermissionStatus: { GRANTED: 'granted', DENIED: 'denied', UNDETERMINED: 'undetermined' },
  Accuracy: { Balanced: 3 },
  useForegroundPermissions: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('@/config/supabase', () => ({
  useSupabaseClient: jest.fn(),
}));
jest.mock('@/config/demo-location', () => ({
  demoLocation: jest.fn(),
}));

const mockUsePermissions = useForegroundPermissions as jest.Mock;
const mockGetPosition = getCurrentPositionAsync as jest.Mock;
const mockUseSupabaseClient = useSupabaseClient as jest.Mock;
const mockDemoLocation = demoLocation as jest.Mock;
const requestPermission = jest.fn();
const rpc = jest.fn();

const here = { lat: 40.01, lng: -75.01 };
/** Where the fixture courts sit (`location` below, as [lng, lat]). */
const courtPoint = { lat: 40, lng: -75 };

const row = (id: string, name: string, distance_m: number) => ({
  id,
  name,
  location: { type: 'Point', coordinates: [-75, 40] },
  is_active: true,
  created_at: '2026-11-13T12:00:00Z',
  google_place_id: null,
  distance_m,
});
const near = row('11111111-1111-4111-8111-111111111111', 'Near Courts', 805);
const far = row('22222222-2222-4222-8222-222222222222', 'Far Courts', 12_000);

function setPermission(status: 'granted' | 'denied' | 'undetermined' | null, canAskAgain = true) {
  mockUsePermissions.mockReturnValue([status ? { status, canAskAgain } : null, requestPermission]);
}

function wrapper({ children }: { children: ReactNode }) {
  // gcTime: Infinity stops React Query from scheduling its 5-minute garbage-collection
  // timer for unobserved queries; that timer kept the Jest worker alive (#98).
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const render = () => renderHook(() => useNearbyCourts(), { wrapper });

async function settle(result: { current: NearbyCourtsState }) {
  await waitFor(() => expect(result.current.status).not.toBe('loading'));
}

describe('useNearbyCourts', () => {
  beforeEach(() => {
    mockUseSupabaseClient.mockReturnValue({ rpc });
    mockGetPosition.mockResolvedValue({ coords: { latitude: here.lat, longitude: here.lng } });
    rpc.mockResolvedValue({ data: [near, far], error: null });
    mockDemoLocation.mockReturnValue(undefined);
  });
  afterEach(() => jest.clearAllMocks());

  it('is asking while the permission is loading or undetermined, and prompts once', () => {
    setPermission(null);
    const { result, rerender } = render();
    expect(result.current.status).toBe('asking');

    setPermission('undetermined');
    rerender({});
    expect(result.current.status).toBe('asking');
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('calls nearby_courts at the device position and maps rows to cards, nearest first', async () => {
    setPermission('granted');
    const { result } = render();

    expect(result.current.status).toBe('loading');
    await settle(result);

    expect(rpc).toHaveBeenCalledWith('nearby_courts', {
      lat: here.lat,
      lng: here.lng,
      radius_m: NearbyCourtsRadiusMeters,
      max_results: NearbyCourtsMaxResults,
    });
    expect(result.current).toEqual({
      status: 'loaded',
      courts: [
        { id: near.id, name: 'Near Courts', distanceMiles: '0.5', location: courtPoint, tags: [] },
        { id: far.id, name: 'Far Courts', distanceMiles: '7.5', location: courtPoint, tags: [] },
      ],
      defaultArea: undefined,
    });
  });

  it('is loaded with no courts when none are within the radius', async () => {
    setPermission('granted');
    rpc.mockResolvedValue({ data: [], error: null });
    const { result } = render();
    await settle(result);

    expect(result.current).toMatchObject({ status: 'loaded', courts: [] });
  });

  it('is an error when the RPC fails, and retry refetches', async () => {
    setPermission('granted');
    rpc.mockResolvedValue({ data: null, error: new Error('network down') });
    const { result } = render();
    await settle(result);

    expect(result.current.status).toBe('error');
    rpc.mockResolvedValue({ data: [near], error: null });
    await act(async () => {
      if (result.current.status === 'error') result.current.retry();
    });
    await waitFor(() => expect(result.current.status).toBe('loaded'));
  });

  it('is an error when a row does not match NearbyCourtSchema', async () => {
    setPermission('granted');
    rpc.mockResolvedValue({ data: [{ ...near, distance_m: 'far' }], error: null });
    const { result } = render();
    await settle(result);

    expect(result.current.status).toBe('error');
  });

  it('is an error when the device position cannot be read', async () => {
    setPermission('granted');
    mockGetPosition.mockRejectedValue(new Error('location unavailable'));
    const { result } = render();
    await settle(result);

    expect(result.current.status).toBe('error');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('offers the default area after a position error, and can go back to GPS', async () => {
    setPermission('granted');
    mockGetPosition.mockRejectedValue(new Error('location unavailable'));
    const { result } = render();
    await settle(result);

    const state = result.current;
    if (state.status !== 'error' || !state.showDefaultArea) throw new Error('no default area offered');
    act(() => state.showDefaultArea!());
    await waitFor(() => expect(result.current.status).toBe('loaded'));

    expect(rpc).toHaveBeenCalledWith(
      'nearby_courts',
      expect.objectContaining({ lat: DefaultCourtsArea.lat, lng: DefaultCourtsArea.lng }),
    );
    expect(result.current).toMatchObject({ status: 'loaded', defaultArea: { canAskAgain: true } });

    // "Use my location" reads the position again instead of prompting.
    mockGetPosition.mockResolvedValue({ coords: { latitude: here.lat, longitude: here.lng } });
    await act(async () => {
      if (result.current.status === 'loaded') result.current.defaultArea?.requestPermission();
    });
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith(
        'nearby_courts',
        expect.objectContaining({ lat: here.lat, lng: here.lng }),
      ),
    );
    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'loaded', defaultArea: undefined }),
    );
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('offers the default area while the permission stays unanswered', async () => {
    // An OS that won't show the dialog (or a dismissed web prompt) leaves it
    // undetermined for good.
    setPermission('undetermined', false);
    const { result } = render();

    expect(result.current.status).toBe('asking');
    expect(requestPermission).not.toHaveBeenCalled();
    act(() => {
      if (result.current.status === 'asking') result.current.showDefaultArea();
    });
    await settle(result);

    expect(rpc).toHaveBeenCalledWith(
      'nearby_courts',
      expect.objectContaining({ lat: DefaultCourtsArea.lat, lng: DefaultCourtsArea.lng }),
    );
    expect(result.current).toMatchObject({ status: 'loaded', defaultArea: { canAskAgain: false } });
  });

  it('explains a denial without fetching, then lists the default area on request', async () => {
    setPermission('denied');
    const { result } = render();

    expect(result.current).toMatchObject({ status: 'denied', canAskAgain: true });
    expect(rpc).not.toHaveBeenCalled();
    expect(mockGetPosition).not.toHaveBeenCalled();

    act(() => {
      if (result.current.status === 'denied') result.current.showDefaultArea();
    });
    await settle(result);

    expect(rpc).toHaveBeenCalledWith(
      'nearby_courts',
      expect.objectContaining({ lat: DefaultCourtsArea.lat, lng: DefaultCourtsArea.lng }),
    );
    expect(result.current).toMatchObject({
      status: 'loaded',
      defaultArea: { canAskAgain: true },
    });
    expect(result.current.status === 'loaded' && result.current.courts).toHaveLength(2);
  });

  it('re-prompts after a denial when the OS allows it, else opens Settings', () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();

    setPermission('denied', true);
    const { result, rerender } = render();
    act(() => {
      if (result.current.status === 'denied') result.current.requestPermission();
    });
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(openSettings).not.toHaveBeenCalled();

    setPermission('denied', false);
    rerender({});
    expect(result.current).toMatchObject({ status: 'denied', canAskAgain: false });
    act(() => {
      if (result.current.status === 'denied') result.current.requestPermission();
    });
    expect(openSettings).toHaveBeenCalledTimes(1);
  });

  it('uses a configured demo location without asking for permission or reading GPS', async () => {
    const demo = { lat: 40, lng: -75 }; // distinct from DefaultCourtsArea
    mockDemoLocation.mockReturnValue(demo);
    setPermission('undetermined');
    const { result } = render();
    await settle(result);

    expect(requestPermission).not.toHaveBeenCalled();
    expect(mockGetPosition).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      'nearby_courts',
      expect.objectContaining({ lat: demo.lat, lng: demo.lng }),
    );
    // Labelled as the user's own location, not the default area.
    expect(result.current).toMatchObject({ status: 'loaded', defaultArea: undefined });
  });
});
