// View-model shapes for the home dashboard. The rating comes from the shared
// `PlayerRatingSummary`; `RecentMatch` stays screen-local until matches have a
// cross-app shape in `shared/`.
import type { PlayerRatingSummary } from '@myrating/shared';

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
  /**
   * The shared `PlayerRatingSummary.rating`: null while the player is still
   * calibrating. Undefined (mobile-only) when it couldn't be loaded or parsed;
   * don't show that as calibrating.
   */
  rating: PlayerRatingSummary['rating'] | undefined;
  recentMatches: RecentMatch[];
};
