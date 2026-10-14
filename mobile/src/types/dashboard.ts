// View-model shapes for the home dashboard. These are screen-local — once
// matches/ratings have cross-app shapes in `shared/`, build these from those.

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
  /** From `player_ratings.rating`; null while the player is still calibrating. */
  rating: number | null;
  recentMatches: RecentMatch[];
};
