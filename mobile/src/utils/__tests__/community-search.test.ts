import type { DiscoverGroup } from '@/types/community';
import { filterDiscoverGroups } from '@/utils/community-search';

const groups: DiscoverGroup[] = [
  {
    id: 'a',
    name: 'Morning Crew',
    memberCount: 10,
    onlineCount: 0,
    area: 'Testville',
    courts: 'Riverside Courts',
    schedule: 'Daily 7 AM',
    tags: ['Friendly'],
  },
  { id: 'b', name: 'Night Owls', memberCount: 5, onlineCount: 1, tags: ['Competitive', 'Invite only'] },
];

describe('filterDiscoverGroups', () => {
  it('keeps every group for a blank term', () => {
    expect(filterDiscoverGroups(groups, '  ')).toBe(groups);
  });

  it('matches name, area, courts, schedule and tags case-insensitively', () => {
    const ids = (term: string) => filterDiscoverGroups(groups, term).map((group) => group.id);
    expect(ids('morning')).toEqual(['a']);
    expect(ids('TESTVILLE')).toEqual(['a']);
    expect(ids('riverside')).toEqual(['a']);
    expect(ids('7 am')).toEqual(['a']);
    expect(ids('invite')).toEqual(['b']);
  });

  it('requires every word to match', () => {
    expect(filterDiscoverGroups(groups, 'night friendly')).toEqual([]);
    expect(filterDiscoverGroups(groups, 'night competitive').map((group) => group.id)).toEqual(['b']);
  });
});
