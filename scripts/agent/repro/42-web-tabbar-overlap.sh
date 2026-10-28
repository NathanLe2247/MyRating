#!/usr/bin/env bash
# Repro for #42: on the web build, the tab bar covers the Home header and
# still shows the Expo template's "Expo Starter" / "Docs".
#
# Starts mobile/ as an Expo web build on a free port, signs in as a fresh
# onboarded Clerk test user, and runs 42-web-tabbar-overlap.mjs in headless
# Chromium (see .claude/skills/mobile-auth-smoke for the same setup).
#
# Needs CLERK_SECRET_KEY for the Clerk *dev* instance, from the environment or
# backend/.env.local (this checkout's or the main checkout's), and
# mobile/.env.local for the app's publishable key.
#
# Exits 0 when the header is uncovered and the branding is myRating, 1 while
# the bug is present, 2 on a setup error.
#   SHOTS=<dir> keeps screenshots there.
set -uo pipefail

ROOT=$(git rev-parse --show-toplevel)
MAIN=$(cd "$(git rev-parse --git-common-dir)/.." && pwd)
MOBILE="$ROOT/mobile"
HERE="$ROOT/scripts/agent/repro"

env_value() { # env_value <file> <key>
  [ -f "$1" ] && sed -n "s/^$2=//p" "$1" | head -1 | tr -d "\"'"
}
if [ -z "${CLERK_SECRET_KEY:-}" ]; then
  CLERK_SECRET_KEY=$(env_value "$ROOT/backend/.env.local" CLERK_SECRET_KEY)
  [ -n "$CLERK_SECRET_KEY" ] || CLERK_SECRET_KEY=$(env_value "$MAIN/backend/.env.local" CLERK_SECRET_KEY)
fi
[ -n "${CLERK_SECRET_KEY:-}" ] || { echo "SETUP ERROR: no CLERK_SECRET_KEY"; exit 2; }
export CLERK_SECRET_KEY

[ -f "$MOBILE/.env.local" ] || cp "$MAIN/mobile/.env.local" "$MOBILE/.env.local" 2>/dev/null \
  || { echo "SETUP ERROR: no mobile/.env.local"; exit 2; }
[ -d "$MOBILE/node_modules" ] || (cd "$MOBILE" && npm ci --prefer-offline --no-audit --no-fund >/dev/null 2>&1) \
  || { echo "SETUP ERROR: npm ci failed"; exit 2; }

# Playwright stays out of the repo: a driver directory cached per machine.
DRIVER="${TMPDIR:-/tmp}/myrating-repro-playwright"
if [ ! -d "$DRIVER/node_modules/playwright" ]; then
  mkdir -p "$DRIVER"
  (cd "$DRIVER" && npm init -y >/dev/null && npm i -s playwright@1 >/dev/null && npx playwright install chromium >/dev/null) \
    || { echo "SETUP ERROR: Playwright install failed"; exit 2; }
fi

PORT=8142
while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT + 1)); done
WORK=$(mktemp -d)
(cd "$MOBILE" && CI=1 BROWSER=none exec npx expo start --web --port "$PORT" >"$WORK/expo.log" 2>&1) &
cleanup() {
  lsof -ti:"$PORT" -sTCP:LISTEN | xargs kill 2>/dev/null
  rm -rf "$WORK"
}
trap cleanup EXIT

up=0
for _ in $(seq 1 90); do
  curl -sf -o /dev/null "http://localhost:$PORT" && { up=1; break; }
  sleep 2
done
[ "$up" = 1 ] || { echo "SETUP ERROR: Expo web server didn't start"; tail -20 "$WORK/expo.log"; exit 2; }

cp "$HERE/42-web-tabbar-overlap.mjs" "$DRIVER/"
cd "$DRIVER" && BASE_URL="http://localhost:$PORT" node 42-web-tabbar-overlap.mjs ${SHOTS:+"$SHOTS"}
