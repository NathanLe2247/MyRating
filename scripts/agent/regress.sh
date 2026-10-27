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
CHECKS=0 # PASS/FAIL lines printed; 0 means nothing was checked
LOG_DIR=$(mktemp -d)
result() {
  printf '%-5s %s\n' "$1" "$2"
  [ "$1" = SKIP ] || CHECKS=$((CHECKS + 1))
}

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

# The gate checks changes to itself (#22, #24): syntax-check and shellcheck
# every changed shell script under scripts/, and run the mobile checks below
# so a gate change is exercised against a real app. /bin/bash is 3.2 on macOS,
# so parsing with it also catches syntax newer bashes accept but the user's
# shell doesn't.
#
# Shell scripts are found by `.sh` extension or by shebang, so extensionless
# scripts are covered too. Any absolute path or `env` form counts:
# `#!/bin/bash`, `#! /bin/sh`, `#!/opt/homebrew/bin/bash`, `#!/usr/bin/env bash`,
# `#!/usr/bin/env -S bash -e`.
#
# bash scripts are also scanned by check-bash32.sh for bash 4+ features that
# parse but fail at runtime on 3.2 (#29); sh scripts get ShellCheck's SC3xxx
# (non-POSIX) warnings, which `-S error` alone would hide.
#
# The gate expects ShellCheck to be installed wherever it runs:
#   brew install shellcheck      (macOS)
#   apt-get install shellcheck   (Debian/Ubuntu)
# Without it the gate falls back to `bash -n` / `sh -n` and prints a SKIP line.
shell_of() { # prints bash|sh for a shell script, nothing otherwise
  local first w name=
  local -a words=()
  first=$(head -n 1 "$1" 2>/dev/null)
  first=${first%$'\r'} # CRLF files: `read -a` would keep the \r on "bash"
  case "$first" in
    '#!'*)
      read -r -a words <<<"${first#??}"
      for w in "${words[@]+"${words[@]}"}"; do
        # skip env's own options (-S, -i, ...) and VAR=val assignments to
        # reach the interpreter
        case "$w" in -*|*=*) [ "$name" = env ] && continue ;; esac
        name=${w##*/}
        [ "$name" = env ] || break
      done
      case "$name" in bash|sh) echo "$name"; return ;; esac
      ;;
  esac
  if [ "${1%.sh}" != "$1" ]; then echo bash; fi
}

# sh_bashisms <file>: fails with ShellCheck's SC3xxx findings for a sh script
sh_bashisms() {
  local out
  out=$(shellcheck -s sh -S warning -f gcc "$1" | grep -E 'SC3[0-9]{3}')
  [ -z "$out" ] || { echo "$out"; return 1; }
}

if touched 'scripts/'; then
  BASH_N=bash
  [ -x /bin/bash ] && BASH_N=/bin/bash
  HAS_SHELLCHECK=0
  command -v shellcheck >/dev/null && HAS_SHELLCHECK=1
  while IFS= read -r f; do
    [ -n "$f" ] && [ -f "$f" ] || continue # deleted on this branch
    sh_kind=$(shell_of "$f")
    [ -n "$sh_kind" ] || continue # not a shell script
    if [ "$sh_kind" = sh ]; then
      run "sh -n $f" . sh -n "$f"
      [ $HAS_SHELLCHECK = 1 ] && run "posix sh (SC3xxx) $f" . sh_bashisms "$f"
    else
      run "bash -n $f" . "$BASH_N" -n "$f"
      run "bash 3.2 features $f" . scripts/agent/check-bash32.sh "$f"
    fi
    [ $HAS_SHELLCHECK = 1 ] && run "shellcheck $f" . shellcheck -S error "$f"
  done <<EOF
$(echo "$CHANGED" | grep -E '^scripts/')
EOF
  if touched 'scripts/agent/(check-bash32|tests/check-bash32)'; then
    run "check-bash32 tests" . scripts/agent/tests/check-bash32.test.sh
  fi
  [ $HAS_SHELLCHECK = 1 ] || result SKIP "shellcheck: not installed (bash -n only; brew install shellcheck)"
fi

# shared/ is imported by both apps, so a shared change re-checks both.
# scripts/agent/ re-checks mobile so a gate change runs against a real app.
if [ $FULL = 1 ] || touched 'mobile/|shared/|scripts/agent/'; then check_node_app mobile; fi
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

# a diff with no matching checks says so instead of passing silently
[ $CHECKS = 0 ] && result SKIP "no checks apply to the changed paths"

rm -rf "$LOG_DIR"
exit $FAILED
