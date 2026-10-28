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
    expect(parseMatchFound(JSON.stringify({ ...SampleMatchFound, elapsedSeconds: '42' }))).toBeNull();
    expect(parseMatchFound(JSON.stringify({ ...SampleMatchFound, official: 'yes' }))).toBeNull();
  });

  describe('drops an invalid optional field but keeps the match', () => {
    const withField = (patch: object) =>
      parseMatchFound(JSON.stringify({ ...SampleMatchFound, ...patch }));
    const withPlayer = (patch: object) =>
      parseMatchFound(
        JSON.stringify({ ...SampleMatchFound, player: { ...SampleMatchFound.player, ...patch } }),
      );

    it.each([
      ['venue without distanceMiles', { venue: { name: 'Zilker' } }],
      ['venue with a string distance', { venue: { name: 'Zilker', distanceMiles: '1.4' } }],
      ['venue as a string', { venue: 'Zilker' }],
    ])('%s', (_label, patch) => {
      const match = withField(patch);
      expect(match).not.toBeNull();
      expect(match?.venue).toBeUndefined();
      expect(match?.rules).toEqual(SampleMatchFound.rules);
    });

    it('keeps a venue but drops a bad driveMinutes', () => {
      const match = withField({ venue: { name: 'Zilker', distanceMiles: 1.4, driveMinutes: 'soon' } });
      expect(match?.venue).toEqual({ name: 'Zilker', distanceMiles: 1.4 });
    });

    it.each([
      ['empty rules', { rules: {} }],
      ['rules with zero games', { rules: { games: 0, pointsTo: 11, winBy: 2 } }],
      ['rules with fractional points', { rules: { games: 3, pointsTo: 10.5, winBy: 2 } }],
    ])('%s', (_label, patch) => {
      expect(withField(patch)?.rules).toBeUndefined();
    });

    it.each([
      ['string', '0.51'],
      ['above 1', 1.5],
      ['negative', -0.1],
      ['percent', 51],
    ])('winProbability as %s', (_label, value) => {
      const match = withField({ winProbability: value });
      expect(match).not.toBeNull();
      expect(match?.winProbability).toBeUndefined();
    });

    it.each([
      ['ratingImpact', { ratingImpact: 'big' }],
      ['ratingImpact negative', { ratingImpact: -1 }],
      ['ratingsVerified', { ratingsVerified: 'true' }],
      ['courtReady', { courtReady: 1 }],
      ['autoCheckIn', { autoCheckIn: {} }],
    ])('%s', (_label, patch) => {
      const match = withField(patch);
      expect(match).not.toBeNull();
      expect(match?.[Object.keys(patch)[0] as keyof typeof match]).toBeUndefined();
    });

    it.each([
      ['location as an object', { location: {} }],
      ['location empty', { location: '' }],
      ['winStreak as a string', { winStreak: '7' }],
      ['winStreak fractional', { winStreak: 2.5 }],
      ['avatarUrl as a number', { avatarUrl: 42 }],
    ])('player %s', (_label, patch) => {
      const match = withPlayer(patch);
      expect(match).not.toBeNull();
      expect(match?.player[Object.keys(patch)[0] as keyof typeof match.player]).toBeUndefined();
      expect(match?.player.name).toBe(SampleMatchFound.player.name);
    });
  });

  describe('avatarUrl', () => {
    const R2 = 'https://pub-test.r2.dev';
    const original = process.env.EXPO_PUBLIC_R2_PUBLIC_URL;
    beforeEach(() => {
      process.env.EXPO_PUBLIC_R2_PUBLIC_URL = R2;
    });
    afterEach(() => {
      // process.env stringifies values, so restore "unset" by deleting.
      if (original === undefined) delete process.env.EXPO_PUBLIC_R2_PUBLIC_URL;
      else process.env.EXPO_PUBLIC_R2_PUBLIC_URL = original;
    });
    const avatar = (avatarUrl: string) =>
      parseMatchFound(
        JSON.stringify({ ...SampleMatchFound, opponent: { ...SampleMatchFound.opponent, avatarUrl } }),
      )?.opponent.avatarUrl;

    it('keeps a photo from the app’s R2 bucket', () => {
      expect(avatar(`${R2}/avatars/u1.jpg`)).toBe(`${R2}/avatars/u1.jpg`);
    });

    it.each([
      'https://evil.example.com/tracker.png',
      `${R2}.evil.example.com/a.png`,
      `${R2}/../a.png`,
      'http://pub-test.r2.dev/a.png',
      'data:image/png;base64,AAAA',
    ])('drops %s', (url) => {
      expect(avatar(url)).toBeUndefined();
    });

    it('drops every photo when the R2 URL isn’t configured', () => {
      delete process.env.EXPO_PUBLIC_R2_PUBLIC_URL;
      expect(avatar(`${R2}/avatars/u1.jpg`)).toBeUndefined();
    });
  });
});
