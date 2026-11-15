import type { ReactNode } from 'react';

import { MatchmakingContext, useMatchmakingController } from '@/hooks/use-matchmaking';

/**
 * Holds the player's match queue state for the whole app (Home's queue card,
 * Match Found), so a search keeps polling while the player moves between
 * screens. Needs Clerk and React Query above it; idle until signed in and
 * onboarded.
 */
export function MatchmakingProvider({ children }: { children: ReactNode }) {
  const value = useMatchmakingController();
  return <MatchmakingContext.Provider value={value}>{children}</MatchmakingContext.Provider>;
}
