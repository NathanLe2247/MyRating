import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { CommunityView } from '@/components/community/community-view';
import { DiscoverView } from '@/components/community/discover-view';
import { DiscoverSearchDebounceMs } from '@/constants/community';
import { useCommunityGroups, useDiscoverGroups, useGroupChat } from '@/hooks/use-community';
import { en } from '@/i18n/en';
import { withDemoDataFlag } from '@/test-utils/demo-flag';

const copy = en.community;

// The Community views fed by the real hooks, the way the tab composes them.
function MyGroups() {
  const groups = useCommunityGroups();
  const [selectedId, setSelectedId] = useState<string>();
  const activeGroupId = selectedId ?? groups[0]?.id;
  const messages = useGroupChat(activeGroupId);
  return (
    <CommunityView groups={groups} activeGroupId={activeGroupId} onSelectGroup={setSelectedId} messages={messages} />
  );
}

function Discover() {
  const groups = useCommunityGroups();
  const [query, setQuery] = useState('');
  const results = useDiscoverGroups(query);
  return (
    <DiscoverView
      groupCount={groups.length}
      onMinePress={() => {}}
      query={query}
      onChangeQuery={setQuery}
      results={results}
    />
  );
}

describe('Community tab, demo data off (default)', () => {
  withDemoDataFlag(false);

  it('shows the empty state with no groups', () => {
    render(<MyGroups />);

    expect(screen.getByText(copy.empty.title)).toBeOnTheScreen();
    expect(screen.queryByText('Columbia Local Park Regulars')).toBeNull();
  });

  it('has nothing to discover', () => {
    render(<Discover />);

    expect(screen.getByText(copy.discover.empty.title)).toBeOnTheScreen();
  });
});

describe('Community tab, demo data on', () => {
  withDemoDataFlag(true);
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows the sample groups and the first room’s chat with an open challenge', () => {
    render(<MyGroups />);

    expect(screen.queryByText(copy.empty.title)).toBeNull();
    expect(screen.getByRole('header', { name: 'Columbia Local Park Regulars' })).toBeOnTheScreen();
    expect(screen.getByText(/Courts 2 and 3 are open/)).toBeOnTheScreen();
    expect(screen.getByText(copy.challenge.live)).toBeOnTheScreen();
    expect(screen.getByText('Columbia Local Park · Court 2')).toBeOnTheScreen();
  });

  it('switches to another sample group’s chat', () => {
    render(<MyGroups />);

    fireEvent.press(screen.getByRole('tab', { name: copy.a11y.memberCount('Silver Dinks Open Play (50+)', 58) }));

    expect(screen.getByRole('header', { name: 'Silver Dinks Open Play (50+)' })).toBeOnTheScreen();
    expect(screen.getByText(/Beginners welcome/)).toBeOnTheScreen();
  });

  it('recommends the sample groups on Discover and filters them by the search', () => {
    render(<Discover />);

    expect(screen.getByRole('header', { name: 'Kitchen Kings — 1800+ Invite Only' })).toBeOnTheScreen();
    expect(screen.getByText('Invite only')).toBeOnTheScreen();
    // Rating bands on the 1500-based Glicko scale, not DUPR's (#116).
    expect(screen.getByText(copy.discover.ratingMin('1800'))).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Silver Dinks Open Play (50+)' })).toBeOnTheScreen();
    expect(screen.getByText('All levels welcome')).toBeOnTheScreen();

    fireEvent.changeText(screen.getByLabelText(copy.discover.searchLabel), 'cloverly');
    act(() => jest.advanceTimersByTime(DiscoverSearchDebounceMs));

    expect(screen.getByRole('header', { name: 'Cloverly Park Pickleball' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Kitchen Kings — 1800+ Invite Only' })).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Silver Dinks Open Play (50+)' })).toBeNull();
  });
});
