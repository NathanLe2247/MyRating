import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CourtCard } from '@/components/play/court-card';
import { PlayListings } from '@/components/play/play-listings';
import { PlaySection } from '@/components/play/play-section';
import { TournamentCard } from '@/components/play/tournament-card';
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
  timeZone: 'UTC',
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

  it('disables the card actions until detail screens exist, but keeps cards tappable', () => {
    render(<PlayListings courts={[outdoor]} tournaments={[tournament]} />);

    expect(
      screen.getByRole('button', { name: copy.courts.a11y.directions(outdoor.name) }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: copy.courts.a11y.checkIn(outdoor.name) }),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: outdoor.name })).toBeEnabled();
    expect(screen.getByRole('button', { name: tournament.name })).toBeEnabled();
  });
});

describe('CourtCard', () => {
  it('shows the court count, distance and check-in action for an outdoor venue', () => {
    const onPress = jest.fn();
    const onPrimaryAction = jest.fn();
    render(<CourtCard court={outdoor} onPress={onPress} onPrimaryAction={onPrimaryAction} />);

    expect(screen.getByText(copy.courts.courtCount(8))).toBeOnTheScreen();
    expect(screen.getByText(copy.courts.distance('1.2'))).toBeOnTheScreen();
    expect(screen.getByText(outdoor.note!)).toBeOnTheScreen();
    expect(screen.getByText(copy.courts.checkIn)).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: outdoor.name }));
    expect(onPress).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('button', { name: copy.courts.a11y.checkIn(outdoor.name) }));
    expect(onPrimaryAction).toHaveBeenCalledTimes(1);
  });

  it('labels indoor venues and offers booking', () => {
    render(<CourtCard court={indoor} />);

    expect(screen.getByText(copy.courts.indoorCount(6))).toBeOnTheScreen();
    expect(screen.getByText(copy.courts.bookCourt)).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: copy.courts.a11y.bookCourt(indoor.name) }),
    ).toBeOnTheScreen();
  });

  it('shows only directions, with the distance, when there is no main action', () => {
    render(<CourtCard court={casual} />);

    expect(screen.getByText(copy.courts.directionsWithDistance('3.4'))).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: copy.courts.a11y.directions(casual.name) }),
    ).toBeOnTheScreen();
    expect(screen.queryByText(copy.courts.checkIn)).toBeNull();
    expect(screen.queryByText(copy.courts.bookCourt)).toBeNull();
  });

  // The test renderer drops empty strings, so these can't reproduce the native
  // "Text strings must be rendered within a <Text>" crash that `'' && <X />`
  // causes; they cover the empty-field render paths and fallbacks.
  it('renders empty optional strings without crashing', () => {
    render(
      <CourtCard
        court={{
          ...outdoor,
          neighborhood: '',
          note: '',
          description: '',
          photoUrl: '',
          photoCaption: '',
        }}
      />,
    );

    expect(screen.getByRole('button', { name: outdoor.name })).toBeOnTheScreen();
  });
});

describe('TournamentCard', () => {
  it('shows the date in the venue time zone', () => {
    render(
      <TournamentCard
        tournament={{
          ...tournament,
          startsAt: '2026-11-15T03:00:00Z',
          timeZone: 'America/Chicago',
        }}
      />,
    );

    expect(screen.getByText('Sat, Nov 14')).toBeOnTheScreen();
  });

  it('renders empty optional strings and a bad date without crashing', () => {
    render(
      <TournamentCard tournament={{ ...tournament, startsAt: '', venue: '', division: '' }} />,
    );

    expect(screen.getByText(copy.tournaments.dateTbd)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: tournament.name })).toBeOnTheScreen();
  });
});

describe('PlaySection', () => {
  it('hides an empty badge', () => {
    render(
      <PlaySection title={copy.courts.title} badge="">
        <Text>{copy.courts.emptyTitle}</Text>
      </PlaySection>,
    );

    expect(screen.getByText(copy.courts.title)).toBeOnTheScreen();
  });
});
