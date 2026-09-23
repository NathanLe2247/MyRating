# mobile (Expo / React Native)

The full-featured app: everything in `frontend/` plus match queueing,
community chat/presence, and health integrations.

## In scope

- Everything `frontend/` has (stats, leaderboards, tournaments, courts) minus
  news/sales.
- Match queueing via PostGIS radius queries — see
  `agent/skills/geospatial-matching`.
- Realtime community chat/presence via Supabase Realtime — see
  `agent/skills/community-realtime`.
- Health integrations: HealthKit + WHOOP OAuth — see
  `agent/skills/health-integrations`.

## Structure

- `app/` — Expo Router routes/screens only. A file here is a screen; it
  composes from `src/`, it doesn't define components, types, or logic inline.
- `src/components/` — reusable UI components shared across screens.
- `src/config/` — app config (env var access, client setup — e.g. the
  Supabase client instance, R2 public URL helpers).
- `src/constants/` — static constants (enums, magic strings/numbers, route
  names).
- `src/types/` — local types that aren't cross-app (cross-app shapes like
  `Court`/`Tournament`/`RatingEntry`/`NewsItem` still come from `shared/`).
- `src/providers/` — React context providers (Clerk session, theme, query
  client, realtime/presence context, etc.) — wired up in `app/_layout`.
- `src/hooks/` — reusable hooks (from the Expo template: `use-color-scheme`,
  `use-theme`; add to this, don't recreate it).

Import from `src/` using the `@/*` path alias (e.g. `@/components/themed-text`),
already configured in `tsconfig.json`.

`app/`, `assets/`, `package.json`, `app.json`, `tsconfig.json` came from
`create-expo-app`'s default (Expo Router) template — `app/index.tsx` and
`app/explore.tsx` are the template's placeholder screens, not real ones yet.

## Auth

Auth is Clerk, not Supabase Auth. Supabase is configured as a third-party
auth consumer (Clerk issues the JWT, Supabase RLS verifies it) — Supabase is
still the database/Realtime layer, just not the identity provider. The
Supabase client here is initialized with the Clerk session token, not
Supabase's own session.

## Conventions

- Import shared types/schemas from `shared/`, never redefine them locally.
- Anything writing ratings goes through the `ratings` edge function in
  `backend/functions/ratings/`, using `agent/skills/ratings-engine`
  conventions — never compute Glicko-2 client-side as the source of truth.
- OAuth tokens (WHOOP) and HealthKit data stay device-local or go through
  `backend/functions/whoop-oauth/`; never persist raw health credentials in
  `shared/` or client-visible tables.
