#!/bin/sh
# Rule 4i, mechanical half. Runs BEFORE a diff is read.
#
#   sh scripts/check-removals.sh [baseline-ref]     # default HEAD
#
# Compares assertion/test counts and file existence in every changed test file
# against the baseline. Static, no suite run, milliseconds. Exit 1 if anything
# shrank. A drop is not automatically wrong -- a legitimate consolidation shrinks
# counts too -- but it must be EXPLAINED, never merely unnoticed.
#
# 4a-bis applies to this script itself: `sh scripts/check-removals.sh --prove`
# runs it in a state where it MUST report a removal, and fails loudly if it
# doesn't. A checker that silently compares zero files is the exact vacuous
# instrument this exists to prevent.

set -u
BASE="${1:-HEAD}"
TOKENS="it( test( describe( expect( assert. assert( skipIf"
status=0

if [ "$BASE" = "--prove" ]; then
  # Positive control. Delete a real assertion in a scratch copy and confirm we shout.
  f=$(git ls-files 'tests/*.test.ts' | head -1)
  [ -n "$f" ] || { echo "--prove: no test files tracked yet; nothing to prove against"; exit 1; }
  # Backup OUTSIDE the repo: a sibling .provebak lands in the changed set and the
  # checker reports it mid-run, which is noise in an instrument whose whole value
  # is that its output is unambiguous. (R-8)
  bak=$(mktemp -t provebak)
  trap 'cp "$bak" "$f" 2>/dev/null; rm -f "$bak"' EXIT INT TERM
  cp "$f" "$bak"
  grep -v 'assert\.' "$bak" > "$f"
  sh "$0" HEAD >/tmp/prove.out 2>&1; rc=$?
  cp "$bak" "$f"; rm -f "$bak"; trap - EXIT INT TERM
  if [ $rc -eq 0 ]; then
    echo "PROVE FAILED — removing every assert. from $f did not trip the checker."
    echo "The checker is vacuous. Fix it before trusting any pass it reports."
    exit 1
  fi
  echo "PROVE OK — checker reports a removal when one exists:"
  sed 's/^/    /' /tmp/prove.out
  exit 0
fi

count() { grep -oF "$2" "$1" 2>/dev/null | wc -l | tr -d ' '; }

changed=$(git diff --name-only "$BASE" -- 'tests/' '*.test.ts' '*.test.tsx'; \
          git ls-files --others --exclude-standard 'tests/' 2>/dev/null)
changed=$(printf '%s\n' $changed | sort -u | sed '/^$/d')

if [ -z "$changed" ]; then
  # 4a-bis: say so out loud. "compared zero files" must never read as "clean".
  echo "check-removals: NO test files changed vs $BASE — compared 0 files."
  echo "  (this is not a pass; it means the check had nothing to look at)"
  exit 0
fi

n=0
for f in $changed; do
  n=$((n + 1))
  if [ ! -f "$f" ]; then
    echo "REMOVED FILE  $f"
    status=1
    continue
  fi
  if ! git cat-file -e "$BASE:$f" 2>/dev/null; then
    echo "new           $f"
    continue
  fi
  for t in $TOKENS; do
    before=$(git show "$BASE:$f" 2>/dev/null | grep -oF "$t" | wc -l | tr -d ' ')
    after=$(count "$f" "$t")
    if [ "$after" -lt "$before" ]; then
      echo "SHRANK        $f  '$t'  $before -> $after"
      status=1
    fi
  done
done

echo "check-removals: compared $n file(s) against $BASE"
[ $status -eq 0 ] && echo "no removals" || echo "EXPLAIN EVERY LINE ABOVE, or restore it. Rule 4i."
exit $status
