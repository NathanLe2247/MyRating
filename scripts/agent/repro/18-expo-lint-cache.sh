#!/usr/bin/env bash
# Repro for #18: the regression gate replays a stale `expo lint` cache.
#
# 1. A probe file imports a package that isn't installed; a normal
#    `expo lint` run fails on import/no-unresolved and caches that result
#    in mobile/.expo/cache/eslint.
# 2. The package gets installed (as `npm ci` would). Neither the probe file
#    nor the ESLint config changed, so the cache key is unchanged.
# 3. scripts/agent/regress.sh must now report `PASS mobile: lint`, the same
#    as a fresh run. While the bug is present it replays the cached error.
#
# Exits 0 when the gate's lint matches a fresh run, 1 otherwise.
set -uo pipefail

ROOT=$(git rev-parse --show-toplevel)
MOBILE="$ROOT/mobile"
PROBE_DIR="$MOBILE/src/__repro18__"
DEP_DIR="$MOBILE/node_modules/repro-18-missing-dep"

cleanup() { rm -rf "$PROBE_DIR" "$DEP_DIR"; }
trap cleanup EXIT
cleanup

[ -d "$MOBILE/node_modules" ] || (cd "$MOBILE" && npm ci --prefer-offline --no-audit --no-fund >/dev/null 2>&1)

mkdir -p "$PROBE_DIR"
printf "import { x } from 'repro-18-missing-dep';\n\nexport const y = x;\n" > "$PROBE_DIR/probe.ts"

# 1. seed the cache with a failure while the dependency is missing
if (cd "$MOBILE" && npx expo lint >/dev/null 2>&1); then
  echo "SETUP ERROR: lint passed with the dependency missing; probe isn't detected"
  exit 2
fi

# 2. install the dependency
mkdir -p "$DEP_DIR"
echo '{"name":"repro-18-missing-dep","version":"1.0.0","main":"index.js","types":"index.d.ts"}' > "$DEP_DIR/package.json"
echo 'exports.x = 1;' > "$DEP_DIR/index.js"
echo 'export declare const x: number;' > "$DEP_DIR/index.d.ts"

# sanity: a fresh, uncached lint passes now
if ! (cd "$MOBILE" && npx eslint src/__repro18__/probe.ts >/dev/null 2>&1); then
  echo "SETUP ERROR: fresh lint still fails with the dependency installed"
  exit 2
fi

# 3. the gate must agree with the fresh run
OUT=$("$ROOT/scripts/agent/regress.sh" 2>&1)
if echo "$OUT" | grep -qE '^PASS +mobile: lint$'; then
  echo "OK: regress.sh lint matches a fresh run"
  exit 0
fi
echo "BUG: regress.sh reported a stale lint result after the dependency was installed"
echo "$OUT" | grep -A6 'mobile: lint'
exit 1
