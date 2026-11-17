#!/usr/bin/env bash
# Repro for #119: nearby-court-card.test.tsx's first test ("shows the photo
# above the card with its linked Google credit", line 58) fails now and then
# in a full mobile Jest run with "Exceeded timeout of 5000 ms for a test".
#
# Nothing in that test hangs. The first render in a test file loads the
# react-native/Expo modules that load lazily, inside the test, so it counts
# against the test's timeout. Alone that takes about 0.5 s. When other agents'
# gates run Jest on the same machine at the same time (each full run starts a
# worker per core), the machine swaps and that first render takes 5-20 s,
# past Jest's default 5 s. Which file gets hit depends on which ones each
# worker starts with, so the same timeout also lands on other suites
# (useMatchResult, useDashboard, useMatchmaking).
#
# Makes that load on purpose: RUNS full mobile Jest runs at the same time
# (default 8). Exits 1 if any test in any run exceeds its timeout, 0 if none
# does, 2 on a setup error. Failures for any other reason are listed but
# don't change the result. Written for bash 3.2.
set -uo pipefail

ROOT=$(git rev-parse --show-toplevel)
MOBILE="$ROOT/mobile"
RUNS=${RUNS:-8}

if [ ! -f "$MOBILE/node_modules/jest-expo/package.json" ]; then
  (cd "$MOBILE" && npm ci --prefer-offline --no-audit --no-fund >/dev/null 2>&1) \
    || { echo "SETUP ERROR: npm ci failed in mobile/"; exit 2; }
fi

LOGS=$(mktemp -d)
trap 'rm -rf "$LOGS"' EXIT

PIDS=""
i=0
while [ "$i" -lt "$RUNS" ]; do
  i=$((i + 1))
  (cd "$MOBILE" && npx jest --ci --json --outputFile="$LOGS/run-$i.json") \
    >"$LOGS/run-$i.log" 2>&1 &
  PIDS="$PIDS $!"
done
for pid in $PIDS; do
  wait "$pid"
done

if ! ls "$LOGS"/run-*.json >/dev/null 2>&1; then
  echo "SETUP ERROR: no Jest run finished"
  tail -20 "$LOGS/run-1.log"
  exit 2
fi

# Sort each failed test by its error, read from Jest's JSON results (the
# text log can interleave other output between a failure and its error).
# Prints "T <Suite › test>" for a timeout and "O <Suite › test>" otherwise,
# one line per failing run.
RESULTS=$(node -e '
  const fs = require("fs");
  for (const file of process.argv.slice(1)) {
    const run = JSON.parse(fs.readFileSync(file, "utf8"));
    for (const suite of run.testResults) {
      for (const t of suite.assertionResults) {
        if (t.status !== "failed") continue;
        const kind = t.failureMessages.some((m) => m.includes("Exceeded timeout")) ? "T" : "O";
        console.log(kind + " " + [...t.ancestorTitles, t.title].join(" › "));
      }
    }
  }
' "$LOGS"/run-*.json) || { echo "SETUP ERROR: could not read Jest's JSON results"; exit 2; }
TIMEOUTS=$(printf '%s\n' "$RESULTS" | sed -n 's/^T //p')
OTHERS=$(printf '%s\n' "$RESULTS" | sed -n 's/^O //p')

if [ -n "$OTHERS" ]; then
  echo "Tests that failed for a reason other than a timeout:"
  printf '%s\n' "$OTHERS" | sort | uniq -c
fi

if [ -n "$TIMEOUTS" ]; then
  echo "Tests that exceeded their timeout (runs):"
  printf '%s\n' "$TIMEOUTS" | sort | uniq -c
  echo "FAIL #119: mobile tests exceeded the Jest timeout under $RUNS concurrent runs"
  exit 1
fi

echo "PASS #119: no mobile test exceeded the Jest timeout under $RUNS concurrent runs"
exit 0
