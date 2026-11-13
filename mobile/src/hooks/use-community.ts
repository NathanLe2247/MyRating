import { useEffect, useState } from 'react';

import { DiscoverSearchDebounceMs } from '@/constants/community';
import type { ChatItem, CommunityGroup, DiscoverGroup, DiscoverResults } from '@/types/community';

const NO_GROUPS: CommunityGroup[] = [];
const NO_MESSAGES: ChatItem[] = [];
const NO_DISCOVER_GROUPS: DiscoverGroup[] = [];

/**
 * Groups the signed-in player has joined.
 *
 * TODO: there's no groups table or endpoint yet, so this always returns an
 * empty list and the Community tab shows its empty state. Once group shapes
 * exist in `shared/` and the backend serves them, query them here. Never
 * return placeholder groups.
 */
export function useCommunityGroups(): CommunityGroup[] {
  return NO_GROUPS;
}

/**
 * Live chat (messages and open challenges) for one group.
 *
 * TODO: wire to a Supabase Realtime channel per
 * `agent/skills/community-realtime` once chat has a backend. Until then it
 * returns no messages.
 */
export function useGroupChat(_groupId: string | undefined): ChatItem[] {
  return NO_MESSAGES;
}

/**
 * Groups to show on Discover & search: recommendations when `query` is blank,
 * matches for it otherwise. The query is debounced, and `loading` is true
 * until the latest query has settled.
 *
 * TODO: there's no discoverable-groups table or search endpoint yet, so every
 * query settles to an empty list and the screen shows its empty or
 * no-results state. Fetch for `settled` here once the backend exists. Never
 * return placeholder groups.
 */
export function useDiscoverGroups(query: string): DiscoverResults {
  const term = query.trim();
  const [settled, setSettled] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSettled(term), DiscoverSearchDebounceMs);
    return () => clearTimeout(timer);
  }, [term]);

  // A blank query needs no search, so it never waits on the debounce.
  const loading = term !== '' && settled !== term;
  return { groups: NO_DISCOVER_GROUPS, loading };
}
