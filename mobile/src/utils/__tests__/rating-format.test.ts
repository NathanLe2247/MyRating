import { formatDelta, formatRating, formatRatingBand } from '@/utils/rating-format';

describe('formatRating', () => {
  it('shows two decimals', () => {
    expect(formatRating(4.1832)).toBe('4.18');
    expect(formatRating(3)).toBe('3.00');
  });
});

describe('formatRatingBand', () => {
  it('shows a band bound as a whole number', () => {
    expect(formatRatingBand(1500)).toBe('1500');
    expect(formatRatingBand(1749.6)).toBe('1750');
  });
});

describe('formatDelta', () => {
  it.each([
    [0.04, '+0.04'],
    [-0.02, '-0.02'],
    [0, '0.00'],
    [-0.001, '-0.00'],
  ])('formats %p as %p', (delta, expected) => {
    expect(formatDelta(delta)).toBe(expected);
  });
});
