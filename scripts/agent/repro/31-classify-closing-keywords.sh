#!/usr/bin/env bash
# Repro for #31: classify-pr.sh only recognises "closes|fixes|resolves"
# followed by a space, so a PR that closes a `major` issue with any other
# keyword GitHub accepts (close/closed/fix/fixed/resolve/resolved, an optional
# colon, a tab separator) comes out ROUTINE. It also ignores GitHub's own
# closing links (closingIssuesReferences), so an issue linked there but not in
# the body is never checked.
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
# Minimal gh stub for classify-pr.sh. Like real gh, `pr view --json F` only
# returns the fields asked for. Canned data comes from env:
#   STUB_BODY          PR body
#   STUB_REFS          space-separated owner/repo#N in closingIssuesReferences
#   STUB_REFS_FAIL     1 = `gh pr view --json closingIssuesReferences` exits 1
#   STUB_MAJOR_ISSUES  space-separated issue numbers labeled major
q=""
prev=""
fields=""
for a in "$@"; do
  case "$prev" in -q|--jq) q=$a ;; --json) fields=$a ;; esac
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
  "pr view")
    case ",$fields," in
      *,closingIssuesReferences,*)
        [ "${STUB_REFS_FAIL:-}" = 1 ] && { echo "GraphQL: API rate limit exceeded" >&2; exit 1; }
        # shellcheck disable=SC2086
        printf '%s\n' ${STUB_REFS:-} \
          | jq -R 'select(length > 0) | capture("^(?<o>[^/]+)/(?<r>[^#]+)#(?<n>[0-9]+)$")
              | {number: (.n | tonumber), repository: {name: .r, owner: {login: .o}},
                 url: "https://github.com/\(.o)/\(.r)/issues/\(.n)"}' \
          | jq -s '{closingIssuesReferences: .}' | emit ;;
      *) jq -n --arg b "$STUB_BODY" '{labels: [], body: $b, headRefName: "fix/7-thing"}' | emit ;;
    esac ;;
  "issue view")
    if in_list "$3" "${STUB_MAJOR_ISSUES:-}"; then echo '{"labels":[{"name":"bug"},{"name":"major"}]}' | emit
    else echo '{"labels":[{"name":"bug"}]}' | emit; fi ;;
  *) echo "gh stub: unhandled: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "$STUB_DIR/gh"

FAIL=0
run() { PATH="$STUB_DIR:$PATH" STUB_BODY=$1 STUB_REFS=$2 STUB_REFS_FAIL=$3 STUB_MAJOR_ISSUES=$4 "$CLASSIFY" 1 2>&1; }
# check <name> <body> <closing refs> <refs call fails: 1|""> <major issues> <expected exit> <reason line or "">
# With an empty reason line, the output must be exactly ROUTINE.
check() {
  out=$(run "$2" "$3" "$4" "$5")
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

TAB=$(printf '\t')
OTHER="- closes someone/else#7 in another repo (labels can't be checked)"
# other closing keywords and separators GitHub accepts, major issue -> MAJOR
check "Fixed #7, major"              'Fixed #7'                     '' '' '7' 10 "- issue #7 labeled major"
check "Closes: #7, major"            'Closes: #7'                   '' '' '7' 10 "- issue #7 labeled major"
check "close #7, major"              'close #7'                     '' '' '7' 10 "- issue #7 labeled major"
check "Closes<TAB>#7, major"         "Closes${TAB}#7"               '' '' '7' 10 "- issue #7 labeled major"
check "RESOLVED #7, major"           'RESOLVED #7'                  '' '' '7' 10 "- issue #7 labeled major"
check "fix: owner/repo#7, major"     'fix: NathanLe2247/MyRating#7' '' '' '7' 10 "- issue #7 labeled major"
check "Closed: other repo -> MAJOR"  'Closed: someone/else#7'       '' '' ''  10 "$OTHER"
# GitHub's own closing links
check "only in closingIssuesReferences, major" 'Fixes a thing.' 'NathanLe2247/MyRating#7' '' '7' 10 "- issue #7 labeled major"
check "closingIssuesReferences other repo"     'Fixes a thing.' 'someone/else#7'          '' ''  10 "$OTHER"
check "closingIssuesReferences call fails"     'Closes #7'      ''                        1  ''  10 "- couldn't read the PR's closing issue references"
# an issue named several times prints its reason once
n=$(run $'Closes #7\nfixed #7' 'NathanLe2247/MyRating#7' '' 7 | grep -cxF -- "- issue #7 labeled major")
if [ "$n" = 1 ]; then echo "PASS repeated issue prints its reason once"
else echo "FAIL repeated issue prints its reason $n times"; FAIL=1; fi
# readable, unlabeled, same-repo issues stay routine
check "Fixed #7, unlabeled"                    'Fixed #7'       ''                        '' '' 0 ""
check "closingIssuesReferences, unlabeled"     'Fixes a thing.' 'NathanLe2247/MyRating#7' '' '' 0 ""
check "no closing reference"                   'Fixes a thing.' ''                        '' '' 0 ""

exit $FAIL
