// DEV-ONLY SAMPLE DATA. Never shown to real users.
//
// Read only behind `DevPreviews.demoData()` (`src/constants/dev-previews.ts`),
// which is false in production builds and off by default in dev. It exists so
// a demo recording can show the Community and Health tabs before groups, chat
// and HealthKit have a backend. Every person here is fictional; group names
// borrow public court names from the courts seed.

import type { ChatItem, CommunityGroup, DiscoverGroup } from '@/types/community';
import type { HealthSummary } from '@/types/health';

/** How long the simulated Apple Health connection "connects" for. */
export const DemoHealthConnectMs = 1200;

/** How long ago the simulated wearable last synced. */
const DEMO_SYNC_AGE_MS = 4 * 60_000;

const MS_PER_DAY = 24 * 60 * 60_000;

const columbia: DiscoverGroup = {
  id: 'demo-columbia-regulars',
  name: 'Columbia Local Park Regulars',
  memberCount: 42,
  onlineCount: 6,
  area: 'Burtonsville MD',
  verified: true,
  ratingRange: { min: 1500, max: 1700 },
  courts: 'Columbia Local Park',
  schedule: 'Weeknights 6 PM drop-in',
  tags: ['Friendly', 'Drop-in'],
};

const goodHope: DiscoverGroup = {
  id: 'demo-good-hope-morning',
  name: 'Good Hope Morning Crew',
  memberCount: 27,
  onlineCount: 3,
  area: 'Silver Spring MD',
  ratingRange: { min: 1400, max: 1600 },
  courts: 'Good Hope Local Park',
  schedule: 'Daily 7 AM sunrise sessions',
  tags: ['Early birds', 'Skill building'],
};

const cloverly: DiscoverGroup = {
  id: 'demo-cloverly-pickleball',
  name: 'Cloverly Park Pickleball',
  memberCount: 35,
  onlineCount: 4,
  area: 'Silver Spring MD',
  ratingRange: { min: 1500, max: 1800 },
  courts: 'Cloverly Local Park',
  schedule: 'Weekend round robins',
  tags: ['Round robin', 'Social'],
};

const kitchenKings: DiscoverGroup = {
  id: 'demo-kitchen-kings',
  name: 'Kitchen Kings — 1800+ Invite Only',
  memberCount: 12,
  onlineCount: 2,
  area: 'Montgomery County MD',
  verified: true,
  ratingRange: { min: 1800, max: null },
  courts: 'Columbia Local Park · Cloverly Local Park',
  schedule: 'Tue & Thu rated king-of-the-court',
  tags: ['Invite only', 'Private', 'Competitive'],
};

const silverDinks: DiscoverGroup = {
  id: 'demo-silver-dinks',
  name: 'Silver Dinks Open Play (50+)',
  memberCount: 58,
  onlineCount: 5,
  area: 'Silver Spring MD',
  ratingRange: { min: 1300, max: 1700 },
  courts: 'Good Hope Local Park',
  schedule: 'Mon, Wed & Fri 9 AM open play',
  tags: ['Open play', 'All levels welcome', '50+'],
};

const DEMO_GROUPS: DiscoverGroup[] = [columbia, goodHope, cloverly, kitchenKings, silverDinks];

/** Joined groups (My communities). */
export const DemoCommunityGroups: CommunityGroup[] = DEMO_GROUPS.map(
  ({ id, name, memberCount, onlineCount, area, verified }) => ({
    id,
    name,
    memberCount,
    onlineCount,
    area,
    verified,
  }),
);

/** Discover & search recommendations; filtered by the search query. */
export const DemoDiscoverGroups: DiscoverGroup[] = [kitchenKings, silverDinks, cloverly, goodHope, columbia];

