import { formatEventDate } from '@/utils/date-format';

describe('formatEventDate', () => {
  it('formats in the given time zone', () => {
    // 03:00 UTC on the 15th is still the 14th in Chicago.
    expect(formatEventDate('2026-11-15T03:00:00Z', 'America/Chicago')).toBe('Sat, Nov 14');
    expect(formatEventDate('2026-11-15T03:00:00Z', 'UTC')).toBe('Sun, Nov 15');
  });

  it('returns null for an empty or invalid date', () => {
    expect(formatEventDate('', 'UTC')).toBeNull();
    expect(formatEventDate('not a date', 'UTC')).toBeNull();
  });
});
