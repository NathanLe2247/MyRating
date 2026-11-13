#!/usr/bin/env bash
# The only way the manager merges. `gh pr merge` itself is denied in
# .claude/settings.json. Refuses unless all of these hold:
#   - classify-pr.sh says ROUTINE
#   - the PR head is exactly the commit the gates ran on
#   - origin/main is exactly the commit the gates merged in (so main didn't
#     move under the test)
#   - the PR is open, not a draft, and GitHub says it merges cleanly
#
#   scripts/agent/merge-pr.sh <PR> <gated-head-sha> <gated-main-sha>
#
# Run it from the main checkout so the rules are the ones on main. A PR that
# edits scripts/agent/ is MAJOR, so the agents can't loosen these checks.
set -uo pipefail

PR=${1:?usage: merge-pr.sh <PR> <gated-head-sha> <gated-main-sha>}
HEAD_SHA=${2:?gated head sha required}
MAIN_SHA=${3:?gated main sha required}
DIR=$(cd "$(dirname "$0")" && pwd)

refuse() { echo "REFUSED: $*" >&2; exit 1; }

CLASS=$("$DIR/classify-pr.sh" "$PR")
case $? in
  0) ;;
  10) echo "$CLASS" >&2; refuse "PR #$PR is MAJOR, so the user merges it" ;;
  *) refuse "could not classify PR #$PR" ;;
esac

INFO=$(gh pr view "$PR" --json state,isDraft,mergeable,mergeStateStatus,headRefOid) || refuse "gh pr view failed"
[ "$(jq -r .state <<<"$INFO")" = OPEN ] || refuse "PR #$PR is not open"
[ "$(jq -r .isDraft <<<"$INFO")" = false ] || refuse "PR #$PR is still a draft"
[ "$(jq -r .headRefOid <<<"$INFO")" = "$HEAD_SHA" ] || refuse "PR head moved since the gates ran; re-gate"
[ "$(jq -r .mergeable <<<"$INFO")" = MERGEABLE ] || refuse "PR #$PR is not cleanly mergeable"
[ "$(jq -r .mergeStateStatus <<<"$INFO")" = CLEAN ] || refuse "merge state is $(jq -r .mergeStateStatus <<<"$INFO"), not CLEAN"

git fetch -q origin main || refuse "fetch failed"
[ "$(git rev-parse origin/main)" = "$MAIN_SHA" ] || refuse "main moved since the gates ran; re-gate against the new main"

gh pr merge "$PR" --merge --delete-branch --match-head-commit "$HEAD_SHA"
