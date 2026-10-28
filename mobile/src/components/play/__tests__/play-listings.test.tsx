import { fireEvent, render, screen } from '@testing-library/react-native';

import { CourtCard } from '@/components/play/court-card';
import { PlayListings } from '@/components/play/play-listings';
import { en } from '@/i18n/en';
import type { CourtCardData, TournamentCardData } from '@/types/play';

const copy = en.play;

const outdoor: CourtCardData = {
  id: 'c1',
  name: 'Test Outdoor Courts',
  distanceMiles: '1.2',
  neighborhood: 'South Side',
  courtCount: 8,
  setting: 'outdoor',
  featured: true,
  note: 'Lit until 10 PM',
  tags: [{ label: 'Public · Free', tone: 'strong' }],
  primaryAction: 'checkIn',
};

const indoor: CourtCardData = {
  id: 'c2',
  name: 'Test Indoor Club',
  distanceMiles: '2.8',
  neighborhood: 'Downtown',
  courtCount: 6,
  setting: 'indoor',
  tags: [],
  primaryAction: 'book',
};

const casual: CourtCardData = {
  id: 'c3',
  name: 'Test Park',
  distanceMiles: '3.4',
  neighborhood: 'East Side',
  courtCount: 4,
  setting: 'outdoor',
  tags: [],
};

const tournament: TournamentCardData = {
  id: 't1',
  name: 'Test Open',
  startsAt: '2026-11-14T15:00:00Z',
  venue: 'Test Convention Center',
  division: 'DUPR 3.5 – 4.5',
  spotsLeft: 6,
};

describe('PlayListings', () => {
  it('shows both empty states when there are no courts or tournaments', () => {
    render(<PlayListings courts={[]} tournaments={[]} />);

    expect(screen.getByText(copy.courts.title)).toBeOnTheScreen();
    expect(screen.getByText(copy.courts.emptyTitle)).toBeOnTheScreen();
    expect(screen.getByText(copy.tournaments.title)).toBeOnTheScreen();
    expect(screen.getByText(copy.tournaments.emptyTitle)).toBeOnTheScreen();
    expect(screen.queryByText(copy.courts.nearYou(0))).toBeNull();
  });

  it('lists courts and tournaments when loaded', () => {
    render(<PlayListings courts={[outdoor, indoor]} tournaments={[tournament]} />);

    expect(screen.getByText(copy.courts.nearYou(2))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: outdoor.name })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: indoor.name })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: tournament.name })).toBeOnTheScreen();
    expect(screen.getByText(copy.tournaments.spotsLeft(6))).toBeOnTheScreen();
    expect(screen.queryByText(copy.courts.emptyTitle)).toBeNull();
    expect(screen.queryByText(copy.tournaments.emptyTitle)).toBeNull();
  });

  it('keeps one empty state when only the other section has data', () => {
    render(<PlayListings courts={[]} tournaments={[tournament]} />);

    expect(screen.getByText(copy.courts.emptyTitle)).toBeOnTheScreen();
    expect(screen.queryByText(copy.tournaments.emptyTitle)).toBeNull();
  });

  it('treats tapping a card as a no-op until detail screens exist', () => {
    render(<PlayListings courts={[outdoor]} tournaments={[tournament]} />);

    fireEvent.press(screen.getByRole('button', { name: outdoor.name }));
    fireEvent.press(screen.getByRole('button', { name: tournament.name }));

    expect(screen.getByRole('button', { name: outdoor.name })).toBeOnTheScreen();
  });
});

describe('CourtCard', () => {
  it('shows the court count, distance and check-in action for an outdoor venue', () => {
    const onPress = jest.fn();
    render(<CourtCard court={outdoor} onPress={onPress} />);

    expect(screen.getByText(copy.courts.courtCount(8))).toBeOnTheScreen();
    expect(screen.getByText(copy.courts.distance('1.2'))).toBeOnTheScreen();
    expect(screen.getByText(outdoor.note!)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: copy.courts.checkIn })).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: outdoor.name }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('labels indoor venues and offers booking', () => {
    render(<CourtCard court={indoor} />);

    expect(screen.getByText(copy.courts.indoorCount(6))).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: copy.courts.bookCourt })).toBeOnTheScreen();
  });

  it('shows only directions, with the distance, when there is no main action', () => {
    render(<CourtCard court={casual} />);

    expect(
      screen.getByRole('button', {
        name: copy.courts.directionsWithDistance('3.4'),
      }),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: copy.courts.checkIn })).toBeNull();
    expect(screen.queryByRole('button', { name: copy.courts.bookCourt })).toBeNull();
  });
});
