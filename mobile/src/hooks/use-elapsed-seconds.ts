import { useEffect, useState } from 'react';

const TickMs = 1000;

/**
 * Whole seconds since the ISO timestamp `since`, ticking every second; 0
 * without one. Clamped at 0, since `since` may come from the server's clock.
 */
export function useElapsedSeconds(since: string | undefined): number {
  const start = since ? Date.parse(since) : NaN;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (Number.isNaN(start)) return;
    const id = setInterval(() => setNow(Date.now()), TickMs);
    return () => clearInterval(id);
  }, [start]);

  return Number.isNaN(start) ? 0 : Math.max(0, Math.floor((now - start) / 1000));
}
