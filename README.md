# myRating

A pickleball ranking system, taking cues from chess.com: skill ratings, leaderboards,
tournaments, local courts, and a community layer for finding matches.

## Structure

- [`frontend/`](frontend/) — Next.js web app: stats, leaderboards, tournaments/events,
  local courts, news/sales. Read-heavy, no queueing, chat, or health data.
- [`mobile/`](mobile/) — Expo/React Native app: full feature set, including match
  queueing, real-time community chat, and health integrations.
- [`backend/`](backend/) — Supabase project: database migrations and edge functions
  (ratings, matchmaking, DUPR import, WHOOP OAuth).
- [`shared/`](shared/) — Types, Zod schemas, and constants shared across all three
  apps (`Court`, `Tournament`, `RatingEntry`, `NewsItem`, etc.).
- [`agent/`](agent/) — Claude Code skills and subagents scoped to this repo's domains.
- [`.claude/`](.claude/) — Repo-level Claude Code configuration.

## Apps at a glance

| Feature | Frontend (web) | Mobile |
|---|---|---|
| Stats / leaderboards | ✅ | ✅ |
| Tournaments & events | ✅ | ✅ |
| Local courts | ✅ | ✅ |
| News / sales | ✅ | — |
| Match queueing | — | ✅ |
| Community chat / presence | — | ✅ |
| Health integrations (HealthKit, WHOOP) | — | ✅ |

## Ratings

Player skill is tracked with [Glicko-2](agent/skills/ratings-engine/) — see that
skill for the conventions used across the ratings engine and edge functions.
