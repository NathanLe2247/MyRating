import { useEffect, useState } from 'react';

import { DiscoverSearchDebounceMs } from '@/constants/community';
import { DemoCommunityGroups, DemoDiscoverGroups, DemoGroupChats } from '@/constants/demo-data';
import { DevPreviews } from '@/constants/dev-previews';
import type { ChatItem, CommunityGroup, DiscoverGroup, DiscoverResults } from '@/types/community';
import { filterDiscoverGroups } from '@/utils/community-search';

const NO_GROUPS: CommunityGroup[] = [];
const NO_MESSAGES: ChatItem[] = [];
const NO_DISCOVER_GROUPS: DiscoverGroup[] = [];

/**
 * Groups the signed-in player has joined.
 *
 * TODO: there's no groups table or endpoint yet, so this returns an empty
 * list and the Community tab shows its empty state. Once group shapes exist
 * in `shared/` and the backend serves them, query them here. Never return
 * placeholder groups for real data: the only exception is the dev-only
 * sample set (`src/constants/demo-data.ts`), returned behind
 * `DevPreviews.demoData()`, which is always off in production builds.
 */
export function useCommunityGroups(): CommunityGroup[] {
  return DevPreviews.demoData() ? DemoCommunityGroups : NO_GROUPS;
}

/**
 * Live chat (messages and open challenges) for one group.
 *
 * TODO: wire to a Supabase Realtime channel per
 * `agent/skills/community-realtime` once chat has a backend. Until then it
 * returns no messages (dev-only sample chat behind `DevPreviews.demoData()`).
 */
export function useGroupChat(groupId: string | undefined): ChatItem[] {
  if (!DevPreviews.demoData() || !groupId) return NO_MESSAGES;
  return DemoGroupChats[groupId] ?? NO_MESSAGES;
}

/**
 * Groups to show on Discover & search: recommendations when `query` is blank,
 * matches for it otherwise. The query is debounced, and `loading` is true
 * until the latest query has settled.
 *
 * TODO: there's no discoverable-groups table or search endpoint yet, so every
 * query settles to an empty list and the screen shows its empty or
 * no-results state. Fetch for `settled` here once the backend exists. Never
 * return placeholder groups for real data; the dev-only sample set behind
 * `DevPreviews.demoData()` is filtered locally instead.
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
  const groups = DevPreviews.demoData()
    ? filterDiscoverGroups(DemoDiscoverGroups, term === '' ? '' : settled)
    : NO_DISCOVER_GROUPS;
  return { groups, loading };
}
