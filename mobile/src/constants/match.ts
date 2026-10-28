// Match formats a player can filter the home dashboard by, in tab order.
export const MatchFormats = ['doubles', 'singles', 'mixed'] as const;

export type MatchFormat = (typeof MatchFormats)[number];

/** Smallest win streak worth a badge on the Match Found screen. */
export const MinStreakBadge = 2;

/**
 * A pairing reads as an "even matchup" when the player's win probability is
 * within this of 50%.
 */
export const EvenMatchupMargin = 0.05;

/** Route of the Match Found screen; the match is passed as JSON in the `match` param. */
export const MatchFoundRoute = '/match/found';
