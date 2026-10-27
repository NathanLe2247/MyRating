#!/usr/bin/env bash
# Flags bash 4+ features in bash scripts (#29).
#
#   scripts/agent/check-bash32.sh <file>...
#
# macOS ships /bin/bash 3.2. `bash -n` and `shellcheck -S error` accept most
# bash 4+ features, which then break (or silently misbehave) at runtime on the
# user's shell. This prints one `file:line: ...` finding per construct, with the
# offending line, and exits 1 if there were any.
#
# The scan is lexical, not a full parser: it skips comments, single-quoted and
# $'...' strings, and quoted heredoc bodies. Text inside double quotes and
# unquoted heredoc bodies is only checked for parameter expansions (which still
# expand there), not for commands. Command substitutions nested in double
# quotes are not scanned for commands.
set -uo pipefail

[ $# -gt 0 ] || { echo "usage: $0 <file>..." >&2; exit 2; }

awk '
function flag(what) {
  printf "%s:%d: %s needs bash 4+ (macOS /bin/bash is 3.2)\n    %s\n", FILENAME, FNR, what, $0
  found = 1
}

# Splits the current line into `code` (unquoted shell text, quoted text
# blanked to "~") and `expn` (text where ${...} expands: unquoted plus
# double-quoted), and updates the quote/heredoc state for the next line.
function scan(line,    i, n, c, nx, pv, q, d, dash, quoted) {
  code = ""; expn = ""
  n = length(line)
  pv = ""
  for (i = 1; i <= n; i++) {
    c = substr(line, i, 1); nx = substr(line, i + 1, 1)
    if (st == "S") {
      if (c == "\047") st = "N"
      code = code "~"; expn = expn "~"
    } else if (st == "A") {
      if (c == "\\") { i++; code = code "~~"; expn = expn "~~" }
      else { if (c == "\047") st = "N"; code = code "~"; expn = expn "~" }
    } else if (st == "D") {
      if (c == "\\") { i++; code = code "~~"; expn = expn "~~" }
      else if (c == "\"") { st = "N"; code = code "~"; expn = expn "~" }
      else { code = code "~"; expn = expn c }
    } else { # N: unquoted
      if (c == "\\") { i++; code = code "~~"; expn = expn "~~"; pv = "~"; continue }
      if (c == "#" && (pv == "" || pv ~ /[ \t;&|()]/)) break # comment
      if (c == "$" && nx == "\047") { st = "A"; i++; code = code "~~"; expn = expn "~~"; pv = "~"; continue }
      if (c == "\047") { st = "S"; code = code "~"; expn = expn "~"; pv = "~"; continue }
      if (c == "\"") { st = "D"; code = code "~"; expn = expn "~"; pv = "~"; continue }
      # (( )) and $[ ] arithmetic, where << is a shift, not a heredoc. Counted
      # per line only (reset in the main rule), so a stray `((` such as
      # `((cd a); b)` cannot hide heredocs further down the file.
      if (c == "(" && nx == "(") arith++
      if (c == ")" && nx == ")" && arith > 0) arith--
      if (c == "$" && nx == "[") brk++
      if (c == "]" && brk > 0) brk--
      if (c == "<" && nx == "<" && pv != "<" && substr(line, i + 2, 1) != "<" && \
          ((arith == 0 && brk == 0) || substr(line, i + 2) ~ /^-?[ \t]*[\\\047"]/)) {
        # (a quoted delimiter is a heredoc even inside an apparent (( ), so a
        # quoted body is never scanned as code)
        # heredoc: <<[-] [quote]DELIM[quote]
        code = code "<<"; expn = expn "<<"
        i += 2; dash = 0; quoted = 0
        if (substr(line, i, 1) == "-") { dash = 1; i++ }
        while (substr(line, i, 1) ~ /[ \t]/) i++
        q = substr(line, i, 1)
        if (q == "\\") { quoted = 1; i++; q = "" }
        if (q == "\047" || q == "\"") {
          quoted = 1; i++; d = ""
          while (i <= n && substr(line, i, 1) != q) { d = d substr(line, i, 1); i++ }
        } else {
          d = ""
          while (i <= n && substr(line, i, 1) ~ /[A-Za-z0-9_.-]/) { d = d substr(line, i, 1); i++ }
          i--
        }
        if (d != "") { nh++; hd[nh] = d; hq[nh] = quoted; hdash[nh] = dash }
        pv = "~"
        continue
      }
      code = code c; expn = expn c
    }
    pv = c
  }
  if (nh > hcur) st = "H"
}

# True when `s` runs `shopt` with a bash 4+ option name in the same simple
# command and nothing handles its failure on 3.2: not followed by `||`, and
# not the condition of an if/elif/while/until.
function unguarded_shopt(s,    m, k, before, after) {
  while (match(s, CMD "shopt([ \t]+[^ \t;&|]+)*[ \t]+(" SHOPT4 ")([ \t;&|)]|$)")) {
    m = substr(s, RSTART, RLENGTH)
    k = index(m, "shopt")
    before = substr(s, 1, RSTART + k - 2)
    after = substr(s, RSTART + RLENGTH)
    if (m ~ /[;&|)]$/) after = substr(m, length(m)) after
    gsub(/[0-9]*>&[0-9-]*/, "", after) # 2>&1 is a redirect, not a separator
    if (after !~ /^[^;&|]*\|\|/ && before !~ /(^|[^A-Za-z0-9_])(if|elif|while|until)[ \t]+(![ \t]+)?$/) return 1
    s = after
  }
  return 0
}

BEGIN {
  # a word in command position: line start, after a separator, or after a
  # keyword that starts a command
  CMD = "(^|[;&|(){!]|(^|[ \t])(then|do|else|elif|if|while|until|time))[ \t]*"
  SPECIAL = "BASHPID|EPOCHSECONDS|EPOCHREALTIME|SRANDOM|BASH_ARGV0"
  SHOPT4 = "globstar|lastpipe|inherit_errexit|localvar_inherit|autocd|direxpand"
}

FNR == 1 { st = "N"; arith = 0; nh = 0; hcur = 0 }

{
  if (st == "H") {
    t = $0
    if (hdash[hcur + 1]) sub(/^\t+/, "", t)
    if (t == hd[hcur + 1]) {
      hcur++
      if (hcur >= nh) { st = "N"; nh = 0; hcur = 0 }
      next
    }
    if (hq[hcur + 1]) next
    code = ""; expn = $0
  } else {
    arith = 0; brk = 0
    scan($0)
  }

  if (expn ~ /\$\{[A-Za-z0-9_@*]+(\[[^]]*\])?[,^]/) flag("case modification ${x,,} / ${x^^}")
  if (expn ~ /\$\{[A-Za-z0-9_@*]+(\[[^]]*\])?@[A-Za-z]\}/) flag("${x@op} transformation")
  if (expn ~ /\$\{[A-Za-z_][A-Za-z0-9_]*\[-[0-9]/) flag("negative array index")
  # bare use only: ${BASHPID:-$$} and friends supply a 3.2 fallback
  if (expn ~ "[$](" SPECIAL ")([^A-Za-z0-9_]|$)" || \
      expn ~ "[$][{](" SPECIAL ")([^-:=+A-Za-z0-9_]|:[^-=+]|:?$)") flag("bash 4+/5 special variable")

  if (code ~ CMD "(declare|typeset|local)[ \t]+(-[A-Za-z]+[ \t]+)*-[A-Za-z]*A") flag("associative array (declare -A)")
  # (-f groups excluded: declare -fu etc. act on functions)
  if (code ~ CMD "(declare|typeset|local)[ \t]+(-[A-Za-z]+[ \t]+)*-[A-Za-eg-z]*n[A-Za-eg-z]*([ \t]|$)") flag("nameref (declare -n)")
  if (code ~ CMD "(declare|typeset|local)[ \t]+(-[A-Za-z]+[ \t]+)*-[A-Za-eg-z]*[lu][A-Za-eg-z]*([ \t]|$)") flag("case attribute (declare -l / -u)")
  if (code ~ CMD "(mapfile|readarray)([ \t;&|)]|$)") flag("mapfile / readarray")
  if (code ~ CMD "coproc([ \t;&|)]|$)") flag("coproc")
  if (code ~ CMD "wait[ \t]+-[A-Za-z]*n") flag("wait -n")
  if (code ~ /\[\[?[ \t]+(![ \t]+)?-v[ \t]/) flag("test -v")
  if (unguarded_shopt(code)) flag("bash 4+ shopt option")
  if (code ~ /&>>/) flag("&>> append redirect")
  if (code ~ /\|&/) flag("|& pipe")
  if (code ~ /;;?&/) flag("case fallthrough ;& / ;;&")
}

END { exit found }
' "$@"
