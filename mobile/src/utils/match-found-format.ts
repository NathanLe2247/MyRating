import { formatRating } from '@/utils/rating-format';

// Display helpers for the Match Found screen. Pure formatting — win
// probability and rating impact arrive already computed by the ratings engine.

/** Queue time as `mm:ss`, e.g. 42 → `00:42`, 754 → `12:34`. */
export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/** Rating gap between two players at rating precision, e.g. `0.02`; null if either is unrated. */
export function formatRatingGap(a: number | null, b: number | null): string | null {
  if (a === null || b === null) return null;
  return formatRating(Math.abs(a - b));
}

/** A 0–1 probability as a whole percent, clamped to 0–100. */
export function toPercent(probability: number): number {
  return Math.round(Math.min(1, Math.max(0, probability)) * 100);
}

/** Rating impact to three decimals, e.g. `0.038`. */
export function formatRatingImpact(impact: number): string {
  return Math.abs(impact).toFixed(3);
}

/** Distance in miles to one decimal, e.g. `1.4`. */
export function formatMiles(miles: number): string {
  return miles.toFixed(1);
}
