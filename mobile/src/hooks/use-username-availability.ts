import { useEffect, useState } from 'react';

import { UsernameCheckDebounceMs, UsernamePattern } from '@/constants/profile';
import { usePlayerProfileApi } from '@/hooks/use-player-profile-api';
import type { UsernameStatus } from '@/types/profile';

type CheckResult = { username: string; status: UsernameStatus };

/**
 * Debounced "is this handle free?" check. Status is derived from the latest
 * result, so a stale answer for a previous value reads as `checking`.
 */
export function useUsernameAvailability(username: string): UsernameStatus {
  const api = usePlayerProfileApi();
  const [result, setResult] = useState<CheckResult | null>(null);
  const valid = UsernamePattern.test(username);

  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      let status: UsernameStatus;
      try {
        status = (await api.isUsernameAvailable(username)) ? 'available' : 'taken';
      } catch {
        status = 'error';
      }
      if (!cancelled) setResult({ username, status });
    }, UsernameCheckDebounceMs);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [api, username, valid]);

  if (!username) return 'idle';
  if (!valid) return 'invalid';
  return result?.username === username ? result.status : 'checking';
}
