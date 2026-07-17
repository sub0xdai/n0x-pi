#!/usr/bin/env bash
# __check.sh — Mechanical code emission gate
# Input: file path. Output: JSON array of violations.
# Rules: TB-09 (line width <= 100), TB-10 (no TODO/FIXME/HACK/XXX)
# Respects inline @waiver RULE-ID annotations. Caps at 20 total items
# (19 real violations + 1 overflow sentinel if suppressed remain).

set -euo pipefail
FILE="$1"
CAP=19
VIOLATIONS=""
COUNT=0
SUPPRESSED=0

if [[ ! -f "$FILE" ]]; then
  echo "[]"
  exit 0
fi

add_violation() {
  local rule="$1" line="$2" msg="$3"
  if (( COUNT >= CAP )); then
    SUPPRESSED=$((SUPPRESSED + 1))
    return 1
  fi
  local json="{\"rule\":\"$rule\",\"line\":$line,\"message\":\"$msg\"}"
  if [[ -z "$VIOLATIONS" ]]; then
    VIOLATIONS="$json"
  else
    VIOLATIONS="$VIOLATIONS,$json"
  fi
  COUNT=$((COUNT + 1))
  return 0
}

emit_sentinel() {
  local n=$1
  local json="{\"rule\":\"SYSTEM\",\"line\":0,\"message\":\"Truncated: $n additional violations hidden\"}"
  if [[ -z "$VIOLATIONS" ]]; then
    VIOLATIONS="$json"
  else
    VIOLATIONS="$VIOLATIONS,$json"
  fi
}

# ── TB-10: No TODO/FIXME/HACK/XXX (skip @waiver TB-10 lines) ─────────────
# Process first — fewer typical violations, more useful in output
while IFS=: read -r grep_line_num line_content; do
  if [[ "$line_content" =~ @waiver[[:space:]]+TB-10 ]]; then
    continue
  fi
  add_violation "TB-10" "$grep_line_num" "Prohibited token found" || true
done < <(grep -nE 'TODO|FIXME|HACK|XXX' "$FILE" 2>/dev/null || true)

# ── TB-09: Line width <= 100 (skip @waiver TB-09 lines) ──────────────────
line_num=0
while IFS= read -r line_content || [[ -n "$line_content" ]]; do
  line_num=$((line_num + 1))
  if [[ "$line_content" =~ @waiver[[:space:]]+TB-09 ]]; then
    continue
  fi
  if (( ${#line_content} > 100 )); then
    add_violation "TB-09" "$line_num" "Line exceeds 100 characters" || true
  fi
done < "$FILE"
# ── Overflow sentinel ─────────────────────────────────────────────────────
if (( SUPPRESSED > 0 )); then
  emit_sentinel "$SUPPRESSED"
fi

echo "[$VIOLATIONS]"
