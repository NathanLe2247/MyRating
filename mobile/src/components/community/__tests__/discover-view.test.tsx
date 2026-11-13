import { fireEvent, render, screen } from '@testing-library/react-native';
import { type ComponentProps, useState } from 'react';

import { DiscoverView } from '@/components/community/discover-view';
import { en } from '@/i18n/en';
import type { DiscoverGroup, DiscoverResults } from '@/types/community';

const copy = en.community;
const t = copy.discover;

// Test fixtures only; the app never shows placeholder groups.
const groups: DiscoverGroup[] = [
  {
    id: 'd1',
    name: 'Test Ladder',
    memberCount: 48,
    onlineCount: 5,
    verified: true,
    ratingRange: { min: 4.25, max: 5 },
    courts: 'Test Rec Center',
    schedule: 'Sunday ladder nights',
    tags: ['High intensity'],
  },
  {
    id: 'd2',
    name: 'Open Elite',
    memberCount: 1,
    onlineCount: 0,
    ratingRange: { min: 4.75, max: null },
  },
];

const empty: DiscoverResults = { groups: [], loading: false };
const noop = () => {};

function renderView(props: Partial<ComponentProps<typeof DiscoverView>> = {}) {
  return render(
    <DiscoverView
      groupCount={0}
      onMinePress={noop}
      query=""
      onChangeQuery={noop}
      results={empty}
      {...props}
    />,
  );
}

describe('DiscoverView', () => {
  describe('empty state', () => {
    it('shows the search field, builder banner, and empty state when there is nothing to discover', () => {
      renderView();

      expect(screen.getByLabelText(t.searchLabel)).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: t.builder.title })).toBeOnTheScreen();
      expect(screen.getByRole('header', { name: t.recommended })).toBeOnTheScreen();
      expect(screen.getByText(t.empty.title)).toBeOnTheScreen();
      expect(screen.getByText(t.empty.body)).toBeOnTheScreen();
    });

    it('selects the discover tab and switches back to my communities', () => {
      const onMinePress = jest.fn();
      renderView({ onMinePress });

      expect(screen.getByRole('tab', { name: new RegExp(copy.sections.discover) })).toBeSelected();
      fireEvent.press(screen.getByRole('tab', { name: new RegExp(copy.sections.mine) }));
      expect(onMinePress).toHaveBeenCalledTimes(1);
    });

    it('leaves create and filter disabled until those flows exist', () => {
      renderView();

      expect(screen.getByRole('button', { name: new RegExp(t.builder.cta.replace('+', '\\+')) })).toBeDisabled();
      expect(screen.getByRole('button', { name: t.filter })).toBeDisabled();
    });
  });

  describe('search', () => {
    function Controlled({ results }: { results: DiscoverResults }) {
      const [query, setQuery] = useState('');
      return (
        <DiscoverView groupCount={0} onMinePress={noop} query={query} onChangeQuery={setQuery} results={results} />
      );
    }

    it('reports what the player types and clears it', () => {
      render(<Controlled results={empty} />);

      fireEvent.changeText(screen.getByLabelText(t.searchLabel), 'zilker');
      expect(screen.getByLabelText(t.searchLabel)).toHaveDisplayValue('zilker');
      expect(screen.getByRole('header', { name: t.results })).toBeOnTheScreen();

      fireEvent.press(screen.getByRole('button', { name: t.clearSearch }));
      expect(screen.getByLabelText(t.searchLabel)).toHaveDisplayValue('');
      expect(screen.queryByRole('button', { name: t.clearSearch })).toBeNull();
    });

    it('shows a loading state while a search is pending', () => {
      renderView({ query: 'zilker', results: { groups: [], loading: true } });

      expect(screen.getByLabelText(t.loading)).toBeOnTheScreen();
      expect(screen.queryByText(t.noResults.title)).toBeNull();
      expect(screen.queryByText(t.empty.title)).toBeNull();
    });

    it('shows a no-results state naming the query', () => {
      renderView({ query: '  zilker  ', results: empty });

      expect(screen.getByText(t.noResults.title)).toBeOnTheScreen();
      expect(screen.getByText(t.noResults.body('zilker'))).toBeOnTheScreen();
      // The banner makes room for results while searching.
      expect(screen.queryByRole('header', { name: t.builder.title })).toBeNull();
    });
  });

  describe('loaded state', () => {
    it('lists groups with members, online count, rating band, details, and tags', () => {
      renderView({ results: { groups, loading: false } });

      expect(screen.queryByText(t.empty.title)).toBeNull();
      expect(screen.getByRole('header', { name: 'Test Ladder' })).toBeOnTheScreen();
      expect(screen.getByLabelText(copy.a11y.verified)).toBeOnTheScreen();
      expect(screen.getByText(copy.members(48))).toBeOnTheScreen();
      expect(screen.getByText(copy.online(5))).toBeOnTheScreen();
      expect(screen.getByText(t.ratingRange('4.25', '5.00'))).toBeOnTheScreen();
      expect(screen.getByText('Test Rec Center')).toBeOnTheScreen();
      expect(screen.getByText('Sunday ladder nights')).toBeOnTheScreen();
      expect(screen.getByText('High intensity')).toBeOnTheScreen();
    });

    it('shows an open-ended band and hides the online count when nobody is on', () => {
      renderView({ results: { groups: [groups[1]], loading: false } });

      expect(screen.getByText(copy.members(1))).toBeOnTheScreen();
      expect(screen.getByText(t.ratingMin('4.75'))).toBeOnTheScreen();
      expect(screen.queryByText(copy.online(0))).toBeNull();
    });
  });
});
