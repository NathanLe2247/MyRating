import type { MatchFormat } from '@/constants/match';

// View-model shapes for the home dashboard. These are screen-local — once
// matches/ratings have cross-app shapes in `shared/`, build these from those.

export type RatingSummary = {
  /** From `player_ratings.rating`; null until the player has a ratings row. */
  rating: number | null;
  certified: boolean;
  location: string;
  /** Skill bracket label, e.g. "Advanced Comp". */
  bracket: string;
  /** Rating change over `trendDays`. */
  trend: number;
  trendDays: number;
  /** Next tier boundary on the way to `target`. */
  nextTier: { rating: number; label: string };
  target: { rating: number; label: string; shortLabel: string };
  /** 0–1 progress toward `target`. */
  progress: number;
};

export type QueueSummary = {
  min: number;
  max: number;
  formats: MatchFormat[];
  activePlayers: number;
  courts: number;
  waitMinutes: number;
};

export type RecentMatch = {
  id: string;
  won: boolean;
  score: string;
  title: string;
  /** Small badge next to the title, e.g. "Official". */
  badge?: string;
  partner?: string;
  opponents: string[];
  venue: string;
  when: string;
  ratingBefore: number;
  ratingAfter: number;
};

export type Dashboard = {
  courts: number;
  rating: RatingSummary;
  queue: QueueSummary;
  recentMatches: RecentMatch[];
};

/**
 * Values with no Supabase table behind them yet. They live in `DashboardPlaceholderData`
 * until the matches/queue/courts tables exist.
 */
export type DashboardPlaceholder = Omit<Dashboard, 'rating'> & {
  rating: Omit<RatingSummary, 'rating'>;
};
