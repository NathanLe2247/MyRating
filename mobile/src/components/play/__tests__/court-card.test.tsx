import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';

import { CourtCard } from '@/components/play/court-card';
import { en } from '@/i18n/en';
import type { CourtCardData } from '@/types/play';

const copy = en.play.courts;

const court: CourtCardData = {
  id: 'c1',
  name: 'Test Park & Courts',
  distanceMiles: '1.2',
  location: { lat: 40, lng: -75 },
  tags: [],
};

const directions = () => screen.getByRole('button', { name: copy.a11y.directions(court.name) });

describe('CourtCard directions', () => {
  const originalOS = Platform.OS;
  let openURL: jest.SpyInstance;

  const setOS = (os: typeof Platform.OS) =>
    Object.defineProperty(Platform, 'OS', {
      get: () => os,
      configurable: true,
    });

  beforeEach(() => {
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  });

  afterEach(() => {
    openURL.mockRestore();
    setOS(originalOS);
  });

  it('opens Apple Maps at the court on iOS', () => {
    setOS('ios');
    render(<CourtCard court={court} />);

    expect(directions()).toBeEnabled();
    fireEvent.press(directions());

    expect(openURL).toHaveBeenCalledWith(
      'https://maps.apple.com/?ll=40,-75&q=Test%20Park%20%26%20Courts',
    );
  });

  it('opens Google Maps at the court on Android', () => {
    setOS('android');
    render(<CourtCard court={court} />);

    fireEvent.press(directions());

    expect(openURL).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=40,-75');
  });

  it('stays on the card when the maps link cannot be opened', async () => {
    openURL.mockRejectedValue(new Error('no handler'));
    render(<CourtCard court={court} />);

    fireEvent.press(directions());

    await expect(openURL.mock.results[0].value).rejects.toThrow('no handler');
    expect(screen.getByText(court.name)).toBeOnTheScreen();
  });

  it('is disabled, and says why, when the court has no coordinates', () => {
    render(<CourtCard court={{ ...court, location: undefined }} />);

    expect(directions()).toBeDisabled();
    expect(screen.getByHintText(copy.a11y.noLocation)).toBe(directions());
    fireEvent.press(directions());
    expect(openURL).not.toHaveBeenCalled();
  });
});
