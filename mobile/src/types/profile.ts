// Mirrors public.rating_source.
export type RatingSource = 'dupr' | 'usa_pickleball' | 'calibration';

// Mirrors public.dominant_hand.
export type DominantHand = 'left' | 'ambi' | 'right';

/** A photo picked on-device, not yet uploaded. */
export type PickedAvatar = {
  uri: string;
  contentType: string;
};

/** Body of `POST /player-profile` (minus the avatar, which is uploaded first). */
export type PlayerProfileInput = {
  username: string;
  dateOfBirth: string;
  dominantHand: DominantHand;
};

export type UsernameStatus = 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'error';
