# backend (Supabase + Django)

Postgres + PostGIS + Realtime + Supabase edge functions, plus a Django
service (`django/`) running alongside them. Consumed by `frontend/` and
`mobile/`.

Auth is Clerk (see `mobile/CLAUDE.md`) — Supabase is configured as a
third-party auth consumer, verifying Clerk-issued JWTs for RLS rather than
issuing its own sessions.

## Structure

- `supabase/migrations/` — schema migrations. Any change to a shape defined
  in `shared/` (`Court`, `Tournament`, `RatingEntry`, `NewsItem`) needs a
  matching migration here, reviewed by the `schema-guardian` subagent.
- `functions/ratings/` — Glicko-2 rating updates. Follows
  `agent/skills/ratings-engine` conventions; this is the only place ratings
  get written.
- `functions/matchmaking/` — PostGIS radius queries for the mobile queue.
  Follows `agent/skills/geospatial-matching`.
- `functions/dupr-import/` — importing/reconciling DUPR ratings.
- `functions/whoop-oauth/` — WHOOP OAuth flow, token exchange/refresh for
  `agent/skills/health-integrations`.
- `django/` — a separate Django service. **Ownership boundary vs. the edge
  functions above is not yet decided** — see `django/CLAUDE.md`. Don't
  assume it owns a piece of logic without confirming; check there first
  before adding anything.

## Conventions

- Row shapes must match the Zod schemas in `shared/` — migrations and
  `shared/` change together, in the same PR.
- Edge functions are the only writers for ratings and match state; clients
  (web or mobile) never write those tables directly. `django/` follows
  the same rule until/unless its ownership boundary says otherwise.
- Realtime channels used for chat/presence are mobile-only — don't expose
  them to `frontend/`.
