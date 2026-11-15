# shared

Types, Zod schemas, and constants used by `frontend/`, `mobile/`, and
`backend/`. This is the single source of truth for cross-app data shapes:
`Court`, `Tournament`, `RatingEntry`, `NewsItem`, and related enums/constants.

## Conventions

- No app-specific logic here — only types, schemas, and constants that at
  least two of the three apps consume.
- Every shape here should have a Zod schema (`z.infer` the TS type from it,
  not the other way around) so runtime validation and static types can't
  drift apart.
- Changing a shape here is a breaking change for every consumer — update
  `backend/supabase/migrations/` in the same PR, and check `frontend/` and
  `mobile/` usages before merging.

## Shapes and where to read them

- `Court` / `NearbyCourt` (`src/court.ts`) — read courts from the
  `public.courts_geojson` view or the `public.nearby_courts(lat, lng,
  radius_m, max_results)` RPC, never `public.courts` directly (PostgREST
  returns its `location` as WKB hex, which won't parse as `GeoJsonPoint`).
  Only active courts are visible to clients. The shape is deliberately
  minimal until the catalog is designed — see `agent/skills/courts-catalog`.
- Queue, match, and result shapes (`src/match.ts`) — the demo flow queue →
  match → report score → confirm → rating update. `queue_entries` and
  `matches` (with the `queue_entry_status` / `match_status` enums) are in
  `20261114130000_queue_and_matches.sql` and must keep these names, enums,
  and nullability. `match_games` (`MatchGameRow`) and `rating_history`
  (`RatingHistoryRow`) are in `20261114140000_match_results_ratings.sql`.
  Player ids are always `public.users.id` (uuid), never `clerk_user_id`.
  Clients read queue entries through `public.queue_entries_geojson`.
  - `QueueEntry` (`id` — its own key, separate from `player_id`;
    `player_id`, `location` GeoJSON point, `radius_m` integer 1–
    `MAX_QUEUE_RADIUS_M` (100000, same as `nearby_courts`), `status`:
    `QUEUE_ENTRY_STATUSES` = `waiting | matched | left`, `created_at`,
    `updated_at`). Read `location` through a view/RPC, like courts.
  - `Match` (`id`, `player_a_id`, `player_b_id` — must differ, `court_id`
    nullable, `status`, `player_a_accepted_at` / `player_b_accepted_at`
    nullable timestamps, `reported_by` nullable uuid that must be one of the
    two players, `created_at`, `updated_at`). `MATCH_STATUSES` and the
    transitions:
    - `proposed` → `accepted` (both players accepted) | `declined` |
      `cancelled` (expired, or a player left).
    - `accepted` is also the "report the result" state: no separate
      awaiting-result status.
    - `accepted` → `awaiting_confirmation` (one player reported;
      `reported_by` set) → `confirmed` (ratings update) | `disputed`.
    - `accepted` → `cancelled` when a player leaves the queue before anyone
      reported a result. Once a result is reported, leaving doesn't touch it.
    - One open match per player: `OPEN_MATCH_STATUSES` = `proposed |
      accepted | awaiting_confirmation`. The matchmaking function refuses to
      queue a player who has one (`match_pending` for a proposal,
      `match_open` otherwise).
  - `MatchGame` (`player_a_points`, `player_b_points`, in the match's a/b
    order) and `MatchResultSubmission` (`match_id`, `games`: 1–`MAX_GAMES`).
    The scoring rules live in these schemas, so every app validates the same
    way and mobile shows the issue messages verbatim: a game goes to
    `POINTS_TO_WIN` (11), won by `WIN_BY` (2), and past 11 ends the moment
    the lead is 2 (11–9, 12–10, 13–11, 15–13 valid; 11–10, 10–8, 12–9,
    15–11 not); no ties; the match winner wins more games; nothing after a
    player reaches `GAMES_TO_WIN_MATCH` (2), so no 3rd game after 2–0. A
    single game is a valid result. One problem yields one issue: an invalid
    game suppresses the match-level checks.
  - `MatchGameRow` — a stored game: `match_id`, `game_number` (1–3),
    `player_a_points`, `player_b_points`, same score rules as `MatchGame`.
  - `matchWinner(submission)` → `MatchSide` (`'a' | 'b'`): the winner of a
    parsed result. Use it everywhere (backend and mobile) instead of
    counting games yourself; it throws on split games, so parse first.
  - `RatingChange` (`match_id`, `player_id`, `before`, `after`, `delta`) for
    display, and `RatingHistoryRow` (the same plus `created_at`) for the
    stored row. `delta` must be within `RATING_DELTA_TOLERANCE` (0.005) of
    `after − before`; values are `numeric(7,2)`, so compute `delta` from
    the rounded values (the table's `delta` is generated as `after - before`).
    Only the backend `ratings` code computes these
    (`agent/skills/ratings-engine`).
- Matchmaking API (`src/matchmaking.ts`) — the `matchmaking` edge function's
  request and response. `MatchmakingRequestSchema` (POST body,
  discriminated on `action`: `join` with `lat`/`lng`/`radius_m`, `poll`,
  `leave`, `accept`/`decline` with `match_id`), `MatchmakingStateSchema`
  (every 200: `queue_entry`, `match`, `opponent`, `court`, each nullable),
  `MATCHMAKING_ERRORS` (the `{ error }` codes), and `DEMO_TESTER_USER_ID`
  (the Demo Tester bot's `users.id`, inserted by the same migration; a
  test checks it's there). `MatchOpponent.is_bot` mirrors `users.is_bot`,
  which is true only for the Demo Tester: leaderboards must filter `is_bot`
  users out, and the bot's rating never changes. Edge functions import these as
  `@myrating/shared` (see `backend/CLAUDE.md`).
- Match results API (`src/match-results.ts`) — the `match-results` edge
  function's request and response. `MatchResultsRequestSchema` (POST body,
  discriminated on `action`: `submit` is `MatchResultSubmissionSchema`
  plus the action, via `safeExtend` so its scoring rules still apply;
  `confirm`, `dispute`, `state` take `match_id`), `MatchResultsStateSchema`
  (every 200: `match`, `games` as `MatchGameRow[]`, `opponent` as
  `MatchOpponent`, `rating_change` — the caller's `RatingChange`, null until
  confirmed and after a dispute), `MATCH_RESULTS_ERRORS` (every code the
  function returns, including 405 `method_not_allowed`, 409 `match_changed`
  — re-read `state`, the opponent reported meanwhile — and 409
  `rating_stale` — try again), and
  `DEMO_BOT_CONFIRM_DELAY_MS` (3 s: the Demo Tester confirms a score
  reported against it on the first call after this, so poll `state`).
