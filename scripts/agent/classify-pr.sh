#!/usr/bin/env bash
# Decides whether a PR is ROUTINE (the manager may merge it) or MAJOR (the
# user reviews and merges it). Rules go by path and size, so the call doesn't
# rest on judgment. The manager may escalate a ROUTINE PR to MAJOR, never the
# reverse.
#
#   scripts/agent/classify-pr.sh <PR>
#
# Prints ROUTINE or MAJOR on the first line, then one "- reason" per rule
# hit. Exit 0 = ROUTINE, 10 = MAJOR, 1 = error.
#
# ROUTINE is app-level work: screens, components, hooks, constants, copy,
# styles, i18n, and tests in mobile/ or frontend/, plus bug fixes in those.
set -uo pipefail

PR=${1:?usage: classify-pr.sh <PR>}
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner) || exit 1

# filename, status, and changed-line count per file
FILES=$(gh api --paginate "repos/$REPO/pulls/$PR/files" \
  --jq '.[] | "\(.status)\t\(.additions + .deletions)\t\(.filename)"') || exit 1
META=$(gh pr view "$PR" --json labels,body,headRefName) || exit 1

REASONS=()
hit() { REASONS+=("$1"); }

# Paths under __tests__/ are test-only and never make a PR major by path.
NONTEST=$(echo "$FILES" | awk -F'\t' '$3 !~ /(^|\/)__tests__\// && $3 !~ /\.test\.[jt]sx?$/')
paths() { echo "$NONTEST" | cut -f3 | grep -E "$1"; }
any() { paths "$1" >/dev/null; }

any '^backend/supabase/migrations/'       && hit "database migration (applied to production on merge)"
any '^backend/supabase/functions/'        && hit "edge function (server-side; the only writer of ratings and match state)"
any '^backend/' && ! any '^backend/supabase/(migrations|functions)/' && hit "backend config or Django service"
any '^shared/'                            && hit "shared/ cross-app types or schemas (both apps and the backend depend on them)"
any '^mobile/app/\(auth\)/|^mobile/app/sso-callback|^mobile/src/components/auth/|^mobile/src/hooks/use-(auth|google-sign-in)|^mobile/src/providers/' \
                                          && hit "authentication, sign-in, or app-wide providers"
any '^mobile/src/config/|^frontend/src/config/' && hit "client config (Supabase client, env access)"
any '(health|whoop|healthkit)'            && hit "health data or OAuth"
any '(^|/)package\.json$'                 && hit "dependencies or package scripts"
any '(^|/)(app\.json|eas\.json|tsconfig\.json|babel\.config\.js|metro\.config\.js|eslint\.config\.js|next\.config\.[jt]s)$' \
                                          && hit "build, app, or tooling config"
any '^\.github/'                          && hit "CI / GitHub workflows"
any '^\.claude/|^agent/|^scripts/agent/|(^|/)CLAUDE\.md$' && hit "agent rules or project instructions"

# Removing a screen or route is a product decision.
echo "$NONTEST" | awk -F'\t' '$1 == "removed" && $3 ~ /^(mobile|frontend)\/app\//' | grep -q . \
  && hit "removes a screen or route"

# Size, excluding lockfiles and tests
SIZE=$(echo "$NONTEST" | awk -F'\t' '$3 !~ /package-lock\.json$/ {s += $2} END {print s + 0}')
[ "$SIZE" -gt 600 ] && hit "large change ($SIZE lines outside tests and lockfiles)"

# The user can force review with a `major` label on the PR or its issue
echo "$META" | jq -e '[.labels[].name] | index("major")' >/dev/null && hit "labeled major"
for N in $(echo "$META" | jq -r .body | grep -oiE '(closes|fixes|resolves) #[0-9]+' | grep -oE '[0-9]+'); do
  gh issue view "$N" --json labels -q '[.labels[].name] | index("major")' 2>/dev/null | grep -qv null \
    && hit "issue #$N labeled major"
done

# Only agent branches can be routine
echo "$META" | jq -r .headRefName | grep -qE '^(agent|fix)/[0-9]+-' || hit "not an agent branch (agent/<N>-… or fix/<N>-…)"

if [ ${#REASONS[@]} -eq 0 ]; then
  echo ROUTINE
  exit 0
fi
echo MAJOR
printf -- '- %s\n' "${REASONS[@]}"
exit 10
