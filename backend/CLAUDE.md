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
- `supabase/functions/matchmaking/` — the mobile match queue. Follows
  `agent/skills/geospatial-matching` (queue shape, radius query, courts,
  timing, Realtime). One endpoint, `POST /matchmaking`, Clerk token
  verified in the function (`verify_jwt = false`, `CLERK_SECRET_KEY`). The
  body is a `MatchmakingRequest` and every 200 is a `MatchmakingState`
  (`shared/src/matchmaking.ts`, validated with those schemas in the
  function): `join` (`lat`, `lng`, `radius_m`), `poll`, `leave`, `accept` /
  `decline` (`match_id`). Errors are `{ error }` with the codes in
  `MATCHMAKING_ERRORS`. Logic is in `handler.ts` (tested by
  `handler.test.ts` with a fake store); `index.ts` wires Clerk and the
  `public.matchmaking_*` SQL functions, which hold the pairing rules
  (tested by `tests/matchmaking.test.sql`). Never log coordinates.
  - **One open match per player**: `join` is refused with `match_pending`
    while a proposal is unanswered and `match_open` while an `accepted` /
    `awaiting_confirmation` match exists. `leave` cancels the player's
    `proposed` match, or their `accepted` one if nobody has reported a
    result, so a player can always back out before a result.
  - **Demo Tester bot**: a `public.users` row (fixed id
    `00000000-0000-4000-8000-0000000000d1`, `clerk_user_id = 'demo_tester'`,
    `username` null so it can't clash with a real handle, `is_bot = true`,
    a rating near the median) inserted by the queue migration, so it exists
    on the hosted project. **Leaderboards (and any other player list) must
    filter out `users.is_bot`, and the bot's rating never changes**: the
    `ratings` function must skip `is_bot` players. The bot's seed
    `player_ratings` row in that migration is the one ratings write outside
    the `ratings` function. With the function secret `DEMO_BOT_ENABLED=true`,
    a player still unpaired 5 s after joining is paired with it on their next
    `join`/`poll`, and it has already accepted. Any other value (or unset)
    and it never pairs. There is no timer: pairing runs on each call, and
    mobile polls every few seconds while searching.
  - Realtime: `public.matches` is published; RLS limits events to the
    player's own matches.
- `supabase/functions/dupr-import/` — importing/reconciling DUPR ratings.
- `supabase/functions/whoop-oauth/` — WHOOP OAuth flow, token exchange/refresh for
  `agent/skills/health-integrations`.
- `supabase/functions/player-profile/` — onboarding step 1: username
  availability, R2 avatar upload URLs, and saving the profile to
  `public.users` (plus Clerk `publicMetadata.profileCompletedAt`, which gates
  onboarding in the app). Verifies Clerk tokens itself (`verify_jwt = false`).
  Writes the Clerk-owned columns through `public.clerk_sync_user`, like
  clerk-webhook, and only the player-entered ones directly.
- `supabase/functions/clerk-webhook/` — mirrors Clerk-owned fields (names,
  email, phone, `login_method`) into `public.users` on user.created/updated
  through `public.clerk_sync_user`, which inserts a missing row, skips
  events whose Clerk `updated_at` isn't newer than `users.clerk_updated_at`,
  and refuses users tombstoned in `deleted_clerk_users`. On user.deleted,
  `public.clerk_delete_user` tombstones the id and hard-deletes the row in
  one transaction, then the player's R2 avatars are removed.
  Svix-signature verified (`verify_jwt = false`). Never writes
  player-entered fields. Logic is in `handler.ts` (tested by
  `handler.test.ts`: `deno test --allow-env supabase/functions/clerk-webhook/
  supabase/functions/_shared/`); `index.ts` only wires env, the DB and R2.
- `supabase/functions/_shared/` — helpers imported by more than one function
  (`login-method.ts`, `r2.ts` for the R2 client and avatar cleanup).
  `_shared/myrating-shared` is a symlink to `../../../../shared/src`.
- **Importing `shared/` in an edge function**: give the function a
  `deno.json` like `functions/matchmaking/deno.json`:

  ```json
  { "imports": { "@myrating/shared": "../_shared/myrating-shared/index.ts",
                 "zod": "npm:zod@^4.1.0" },
    "lock": false }
  ```

  then `import { MatchSchema } from '@myrating/shared'`. Why the symlink:
  `supabase functions deploy --use-api` (run from `backend/`) uploads each
  file under its path relative to `backend/` and refuses paths with `..`,
  so `../shared/src` can't be uploaded directly; through the symlink the
  path stays inside `backend/` while the real file is still in the repo.
  `supabase functions serve` follows it too. `zod` must be mapped because
  the shared sources import it bare. `"lock": false` because a `deno.lock`
  written by a newer local Deno breaks the edge runtime's boot. Run Deno
  from the function's folder (or with `--config <its deno.json>`) so the
  import map applies: `cd supabase/functions/matchmaking && deno test`.
  Older functions (`login-method.ts`) still copy shared rules by hand;
  move them to this pattern when touched. The deploy workflow checks the
  symlink before deploying, and `regress.sh` re-type-checks every function
  whose `deno.json` maps `@myrating/shared` when `shared/` changes.
- `supabase/tests/` — pgTAP tests, run against the local stack with
  `supabase test db --local`.
- Courts data is split in two. Real catalog courts (8 Montgomery County, MD
  parks with pickleball) are inserted by the migration
  `20261114120000_courts_silver_spring.sql`, so they reach the hosted project.
  `supabase/seed.sql` is local only (`db reset` loads it, `db push` never
  does) and holds just an inactive test court. `tests/courts_seed.test.sql`
  checks both by their fixed ids.
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

Where each secret lives (all three were wrong or missing until 2026-11-14,
so the workflow never succeeded before then):

- GitHub Actions secrets: `SUPABASE_ACCESS_TOKEN` (a personal access token,
  account-wide, so never in a repo `.env`) and `SUPABASE_DB_PASSWORD`.
  `gh secret set` run through Claude Code's `!` can't prompt and saves an
  empty value; set these in the GitHub UI or a normal terminal.
- Supabase Edge Function secrets: `CLERK_WEBHOOK_SECRET` must equal the
  signing secret of the Clerk dashboard webhook endpoint, which must point at
  `https://<project-ref>.supabase.co/functions/v1/clerk-webhook` (not a Svix
  Play inbox) with `user.created`, `user.updated`, `user.deleted`.

To check the webhook end to end, create and then delete a throwaway user in
the Clerk dev instance and look it up by `public.users.clerk_user_id` (not
`id`, which is our own uuid), then in `public.deleted_clerk_users`.

## Conventions

- **User deletion is a hard delete.** When Clerk deletes a user,
  clerk-webhook deletes their `public.users` row (and their R2 avatars) and
  records a PII-free tombstone in `deleted_clerk_users` so late events can't
  recreate them. Anything that writes Clerk-owned `users` columns must go
  through `public.clerk_sync_user`.
  Every table that references `users.id` must declare `ON DELETE CASCADE`;
  without it the delete fails and the webhook keeps retrying.
- Row shapes must match the Zod schemas in `shared/` — migrations and
  `shared/` change together, in the same PR.
- Edge functions are the only writers for ratings and match state; clients
  (web or mobile) never write those tables directly. `django/` follows
  the same rule until/unless its ownership boundary says otherwise.
- Realtime channels used for chat/presence are mobile-only — don't expose
  them to `frontend/`.
