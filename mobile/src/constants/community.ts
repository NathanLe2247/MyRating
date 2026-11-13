// Community tab constants.

/** The two halves of the Community tab, in switcher order. */
export const CommunitySections = ['mine', 'discover'] as const;

export type CommunitySection = (typeof CommunitySections)[number];

/** Wait this long after the last keystroke before searching groups. */
export const DiscoverSearchDebounceMs = 300;
