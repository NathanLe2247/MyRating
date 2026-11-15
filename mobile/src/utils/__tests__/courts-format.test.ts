import type { NearbyCourt } from '@myrating/shared';

import { formatMiles, toCourtCardData } from '@/utils/courts-format';

const court: NearbyCourt = {
  id: '6f1c2a1e-1d2b-4c3d-8e4f-5a6b7c8d9e0f',
  name: 'Test Park Courts',
  location: { type: 'Point', coordinates: [-75, 40] },
  is_active: true,
  created_at: '2026-11-13T12:00:00Z',
  distance_m: 1931,
};

describe('formatMiles', () => {
  it('converts metres to miles with one decimal', () => {
    expect(formatMiles(1931)).toBe('1.2');
    expect(formatMiles(0)).toBe('0.0');
    expect(formatMiles(25_000)).toBe('15.5');
  });
});

describe('toCourtCardData', () => {
  it('maps a nearby court to a card with its distance, inventing nothing', () => {
    expect(toCourtCardData(court)).toEqual({
      id: court.id,
      name: 'Test Park Courts',
      distanceMiles: '1.2',
      tags: [],
    });
  });
});
