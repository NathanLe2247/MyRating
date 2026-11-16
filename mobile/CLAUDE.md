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
`create-expo-app`'s default (Expo Router) template. The template's placeholder
screens are gone; `app/(home)/` holds the tab screens.

### Route groups and signed-out access

- `app/(public)/` — the only screens that work without an account. Today
  that's `courts.tsx` ("Courts near you", `/courts`), which reads courts with
  the anon key via `useNearbyCourts`. Its layout sends signed-in players to
  Play, which shows the same list.
- `app/(auth)/` — sign-up, sign-in, forgot password. Signed-in users are
  sent to `/`.
- `app/(home)/` (tabs), `app/match/`, `app/onboarding/` — need an account.
  The tab and match layouts use `useSignedInGate` (`src/hooks/use-route-gate.ts`):
  signed out, `/` redirects to `/courts` and every other route to sign-up
  (`signedOutRedirect` in `src/constants/routes.ts`); signed in, onboarding
  is enforced. Gate in the layout, before any screen renders, so no user or
  rating data reaches a signed-out session.
- A new public screen goes in `(public)/` and must only read data the anon
  key can see. Anything else goes behind the signed-in gate.
- Demo location: set `EXPO_PUBLIC_DEMO_LAT` / `EXPO_PUBLIC_DEMO_LNG` (see
  `.env.example`, `src/config/demo-location.ts`; real values go in
  `.env.local` only) and `useNearbyCourts` uses that point as the user's
  location. `useLocationPermission` then never prompts or reports a denial,
  so no screen (Home included) asks for location or reads GPS.

### Match queue (matchmaking)

- The queue → Match Found flow calls the `matchmaking` edge function (contract
  in `shared/src/matchmaking.ts`, conventions in
  `agent/skills/geospatial-matching`) through `useMatchmakingApi`
  (`src/hooks/use-matchmaking-api.ts`): `supabase.functions.invoke` with the
  Clerk token, every 200 parsed with `MatchmakingStateSchema`, failures
  thrown as `MatchmakingApiError` with the function's code, `network`, or
  `location_unavailable`. Copy for every code is `en.matchmaking.errors`.
- State is shared app-wide by `MatchmakingProvider` (root `_layout`), read
  with `useMatchmaking()` (`src/hooks/use-matchmaking.ts`). It's one React
  Query entry (`['matchmaking', userId]`) that polls every
  `MatchmakingPollMs` while `searching`, `proposed` or
  `waiting_for_opponent`, every `MatchmakingOpenMatchPollMs` (slower) while
  the match is `accepted` or `awaiting_confirmation` (so the opponent's
  cancel or score report shows up), and is idle otherwise
  (`pollIntervalMs` in `src/utils/matchmaking-state.ts`); it only runs once
  the player is signed in and onboarded. Actions (`join`, `leave`, `accept`, `decline`
  — which requeues) write their returned state into that entry.
  `match_open` / `match_pending` aren't errors: the state is re-read and the
  open match is shown. Phases and the Match Found view model are pure
  helpers in `src/utils/matchmaking-state.ts`.
- No Realtime yet (Clerk third-party auth isn't on in hosted Supabase, so
  RLS-filtered events wouldn't arrive). To add it, subscribe to
  `public.matches` in the provider and call `refresh()` on each event; keep
  the poll as the fallback.
- Join location: `demoLocation()` when set, else one GPS read
  (`currentPositionQuery`, shared with the courts list); radius
  `QueueRadiusMeters` (`src/constants/matchmaking.ts`).
- Home's queue card (`useQueueCard`) shows Find a match → searching (timer,
  Leave) → the pairing, and opens `/match/found` once per new proposal.
  `app/match/found.tsx` (`useMatchFoundScreen`) shows the live match:
  Accept / Decline / Leave while proposed, then the "match on" panel
  (`MatchOnPanel`): view phase `'on'` for `accepted`, with Cancel match, and
  `'reported'` for `awaiting_confirmation`, with no Cancel —
  `matchmaking_leave` only cancels `proposed` or unreported `accepted`
  matches, so offering it after a report would leave the match open. The
  score report goes in that panel via `MatchFoundView`'s `matchOnContent`.
- Test builders for function states live in `src/test-utils/matchmaking.ts`
  (outside `__tests__/` so Jest doesn't run them as tests).

### Opening other apps

- Links out to another app (maps, for now) are built in `src/utils/`
  (`courtDirectionsUrl` in `src/utils/maps.ts`) with base URLs in
  `src/constants/`, and opened with `Linking.openURL`. Prefer https
  universal links (`maps.apple.com`, Google Maps URLs) over custom schemes
  (`maps://`, `geo:`): they work on iOS, Android and web without a
  `canOpenURL` allow-list in `app.json`.
- A court card's Directions button opens maps from `CourtCardData.location`
  itself; it's disabled only when a court has no coordinates.

## Testing

Jest via `jest-expo` with React Native Testing Library. `npm test` runs it;
`npm run typecheck` runs `tsc --noEmit`.

- Tests go in a `__tests__/` folder next to the code
  (`src/hooks/__tests__/use-foo.test.ts`). **Never under `app/`**: Expo
  Router turns every file there into a route. Jest only looks in `src/`.
- Test logic that matters (rating display, phone parsing, onboarding rules)
  and component behavior (what's on screen, what a tap does). Query by role
  or text the way a user would (`getByRole('button', { name })`), not by
  test IDs or styles. No snapshot tests.
- Mock at the boundary (Clerk hooks, the Supabase client, `fetch`), not the
  component under test.
- CSS imports resolve to `jest/style-mock.js`.
- A test `QueryClient` sets `gcTime: Infinity` (with `retry: false`).
  Otherwise React Query starts a 5-minute garbage-collection timer for each
  unobserved query, and that timer keeps the Jest worker alive after the
  suite ends ("A worker process has failed to exit gracefully", #98).
  `scripts/agent/repro/98-jest-worker-leak.sh` fails if that warning comes back.

## Auth

Auth is Clerk, not Supabase Auth. Supabase is configured as a third-party
auth consumer (Clerk issues the JWT, Supabase RLS verifies it) — Supabase is
still the database/Realtime layer, just not the identity provider. The
Supabase client here is initialized with the Clerk session token, not
Supabase's own session.

## Conventions

- Import shared types/schemas from `shared/`, never redefine them locally.
- Anything writing ratings goes through the `ratings` edge function in
  `backend/supabase/functions/ratings/`, using `agent/skills/ratings-engine`
  conventions — never compute Glicko-2 client-side as the source of truth.
- OAuth tokens (WHOOP) and HealthKit data stay device-local or go through
  `backend/supabase/functions/whoop-oauth/`; never persist raw health credentials in
  `shared/` or client-visible tables.
