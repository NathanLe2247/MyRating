// Display helpers for ratings. Ratings are shown to two decimals (e.g. 4.18).

export function formatRating(rating: number): string {
  return rating.toFixed(2);
}

/** Signed change, e.g. `+0.04` / `-0.02`. */
export function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
  return `${sign}${Math.abs(delta).toFixed(2)}`;
}
