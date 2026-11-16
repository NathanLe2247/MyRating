import { act, renderHook } from '@testing-library/react-native';

import { DiscoverSearchDebounceMs } from '@/constants/community';
import { DemoCommunityGroups, DemoDiscoverGroups, DemoGroupChats } from '@/constants/demo-data';
import { useCommunityGroups, useDiscoverGroups, useGroupChat } from '@/hooks/use-community';
import { withDemoDataFlag } from '@/test-utils/demo-flag';

describe('demo data off (default)', () => {
  withDemoDataFlag(false);

  describe('useCommunityGroups / useGroupChat', () => {
    it('returns no groups and no chat', () => {
      expect(renderHook(() => useCommunityGroups()).result.current).toEqual([]);
      const someId = DemoCommunityGroups[0].id;
      expect(renderHook(() => useGroupChat(someId)).result.current).toEqual([]);
    });
  });

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

  it('stays off when the var is set to anything but "1"', () => {
    process.env.EXPO_PUBLIC_DEMO_DATA = 'true';
    expect(renderHook(() => useCommunityGroups()).result.current).toEqual([]);
  });
});

describe('demo data on', () => {
  withDemoDataFlag(true);

  it('returns the sample groups, including the invite-only and 50+ groups', () => {
    const groups = renderHook(() => useCommunityGroups()).result.current;

    expect(groups).toBe(DemoCommunityGroups);
    const names = groups.map((group) => group.name);
    expect(names).toEqual(
      expect.arrayContaining(['Kitchen Kings — 4.5+ Invite Only', 'Silver Dinks Open Play (50+)']),
    );
  });

  it('returns each sample group’s chat, with an open challenge', () => {
    for (const group of DemoCommunityGroups) {
      const chat = renderHook(() => useGroupChat(group.id)).result.current;
      expect(chat).toBe(DemoGroupChats[group.id]);
      expect(chat.filter((item) => item.kind === 'text').length).toBeGreaterThanOrEqual(2);
    }
    const challenges = Object.values(DemoGroupChats)
      .flat()
      .filter((item) => item.kind === 'challenge');
    expect(challenges.length).toBeGreaterThan(0);
  });

  it('returns no chat for an unknown or missing group', () => {
    expect(renderHook(() => useGroupChat('nope')).result.current).toEqual([]);
    expect(renderHook(() => useGroupChat(undefined)).result.current).toEqual([]);
  });

  describe('useDiscoverGroups', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('recommends every sample group for a blank query', () => {
      const { result } = renderHook(() => useDiscoverGroups(''));

      expect(result.current).toEqual({ groups: DemoDiscoverGroups, loading: false });
    });

    it('filters the sample groups by the settled query', () => {
      const { result } = renderHook(() => useDiscoverGroups('invite'));
      expect(result.current.loading).toBe(true);

      act(() => jest.advanceTimersByTime(DiscoverSearchDebounceMs));

      expect(result.current.loading).toBe(false);
      expect(result.current.groups.map((group) => group.name)).toEqual(['Kitchen Kings — 4.5+ Invite Only']);
    });

    it('settles to no results for a query nothing matches', () => {
      const { result } = renderHook(() => useDiscoverGroups('zilker'));

      act(() => jest.advanceTimersByTime(DiscoverSearchDebounceMs));

      expect(result.current).toEqual({ groups: [], loading: false });
    });
  });
});
