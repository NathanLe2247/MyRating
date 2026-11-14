#!/usr/bin/env bash
# Deletes branches whose work is already on main. The manager runs it every
# pass. It only deletes when nothing can be lost:
#
#   remote branch   its PR was MERGED, the branch tip is still the merged PR
#                   head (no commits were added after the merge), and no
#                   open PR uses it.
#   local branch    same test against its remote branch, or (for branches
#                   with no PR, like worktree-agent-*) the tip is already
#                   on origin/main. Uses `git branch -d`, which refuses
#                   unmerged work.
#   agent worktree  .claude/worktrees/agent-* only, not locked, clean, and
#                   its HEAD is on origin/main. Removed without --force.
#
# Kept: main, branches with an open PR, closed-but-unmerged PRs, branches
# with commits after the merge, branches with no PR and unmerged work,
# anything checked out in a worktree that isn't an agent worktree, and locked
# worktrees plus the branches checked out in them. A locked worktree is in use
# (a running agent); a fresh one has no commits yet, so its HEAD is on main
# and would otherwise look prunable (#84).
#
#   scripts/agent/prune-branches.sh            # delete
#   scripts/agent/prune-branches.sh --dry-run  # only print
set -uo pipefail

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

# run <message> <command...>: prints the message after the command succeeds.
run() {
  msg=$1; shift
  if [ "$DRY" = 1 ]; then echo "would: $msg"; else "$@" && echo "$msg"; fi
}

git fetch -q --prune origin || { echo "prune-branches: fetch failed" >&2; exit 1; }
ROOT=$(git rev-parse --show-toplevel)

on_main() { git merge-base --is-ancestor "$1" origin/main 2>/dev/null; }

# Prints "yes" if the branch's work is safely on main through a merged PR.
merged_pr_at_tip() {
  b=$1 tip=$2
  prs=$(gh pr list --state all --head "$b" --json state,headRefOid \
    --jq '.[] | "\(.state) \(.headRefOid)"' 2>/dev/null) || { echo no; return; }
  ok=no
  while read -r state oid; do
    [ -z "$state" ] && continue
    [ "$state" = OPEN ] && { echo no; return; }
    [ "$state" = MERGED ] && [ "$oid" = "$tip" ] && ok=yes
  done <<EOF
$prs
EOF
  echo "$ok"
}

# Prints one "<path> TAB <locked|-> TAB <branch|->" line per worktree from
# the porcelain records. A "locked" line, with an optional reason, follows the
# worktree/HEAD/branch lines of its record; records end with a blank line.
worktrees() {
  git worktree list --porcelain | awk '
    function emit() { if (wt != "") printf "%s\t%s\t%s\n", wt, lk, br; wt = "" }
    /^worktree /   { emit(); wt = substr($0, 10); lk = "-"; br = "-"; next }
    /^branch /     { br = substr($0, 8); sub("^refs/heads/", "", br); next }
    /^locked( |$)/ { lk = "locked"; next }
    /^$/           { emit() }
    END            { emit() }'
}
TAB=$(printf '\t')

# Branches checked out in locked worktrees, read before anything is removed.
LOCKED_BRANCHES=$(worktrees | awk -F'\t' '$2 == "locked" && $3 != "-" {print $3}')

# 1. Agent worktrees whose work is on main. Locked ones are in use.
worktrees | while IFS=$TAB read -r wt lk _; do
  case $wt in "$ROOT"/.claude/worktrees/agent-*) ;; *) continue ;; esac
  [ "$lk" = locked ] && { echo "keep worktree $wt (locked: in use)"; continue; }
  [ -n "$(git -C "$wt" status --porcelain 2>/dev/null)" ] && { echo "keep worktree $wt (uncommitted changes)"; continue; }
  if on_main "$(git -C "$wt" rev-parse HEAD)"; then
    run "removed worktree $wt" git worktree remove "$wt"
  else
    echo "keep worktree $wt (work not on main)"
  fi
done
git worktree prune

CHECKED_OUT=$(worktrees | awk -F'\t' '$3 != "-" {print $3}'; printf '%s\n' "$LOCKED_BRANCHES")

# 2. Remote branches.
git for-each-ref --format='%(refname:strip=3) %(objectname)' refs/remotes/origin | while read -r b tip; do
  case $b in main|HEAD) continue ;; esac
  if [ "$(merged_pr_at_tip "$b" "$tip")" = yes ]; then
    run "deleted origin/$b" git push -q origin --delete "$b"
  fi
done

# 3. Local branches.
git for-each-ref --format='%(refname:strip=2) %(objectname)' refs/heads | while read -r b tip; do
  [ "$b" = main ] && continue
  printf '%s\n' "$CHECKED_OUT" | grep -qxF "$b" && continue
  if [ "$(merged_pr_at_tip "$b" "$tip")" = yes ] || on_main "$tip"; then
    run "deleted local $b" git branch -q -d "$b" 2>/dev/null
  fi
done
exit 0
