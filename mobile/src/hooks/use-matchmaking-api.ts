import {
  MATCHMAKING_ERRORS,
  type MatchmakingError,
  type MatchmakingRequest,
  type MatchmakingState,
  MatchmakingStateSchema,
} from '@myrating/shared';
import { useMemo } from 'react';

import { useSupabaseClient } from '@/config/supabase';
import type { GeoPoint } from '@/constants/courts';
import { MatchmakingFunction } from '@/constants/matchmaking';
import type { MatchmakingErrorCode } from '@/types/matchmaking';
import { edgeFunctionErrorCode } from '@/utils/edge-function-error';

export class MatchmakingApiError extends Error {
  constructor(readonly code: MatchmakingErrorCode) {
    super(code);
  }
}

const isMatchmakingError = (code: string | undefined): code is MatchmakingError =>
  (MATCHMAKING_ERRORS as readonly string[]).includes(code ?? '');

/** The code of anything a matchmaking action threw. */
export function matchmakingErrorCode(error: unknown): MatchmakingErrorCode {
  return error instanceof MatchmakingApiError ? error.code : 'network';
}

/**
 * Client for the `matchmaking` edge function (backend/supabase/functions/
 * matchmaking, contract in shared/src/matchmaking.ts). The Supabase client
 * sends the Clerk session token, which the function verifies. Every call
 * resolves to the player's parsed `MatchmakingState` or throws a
 * `MatchmakingApiError`.
 */
export function useMatchmakingApi() {
  const supabase = useSupabaseClient();

  return useMemo(() => {
    const call = async (body: MatchmakingRequest): Promise<MatchmakingState> => {
      const { data, error } = await supabase.functions.invoke(MatchmakingFunction, { body });
      if (error) {
        const code = await edgeFunctionErrorCode(error);
        throw new MatchmakingApiError(isMatchmakingError(code) ? code : 'network');
      }
      const parsed = MatchmakingStateSchema.safeParse(data);
      if (!parsed.success) throw new MatchmakingApiError('network');
      return parsed.data;
    };

    return {
      join: (origin: GeoPoint, radiusM: number) =>
        call({ action: 'join', lat: origin.lat, lng: origin.lng, radius_m: radiusM }),
      poll: () => call({ action: 'poll' }),
      leave: () => call({ action: 'leave' }),
      accept: (matchId: string) => call({ action: 'accept', match_id: matchId }),
      decline: (matchId: string) => call({ action: 'decline', match_id: matchId }),
    };
  }, [supabase]);
}
