import type { MatchFormat } from '@/constants/match';

// View-model for the Match Found screen. Screen-local until matchmaking has a
// cross-app shape in `shared/`; build this from that once it exists. Optional
// fields are ones matchmaking may not provide — the screen hides them or shows
// an empty state rather than inventing a value.

export type MatchFoundPlayer = {
  name: string;
  /** Null while the player is still calibrating. */
  rating: number | null;
  /** City shown under the rating, e.g. "Austin, TX". */
  location?: string;
  avatarUrl?: string;
  /** Current win streak; shown as a badge when it's `MinStreakBadge` or more. */
  winStreak?: number;
};

export type MatchFoundVenue = {
  name: string;
  distanceMiles: number;
  driveMinutes?: number;
};

export type MatchFoundRules = {
  /** Number of games in the series, e.g. 3 for best 2 of 3. */
  games: number;
  pointsTo: number;
  winBy: number;
};

export type MatchFound = {
  id: string;
  format: MatchFormat;
  /** Counts toward the official rating. */
  official: boolean;
  player: MatchFoundPlayer;
  opponent: MatchFoundPlayer;
  /** Queue search radius, in miles. */
  searchRadiusMiles: number;
  /** Seconds spent in the queue before the pairing. */
  elapsedSeconds: number;
  /** Both players' ratings are verified. */
  ratingsVerified?: boolean;
  /** The venue has a court confirmed for this match. */
  courtReady?: boolean;
  autoCheckIn?: boolean;
  /**
   * The player's win probability (0–1), from the ratings engine. Never
   * computed on the client.
   */
  winProbability?: number;
  /** Largest rating change either way this match can produce, from the ratings engine. */
  ratingImpact?: number;
  venue?: MatchFoundVenue;
  rules?: MatchFoundRules;
};
