---
name: geospatial-matching
description: PostGIS radius queries for mobile-only match queueing — how nearby players/courts are found and queued.
---

# geospatial-matching

Conventions for finding nearby players and courts and queueing matches, using
PostGIS on the Supabase backend.

Scope: mobile-only. Consumed by `mobile/` and `backend/supabase/functions/matchmaking/`.
Do not surface queueing in `frontend/`.

Schema: `backend/supabase/migrations/20261114130000_queue_and_matches.sql`.
Shapes: `QueueEntry` / `Match` in `shared/src/match.ts`, the function's API in
`shared/src/matchmaking.ts`.

## Queue table shape

`public.queue_entries` mirrors `QueueEntrySchema`:

- `id`, `player_id` (`public.users.id`, `on delete cascade`).
- `location geography(point, 4326)`: `[lng, lat]`, metres for every distance
  function. `POINT EMPTY` is rejected by a check.
- `radius_m integer`, 1 to `MAX_QUEUE_RADIUS_M` (100000), the same cap as
  `nearby_courts`.
- `status queue_entry_status`: `waiting` → `matched` (paired) or `left`.
  A partial unique index allows one `waiting` row per player; old rows stay
  as history.
- `created_at` is when the player started waiting (the bot timer);
  rejoining while waiting moves the entry but keeps `created_at`.

Clients read their own entry through `public.queue_entries_geojson`
(security invoker, GeoJSON `location`); never `anon`. Writes go only
through the `matchmaking` edge function, which calls `public.matchmaking_*`
SQL functions (service_role only).

## Radius query pattern

Pairing (`public.matchmaking_pair(player_id)`):

```sql
select q.* from public.queue_entries q
where q.status = 'waiting'
  and q.player_id <> me.player_id
  and extensions.st_dwithin(q.location, me.location, least(q.radius_m, me.radius_m))
order by extensions.st_distance(q.location, me.location), q.created_at, q.id
limit 1;
```

- Both players must accept the distance, so the **smaller** radius decides.
- `st_dwithin` on geography uses the partial GiST index
  `queue_entries_waiting_location_idx` (waiting rows only).
- Nearest first; ties go to whoever waited longest.
- Every pairing/answer function takes one transaction-scoped advisory lock
  (`pg_advisory_xact_lock(hashtext('public.matchmaking'))`), so concurrent
  polls can't pair a player twice. Shard the lock by area if it ever matters.
- Always `extensions.`-qualify PostGIS calls and `set search_path = ''`.

## How it composes with courts-catalog

The match's `court_id` is the nearest active court to the midpoint of the two
players (`st_centroid(st_collect(a, b))`), found with
`public.nearby_courts(lat, lng, 100000, 1)` — the same RPC the courts
screens use, so "active" means the same thing everywhere. Null when no
active court is within 100 km. For a Demo Tester match, the player's own
location is used. Don't query `public.courts` directly for this.

## Pairing timing and the Demo Tester

Hosted edge functions are short-lived, so there is no background matcher:
pairing is checked on every `join` and `poll` call. Mobile calls `poll` every
few seconds (2–3 s) while it shows "Searching".

With the function secret `DEMO_BOT_ENABLED=true`, a `poll` that finds no
real opponent pairs the player with the Demo Tester
(`DEMO_TESTER_USER_ID` in `shared/src/matchmaking.ts`) once their entry is
at least 5 s old (`DEMO_BOT_WAIT_MS` in the function). The bot is
`player_b` and has already accepted (`player_b_accepted_at` set), so the
match turns `accepted` as soon as the player accepts. A real nearby player
always wins over the bot. Flag off: the bot is never considered.

## Realtime

`public.matches` is in the `supabase_realtime` publication. A player
subscribes with their Clerk token set on the client (supabase-js
`accessToken`), and the "Players read their own matches" RLS policy limits
events to matches they are in, so no filter is needed:

```ts
supabase
  .channel(`matches:${playerId}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, onChange)
  .subscribe();
```

Treat events as a hint and re-read state with `poll` (the payload has no
opponent or court). `queue_entries` is not published.
