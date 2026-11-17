import type { CourtPhotoAttribution } from '@myrating/shared';

import type { BrandIconName } from '@/components/brand-icon';
import type { GeoPoint } from '@/constants/courts';

// Display models for the Play tab's cards. These are what the cards render,
// not the domain shapes: a hook maps shared records into these (formatting
// distance, picking tags). Courts: `useNearbyCourts` via
// `toCourtCardData` (src/utils/courts-format.ts). Tournaments: once
// `Tournament` lands in `shared/`.

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
  /** Where the court is; Directions is disabled without it. */
  location?: GeoPoint;
  /** Omitted while the shared `Court` shape has no address data. */
  neighborhood?: string;
  /** Omitted when unknown; the count badge is left out. */
  courtCount?: number;
  /** Omitted when unknown; renders in the default (outdoor) style. */
  setting?: 'outdoor' | 'indoor';
  /** Highlighted venue: lime count badge and accent bar. */
  featured?: boolean;
  verified?: boolean;
  /** Short line under the count badge, e.g. lighting hours or rating range. */
  note?: string;
  description?: string;
  /**
   * The court's Google Place ID. Only courts with one can have a photo, so
   * the photo is fetched only when it's set (`useCourtPhoto`).
   */
  googlePlaceId?: string;
  /**
   * Shown above the name. Held in memory only, never persisted (Google's
   * terms); a URL that fails to load hides the photo block.
   */
  photoUrl?: string;
  /** Required credits for `photoUrl` ("Photo: <author>"), shown under it. */
  photoAttributions?: CourtPhotoAttribution[];
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
  /** Venue's IANA time zone; the date shows in the device zone without it. */
  timeZone?: string;
  venue: string;
  /** Division or rating range, e.g. "DUPR 3.5 – 4.5". */
  division?: string;
  spotsLeft?: number;
};

/** What the courts list shows; see `useNearbyCourts`. */
export type NearbyCourtsState =
  /** Location permission not answered yet (the OS dialog may be up). */
  | { status: 'asking'; showDefaultArea: () => void }
  /** Location denied and the user hasn't chosen the default area. */
  | ({ status: 'denied'; showDefaultArea: () => void } & LocationAccess)
  | { status: 'loading' }
  | {
      status: 'error';
      retry: () => void;
      /** Set when the device position failed: list the default area instead. */
      showDefaultArea?: () => void;
    }
  | {
      status: 'loaded';
      /** Empty when no active court is within the radius. */
      courts: CourtCardData[];
      /**
       * Set when listing the default area because location was denied, so
       * the screen can name the area and offer to turn location on.
       */
      defaultArea?: LocationAccess;
    };

export type LocationAccess = {
  /** False once the OS won't show the dialog again; `requestPermission` opens Settings. */
  canAskAgain: boolean;
  requestPermission: () => void;
};

export type PlayListings = {
  tournaments: TournamentCardData[];
};
