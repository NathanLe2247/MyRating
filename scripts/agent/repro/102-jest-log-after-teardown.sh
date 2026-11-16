#!/usr/bin/env bash
# Repro for #102: mobile Jest runs log "Cannot log after tests are done ...
# ExpoModulesCoreJSLogger" after a test file finishes.
#
# jest-expo installs Expo's `fetch` as a lazy global getter. When a test never
# touches `fetch`, Jest's own teardown (jest-runtime resetModules, which reads
# every global looking for mocks to clear) fires the getter after the test
# is done. In the jsdom web tests `react-native` is mocked with
# react-native-web, so loading expo/fetch then fails in expo-modules-core and
# it warns after teardown.
#
# Runs every `@jest-environment jsdom` test file under mobile/src and fails if
# any of them logs that warning. Exits 0 when none does, 1 when one does,
# 2 on a setup error. Written for bash 3.2.
set -uo pipefail

ROOT=$(git rev-parse --show-toplevel)
MOBILE="$ROOT/mobile"

if [ ! -f "$MOBILE/node_modules/jest-expo/package.json" ]; then
  (cd "$MOBILE" && npm ci --prefer-offline --no-audit --no-fund >/dev/null 2>&1) \
    || { echo "SETUP ERROR: npm ci failed in mobile/"; exit 2; }
fi

FILES=$(cd "$MOBILE" && grep -rl '@jest-environment jsdom' src)
if [ -z "$FILES" ]; then
  echo "SETUP ERROR: no jsdom test files found under mobile/src"
  exit 2
fi

LOG=$(mktemp)
trap 'rm -f "$LOG"' EXIT

# shellcheck disable=SC2086 # FILES is a whitespace-separated path list
(cd "$MOBILE" && npx jest --ci $FILES) >"$LOG" 2>&1
STATUS=$?

if [ "$STATUS" -ne 0 ]; then
  echo "SETUP ERROR: jest failed (exit $STATUS) for a reason other than the log"
  tail -40 "$LOG"
  exit 2
fi

PATTERN="Cannot log after tests are done|requiring the 'ExpoModulesCoreJSLogger' module"
if grep -qE "$PATTERN" "$LOG"; then
  echo "FAIL: a jsdom test logs after teardown from Expo's lazy fetch global (#102)"
  grep -E -A12 "$PATTERN" "$LOG" | head -40
  exit 1
fi

echo "PASS: no jsdom test logs after teardown"
exit 0
