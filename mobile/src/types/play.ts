import type { BrandIconName } from '@/components/brand-icon';

// Display models for the Play tab's cards. These are what the cards render,
// not the domain shapes: once `Court` and `Tournament` land in `shared/`, a
// hook maps those records into these (formatting distance, picking tags).

export type VenueTagTone = 'default' | 'strong' | 'lime' | 'indoor';

export type VenueTag = {
  label: string;
  tone?: VenueTagTone;
  icon?: BrandIconName;
};

export type CourtCardData = {
  id: string;
  name: string;
  /** Already rounded for display, e.g. "1.2". */
  distanceMiles: string;
  neighborhood: string;
  courtCount: number;
  setting: 'outdoor' | 'indoor';
  /** Highlighted venue: lime count badge and accent bar. */
  featured?: boolean;
  verified?: boolean;
  /** Short line under the count badge, e.g. lighting hours or rating range. */
  note?: string;
  description?: string;
  photoUrl?: string;
  /** Live status over the photo, e.g. open play count. */
  photoCaption?: string;
  tags: VenueTag[];
  /** Venue's main action next to Directions; omit for directions only. */
  primaryAction?: 'checkIn' | 'book';
};

export type TournamentCardData = {
  id: string;
  name: string;
  /** ISO date-time the event starts. */
  startsAt: string;
  venue: string;
  /** Division or rating range, e.g. "DUPR 3.5 – 4.5". */
  division?: string;
  spotsLeft?: number;
};

export type PlayListings = {
  courts: CourtCardData[];
  tournaments: TournamentCardData[];
};
