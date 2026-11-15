import { fireEvent, render, screen } from '@testing-library/react-native';

import { NearbyCourtsSection } from '@/components/courts/nearby-courts-section';
import { SignUpCta } from '@/components/courts/sign-up-cta';
import { en } from '@/i18n/en';
import type { CourtCardData } from '@/types/play';

const copy = en.courts;

const court: CourtCardData = { id: 'c1', name: 'Test Courts', distanceMiles: '1.2', tags: [] };

describe('NearbyCourtsSection', () => {
  it('shows progress while asking for location and while loading', () => {
    const showDefaultArea = jest.fn();
    const { rerender } = render(
      <NearbyCourtsSection state={{ status: 'asking', showDefaultArea }} />,
    );
    expect(screen.getByText(copy.asking)).toBeOnTheScreen();
    // The prompt may never be answered, so the default area is offered meanwhile.
    fireEvent.press(screen.getByRole('link', { name: copy.denied.showDefaultArea }));
    expect(showDefaultArea).toHaveBeenCalledTimes(1);

    rerender(<NearbyCourtsSection state={{ status: 'loading' }} />);
    expect(screen.getByText(copy.loading)).toBeOnTheScreen();
  });

  it('explains a denial and offers location, Settings, or the default area', () => {
    const requestPermission = jest.fn();
    const showDefaultArea = jest.fn();
    const { rerender } = render(
      <NearbyCourtsSection
        state={{ status: 'denied', canAskAgain: true, requestPermission, showDefaultArea }}
      />,
    );

    expect(screen.getByText(copy.denied.title)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: copy.denied.allow }));
    expect(requestPermission).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('link', { name: copy.denied.showDefaultArea }));
    expect(showDefaultArea).toHaveBeenCalledTimes(1);

    rerender(
      <NearbyCourtsSection
        state={{ status: 'denied', canAskAgain: false, requestPermission, showDefaultArea }}
      />,
    );
    expect(screen.getByRole('button', { name: copy.denied.openSettings })).toBeOnTheScreen();
  });

  it('shows an error with a retry', () => {
    const retry = jest.fn();
    render(<NearbyCourtsSection state={{ status: 'error', retry }} />);

    expect(screen.getByText(copy.loadError)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: en.home.retry }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: copy.denied.showDefaultArea })).toBeNull();
  });

  it('offers the default area next to retry when the position failed', () => {
    const showDefaultArea = jest.fn();
    render(<NearbyCourtsSection state={{ status: 'error', retry: jest.fn(), showDefaultArea }} />);

    fireEvent.press(screen.getByRole('link', { name: copy.denied.showDefaultArea }));
    expect(showDefaultArea).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when no courts are within the radius', () => {
    render(<NearbyCourtsSection state={{ status: 'loaded', courts: [] }} />);

    expect(screen.getByText(copy.title)).toBeOnTheScreen();
    expect(screen.getByText(en.play.courts.emptyTitle)).toBeOnTheScreen();
    expect(screen.getByText(en.play.courts.emptyBody('15.5'))).toBeOnTheScreen();
  });

  it('lists courts with their distance and a count badge', () => {
    render(<NearbyCourtsSection state={{ status: 'loaded', courts: [court] }} />);

    expect(screen.getByRole('button', { name: court.name })).toBeOnTheScreen();
    expect(screen.getByText(en.play.courts.distance('1.2'))).toBeOnTheScreen();
    expect(screen.getByText(en.play.courts.nearYou(1))).toBeOnTheScreen();
  });

  it('names the default area and offers to turn location on', () => {
    const requestPermission = jest.fn();
    render(
      <NearbyCourtsSection
        state={{
          status: 'loaded',
          courts: [court],
          defaultArea: { canAskAgain: true, requestPermission },
        }}
      />,
    );

    expect(screen.getByText(copy.defaultArea.title)).toBeOnTheScreen();
    expect(screen.queryByText(copy.title)).toBeNull();
    fireEvent.press(screen.getByRole('link', { name: copy.defaultArea.useMyLocation }));
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });
});

describe('SignUpCta', () => {
  it('offers sign up and log in', () => {
    const onSignUp = jest.fn();
    const onLogIn = jest.fn();
    render(<SignUpCta onSignUp={onSignUp} onLogIn={onLogIn} />);

    fireEvent.press(screen.getByRole('button', { name: copy.signedOut.signUp }));
    expect(onSignUp).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('link', { name: copy.signedOut.logIn }));
    expect(onLogIn).toHaveBeenCalledTimes(1);
  });
});
