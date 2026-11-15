import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { MatchFoundView } from '@/components/match-found/match-found-view';
import { en } from '@/i18n/en';
import type { MatchFound } from '@/types/match-found';

const t = en.matchFound;

function renderView(match: MatchFound | null, props: Partial<ComponentProps<typeof MatchFoundView>> = {}) {
  const handlers = {
    onBack: jest.fn(),
    onLeave: jest.fn(),
    onAccept: jest.fn(),
    onDecline: jest.fn(),
  };
  render(<MatchFoundView match={match} {...handlers} {...props} />);
  return handlers;
}

// Every optional field filled in.
const SampleMatchFound: MatchFound = {
  id: 'sample',
  format: 'singles',
  official: true,
  player: { name: 'Alex Vance', rating: 4.18, location: 'Austin, TX' },
  opponent: { name: 'J. Alvarez', rating: 4.2, location: 'Austin, TX', winStreak: 7 },
  searchRadiusMiles: 5,
  elapsedSeconds: 42,
  ratingsVerified: true,
  courtReady: true,
  autoCheckIn: true,
  winProbability: 0.51,
  ratingImpact: 0.038,
  venue: { name: 'Zilker Park Courts', distanceMiles: 1.4, driveMinutes: 5 },
  rules: { games: 3, pointsTo: 11, winBy: 2 },
};

// Only what matchmaking always provides — every optional field left out.
const minimalMatch: MatchFound = {
  id: 'm1',
  format: 'doubles',
  official: false,
  player: { name: 'Sam Lee', rating: null },
  opponent: { name: 'Rita Cho', rating: 3.9 },
  searchRadiusMiles: 10,
  elapsedSeconds: 125,
};

