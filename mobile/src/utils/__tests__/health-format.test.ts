import { formatDuration, formatSyncedAgo, weekdayInitial } from '@/utils/health-format';

describe('formatDuration', () => {
  it('shows minutes under an hour', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45)).toBe('45m');
  });

  it('shows hours and minutes from an hour up', () => {
    expect(formatDuration(60)).toBe('1h 0m');
    expect(formatDuration(492)).toBe('8h 12m');
  });

  it('rounds and clamps negatives to zero', () => {
    expect(formatDuration(44.6)).toBe('45m');
    expect(formatDuration(-5)).toBe('0m');
  });
});

describe('formatSyncedAgo', () => {
  const now = new Date('2026-10-28T12:00:00Z');
  const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

  it('formats by the largest whole unit', () => {
    expect(formatSyncedAgo(ago(0), now)).toBe('just now');
    expect(formatSyncedAgo(ago(12), now)).toBe('12m ago');
    expect(formatSyncedAgo(ago(125), now)).toBe('2h ago');
    expect(formatSyncedAgo(ago(3 * 24 * 60), now)).toBe('3d ago');
  });
});

describe('weekdayInitial', () => {
  it('uses the calendar date regardless of time zone', () => {
    expect(weekdayInitial('2026-10-26')).toBe('M');
    expect(weekdayInitial('2026-10-28')).toBe('W');
    expect(weekdayInitial('2026-10-25')).toBe('S');
  });
});
