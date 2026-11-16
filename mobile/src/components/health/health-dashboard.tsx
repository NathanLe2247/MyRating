import { StyleSheet, View } from 'react-native';

import type { HealthProvider } from '@/constants/health';
import { Spacing } from '@/constants/theme';
import type { HealthSummary } from '@/types/health';

import { ConnectCard } from './connect-card';
import { CourtLoadCard } from './court-load-card';
import { HealthHeader } from './health-header';
import { ReadinessCard } from './readiness-card';
import { SampleDataNote } from './sample-data-note';
import { SyncBar } from './sync-bar';

type HealthDashboardProps = {
  /** null when no wearable is connected. */
  summary: HealthSummary | null;
  onConnect: (provider: HealthProvider) => void;
  /** A provider whose connection is in progress. */
  connecting?: HealthProvider | null;
  /** True when `summary` is dev-only sample data; labels it as such. */
  sample?: boolean;
  onDisconnect?: () => void;
};

// Health tab content: readiness and court load once a wearable is synced,
// otherwise an empty readiness card and the connect prompt.
export function HealthDashboard({
  summary,
  onConnect,
  connecting = null,
  sample = false,
  onDisconnect,
}: HealthDashboardProps) {
  return (
    <View style={styles.stack}>
      <HealthHeader />
      {summary && <SyncBar provider={summary.provider} syncedAt={summary.syncedAt} />}
      {summary && sample && <SampleDataNote provider={summary.provider} onDisconnect={onDisconnect} />}
      <ReadinessCard readiness={summary?.readiness ?? null} connected={summary !== null} />
      {summary?.courtLoad && <CourtLoadCard load={summary.courtLoad} />}
      {!summary && <ConnectCard onConnect={onConnect} connecting={connecting} />}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.three,
  },
});
