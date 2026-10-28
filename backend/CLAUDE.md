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
- `supabase/functions/ratings/` — Glicko-2 rating updates. Follows
  `agent/skills/ratings-engine` conventions; this is the only place ratings
  get written.
- `supabase/functions/matchmaking/` — PostGIS radius queries for the mobile queue.
  Follows `agent/skills/geospatial-matching`.
- `supabase/functions/dupr-import/` — importing/reconciling DUPR ratings.
- `supabase/functions/whoop-oauth/` — WHOOP OAuth flow, token exchange/refresh for
  `agent/skills/health-integrations`.
- `supabase/functions/player-profile/` — onboarding step 1: username
  availability, R2 avatar upload URLs, and saving the profile to
  `public.users` (plus Clerk `publicMetadata.profileCompletedAt`, which gates
  onboarding in the app). Verifies Clerk tokens itself (`verify_jwt = false`).
- `supabase/functions/clerk-webhook/` — mirrors Clerk-owned fields (names,
  email, phone, `login_method`) into `public.users` on user.created/updated,
  and deletes the row on user.deleted. Svix-signature verified
  (`verify_jwt = false`). Never writes player-entered fields.
- `supabase/functions/_shared/` — helpers imported by more than one function.
- `django/` — a separate Django service. **Ownership boundary vs. the edge
  functions above is not yet decided** — see `django/CLAUDE.md`. Don't
  assume it owns a piece of logic without confirming; check there first
  before adding anything.

## Deploying

Merging to `main` deploys the hosted Supabase project via
`.github/workflows/deploy-supabase.yml`: `supabase db push` for new
migrations, then every edge function with an `index.ts`. Don't deploy by hand
from a feature branch — that's how the hosted project drifted from `main`
before. To redeploy without a code change, run the workflow manually
(Actions → Deploy Supabase → Run workflow).

## Conventions

- Row shapes must match the Zod schemas in `shared/` — migrations and
  `shared/` change together, in the same PR.
- Edge functions are the only writers for ratings and match state; clients
  (web or mobile) never write those tables directly. `django/` follows
  the same rule until/unless its ownership boundary says otherwise.
- Realtime channels used for chat/presence are mobile-only — don't expose
  them to `frontend/`.
