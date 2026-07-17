#!/usr/bin/env bash
# __check.test.sh — Test fixtures for the mechanical emission gate
# Tests T-1 (cap & waiver) and T-3 (scope bleed)

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHECK="$SCRIPT_DIR/__check.sh"
PASS=0
FAIL=0

assert_json() {
  local desc="$1" input="$2"
  if echo "$input" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc — not valid JSON"
    FAIL=$((FAIL + 1))
  fi
}

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc"
    echo "    expected: $expected"
    echo "    actual:   $actual"
    FAIL=$((FAIL + 1))
  fi
}

# ── T-1: Mechanical Cap & Waiver ──────────────────────────────────────────
echo "=== T-1: Mechanical Cap & Waiver ==="

T1_FILE=$(mktemp)
# 25 lines > 100 chars (lines 1-25), one TODO (line 26),
# one long line with @waiver TB-09 (line 27)
for i in $(seq 1 25); do
  printf 'echo "this is a very long line number %d that exceeds one hundred characters so it triggers the line width check"\n' "$i" >> "$T1_FILE"
done
echo "# TODO: fix this later" >> "$T1_FILE"
printf 'echo "this is a very long waived line number 27 that exceeds one hundred characters but has a waiver"\n// @waiver TB-09: URL string\n' >> "$T1_FILE"

OUTPUT=$("$CHECK" "$T1_FILE")
echo "Output: $OUTPUT"

assert_json "T-1: output is valid JSON" "$OUTPUT"
COUNT=$(echo "$OUTPUT" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
assert_eq "T-1: violation count is 20" "20" "$COUNT"

# Last item should be the overflow sentinel
LAST_RULE=$(echo "$OUTPUT" | python3 -c "import sys,json; a=json.load(sys.stdin); print(a[-1]['rule'])")
assert_eq "T-1: last item rule is SYSTEM" "SYSTEM" "$LAST_RULE"

# Last item line should be 0
LAST_LINE=$(echo "$OUTPUT" | python3 -c "import sys,json; a=json.load(sys.stdin); print(a[-1]['line'])")
assert_eq "T-1: last item line is 0" "0" "$LAST_LINE"

# TB-10 violation (TODO on line 26) must be present
HAS_TB10=$(echo "$OUTPUT" | python3 -c "
import sys,json
a=json.load(sys.stdin)
tb10s = [v for v in a if v['rule'] == 'TB-10']
print('yes' if len(tb10s) > 0 else 'no')
")
assert_eq "T-1: TB-10 violation present" "yes" "$HAS_TB10"

# Waived line (line 27, with @waiver TB-09) must be absent
HAS_LINE27=$(echo "$OUTPUT" | python3 -c "
import sys,json
a=json.load(sys.stdin)
l27 = [v for v in a if v.get('line') == 27]
print('yes' if len(l27) > 0 else 'no')
")
assert_eq "T-1: waived line 27 absent" "no" "$HAS_LINE27"

rm "$T1_FILE"

# ── T-3: Scope Bleed ─────────────────────────────────────────────────────
echo "=== T-3: Scope Bleed ==="

T3_FILE=$(mktemp)
# A line that violates both TB-09 (>100 chars) and TB-10 (FIXME),
# but only waives TB-09
printf 'let response = "FIXME: process this later data structure that needs to be handled"; // @waiver TB-09: legacy string constraint\n' >> "$T3_FILE"

OUTPUT=$("$CHECK" "$T3_FILE")
echo "Output: $OUTPUT"

assert_json "T-3: output is valid JSON" "$OUTPUT"

# TB-09 violation must be absent (waived)
HAS_TB09=$(echo "$OUTPUT" | python3 -c "
import sys,json
a=json.load(sys.stdin)
tb09s = [v for v in a if v['rule'] == 'TB-09']
print('yes' if len(tb09s) > 0 else 'no')
")
assert_eq "T-3: TB-09 suppressed by waiver" "no" "$HAS_TB09"

# TB-10 violation must be present (not waived)
HAS_TB10=$(echo "$OUTPUT" | python3 -c "
import sys,json
a=json.load(sys.stdin)
tb10s = [v for v in a if v['rule'] == 'TB-10']
print('yes' if len(tb10s) > 0 else 'no')
")
assert_eq "T-3: TB-10 flagged (waiver is rule-scoped)" "yes" "$HAS_TB10"

rm "$T3_FILE"

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
