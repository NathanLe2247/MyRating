import { en } from '@/i18n/en';
import type { MatchmakingErrorCode } from '@/types/matchmaking';

/** User-facing copy for a failed matchmaking call. */
export function matchmakingErrorMessage(code: MatchmakingErrorCode): string {
  return en.matchmaking.errors[code];
}
