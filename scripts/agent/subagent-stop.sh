#!/usr/bin/env bash
# SubagentStop hook: a worker can't finish while its worktree fails the
# regression gate. Failures are sent back to the worker as the block reason so
# it fixes them and tries again. After MAX_ATTEMPTS blocked stops it is let
# through, and its report must say the gate is still failing.
#
# Only applies to agent worktrees (.claude/worktrees/*) with changes vs. main —
# read-only subagents (reviewers, Explore) and the manager's checkout pass.
set -uo pipefail
MAX_ATTEMPTS=4

INPUT=$(cat)
CWD=$(echo "$INPUT" | jq -r '.cwd // empty')
cd "${CWD:-$PWD}" 2>/dev/null || exit 0

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
case "$ROOT" in */.claude/worktrees/*) ;; *) exit 0 ;; esac

BASE=$(git merge-base origin/main HEAD 2>/dev/null) || exit 0
if git diff --quiet "$BASE" && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  exit 0
fi

COUNTER="$(git rev-parse --git-dir)/agent-regress-attempts"
ATTEMPTS=$(cat "$COUNTER" 2>/dev/null || echo 0)

if OUT=$("$ROOT/scripts/agent/regress.sh" 2>&1); then
  rm -f "$COUNTER"
  exit 0
fi

ATTEMPTS=$((ATTEMPTS + 1))
echo "$ATTEMPTS" >"$COUNTER"

if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
  rm -f "$COUNTER"
  echo "Regression gate still failing after $MAX_ATTEMPTS attempts; stopping anyway. Report this as FAILED with the output below." >&2
  echo "$OUT" >&2
  exit 0
fi

jq -n --arg out "$OUT" --arg n "$ATTEMPTS" --arg max "$MAX_ATTEMPTS" '{
  decision: "block",
  reason: ("Regression gate failed (attempt \($n)/\($max)). Fix these, commit, and finish again:\n\n" + $out)
}'
