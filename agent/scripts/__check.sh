#!/usr/bin/env bash
# ponytail: TB-17 detection is line-anchored, and templates tracked by backtick parity only

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
  local n="$1"
  local msg="Truncated: $n additional violations hidden"
  local json="{\"rule\":\"SYSTEM\",\"line\":0,\"message\":\"$msg\"}"
  if [[ -z "$VIOLATIONS" ]]; then
    VIOLATIONS="$json"
  else
    VIOLATIONS="$VIOLATIONS,$json"
  fi
}

count_ticks() {
  local rest="$1" n=0
  while [[ "$rest" == *'`'* ]]; do
    rest="${rest#*\`}"
    n=$((n + 1))
  done
  echo "$n"
}

md_fence_violations() {
  awk '
    /^```/ {
      if (!in_fence) { in_fence=1; fence_line=NR; lang=$0; sub(/^```/, "", lang); sg=0; en=0 }
      else {
        if (lang ~ /mermaid/ && sg != en) {
          printf "%d\tmermaid block opened here has %d subgraph and %d end\n", fence_line, sg, en
        }
        in_fence=0
      }
      next
    }
    in_fence && /^[[:space:]]*subgraph/ { sg++ }
    in_fence && /^[[:space:]]*end[[:space:]]*$/ { en++ }
    END { if (in_fence) printf "%d\tcode fence opened here is never closed\n", fence_line }
  ' "$1"
}

case "$FILE" in
  *.md|*.markdown|*.mdx)
    while IFS=$'\t' read -r md_line md_msg; do
      [[ -z "$md_line" ]] && continue
      add_violation "MD-01" "$md_line" "$md_msg" || true
    done < <(md_fence_violations "$FILE")
    echo "[$VIOLATIONS]"
    exit 0 ;;
  *.json)
    if ! jq empty "$FILE" 2>/dev/null; then
      add_violation "JSON-01" 0 "Invalid JSON: jq empty rejected the file" || true
    fi
    echo "[$VIOLATIONS]"
    exit 0 ;;
esac

FORBIDDEN='TODO|FIXME|HACK|XXX' # @waiver TB-09 @waiver TB-10: the detector's own pattern

while IFS=: read -r grep_line_num line_content; do
  if [[ "$line_content" =~ @waiver[[:space:]]+TB-10 ]]; then
    continue
  fi
  add_violation "TB-10" "$grep_line_num" "Prohibited token found" || true
done < <(grep -nE "$FORBIDDEN" "$FILE" 2>/dev/null || true)

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.rs|*.go|*.java|*.c|*.cc|*.cpp|*.h|*.hpp|*.swift|*.kt)
    COMMENT_RE='^[[:space:]]*(//|/\*|\*)' ;;
  *.sh|*.bash|*.zsh|*.py|*.rb|*.yml|*.yaml|*.toml|*.pl|*.conf)
    COMMENT_RE='^[[:space:]]*#' ;;
  *.sql|*.lua|*.hs)
    COMMENT_RE='^[[:space:]]*--([[:space:]]|\[|$)' ;;
  *)
    COMMENT_RE='' ;;
esac

KEEP_RE='^[[:space:]]*#!|^[[:space:]]*#\[|@waiver|@anchor|@tags|ponytail:'
KEEP_RE="$KEEP_RE"'|@ts-|eslint|prettier|biome|istanbul|nolint|noqa'
KEEP_RE="$KEEP_RE"'|type:[[:space:]]*ignore|pragma|go:build|\+build'
KEEP_RE="$KEEP_RE"'|//[[:space:]]*export|#include|-\*-'

if [[ -n "$COMMENT_RE" ]]; then
  line_num=0
  in_tpl=0
  while IFS= read -r line_content || [[ -n "$line_content" ]]; do
    line_num=$((line_num + 1))
    ticks=$(count_ticks "$line_content")
    if (( in_tpl )); then
      if (( ticks % 2 == 1 )); then
        in_tpl=0
      fi
      continue
    fi
    if (( ticks % 2 == 1 )); then
      in_tpl=1
    fi
    if [[ ! "$line_content" =~ $COMMENT_RE ]]; then
      continue
    fi
    if [[ "$line_content" =~ $KEEP_RE ]]; then
      continue
    fi
    if [[ "$line_content" =~ @waiver[[:space:]]+TB-17 ]]; then
      continue
    fi
    add_violation "TB-17" "$line_num" "Comment in code" || true
  done < "$FILE"
fi

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

if (( SUPPRESSED > 0 )); then
  emit_sentinel "$SUPPRESSED"
fi

echo "[$VIOLATIONS]"
