#!/usr/bin/env bash
# Repro for #98: a full mobile Jest run leaves a worker process alive, and
# Jest prints "A worker process has failed to exit gracefully and has been
# force exited". The suite still passes, so the gate never noticed.
#
# Runs the whole mobile suite the way `npm test` does (parallel workers) and
# exits 1 if the tests fail or Jest reports a worker it had to force-exit (or,
# when it runs in band, that it "did not exit"). Exits 0 on a clean run.
set -uo pipefail

ROOT=$(git rev-parse --show-toplevel)
MOBILE="$ROOT/mobile"

[ -d "$MOBILE/node_modules" ] || (cd "$MOBILE" && npm ci --prefer-offline --no-audit --no-fund >/dev/null 2>&1)

OUT=$(cd "$MOBILE" && npx jest --ci 2>&1)
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  printf '%s\n' "$OUT" | tail -40
  echo "FAIL #98: mobile Jest run failed (exit $STATUS)"
  exit 1
fi

if printf '%s\n' "$OUT" | grep -qE 'force exited|did not exit'; then
  printf '%s\n' "$OUT" | grep -E 'force exited|did not exit|^Tests:'
  echo "FAIL #98: a Jest worker did not exit cleanly (open handle left by a test)"
  exit 1
fi

echo "PASS #98: mobile Jest run exited cleanly"
exit 0
