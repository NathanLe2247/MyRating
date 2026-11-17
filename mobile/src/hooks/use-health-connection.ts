import { useCallback, useEffect, useRef, useState } from 'react';

import { DemoHealthConnectMs, demoHealthSummary } from '@/constants/demo-data';
import { DevPreviews } from '@/constants/dev-previews';
import type { HealthProvider } from '@/constants/health';
import type { HealthSummary } from '@/types/health';

export type HealthConnection = {
  /** null when no wearable is connected. */
  summary: HealthSummary | null;
  /** The provider whose connection is in progress, if any. */
  connecting: HealthProvider | null;
  /** True when `summary` is dev-only sample data, not a real device's. */
  sample: boolean;
  connect: (provider: HealthProvider) => void;
  /** Present only when the current connection can be undone. */
  disconnect?: () => void;
};

/**
 * The Health tab's wearable connection.
 *
 * TODO: wire up HealthKit (iOS) and WHOOP OAuth (whoop-oauth edge function).
 * Until then there's no data source: `connect` does nothing and the tab
 * shows "not connected". The one exception is the dev-only demo
 * (`DevPreviews.demoData()`, always off in production builds): tapping Apple
 * Health simulates a connection with in-memory sample data from
 * `src/constants/demo-data.ts` — no HealthKit APIs, permissions or storage —
 * and `disconnect` resets it so the demo can be replayed.
 */
export function useHealthConnection(): HealthConnection {
  const demo = DevPreviews.demoData();
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [connecting, setConnecting] = useState<HealthProvider | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const connect = useCallback(
    (provider: HealthProvider) => {
      if (!demo || provider !== 'apple_health' || timer.current) return;
      setConnecting(provider);
      timer.current = setTimeout(() => {
        timer.current = undefined;
        setConnecting(null);
        setSummary(demoHealthSummary(new Date()));
      }, DemoHealthConnectMs);
    },
    [demo],
  );

  const disconnect = useCallback(() => setSummary(null), []);

  return {
    summary,
    connecting,
    sample: demo && summary !== null,
    connect,
    disconnect: demo && summary ? disconnect : undefined,
  };
}
