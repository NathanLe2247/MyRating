#!/usr/bin/env bash
# Repro for #25: classify-pr.sh reports "issue #N labeled major" for every PR
# that closes an issue, even when the issue has no `major` label.
#
# Runs classify-pr.sh against a stub `gh` on PATH that serves canned JSON, so
# no live GitHub state is involved. The stub mimics real `gh -q` output: a
# null jq result prints an empty line, not "null" (checked against real gh:
# `gh issue view <N> --json labels -q '[.labels[].name] | index("major")'`
# prints "\n" for an issue without the label).
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
#   STUB_PR_LABELS, STUB_ISSUE_LABELS  JSON arrays of label names
q=""
prev=""
for a in "$@"; do
  case "$prev" in -q|--jq) q=$a ;; esac
  prev=$a
done
labels() { echo "$1" | jq -c '[.[] | {name: .}]'; }
emit() {
  # like gh -q: raw strings, and null prints as an empty line
  if [ -n "$q" ]; then jq -r "$q" | sed 's/^null$//'; else cat; fi
}
case "$1 $2" in
  "repo view") echo '{"nameWithOwner":"stub/repo"}' | emit ;;
  "api --paginate") echo '[{"status":"modified","additions":3,"deletions":1,"filename":"mobile/src/components/foo.tsx"}]' | emit ;;
  "pr view") printf '{"labels":%s,"body":"Fixes a thing.\\n\\nCloses #7","headRefName":"fix/7-thing","closingIssuesReferences":[]}\n' "$(labels "$STUB_PR_LABELS")" | emit ;;
  "issue view") printf '{"labels":%s}\n' "$(labels "$STUB_ISSUE_LABELS")" | emit ;;
  *) echo "gh stub: unhandled: $*" >&2; exit 1 ;;
esac
STUB
chmod +x "$STUB_DIR/gh"

FAIL=0
# check <name> <pr labels> <issue labels> <expected exit> <reason line> <present|absent>
check() {
  out=$(PATH="$STUB_DIR:$PATH" STUB_PR_LABELS=$2 STUB_ISSUE_LABELS=$3 "$CLASSIFY" 1 2>&1)
  rc=$?
  ok=1
  [ "$rc" -eq "$4" ] || ok=0
  if printf '%s\n' "$out" | grep -qxF -- "$5"; then
    [ "$6" = present ] || ok=0
  else
    [ "$6" = absent ] || ok=0
  fi
  if [ $ok -eq 1 ]; then
    echo "PASS $1"
  else
    echo "FAIL $1 (exit $rc, expected $4; '$5' should be $6)"
    printf '%s\n' "$out" | sed 's/^/    /'
    FAIL=1
  fi
}

check "issue without major -> ROUTINE"   '[]'              '["bug","agent"]' 0  "- issue #7 labeled major" absent
check "issue with no labels -> ROUTINE"  '[]'              '[]'              0  "- issue #7 labeled major" absent
check "issue labeled major -> MAJOR"     '[]'              '["major"]'       10 "- issue #7 labeled major" present
check "issue labeled major (not first)"  '[]'              '["bug","major"]' 10 "- issue #7 labeled major" present
check "PR labeled major -> MAJOR"        '["major"]'       '["bug"]'         10 "- labeled major"          present
check "PR labeled major (not first)"     '["bug","major"]' '[]'              10 "- labeled major"          present
check "PR without major -> no PR reason" '["bug"]'         '[]'              0  "- labeled major"          absent

exit $FAIL
