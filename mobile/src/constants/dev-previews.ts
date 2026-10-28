import type { MatchFound } from '@/types/match-found';

// Dev-only screen previews for screens whose backend doesn't exist yet, so
// they can be opened and screenshotted. Every flag is false in production
// builds (`__DEV__`), and off in dev unless its env var is set, so real users
// never see this sample data.

export const DevPreviews = {
  /**
   * The Home queue card opens Match Found with `SampleMatchFound`. Set
   * `EXPO_PUBLIC_DEV_MATCH_FOUND_PREVIEW=1` and restart Expo.
   */
  matchFound: __DEV__ && process.env.EXPO_PUBLIC_DEV_MATCH_FOUND_PREVIEW === '1',
} as const;

/** Sample pairing for the Match Found preview. Dev only — never shown to real users. */
export const SampleMatchFound: MatchFound = {
  id: 'dev-preview',
  format: 'singles',
  official: true,
  player: { name: 'Alex Vance', rating: 4.18, location: 'Austin, TX' },
  opponent: { name: 'J. Alvarez', rating: 4.2, location: 'Austin, TX', winStreak: 7 },
  searchRadiusMiles: 5,
  elapsedSeconds: 42,
  ratingsVerified: true,
  courtReady: true,
  autoCheckIn: true,
  winProbability: 0.51,
  ratingImpact: 0.038,
  venue: { name: 'Zilker Park Courts', distanceMiles: 1.4, driveMinutes: 5 },
  rules: { games: 3, pointsTo: 11, winBy: 2 },
};
