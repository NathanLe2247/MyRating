import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

/** Bottom tab routes, in display order. Each name is a file in `app/(home)/`. */
export const AppTabNames = ['index', 'play', 'health', 'community'] as const;
export type AppTabName = (typeof AppTabNames)[number];

/** `href` for each tab (used by the web tab bar). */
export const AppTabHrefs = {
  index: '/',
  play: '/play',
  health: '/health',
  community: '/community',
} as const satisfies Record<AppTabName, string>;

/** iOS SF Symbol / Android Material Symbol for each tab. */
export const AppTabIcons = {
  index: { sf: 'bolt.fill', md: 'bolt' },
  play: { sf: 'figure.pickleball', md: 'sports_tennis' },
  health: { sf: 'heart.text.square', md: 'monitor_heart' },
  community: { sf: 'person.2', md: 'group' },
} as const satisfies Record<AppTabName, { sf: SFSymbol; md: AndroidSymbol }>;
