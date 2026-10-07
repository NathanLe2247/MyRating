// Match formats a player can filter the home dashboard by, in tab order.
export const MatchFormats = ['doubles', 'singles', 'mixed'] as const;

export type MatchFormat = (typeof MatchFormats)[number];
