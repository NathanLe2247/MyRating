import type { ChatItem, CommunityGroup } from '@/types/community';

const NO_GROUPS: CommunityGroup[] = [];
const NO_MESSAGES: ChatItem[] = [];

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