/** Chat (messages and open challenges) per demo group id. */
export const DemoGroupChats: Record<string, ChatItem[]> = {
  [columbia.id]: [
    { kind: 'divider', id: 'col-d1', label: 'Today · Columbia Local Park active' },
    {
      kind: 'text',
      id: 'col-m1',
      author: { name: 'Marcy Tellwood', rating: 1621.48, online: true },
      sentAt: '5:02 PM',
      body: 'Courts 2 and 3 are open, nets are up. Who’s coming tonight?',
      reactions: [{ emoji: '🙌', count: 5 }],
    },
    {
      kind: 'text',
      id: 'col-m2',
      author: { name: 'Dev Okonkwo-Ray', rating: 1583.12, online: true },
      sentAt: '5:06 PM',
      body: 'On my way, bringing the new outdoor balls.',
    },
    {
      kind: 'challenge',
      id: 'col-c1',
      challenger: { name: 'Marcy Tellwood', rating: 1621.48, online: true },
      court: 'Columbia Local Park · Court 2',
      startsAt: 'Today 6:15 PM',
      rated: true,
    },
    {
      kind: 'text',
      id: 'col-m3',
      author: { name: 'Lou Brannigan', rating: null },
      sentAt: '5:11 PM',
      body: 'First time out here. Is there a paddle rack system?',
    },
    {
      kind: 'text',
      id: 'col-m4',
      author: { name: 'Marcy Tellwood', rating: 1621.48, online: true },
      sentAt: '5:12 PM',
      body: 'Yep, paddles in the rack by the gate. Next four up play.',
      reactions: [{ emoji: '👍', count: 3 }],
    },
  ],
  [goodHope.id]: [
    { kind: 'divider', id: 'gh-d1', label: 'Today · Good Hope Local Park' },
    {
      kind: 'text',
      id: 'gh-m1',
      author: { name: 'Rosa Quintanar', rating: 1522.9, online: true },
      sentAt: '6:48 AM',
      body: 'Light frost on court 1, court 2 is dry. Starting at 7 sharp.',
    },
    {
      kind: 'text',
      id: 'gh-m2',
      author: { name: 'Hal Pemberton', rating: 1478.35 },
      sentAt: '6:52 AM',
      body: 'Coffee’s on me after. Drilling third-shot drops today?',
      reactions: [{ emoji: '☕', count: 4 }],
    },
    {
      kind: 'challenge',
      id: 'gh-c1',
      challenger: { name: 'Rosa Quintanar', rating: 1522.9, online: true },
      court: 'Good Hope Local Park · Court 2',
      startsAt: 'Today 7:30 AM',
      rated: false,
    },
  ],
  [cloverly.id]: [
    { kind: 'divider', id: 'clo-d1', label: 'Saturday round robin' },
    {
      kind: 'text',
      id: 'clo-m1',
      author: { name: 'Tamsin Achebe-Lowe', rating: 1664.07, online: true },
      sentAt: '9:14 AM',
      body: 'Round robin sheet is posted. 16 signed up so far, 4 spots left.',
      reactions: [{ emoji: '🔥', count: 6 }],
    },
    {
      kind: 'text',
      id: 'clo-m2',
      author: { name: 'Benji Faraday', rating: 1561.6 },
      sentAt: '9:20 AM',
      body: 'Put me down with Priya if she’s still looking for a partner.',
    },
    {
      kind: 'text',
      id: 'clo-m3',
      author: { name: 'Priya Vandersloot', rating: 1598.24, online: true },
      sentAt: '9:22 AM',
      body: 'Still looking. We’re in!',
    },
  ],
  [kitchenKings.id]: [
    { kind: 'divider', id: 'kk-d1', label: 'Tonight · Rated session' },
    {
      kind: 'text',
      id: 'kk-m1',
      author: { name: 'Corwin Strand', rating: 1886.51, online: true },
      sentAt: '4:40 PM',
      body: 'Reminder: rated games only, 1800 floor. Bring your A game.',
    },
    {
      kind: 'challenge',
      id: 'kk-c1',
      challenger: { name: 'Corwin Strand', rating: 1886.51, online: true },
      court: 'Cloverly Local Park · Court 1',
      startsAt: 'Today 7:00 PM',
      rated: true,
    },
    {
      kind: 'text',
      id: 'kk-m2',
      author: { name: 'Ines Halvorsen', rating: 1842.18 },
      sentAt: '4:45 PM',
      body: 'I’ll take that. Loser buys the grip tape.',
      reactions: [{ emoji: '⚡', count: 7 }],
    },
  ],
  [silverDinks.id]: [
    { kind: 'divider', id: 'sd-d1', label: 'Today · Open play 9 AM' },
    {
      kind: 'text',
      id: 'sd-m1',
      author: { name: 'Gloria Fenwick', rating: 1459.73, online: true },
      sentAt: '8:31 AM',
      body: 'Good morning dinkers! Beginners welcome, we have loaner paddles.',
      reactions: [{ emoji: '❤️', count: 9 }],
    },
    {
      kind: 'text',
      id: 'sd-m2',
      author: { name: 'Walt Ashby', rating: 1540.66 },
      sentAt: '8:35 AM',
      body: 'Knee’s feeling better, I’ll be there for a few games.',
    },
    {
      kind: 'challenge',
      id: 'sd-c1',
      challenger: { name: 'Gloria Fenwick', rating: 1459.73, online: true },
      court: 'Good Hope Local Park · Court 3',
      startsAt: 'Today 9:30 AM',
      rated: false,
    },
  ],
};

/** Daily court minutes for the past 7 days, oldest first (the last is today). */
const DEMO_COURT_MINUTES = [55, 90, 0, 75, 60, 110, 40];

/**
 * A believable Apple Health summary for the simulated connection, dated
 * relative to `now` so the sync bar and court-load chart read as current.
 */
export function demoHealthSummary(now: Date): HealthSummary {
  const today = now.getTime();
  return {
    provider: 'apple_health',
    syncedAt: new Date(today - DEMO_SYNC_AGE_MS).toISOString(),
    readiness: {
      score: 82,
      zone: 'optimal',
      hrvMs: 64,
      restingHeartRate: 52,
      sleepMinutes: 461,
      sleepEfficiency: 90,
    },
    courtLoad: {
      days: DEMO_COURT_MINUTES.map((courtMinutes, i) => ({
        date: new Date(today - (DEMO_COURT_MINUTES.length - 1 - i) * MS_PER_DAY)
          .toISOString()
          .slice(0, 10),
        courtMinutes,
      })),
      matchesLogged: 9,
      avgHeartRate: 138,
      kcalPerMatch: 410,
    },
  };
}
