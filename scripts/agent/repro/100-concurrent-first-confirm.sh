#!/usr/bin/env bash
# Repro for #100: two different matches confirmed at the same time for a
# player with no player_ratings row yet. Both public.ratings_apply calls see
# no row and insert one; the second insert waits on the first, then fails
# with a unique violation (23505), which match-results answers with a 500
# instead of the retryable rating_stale (409).
#
# Runs against a throwaway database in the local Supabase Postgres container
# (supabase_db_backend), built from this checkout's migrations, so it never
# touches the shared local `postgres` database or the linked project.
# Session A confirms match 1 and holds its transaction open; session B then
# confirms match 2 for the same unrated player. Exits 1 if B fails with
# anything but rating_stale (on main: 23505), 0 when B gets rating_stale.
set -uo pipefail

ROOT=$(git rev-parse --show-toplevel)
MIGRATIONS="$ROOT/backend/supabase/migrations"
CONTAINER=supabase_db_backend
DB="repro_100_$$"
TMP=$(mktemp -d)

if ! docker exec "$CONTAINER" true >/dev/null 2>&1; then
  echo "SETUP: container $CONTAINER is not running (cd backend && supabase start)"
  exit 2
fi

psql_in() { docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -X "$@"; }

cleanup() {
  psql_in -d postgres -c "drop database if exists $DB with (force)" >/dev/null 2>&1
  rm -rf "$TMP"
}
trap cleanup EXIT

psql_in -d postgres -c "create database $DB" >/dev/null || exit 2

# What the Supabase image provides in its `postgres` database and the
# migrations rely on: the extensions schema, auth.jwt(), the Realtime
# publication. (Roles are cluster-wide and already exist.)
cat >"$TMP/stubs.sql" <<'SQL'
create schema extensions;
create schema auth;
create function auth.jwt() returns jsonb language sql stable
  as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
create publication supabase_realtime;
SQL
psql_in -d "$DB" <"$TMP/stubs.sql" >/dev/null || exit 2

for f in "$MIGRATIONS"/*.sql; do
  if ! psql_in -d "$DB" <"$f" >"$TMP/migrate.log" 2>&1; then
    cat "$TMP/migrate.log"
    echo "SETUP: migration $(basename "$f") failed"
    exit 2
  fi
done

# p: unrated. q, r: rated. m1 = p vs q (reported by q), m2 = p vs r (reported
# by r); p confirms both.
cat >"$TMP/fixtures.sql" <<'SQL'
insert into public.users (id, clerk_user_id, username, login_method) values
  ('a1000000-0000-4000-8000-000000000001', 'user_repro100_p', 'repro100_p', 'email'),
  ('a1000000-0000-4000-8000-000000000002', 'user_repro100_q', 'repro100_q', 'email'),
  ('a1000000-0000-4000-8000-000000000003', 'user_repro100_r', 'repro100_r', 'email');
insert into public.player_ratings (user_id, rating, mmr, rating_deviation, volatility) values
  ('a1000000-0000-4000-8000-000000000002', 1400, 1400, 30, 0.06),
  ('a1000000-0000-4000-8000-000000000003', 1600, 1600, 50, 0.06);
insert into public.matches (id, player_a_id, player_b_id, status, player_a_accepted_at, player_b_accepted_at, reported_by) values
  ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000002', 'awaiting_confirmation', now(), now(), 'a1000000-0000-4000-8000-000000000002'),
  ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000003', 'awaiting_confirmation', now(), now(), 'a1000000-0000-4000-8000-000000000003');
SQL
psql_in -d "$DB" <"$TMP/fixtures.sql" >/dev/null || exit 2

# Session A: confirm m1 and hold the transaction (and p's new row) open.
cat >"$TMP/a.sql" <<'SQL'
begin;
set local role service_role;
select public.ratings_apply('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '[
  {"player_id": "a1000000-0000-4000-8000-000000000001", "expected_rating": null, "expected_mmr": null,
   "expected_rating_deviation": null, "expected_volatility": null,
   "before": 1500, "rating": 1662.31, "rating_deviation": 290.32, "volatility": 0.059999},
  {"player_id": "a1000000-0000-4000-8000-000000000002", "expected_rating": 1400, "expected_mmr": 1400,
   "expected_rating_deviation": 30, "expected_volatility": 0.06,
   "before": 1400, "rating": 1398.2, "rating_deviation": 31.1, "volatility": 0.06}
]');
select pg_sleep(3);
commit;
SQL

# Session B: confirm m2, computed from the same "no row yet" read of p.
cat >"$TMP/b.sql" <<'SQL'
\set VERBOSITY verbose
set role service_role;
select public.ratings_apply('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', '[
  {"player_id": "a1000000-0000-4000-8000-000000000001", "expected_rating": null, "expected_mmr": null,
   "expected_rating_deviation": null, "expected_volatility": null,
   "before": 1500, "rating": 1611.0, "rating_deviation": 300.0, "volatility": 0.059999},
  {"player_id": "a1000000-0000-4000-8000-000000000003", "expected_rating": 1600, "expected_mmr": 1600,
   "expected_rating_deviation": 50, "expected_volatility": 0.06,
   "before": 1600, "rating": 1590.0, "rating_deviation": 52.0, "volatility": 0.06}
]');
SQL

psql_in -d "$DB" <"$TMP/a.sql" >"$TMP/a.log" 2>&1 &
A_PID=$!
sleep 1
psql_in -d "$DB" <"$TMP/b.sql" >"$TMP/b.log" 2>&1
B_STATUS=$?
wait "$A_PID"
A_STATUS=$?

if [ "$A_STATUS" -ne 0 ]; then
  cat "$TMP/a.log"
  echo "SETUP: session A's confirm failed; the repro didn't run as designed"
  exit 2
fi

echo "session B (second concurrent first confirm):"
sed 's/^/  /' "$TMP/b.log"

if [ "$B_STATUS" -eq 0 ]; then
  echo "FAIL #100: the second confirm succeeded although it was computed from a stale (missing) row"
  exit 1
fi
if grep -q '23505' "$TMP/b.log"; then
  echo "FAIL #100: the second concurrent first confirm hit a unique violation (23505 -> 500), not rating_stale"
  exit 1
fi
if grep -q 'P0001: rating_stale' "$TMP/b.log"; then
  echo "PASS #100: the second concurrent first confirm was refused with rating_stale (-> retry / 409)"
  exit 0
fi
echo "FAIL #100: the second confirm failed for an unexpected reason"
exit 1
