import { fireEvent, render, screen } from '@testing-library/react-native';

import { HealthDashboard } from '@/components/health/health-dashboard';
import { en } from '@/i18n/en';
import type { HealthSummary } from '@/types/health';

const copy = en.health;

/** Matches the sync bar's "Synced with <provider>" prefix (the age follows it). */
const syncedWith = (provider: string) => new RegExp(`^${copy.sync.synced(provider)}`);

const summary: HealthSummary = {
  provider: 'whoop',
  syncedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  readiness: {
    score: 88,
    zone: 'optimal',
    hrvMs: 68,
    restingHeartRate: 48,
    sleepMinutes: 492,
    sleepEfficiency: 92,
  },
  courtLoad: {
    days: [
      { date: '2026-10-19', courtMinutes: 45 },
      { date: '2026-10-20', courtMinutes: 80 },
      { date: '2026-10-21', courtMinutes: 0 },
      { date: '2026-10-22', courtMinutes: 95 },
      { date: '2026-10-23', courtMinutes: 60 },
      { date: '2026-10-24', courtMinutes: 120 },
      { date: '2026-10-25', courtMinutes: 30 },
    ],
    matchesLogged: 11,
    avgHeartRate: 154,
    kcalPerMatch: 640,
  },
};

describe('HealthDashboard', () => {
  describe('not connected', () => {
    it('shows the empty readiness card and connect buttons', () => {
      render(<HealthDashboard summary={null} onConnect={jest.fn()} />);

      expect(screen.getByText(copy.readiness.emptyTitle)).toBeOnTheScreen();
      expect(screen.getByText(copy.readiness.emptyBody)).toBeOnTheScreen();
      expect(screen.getByText(copy.readiness.empty)).toBeOnTheScreen();
      expect(screen.getByText(copy.connect.title)).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: copy.connect.label(copy.providers.apple_health) }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole('button', { name: copy.connect.label(copy.providers.whoop) }),
      ).toBeOnTheScreen();
    });

    it('shows no metrics, sync status or court load', () => {
      render(<HealthDashboard summary={null} onConnect={jest.fn()} />);

      expect(screen.queryByText(copy.readiness.hrv)).toBeNull();
      expect(screen.queryByText(copy.courtLoad.title)).toBeNull();
      expect(screen.queryByText(syncedWith(copy.providers.whoop))).toBeNull();
      expect(screen.queryByText(syncedWith(copy.providers.apple_health))).toBeNull();
    });

    it('reports which provider was tapped', () => {
      const onConnect = jest.fn();
      render(<HealthDashboard summary={null} onConnect={onConnect} />);

      fireEvent.press(
        screen.getByRole('button', { name: copy.connect.label(copy.providers.whoop) }),
      );

      expect(onConnect).toHaveBeenCalledWith('whoop');
    });
  });

  describe('loaded', () => {
    it('shows readiness, metrics and the verdict', () => {
      render(<HealthDashboard summary={summary} onConnect={jest.fn()} />);

      expect(screen.getByText('88%')).toBeOnTheScreen();
      expect(screen.getByText(copy.readiness.zones.optimal)).toBeOnTheScreen();
      expect(screen.getByText(copy.readiness.modes.optimal)).toBeOnTheScreen();
      expect(screen.getByText('68')).toBeOnTheScreen();
      expect(screen.getByText('48')).toBeOnTheScreen();
      expect(screen.getByText('8h 12m')).toBeOnTheScreen();
      expect(screen.getByText('92%')).toBeOnTheScreen();
      expect(screen.getByText(copy.readiness.verdicts.optimal)).toBeOnTheScreen();
    });

    it('shows the sync source and age', () => {
      render(<HealthDashboard summary={summary} onConnect={jest.fn()} />);

      expect(screen.getByText(syncedWith(copy.providers.whoop))).toBeOnTheScreen();
      expect(screen.getByText(new RegExp(copy.sync.minutesAgo(12)))).toBeOnTheScreen();
    });

    it('shows the court load chart and weekly totals', () => {
      render(<HealthDashboard summary={summary} onConnect={jest.fn()} />);

      expect(screen.getByText(copy.courtLoad.title)).toBeOnTheScreen();
      expect(screen.getByText('640')).toBeOnTheScreen();
      expect(screen.getByText(copy.courtLoad.today)).toBeOnTheScreen();
      expect(screen.getByText('2h 0m')).toBeOnTheScreen();
      // 45 + 80 + 0 + 95 + 60 + 120 + 30 = 430 minutes
      expect(screen.getByText('7h 10m')).toBeOnTheScreen();
      expect(screen.getByText(copy.courtLoad.matches(11))).toBeOnTheScreen();
      expect(screen.getByText(copy.courtLoad.bpm(154))).toBeOnTheScreen();
    });

    it('hides the connect prompt and the empty state', () => {
      render(<HealthDashboard summary={summary} onConnect={jest.fn()} />);

      expect(screen.queryByText(copy.connect.title)).toBeNull();
      expect(screen.queryByText(copy.readiness.emptyTitle)).toBeNull();
    });
  });

  describe('connected, no readiness yet', () => {
    const partial: HealthSummary = { ...summary, readiness: null, courtLoad: null };

    it('says readiness is pending instead of asking to connect', () => {
      render(<HealthDashboard summary={partial} onConnect={jest.fn()} />);

      expect(screen.getByText(copy.readiness.emptyTitle)).toBeOnTheScreen();
      expect(screen.getByText(copy.readiness.pendingBody)).toBeOnTheScreen();
      expect(screen.queryByText(copy.readiness.emptyBody)).toBeNull();
      expect(screen.queryByText(copy.connect.title)).toBeNull();
      expect(screen.getByText(syncedWith(copy.providers.whoop))).toBeOnTheScreen();
    });
  });
});
