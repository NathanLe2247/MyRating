# myRating

Pickleball ranking system (chess.com-style rating, leaderboards, tournaments,
courts, and community) split into three apps sharing one backend and one
types package.

## Repo map

- `frontend/` — Next.js web app. Stats/leaderboards/tournaments/courts/news.
  No queue, no chat, no health data. See `frontend/CLAUDE.md`.
- `mobile/` — Expo/React Native app. Full feature set. See `mobile/CLAUDE.md`.
- `backend/` — Supabase (Postgres + PostGIS + Realtime) and edge functions,
  plus a Django service (`backend/django/`, ownership boundary vs. edge
  functions still TBD). See `backend/CLAUDE.md`.
- `shared/` — Cross-app types, Zod schemas, constants. See `shared/CLAUDE.md`.
- `agent/skills/` — Domain conventions (ratings math, geospatial queries,
  realtime patterns, health OAuth, courts data shape, content feed reads).
- `agent/agents/` — Subagents for this repo: `code-reviewer`, `schema-guardian`.

## Working across apps

- Auth is Clerk, not Supabase Auth — Supabase is a third-party auth
  consumer (verifies Clerk-issued JWTs for RLS), not the identity provider.
- Anything touching `RatingEntry`, `Court`, `Tournament`, or `NewsItem` shapes
  starts in `shared/` — both apps and the backend import from there, never
  redefine locally.
- Mobile-only concerns (queueing, chat/presence, HealthKit/WHOOP) must not
  leak into `frontend/` — if a feature needs them, it belongs in mobile.
- Ratings math (Glicko-2) lives in one place per `agent/skills/ratings-engine`;
  don't reimplement it in an edge function or client.
