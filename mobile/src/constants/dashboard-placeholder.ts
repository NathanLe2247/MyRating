import type { DashboardPlaceholder } from '@/types/dashboard';

// TODO: demo values until the courts/queue/matches tables and the rating
// history exist in Supabase — replace each piece as its table lands. Only the
// player's rating is real (see hooks/use-dashboard).
export const DashboardPlaceholderData: DashboardPlaceholder = {
  courts: 3,
  rating: {
    certified: true,
    location: 'Austin, TX',
    bracket: 'Advanced Comp',
    trend: 0.06,
    trendDays: 7,
    nextTier: { rating: 4.25, label: 'Semi-Pro' },
    target: { rating: 4.5, label: 'Elite Master', shortLabel: 'Elite' },
    progress: 0.64,
  },
  queue: {
    min: 4.1,
    max: 4.3,
    formats: ['singles', 'doubles'],
    activePlayers: 14,
    courts: 3,
    waitMinutes: 1.5,
  },
  recentMatches: [
    {
      id: '1',
      won: true,
      score: '11-8',
      title: 'Doubles · DUPR Rated',
      badge: 'Official',
      partner: 'Dave K.',
      opponents: ['Marcus T.', 'Elena R.'],
      venue: 'South Austin Tennis Center',
      when: 'Yesterday',
      ratingBefore: 4.14,
      ratingAfter: 4.18,
    },
    {
      id: '2',
      won: false,
      score: '9-11',
      title: 'Mixed Doubles',
      badge: 'DUPR',
      partner: 'Sarah B.',
      opponents: ['Jordan C.', 'Chloe M.'],
      venue: 'Zilker Park Courts',
      when: 'Oct 18',
      ratingBefore: 4.16,
      ratingAfter: 4.14,
    },
    {
      id: '3',
      won: true,
      score: '11-6',
      title: 'Doubles · DUPR Rated',
      partner: 'Travis N.',
      opponents: ['Leo W.', 'Sam P.'],
      venue: 'Austin Tennis Center',
      when: 'Oct 15',
      ratingBefore: 4.11,
      ratingAfter: 4.16,
    },
  ],
};