describe('MatchFoundView', () => {
  describe('empty state', () => {
    it('shows no match and a way back, with no accept/decline', () => {
      const { onBack } = renderView(null);

      expect(screen.getByText(t.empty.title)).toBeOnTheScreen();
      expect(screen.queryByText(t.title)).toBeNull();
      expect(screen.queryByRole('button', { name: t.accept })).toBeNull();

      fireEvent.press(screen.getByRole('button', { name: t.empty.back }));
      expect(onBack).toHaveBeenCalled();
    });
  });

  describe('loaded', () => {
    it('shows both players, the pairing details, and the venue', () => {
      renderView(SampleMatchFound);

      expect(screen.getByText(t.title)).toBeOnTheScreen();
      expect(screen.getByText(t.searching(5))).toBeOnTheScreen();
      expect(screen.getByText(t.elapsed('00:42'))).toBeOnTheScreen();
      expect(screen.getByText(t.parity('0.02'))).toBeOnTheScreen();
      expect(screen.getByText('Alex Vance')).toBeOnTheScreen();
      expect(screen.getByText('J. Alvarez')).toBeOnTheScreen();
      expect(screen.getByText('4.18')).toBeOnTheScreen();
      expect(screen.getByText('4.20')).toBeOnTheScreen();
      expect(screen.getByText(t.streak(7))).toBeOnTheScreen();
      expect(screen.getByText(t.percent(51))).toBeOnTheScreen();
      expect(screen.getByText(t.percent(49))).toBeOnTheScreen();
      expect(
        screen.getByText(`${t.evenMatchup}${t.subtextJoin}${t.ratingImpact('0.038')}`),
      ).toBeOnTheScreen();
      expect(screen.getByText('Zilker Park Courts')).toBeOnTheScreen();
      expect(screen.getByText(t.distance('1.4'))).toBeOnTheScreen();
      expect(screen.getByText(t.drive(5))).toBeOnTheScreen();
      expect(screen.getByText(t.formatTitle('Singles', true, 3))).toBeOnTheScreen();
      expect(screen.getByText(t.rules(3, 11, 2))).toBeOnTheScreen();
      expect(screen.queryByText(t.empty.title)).toBeNull();
    });

    it('wires accept, decline, leave and back', () => {
      const handlers = renderView(SampleMatchFound);

      fireEvent.press(screen.getByRole('button', { name: t.accept }));
      fireEvent.press(screen.getByRole('button', { name: t.decline }));
      fireEvent.press(screen.getByRole('button', { name: t.leaveLabel }));
      fireEvent.press(screen.getByRole('button', { name: t.back }));

      expect(handlers.onAccept).toHaveBeenCalledTimes(1);
      expect(handlers.onDecline).toHaveBeenCalledTimes(1);
      expect(handlers.onLeave).toHaveBeenCalledTimes(1);
      expect(handlers.onBack).toHaveBeenCalledTimes(1);
    });

    it('shows empty states for details matchmaking did not provide, never invented values', () => {
      renderView(minimalMatch);

      expect(screen.getByText(t.parityCalibrating)).toBeOnTheScreen();
      expect(screen.getByText(t.unrated)).toBeOnTheScreen();
      expect(screen.getByText(t.venueEmpty)).toBeOnTheScreen();
      expect(screen.getByText(t.rulesEmpty)).toBeOnTheScreen();
      expect(screen.getByText(t.formatTitle('Doubles', false, undefined))).toBeOnTheScreen();
      expect(screen.queryByText(t.winProbability)).toBeNull();
      expect(screen.queryByText(t.verified)).toBeNull();
      expect(screen.queryByText(t.courtReady)).toBeNull();
      expect(screen.queryByText(t.autoCheckIn)).toBeNull();
      expect(screen.queryByText(t.evenMatchup)).toBeNull();
      expect(screen.queryByRole('button', { name: t.openMap })).toBeNull();
      expect(screen.getByRole('button', { name: t.accept })).toBeOnTheScreen();
    });

    it('shows initials instead of loading a photo from outside the app’s R2 bucket', () => {
      renderView({
        ...SampleMatchFound,
        opponent: { ...SampleMatchFound.opponent, avatarUrl: 'https://evil.example.com/x.png' },
      });

      expect(screen.getByText('JA')).toBeOnTheScreen();
    });
  });

  describe('phases', () => {
    it('disables accept while the opponent still has to answer, keeping decline', () => {
      const { onDecline } = renderView(minimalMatch, { phase: 'waiting_for_opponent' });

      expect(screen.queryByRole('button', { name: t.accept })).toBeNull();
      expect(screen.getByRole('button', { name: t.waitingForOpponent('Rita Cho') })).toBeDisabled();
      fireEvent.press(screen.getByRole('button', { name: t.decline }));
      expect(onDecline).toHaveBeenCalled();
    });

    it('shows the match that is on: where to go, cancel, and no accept/decline', () => {
      const handlers = renderView(SampleMatchFound, { phase: 'on' });

      expect(screen.getByText(t.on.title)).toBeOnTheScreen();
      expect(screen.getByText(t.on.court('Zilker Park Courts'))).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: t.accept })).toBeNull();
      expect(screen.queryByRole('button', { name: t.decline })).toBeNull();
      expect(screen.queryByText(t.searching(5))).toBeNull();

      fireEvent.press(screen.getByRole('button', { name: t.on.cancel }));
      fireEvent.press(screen.getByRole('button', { name: t.on.home }));
      expect(handlers.onLeave).toHaveBeenCalledTimes(1);
      expect(handlers.onBack).toHaveBeenCalledTimes(1);
    });

    it('asks the player to pick a court when matchmaking found none', () => {
      renderView(minimalMatch, { phase: 'on' });

      expect(screen.getByText(t.on.noCourt)).toBeOnTheScreen();
    });

    it('disables the answers while one is in flight', () => {
      renderView(minimalMatch, { busy: true });

      expect(screen.getByRole('button', { name: t.accept })).toBeDisabled();
      expect(screen.getByRole('button', { name: t.decline })).toBeDisabled();
    });

    it('shows an error from matchmaking', () => {
      renderView(minimalMatch, { error: 'Something broke.' });

      expect(screen.getByRole('alert')).toHaveTextContent('Something broke.');
    });

    it('shows a spinner, not the empty state, while loading', () => {
      renderView(null, { loading: true });

      expect(screen.getByLabelText(t.loading)).toBeOnTheScreen();
      expect(screen.queryByText(t.empty.title)).toBeNull();
    });
  });

  it('shows the distance only when it is known', () => {
    renderView({ ...minimalMatch, venue: { name: 'Hill Courts' } });

    expect(screen.getByText('Hill Courts')).toBeOnTheScreen();
    expect(screen.queryByText(/mi away/)).toBeNull();
  });
});
