#!/usr/bin/env bash
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

rule_lines() {
  local rule="$1" input="$2"
  echo "$input" | python3 -c "
import sys,json
a=json.load(sys.stdin)
print(','.join(str(v.get('line')) for v in a if v['rule'] == sys.argv[1]))
" "$rule"
}

echo "=== T-1: Mechanical Cap & Waiver ==="

T1_FILE=$(mktemp)
for i in $(seq 1 25); do
  printf 'echo "this is a very long line number %d that exceeds one hundred characters so it triggers the line width check"\n' "$i" >> "$T1_FILE" # @waiver TB-09: fixture must exceed 100
done
echo "# TODO: fix this later" >> "$T1_FILE" # @waiver TB-10: fixture content
printf 'echo "this is a very long waived line number 27 that exceeds one hundred characters but has a waiver"\n// @waiver TB-09: URL string\n' >> "$T1_FILE" # @waiver TB-09: fixture must exceed 100

OUTPUT=$("$CHECK" "$T1_FILE")
echo "Output: $OUTPUT"

assert_json "T-1: output is valid JSON" "$OUTPUT"
COUNT=$(echo "$OUTPUT" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))") # @waiver TB-09: inline
assert_eq "T-1: violation count is 20" "20" "$COUNT"

LAST_RULE=$(echo "$OUTPUT" | python3 -c "import sys,json; a=json.load(sys.stdin); print(a[-1]['rule'])") # @waiver TB-09: inline
assert_eq "T-1: last item rule is SYSTEM" "SYSTEM" "$LAST_RULE"

LAST_LINE=$(echo "$OUTPUT" | python3 -c "import sys,json; a=json.load(sys.stdin); print(a[-1]['line'])") # @waiver TB-09: inline
assert_eq "T-1: last item line is 0" "0" "$LAST_LINE"

