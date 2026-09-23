# frontend (Next.js)

The public/marketing-adjacent web app: player stats, leaderboards,
tournaments/events, local courts, news/sales.

## In scope

- Stats and leaderboard views (reads from `RatingEntry` via `shared/`).
- Tournament/event listings and detail pages.
- Local courts directory (reads `Court` shape from `agent/skills/courts-catalog`).
- News/sales content feed (`agent/skills/content-feed`).

## Out of scope — do not add here

- Match queueing (mobile-only, geospatial matching).
- Realtime chat/presence (mobile-only, Supabase Realtime).
- Health integrations (HealthKit, WHOOP — mobile-only).

If a feature needs any of the above, it belongs in `mobile/`, not here.

## Conventions

- Import shared types/schemas from `shared/`, never redefine `Court`,
  `Tournament`, `RatingEntry`, or `NewsItem` locally.
- Data fetching favors server components / read-only queries; this app does
  not write ratings or match data directly — that goes through backend
  functions.
