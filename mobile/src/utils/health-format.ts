// Display helpers for the Health tab.

import { en } from '@/i18n/en';

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MS_PER_MINUTE = 60_000;

/** Minutes as hours + minutes, e.g. `8h 12m`, `45m`. */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  return hours > 0 ? en.health.units.hoursMinutes(hours, rest) : en.health.units.minutes(rest);
}

/** How long ago a sync happened, e.g. `12m ago`. */
export function formatSyncedAgo(syncedAt: string, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - new Date(syncedAt).getTime()) / MS_PER_MINUTE);
  const copy = en.health.sync;
  if (minutes < 1) return copy.justNow;
  if (minutes < MINUTES_PER_HOUR) return copy.minutesAgo(minutes);
  if (minutes < MINUTES_PER_DAY) return copy.hoursAgo(Math.floor(minutes / MINUTES_PER_HOUR));
  return copy.daysAgo(Math.floor(minutes / MINUTES_PER_DAY));
}

/** Single-letter weekday for a chart label, from an ISO date (YYYY-MM-DD). */
export function weekdayInitial(isoDate: string): string {
  // Parse as UTC so the weekday doesn't shift with the device's time zone.
  const day = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return en.health.courtLoad.weekdays[day];
}
