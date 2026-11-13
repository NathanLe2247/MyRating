import { act, renderHook } from '@testing-library/react-native';

import { DiscoverSearchDebounceMs } from '@/constants/community';
import { useDiscoverGroups } from '@/hooks/use-community';

describe('useDiscoverGroups', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('is not loading for a blank query', () => {
    const { result } = renderHook(() => useDiscoverGroups('   '));

    expect(result.current).toEqual({ groups: [], loading: false });
  });

  it('loads until the debounced query settles, then has no results without a backend', () => {
    const { result, rerender } = renderHook(({ query }: { query: string }) => useDiscoverGroups(query), {
      initialProps: { query: 'zil' },
    });
    expect(result.current.loading).toBe(true);

    act(() => jest.advanceTimersByTime(DiscoverSearchDebounceMs - 1));
    rerender({ query: 'zilker' });
    expect(result.current.loading).toBe(true);

    act(() => jest.advanceTimersByTime(DiscoverSearchDebounceMs));
    expect(result.current).toEqual({ groups: [], loading: false });
  });
});