HAS_TB10=$(echo "$OUTPUT" | python3 -c "
import sys,json
a=json.load(sys.stdin)
tb10s = [v for v in a if v['rule'] == 'TB-10']
print('yes' if len(tb10s) > 0 else 'no')
")
assert_eq "T-1: TB-10 violation present" "yes" "$HAS_TB10"

HAS_LINE27=$(echo "$OUTPUT" | python3 -c "
import sys,json
a=json.load(sys.stdin)
l27 = [v for v in a if v.get('line') == 27]
print('yes' if len(l27) > 0 else 'no')
")
assert_eq "T-1: waived line 27 absent" "no" "$HAS_LINE27"

rm "$T1_FILE"

echo "=== T-3: Scope Bleed ==="

T3_FILE=$(mktemp)
printf 'let response = "FIXME: process this later data structure that needs to be handled"; // @waiver TB-09: legacy string constraint\n' >> "$T3_FILE" # @waiver TB-10: fixture content

OUTPUT=$("$CHECK" "$T3_FILE")
echo "Output: $OUTPUT"

assert_json "T-3: output is valid JSON" "$OUTPUT"

HAS_TB09=$(echo "$OUTPUT" | python3 -c "
import sys,json
a=json.load(sys.stdin)
tb09s = [v for v in a if v['rule'] == 'TB-09']
print('yes' if len(tb09s) > 0 else 'no')
")
assert_eq "T-3: TB-09 suppressed by waiver" "no" "$HAS_TB09"

HAS_TB10=$(echo "$OUTPUT" | python3 -c "
import sys,json
a=json.load(sys.stdin)
tb10s = [v for v in a if v['rule'] == 'TB-10']
print('yes' if len(tb10s) > 0 else 'no')
")
assert_eq "T-3: TB-10 flagged (waiver is rule-scoped)" "yes" "$HAS_TB10"

rm "$T3_FILE"

echo "=== T-4: Comment Ban ==="

T4_TS=$(mktemp --suffix=.ts)
cat > "$T4_TS" <<'TS'
import x from "y";
const url = "https://example.com//path";
// prose comment
// @waiver TB-17: justified
// @ts-nocheck
/** docblock */
/**
 * doc line
 */
const s = `${x}//not a comment`;
TS
OUTPUT=$("$CHECK" "$T4_TS")
echo "Output: $OUTPUT"
assert_json "T-4: ts output is valid JSON" "$OUTPUT"
assert_eq "T-4: ts prose and docblock flagged" "3,6,7,8,9" "$(rule_lines TB-17 "$OUTPUT")"
rm "$T4_TS"

T4_SH=$(mktemp --suffix=.sh)
printf '%s\n' '#!/usr/bin/env bash' 'echo "${x#prefix}"' > "$T4_SH"
printf '%s\n' '# prose comment' '# ponytail: kept' >> "$T4_SH"
OUTPUT=$("$CHECK" "$T4_SH")
echo "Output: $OUTPUT"
assert_eq "T-4: sh flags prose only, keeps shebang and ponytail" "3" "$(rule_lines TB-17 "$OUTPUT")"
rm "$T4_SH"

T4_RS=$(mktemp --suffix=.rs)
cat > "$T4_RS" <<'RS'
#[derive(Debug)]
//go:build ignore
/// rustdoc
fn main() { let x = 5; }
RS
OUTPUT=$("$CHECK" "$T4_RS")
echo "Output: $OUTPUT"
assert_eq "T-4: rs flags rustdoc, keeps attribute and build tag" "3" "$(rule_lines TB-17 "$OUTPUT")"
rm "$T4_RS"

T4_SQL=$(mktemp --suffix=.sql)
cat > "$T4_SQL" <<'SQL'
select 1;
-- prose comment
SQL
OUTPUT=$("$CHECK" "$T4_SQL")
assert_eq "T-4: sql flags -- comment" "2" "$(rule_lines TB-17 "$OUTPUT")"
rm "$T4_SQL"

T4_NONE=$(mktemp)
printf '// prose comment\necho hi\n' > "$T4_NONE"
OUTPUT=$("$CHECK" "$T4_NONE")
assert_eq "T-4: unknown extension skips the comment rule" "" "$(rule_lines TB-17 "$OUTPUT")"
rm "$T4_NONE"

LONG_ROW='| TB-09 | a markdown table row long enough to exceed one hundred columns when it is'
LONG_ROW="$LONG_ROW"' written out in full, which markdown cannot wrap |'

T4_MD=$(mktemp --suffix=.md)
{
  printf '# Prose is not code\n\n'
  printf 'A rule may name %s in prose.\n\n' "TO""DO"
  printf '%s\n' "$LONG_ROW"
} > "$T4_MD"
OUTPUT=$("$CHECK" "$T4_MD")
assert_eq "T-4: markdown is not graded as code" "[]" "$OUTPUT"
rm "$T4_MD"

echo "=== T-5: File Type Scoping ==="

T5_FENCES=$(mktemp --suffix=.md)
{
  printf '# Doc\n\n'
  printf '```bash\necho hi\n```\n\n'
  printf '```mermaid\nflowchart TB\n    A --> B\n```\n'
} > "$T5_FENCES"
OUTPUT=$("$CHECK" "$T5_FENCES")
assert_eq "T-5: balanced fences and mermaid pass" "[]" "$OUTPUT"
rm "$T5_FENCES"

T5_OPEN=$(mktemp --suffix=.md)
printf '# Doc\n\n```bash\necho hi\n' > "$T5_OPEN"
OUTPUT=$("$CHECK" "$T5_OPEN")
assert_json "T-5: unclosed fence output is valid JSON" "$OUTPUT"
assert_eq "T-5: unclosed fence is flagged" "3" "$(rule_lines MD-01 "$OUTPUT")"
rm "$T5_OPEN"

T5_MERMAID=$(mktemp --suffix=.md)
{
  printf '```mermaid\nflowchart TB\n    subgraph X\n        A --> B\n```\n'
} > "$T5_MERMAID"
OUTPUT=$("$CHECK" "$T5_MERMAID")
assert_eq "T-5: unbalanced mermaid subgraph is flagged" "1" "$(rule_lines MD-01 "$OUTPUT")"
rm "$T5_MERMAID"

T5_JSON=$(mktemp --suffix=.json)
printf '{"a": 1, "b": [2, 3]}\n' > "$T5_JSON"
OUTPUT=$("$CHECK" "$T5_JSON")
assert_eq "T-5: valid json passes" "[]" "$OUTPUT"
printf '{"a": 1,}\n' > "$T5_JSON"
OUTPUT=$("$CHECK" "$T5_JSON")
assert_eq "T-5: invalid json is flagged" "0" "$(rule_lines JSON-01 "$OUTPUT")"
rm "$T5_JSON"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
