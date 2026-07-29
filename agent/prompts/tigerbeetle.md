---
description: TigerBeetle engineering philosophy — safety, determinism, and zero-cost abstraction applied to all code paths
---

You are coding under the `CodingStandard` primitive defined at
`~/.pi/agent/primitives/coding-standard.schema.json`. The 14 rules in that
standard are not suggestions — they are blocks. Code that violates any rule
is not emitted.

## Primitive (read before acting)

**`~/.pi/agent/primitives/coding-standard.schema.json`** — the 14 TigerBeetle rules (TB-01 through TB-14), each with a check description and severity=block. Query `CodingStandard.rules` for the full set.

## Enforcement protocol

1. Write code normally, applying all 14 rules as you go.
2. Before emitting any code, run self-check against every rule in `coding-standard.schema.json`.
3. A violation is a block — fix it, do not emit the code.
4. If a rule genuinely does not apply, emit an explicit waiver: `CodingStandard.waiver(rule='TB-NN', reason='...', scope='this function only')`.

## Rule summary (query the primitive for full check descriptions)

| ID | Rule | Key Check |
|----|------|-----------|
| TB-01 | Assertion density ≥ 2 | Count asserts per function |
| TB-02 | No .unwrap() | Search for unwrap/expect/panic without invariant assertion |
| TB-03 | Typed errors | Error types must be enum variants, never strings |
| TB-04 | Pair-assert write+read | Every write followed by read+assert within 5 lines |
| TB-05 | No hot-path allocation | Allocate at init, not in loops/request handlers |
| TB-06 | Batch over individual | N items = 1 batch call, not N individual calls |
| TB-07 | Control/data plane separation | O(1) decisions outside O(N) loops |
| TB-08 | Function ≤ 70 lines | Hard limit — split if exceeded |
| TB-09 | Line width ≤ 100 | Restructure if a line wraps |
| TB-10 | Zero tech debt | No TODO, FIXME, HACK, commented-out blocks |
| TB-11 | Units in names | latency_ms, timeout_sec, buffer_bytes |
| TB-12 | Single source of truth | Derived state computed on read, never stored |
| TB-13 | Explicit boundaries | Module exports explicit, no leaked internal state |
| TB-14 | Determinism | Seed RNG, log seeds, no time.Now() in decision paths |
| TB-15 | No boolean-gated structs | Boolean + optional sibling fields → convert to discriminated union |
| TB-16 | Parse at boundary | Parse unstructured data into ADTs at ingestion; no runtime checks downstream |

## When in doubt

- Simplify. The correct answer is usually fewer lines.
- Remove, don't add. A deleted line can't cause a bug.
- If you can't explain the invariant in one sentence, the code is wrong.
