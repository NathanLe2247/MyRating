import { SampleMatchFound } from '@/constants/dev-previews';
import {
  formatElapsed,
  formatMiles,
  formatRatingGap,
  formatRatingImpact,
  toPercent,
} from '@/utils/match-found-format';
import { parseMatchFound, serializeMatchFound } from '@/utils/match-found-param';

describe('match found formatting', () => {
  it('formats queue time as mm:ss', () => {
    expect(formatElapsed(42)).toBe('00:42');
    expect(formatElapsed(754)).toBe('12:34');
    expect(formatElapsed(-3)).toBe('00:00');
  });

  it('formats the rating gap, or null when either player is unrated', () => {
    expect(formatRatingGap(4.18, 4.2)).toBe('0.02');
    expect(formatRatingGap(4.2, 4.18)).toBe('0.02');
    expect(formatRatingGap(null, 4.2)).toBeNull();
  });

  it('rounds and clamps probabilities to whole percents', () => {
    expect(toPercent(0.514)).toBe(51);
    expect(toPercent(1.2)).toBe(100);
    expect(toPercent(-0.1)).toBe(0);
  });

  it('formats impact and miles', () => {
    expect(formatRatingImpact(0.038)).toBe('0.038');
    expect(formatRatingImpact(-0.038)).toBe('0.038');
    expect(formatMiles(1.44)).toBe('1.4');
  });
});

describe('parseMatchFound', () => {
  it('round-trips a serialized match', () => {
    expect(parseMatchFound(serializeMatchFound(SampleMatchFound))).toEqual(SampleMatchFound);
  });

  it('reads a missing, repeated, or malformed param as no match', () => {
    expect(parseMatchFound(undefined)).toBeNull();
    expect(parseMatchFound(['a', 'b'])).toBeNull();
    expect(parseMatchFound('{not json')).toBeNull();
    expect(parseMatchFound('null')).toBeNull();
  });

  it('rejects a match missing required fields', () => {
    const { opponent: _opponent, ...noOpponent } = SampleMatchFound;
    expect(parseMatchFound(JSON.stringify(noOpponent))).toBeNull();
    expect(parseMatchFound(JSON.stringify({ ...SampleMatchFound, format: 'triples' }))).toBeNull();
    expect(
      parseMatchFound(
        JSON.stringify({ ...SampleMatchFound, player: { name: 'A', rating: '4.1' } }),
      ),
    ).toBeNull();
  });
});
