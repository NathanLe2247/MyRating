import { fireEvent, render, screen } from '@testing-library/react-native';

import { MatchFoundView } from '@/components/match-found/match-found-view';
import { SampleMatchFound } from '@/constants/dev-previews';
import { en } from '@/i18n/en';
import type { MatchFound } from '@/types/match-found';
import { parseMatchFound } from '@/utils/match-found-param';

const t = en.matchFound;

function renderView(match: MatchFound | null) {
  const handlers = {
    onBack: jest.fn(),
    onLeave: jest.fn(),
    onAccept: jest.fn(),
    onDecline: jest.fn(),
  };
  render(<MatchFoundView match={match} {...handlers} />);
  return handlers;
}

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

  describe('from a malformed route param', () => {
    it('renders the valid parts and empty states for the bad optional fields', () => {
      const param = JSON.stringify({
        ...SampleMatchFound,
        player: { ...SampleMatchFound.player, location: {}, avatarUrl: 'https://evil.example.com/x.png' },
        opponent: { ...SampleMatchFound.opponent, winStreak: 'seven' },
        venue: { name: 'Zilker Park Courts' },
        rules: {},
        winProbability: '0.51',
        ratingImpact: 'huge',
        autoCheckIn: 'yes',
      });

      renderView(parseMatchFound(param));

      expect(screen.getByText(t.title)).toBeOnTheScreen();
      expect(screen.getByText('Alex Vance')).toBeOnTheScreen();
      expect(screen.getByText('J. Alvarez')).toBeOnTheScreen();
      expect(screen.getByText(t.venueEmpty)).toBeOnTheScreen();
      expect(screen.getByText(t.rulesEmpty)).toBeOnTheScreen();
      expect(screen.queryByText(t.winProbability)).toBeNull();
      expect(screen.queryByText(/NaN|undefined|\[object/)).toBeNull();
      expect(screen.queryByText(t.autoCheckIn)).toBeNull();
      expect(screen.queryByText(t.streak(7))).toBeNull();
      expect(screen.getAllByText('AV').length).toBeGreaterThan(0);
    });

    it('shows the empty state when a required field is bad', () => {
      renderView(parseMatchFound(JSON.stringify({ ...SampleMatchFound, player: { name: 'X' } })));

      expect(screen.getByText(t.empty.title)).toBeOnTheScreen();
    });
  });
});
