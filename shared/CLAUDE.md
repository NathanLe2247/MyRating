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
  match → report score → confirm → rating update. The tables don't exist
  yet: the backend migration that adds them must match these names, enums,
  and nullability. Player ids are always `public.users.id` (uuid), never
  `clerk_user_id`.
  - `QueueEntry` (`id`, `player_id`, `location` GeoJSON point, `radius_m`,
    `status`: `QUEUE_ENTRY_STATUSES` = `waiting | matched | left`,
    `created_at`). Read `location` through a view/RPC, like courts.
  - `Match` (`id`, `player_a_id`, `player_b_id` — must differ, `court_id`
    nullable, `status`: `MATCH_STATUSES` = `proposed | accepted | declined |
    awaiting_result | awaiting_confirmation | confirmed | disputed`,
    `created_at`, `updated_at`).
  - `MatchGame` (`player_a_points`, `player_b_points`, in the match's a/b
    order) and `MatchResultSubmission` (`match_id`, `games`: 1–`MAX_GAMES`).
    The scoring rules live in these schemas, so every app validates the same
    way and mobile can show the issue messages directly: a game goes to
    `POINTS_TO_WIN` (11), won by `WIN_BY` (2), and past 11 ends the moment
    the lead is 2 (12–10, 15–13 valid; 11–10, 10–8, 15–11 not); no ties;
    the match winner wins more games; nothing after a player reaches
    `GAMES_TO_WIN_MATCH` (2), so no 3rd game after 2–0. A single game is a
    valid result.
  - `matchWinner(submission)` → `MatchSide` (`'a' | 'b'`): the winner of a
    parsed result. Use it everywhere (backend and mobile) instead of
    counting games yourself; it throws on split games, so parse first.
  - `RatingChange` (`match_id`, `player_id`, `before`, `after`, `delta` =
    after − before) — display-only; only the `ratings` edge function computes it
    (`agent/skills/ratings-engine`).
