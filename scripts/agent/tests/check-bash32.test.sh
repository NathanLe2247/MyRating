#!/usr/bin/env bash
# Tests for scripts/agent/check-bash32.sh (#29). Run by regress.sh when the
# checker or this file changes; exits 1 on any failed case.
set -uo pipefail

CHECK="$(cd "$(dirname "$0")/.." && pwd)/check-bash32.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
FAILS=0

# expect_flag <line-of-bash> : the checker must fail and report <file>:2:
expect_flag() {
  local f="$TMP/bad.sh"
  printf '#!/bin/bash\n%s\n' "$1" >"$f"
  local out
  if out=$("$CHECK" "$f" 2>&1); then
    echo "not flagged: $1"; FAILS=1
  elif ! echo "$out" | grep -qF "$f:2:"; then
    echo "flagged without file:line: $1"; echo "$out"; FAILS=1
  fi
}

while IFS= read -r line; do
  [ -n "$line" ] && expect_flag "$line"
done <<'EOF'
echo "${name,,}"
echo ${name^^}
x=${name,}
echo "${arr[1]^^}"
declare -A map
local -A map
typeset -A map
declare -gA map
local -r -A map
declare -n ref=x
declare -l lower
mapfile -t lines < f
readarray lines
x=$(mapfile -t a)
echo hi &>> log
make |& tee log
coproc worker { cat; }
wait -n
[[ -v name ]]
shopt -s globstar
echo "${x@Q}"
echo "${arr[-1]}"
echo "$EPOCHSECONDS"
case x in a) echo ;& b) echo ;; esac
case x in a) echo ;;& b) echo ;; esac
EOF

# A file of constructs that are fine on bash 3.2 or only look like bash 4.
cat >"$TMP/good.sh" <<'EOF'
#!/bin/bash
# comments may mention ${x,,}, declare -A, mapfile, &>> and |&
echo 'single quotes: ${x,,} declare -A mapfile &>> |&'
echo "double quotes: declare -A mapfile readarray &>> |& wait -n"
echo $'ansi ${x^^} \' mapfile'
echo "${x:-a,b}" "${x//,/ }" "${#x}" "${!x}" "${x%,*}" "${x#^}"
echo "${arr[@]}" "${#arr[@]}" "${arr[$((n - 1))]}"
x=$(( 1 << 2 ))
declare -a list; local -r ro=1; declare -x ex; export -n ex
echo hi >>log 2>&1; echo hi >&2; a || b && c | d
case $x in a) echo a ;; esac
grep -q mapfile file # a word in an argument is fine
cat <<'QUOTED'
declare -A inside a quoted heredoc ${x,,}
QUOTED
cat <<-PLAIN
	mapfile in an unquoted heredoc body is text, not a command
	PLAIN
echo done
EOF
if ! out=$("$CHECK" "$TMP/good.sh" 2>&1); then
  echo "false positive(s):"; echo "$out"; FAILS=1
fi

# An unquoted heredoc body still expands ${x,,}.
printf '#!/bin/bash\ncat <<EOF\n${x,,}\nEOF\n' >"$TMP/heredoc.sh"
if "$CHECK" "$TMP/heredoc.sh" >/dev/null 2>&1; then
  echo "not flagged: \${x,,} in an unquoted heredoc"; FAILS=1
fi

[ $FAILS = 0 ] && echo "check-bash32: all cases pass"
exit $FAILS
