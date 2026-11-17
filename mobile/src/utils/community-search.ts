import type { DiscoverGroup } from '@/types/community';

/**
 * Groups whose name, area, home courts, schedule or tags contain every word
 * of `term` (case-insensitive). A blank term keeps every group.
 */
export function filterDiscoverGroups(groups: DiscoverGroup[], term: string): DiscoverGroup[] {
  const words = term.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return groups;
  return groups.filter((group) => {
    const haystack = [group.name, group.area, group.courts, group.schedule, ...(group.tags ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}
