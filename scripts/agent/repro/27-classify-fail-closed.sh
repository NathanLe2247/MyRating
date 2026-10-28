#!/usr/bin/env bash
# Repro for #27: classify-pr.sh fails open when a linked issue's labels can't
# be read (gh error discarded, so the PR can come out ROUTINE), and it ignores
# closing references written as owner/repo#N or as full issue URLs.
#
# Runs classify-pr.sh against a stub `gh` on PATH that serves canned JSON, so
# no live GitHub state is involved. Every case's PR is otherwise routine (one
# small mobile component, fix/ branch, no PR labels), so the linked-issue rule
# alone decides the outcome.
#
# Exits 0 when every case classifies correctly, 1 otherwise.
set -uo pipefail

ROOT=$(git rev-parse --show-toplevel)
CLASSIFY="$ROOT/scripts/agent/classify-pr.sh"
STUB_DIR=$(mktemp -d)
trap 'rm -rf "$STUB_DIR"' EXIT

cat > "$STUB_DIR/gh" <<'STUB'
#!/usr/bin/env bash
# Minimal gh stub for classify-pr.sh. Canned data comes from env:
#   STUB_BODY          PR body
#   STUB_MAJOR_ISSUES  space-separated issue numbers labeled major
#   STUB_FAIL_ISSUES   issue numbers whose `gh issue view` exits 1
#   STUB_EMPTY_ISSUES  issue numbers whose `gh issue view` prints nothing, exit 0
q=""
prev=""
for a in "$@"; do
  case "$prev" in -q|--jq) q=$a ;; esac
  prev=$a
done
emit() {
  # like gh -q: raw strings, and null prints as an empty line
  if [ -n "$q" ]; then jq -r "$q" | sed 's/^null$//'; else cat; fi
}
in_list() { case " $2 " in *" $1 "*) return 0 ;; esac; return 1; }
case "$1 $2" in
  "repo view") echo '{"nameWithOwner":"NathanLe2247/MyRating"}' | emit ;;
  "api --paginate") echo '[{"status":"modified","additions":3,"deletions":1,"filename":"mobile/src/components/foo.tsx"}]' | emit ;;
  "pr view") jq -n --arg b "$STUB_BODY" '{labels: [], body: $b, headRefName: "fix/7-thing", closingIssuesReferences: []}' | emit ;;
  "issue view")
    n=$3
    in_list "$n" "${STUB_FAIL_ISSUES:-}" && { echo "GraphQL: Could not resolve to an issue ($n)" >&2; exit 1; }
    in_list "$n" "${STUB_EMPTY_ISSUES:-}" && exit 0
    if in_list "$n" "${STUB_MAJOR_ISSUES:-}"; then echo '{"labels":[{"name":"bug"},{"name":"major"}]}' | emit
    else echo '{"labels":[{"name":"bug"}]}' | emit; fi ;;
  *) echo "gh stub: unhandled: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "$STUB_DIR/gh"

FAIL=0
# check <name> <body> <major issues> <failing issues> <empty issues> <expected exit> <reason line or "">
# With an empty reason line, the output must be exactly ROUTINE.
check() {
  out=$(PATH="$STUB_DIR:$PATH" STUB_BODY=$2 STUB_MAJOR_ISSUES=$3 STUB_FAIL_ISSUES=$4 STUB_EMPTY_ISSUES=$5 "$CLASSIFY" 1 2>&1)
  rc=$?
  ok=1
  [ "$rc" -eq "$6" ] || ok=0
  if [ -n "$7" ]; then
    printf '%s\n' "$out" | grep -qxF -- "$7" || ok=0
  else
    [ "$out" = ROUTINE ] || ok=0
  fi
  if [ $ok -eq 1 ]; then
    echo "PASS $1"
  else
    echo "FAIL $1 (exit $rc, expected $6; expected line: '${7:-ROUTINE only}')"
    printf '%s\n' "$out" | sed 's/^/    /'
    FAIL=1
  fi
}

# fail closed
check "gh issue view fails -> MAJOR"          'Closes #7'           '' '7' '' 10 "- couldn't read issue #7 labels"
check "gh issue view prints nothing -> MAJOR" 'Closes #7'           '' ''  '7' 10 "- couldn't read issue #7 labels"
check "second of two issues fails -> MAJOR"   $'Closes #7\nFixes #8' '' '8' '' 10 "- couldn't read issue #8 labels"
# readable issues: unchanged behavior
check "unlabeled readable issue -> ROUTINE"   'Closes #7'           ''  '' '' 0  ""
check "issue labeled major -> MAJOR"          'Closes #7'           '7' '' '' 10 "- issue #7 labeled major"
check "no closing reference -> ROUTINE"       'Fixes a thing.'      ''  '' '' 0  ""
# owner/repo#N and URLs for this repo are checked
check "this-repo owner/repo#N, major"         'Closes NathanLe2247/MyRating#7' '7' '' '' 10 "- issue #7 labeled major"
check "this-repo owner/repo#N, other case"    'fixes nathanle2247/myrating#7'  '7' '' '' 10 "- issue #7 labeled major"
check "this-repo owner/repo#N, unlabeled"     'Closes NathanLe2247/MyRating#7' ''  '' '' 0  ""
check "this-repo owner/repo#N, unreadable"    'Closes NathanLe2247/MyRating#7' ''  '7' '' 10 "- couldn't read issue #7 labels"
check "this-repo issue URL, major"            'Resolves https://github.com/NathanLe2247/MyRating/issues/7' '7' '' '' 10 "- issue #7 labeled major"
check "this-repo issue URL, unlabeled"        'Closes https://github.com/NathanLe2247/MyRating/issues/7'   ''  '' '' 0  ""
# other repos can't be checked
check "other-repo owner/repo#N -> MAJOR"      'Closes someone/else#7' '' '' '' 10 "- closes someone/else#7 in another repo (labels can't be checked)"
check "other-repo issue URL -> MAJOR"         'Closes https://github.com/someone/else/issues/7' '' '' '' 10 "- closes someone/else#7 in another repo (labels can't be checked)"

exit $FAIL
