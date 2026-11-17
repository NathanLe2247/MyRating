import { CloseSkillMatchMaxGap } from '@/constants/match';
import { en } from '@/i18n/en';
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

/**
 * The pairing line under "Match found!": "Close skill match" only within
 * `CloseSkillMatchMaxGap`, a plain gap beyond it, or the calibrating copy
 * while either player is unrated.
 */
export function pairingSubtitle(a: number | null, b: number | null): string {
  const t = en.matchFound;
  if (a === null || b === null) return t.parityCalibrating;
  const gap = Math.abs(a - b);
  const label = formatRating(gap);
  return gap <= CloseSkillMatchMaxGap ? t.closeMatch(label) : t.ratingGap(label);
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
