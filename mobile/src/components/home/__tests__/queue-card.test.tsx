import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { QueueCard } from '@/components/home/queue-card';
import { en } from '@/i18n/en';

const t = en.home.queue;

function renderCard(props: Partial<ComponentProps<typeof QueueCard>> = {}) {
  const handlers = { onFindMatch: jest.fn(), onOpenMatch: jest.fn(), onLeave: jest.fn() };
  render(<QueueCard calibrating={false} status={{ kind: 'idle' }} {...handlers} {...props} />);
  return handlers;
}

describe('QueueCard', () => {
  afterEach(() => jest.useRealTimers());

  it('idle: "Find a match" joins the queue', () => {
    const { onFindMatch, onOpenMatch } = renderCard();

    expect(screen.getByText(t.title)).toBeOnTheScreen();
    expect(screen.getByText(t.subtitle)).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: t.findMatch }));
    expect(onFindMatch).toHaveBeenCalledTimes(1);
    expect(onOpenMatch).not.toHaveBeenCalled();
  });

  it('idle while calibrating: points at the placement match', () => {
    renderCard({ calibrating: true });

    expect(screen.getByText(t.placement)).toBeOnTheScreen();
  });

  it('can’t be pressed again while joining', () => {
    const { onFindMatch } = renderCard({ busy: true });

    const button = screen.getByRole('button', { name: t.findMatch });
    expect(button).toBeDisabled();
    fireEvent.press(button);
    expect(onFindMatch).not.toHaveBeenCalled();
  });

  it('searching: shows the radius, a running timer, and Leave', () => {
    jest.useFakeTimers({ now: new Date('2026-11-14T12:00:05.000Z') });
    const { onLeave, onFindMatch } = renderCard({
      status: { kind: 'searching', since: '2026-11-14T12:00:00.000Z', radiusMiles: 16 },
    });

    expect(screen.getByText(t.searchingTitle)).toBeOnTheScreen();
    expect(screen.getByText(t.searching(16))).toBeOnTheScreen();
    expect(screen.getByText(t.elapsed('00:05'))).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: t.findMatch })).toBeNull();

    act(() => jest.advanceTimersByTime(60_000));
    expect(screen.getByText(t.elapsed('01:05'))).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button', { name: t.leaveLabel }));
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onFindMatch).not.toHaveBeenCalled();
  });

  it('matched: names the opponent and opens Match Found', () => {
    const { onOpenMatch } = renderCard({ status: { kind: 'matched', opponent: 'Demo Tester', waiting: false } });

    expect(screen.getByText(t.matchedTitle)).toBeOnTheScreen();
    expect(screen.getByText(t.matchedBody('Demo Tester'))).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: t.openMatch }));
    expect(onOpenMatch).toHaveBeenCalledTimes(1);
  });

  it('matched after accepting: says the opponent still has to answer', () => {
    renderCard({ status: { kind: 'matched', opponent: 'Rita', waiting: true } });

    expect(screen.getByText(t.waitingBody('Rita'))).toBeOnTheScreen();
  });

  it('match on: opens the match', () => {
    const { onOpenMatch } = renderCard({ status: { kind: 'on', opponent: 'Rita' } });

    expect(screen.getByText(t.onTitle)).toBeOnTheScreen();
    expect(screen.getByText(t.onBody('Rita'))).toBeOnTheScreen();
    fireEvent.press(screen.getByRole('button', { name: t.openMatch }));
    expect(onOpenMatch).toHaveBeenCalledTimes(1);
  });

  it('shows an error message', () => {
    renderCard({ error: en.matchmaking.errors.profile_required });

    expect(screen.getByRole('alert')).toHaveTextContent(en.matchmaking.errors.profile_required);
  });
});
