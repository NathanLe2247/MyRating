// Mobile-only onboarding UI state. Cross-app shapes (`DominantHand`,
// `RatingSource`, `PlayerProfile`, ...) come from `@myrating/shared`.
import type { DominantHand } from '@myrating/shared';

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
