// Display helpers for ratings. A player's rating is shown to two decimals
// (e.g. 1512.40); a rating band's bounds as whole numbers (e.g. 1500).

export function formatRating(rating: number): string {
  return rating.toFixed(2);
}

/** One bound of a rating band (a group's range), as a whole number. */
export function formatRatingBand(bound: number): string {
  return Math.round(bound).toFixed(0);
}

/** Signed change, e.g. `+0.04` / `-0.02`. */
export function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : delta < 0 ? '-' : '';
  return `${sign}${Math.abs(delta).toFixed(2)}`;
}
