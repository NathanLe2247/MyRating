import type { ReactNode } from 'react';

import { MatchResultContext, useMatchResultController } from '@/hooks/use-match-result';

/**
 * Holds the result of the player's current match for the whole app (Home's
 * report card, Match Found's "You're on!" panel), so a score being entered,
 * a wait for confirmation and the final rating change carry across screens.
 * Needs `MatchmakingProvider` (and Clerk, React Query) above it.
 */
export function MatchResultProvider({ children }: { children: ReactNode }) {
  const value = useMatchResultController();
  return <MatchResultContext.Provider value={value}>{children}</MatchResultContext.Provider>;
}
