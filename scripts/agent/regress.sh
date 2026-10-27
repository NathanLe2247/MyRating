#!/usr/bin/env bash
# Regression gate for agent-made changes.
#
#   scripts/agent/regress.sh          checks for the areas changed vs. origin/main
#   scripts/agent/regress.sh --full   every check, plus a local `supabase db reset`
#                                     when migrations changed (manager only — the
#                                     local Supabase stack is shared, don't run
#                                     this from parallel workers)
#
# Prints one PASS / FAIL / SKIP line per check and exits 1 on any FAIL.
# Never touches the linked (production) Supabase project.
set -uo pipefail

FULL=0
[ "${1:-}" = "--full" ] && FULL=1

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"
BASE=$(git merge-base origin/main HEAD)

# committed + staged + unstaged + untracked changes relative to main
CHANGED=$( { git diff --name-only "$BASE"; git ls-files --others --exclude-standard; } | sort -u)

touched() { echo "$CHANGED" | grep -qE "^($1)"; }

FAILED=0
LOG_DIR=$(mktemp -d)
result() { printf '%-5s %s\n' "$1" "$2"; }

run() { # run <name> <dir> <cmd...>
  local name=$1 dir=$2; shift 2
  local log="$LOG_DIR/${name//[^a-zA-Z0-9]/_}.log"
  if (cd "$ROOT/$dir" && "$@") >"$log" 2>&1; then
    result PASS "$name"
  else
    result FAIL "$name"
    sed 's/^/      /' "$log" | tail -40
    FAILED=1
  fi
}

# installs deps when node_modules is missing or older than the lockfile
ensure_deps() {
  local dir=$1
  if [ ! -d "$ROOT/$dir/node_modules" ] || [ "$ROOT/$dir/package-lock.json" -nt "$ROOT/$dir/node_modules/.package-lock.json" ]; then
    (cd "$ROOT/$dir" && npm ci --prefer-offline --no-audit --no-fund) >"$LOG_DIR/npm-$dir.log" 2>&1 \
      || { result FAIL "$dir: npm ci"; tail -20 "$LOG_DIR/npm-$dir.log"; FAILED=1; return 1; }
  fi
}

has_script() { jq -e --arg s "$2" '.scripts[$s]' "$ROOT/$1/package.json" >/dev/null 2>&1; }

check_node_app() { # check_node_app <dir>
  local dir=$1
  [ -f "$ROOT/$dir/package.json" ] || { result SKIP "$dir: no package.json yet"; return; }
  ensure_deps "$dir" || return
  if has_script "$dir" typecheck; then run "$dir: typecheck" "$dir" npm run -s typecheck
  elif [ -f "$ROOT/$dir/tsconfig.json" ]; then run "$dir: typecheck" "$dir" npx tsc --noEmit
  fi
  # --no-cache: the ESLint cache (expo lint keeps it in .expo/cache/eslint) is
  # keyed on file contents and config, not node_modules, so it can replay
  # results from before an `npm ci` (#18). The gate must match a fresh run.
  has_script "$dir" lint && run "$dir: lint" "$dir" npm run -s lint -- --no-cache
  has_script "$dir" test && run "$dir: test" "$dir" npm test --silent
}

# shared/ is imported by both apps, so a shared change re-checks both
if [ $FULL = 1 ] || touched 'mobile/|shared/'; then check_node_app mobile; fi
if [ $FULL = 1 ] || touched 'frontend/|shared/'; then check_node_app frontend; fi
if [ $FULL = 1 ] || touched 'shared/'; then check_node_app shared; fi

if touched 'backend/supabase/functions/'; then
  if command -v deno >/dev/null; then
    for f in $(echo "$CHANGED" | grep -E '^backend/supabase/functions/.*\.ts$'); do
      [ -f "$f" ] && run "deno check $f" . deno check "$f"
    done
  else
    result SKIP "edge functions: deno not installed"
  fi
fi

if touched 'backend/supabase/migrations/'; then
  if [ $FULL = 1 ]; then
    if docker info >/dev/null 2>&1; then
      # local stack only: no --linked, no db push
      run "supabase: start local stack" backend supabase start
      run "supabase: db reset (replays all migrations)" backend supabase db reset --local
    else
      result FAIL "supabase: migrations changed but Docker is not running"
      FAILED=1
    fi
  else
    result SKIP "supabase migrations: replayed by the manager's --full run"
  fi
fi

rm -rf "$LOG_DIR"
exit $FAILED
