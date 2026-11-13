// View-model shapes for the Health tab. Health data is mobile-only and stays
// on the device (see agent/skills/health-integrations), so these live here,
// not in `shared/`.

import type { HealthProvider, ReadinessZone } from '@/constants/health';

export type Readiness = {
  /** Recovery score, 0–100. */
  score: number;
  /** Zone as reported by the provider (e.g. WHOOP's green/yellow/red). */
  zone: ReadinessZone;
  hrvMs: number;
  restingHeartRate: number;
  sleepMinutes: number;
  /** Sleep efficiency, 0–100. */
  sleepEfficiency: number;
};

export type CourtLoadDay = {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  courtMinutes: number;
};

export type CourtLoad = {
  /** The past 7 days, oldest first; the last entry is today. */
  days: CourtLoadDay[];
  matchesLogged: number;
  avgHeartRate: number;
  kcalPerMatch: number;
};

export type HealthSummary = {
  provider: HealthProvider;
  /** ISO timestamp of the last sync. */
  syncedAt: string;
  readiness: Readiness | null;
  courtLoad: CourtLoad | null;
};
