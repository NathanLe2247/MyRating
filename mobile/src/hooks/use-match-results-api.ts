import {
  MATCH_RESULTS_ERRORS,
  type MatchGame,
  type MatchResultsError,
  type MatchResultsRequest,
  type MatchResultsState,
  MatchResultsStateSchema,
} from '@myrating/shared';
import { useMemo } from 'react';

import { useSupabaseClient } from '@/config/supabase';
import { MatchResultsFunction } from '@/constants/match-results';
import type { MatchResultsErrorCode } from '@/types/match-results';
import { edgeFunctionErrorCode } from '@/utils/edge-function-error';

export class MatchResultsApiError extends Error {
  constructor(readonly code: MatchResultsErrorCode) {
    super(code);
  }
}

const isMatchResultsError = (code: string | undefined): code is MatchResultsError =>
  (MATCH_RESULTS_ERRORS as readonly string[]).includes(code ?? '');

/** The code of anything a match-results call threw. */
export function matchResultsErrorCode(error: unknown): MatchResultsErrorCode {
  return error instanceof MatchResultsApiError ? error.code : 'network';
}

/**
 * Client for the `match-results` edge function (backend/supabase/functions/
 * match-results, contract in shared/src/match-results.ts), called the same
 * way as `useMatchmakingApi`. Every call resolves to the match's parsed
 * `MatchResultsState` or throws a `MatchResultsApiError`.
 */
export function useMatchResultsApi() {
  const supabase = useSupabaseClient();

  return useMemo(() => {
    const call = async (body: MatchResultsRequest): Promise<MatchResultsState> => {
      const { data, error } = await supabase.functions.invoke(MatchResultsFunction, { body });
      if (error) {
        const code = await edgeFunctionErrorCode(error);
        throw new MatchResultsApiError(isMatchResultsError(code) ? code : 'network');
      }
      const parsed = MatchResultsStateSchema.safeParse(data);
      if (!parsed.success) throw new MatchResultsApiError('network');
      return parsed.data;
    };

    return {
      state: (matchId: string) => call({ action: 'state', match_id: matchId }),
      submit: (matchId: string, games: MatchGame[]) => call({ action: 'submit', match_id: matchId, games }),
      confirm: (matchId: string) => call({ action: 'confirm', match_id: matchId }),
      dispute: (matchId: string) => call({ action: 'dispute', match_id: matchId }),
    };
  }, [supabase]);
}
