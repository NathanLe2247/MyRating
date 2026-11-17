import { act, renderHook } from '@testing-library/react-native';

import { DemoHealthConnectMs } from '@/constants/demo-data';
import { useHealthConnection } from '@/hooks/use-health-connection';
import { withDemoDataFlag } from '@/test-utils/demo-flag';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('demo data off (default)', () => {
  withDemoDataFlag(false);

  it('is not connected and connecting does nothing', () => {
    const { result } = renderHook(() => useHealthConnection());

    act(() => result.current.connect('apple_health'));
    expect(result.current.connecting).toBeNull();
    act(() => jest.advanceTimersByTime(DemoHealthConnectMs));

    expect(result.current.summary).toBeNull();
    expect(result.current.sample).toBe(false);
    expect(result.current.disconnect).toBeUndefined();
  });
});

describe('demo data on', () => {
  withDemoDataFlag(true);

  it('simulates an Apple Health connection, then disconnects', () => {
    const { result } = renderHook(() => useHealthConnection());

    act(() => result.current.connect('apple_health'));
    expect(result.current.connecting).toBe('apple_health');
    expect(result.current.summary).toBeNull();

    act(() => jest.advanceTimersByTime(DemoHealthConnectMs));
    expect(result.current.connecting).toBeNull();
    expect(result.current.summary?.provider).toBe('apple_health');
    expect(result.current.summary?.readiness).not.toBeNull();
    expect(result.current.summary?.courtLoad?.days).toHaveLength(7);
    expect(result.current.sample).toBe(true);

    act(() => result.current.disconnect?.());
    expect(result.current.summary).toBeNull();
    expect(result.current.sample).toBe(false);
    expect(result.current.disconnect).toBeUndefined();
  });

  it('dates the sample court load so the last day is today', () => {
    jest.setSystemTime(new Date('2026-11-16T15:00:00Z'));
    const { result } = renderHook(() => useHealthConnection());

    act(() => result.current.connect('apple_health'));
    act(() => jest.advanceTimersByTime(DemoHealthConnectMs));

    const days = result.current.summary?.courtLoad?.days ?? [];
    expect(days[0].date).toBe('2026-11-10');
    expect(days[6].date).toBe('2026-11-16');
  });

  it('leaves WHOOP unconnected', () => {
    const { result } = renderHook(() => useHealthConnection());

    act(() => result.current.connect('whoop'));
    act(() => jest.advanceTimersByTime(DemoHealthConnectMs));

    expect(result.current.connecting).toBeNull();
    expect(result.current.summary).toBeNull();
  });
});
