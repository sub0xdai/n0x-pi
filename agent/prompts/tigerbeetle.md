---
description: TigerBeetle engineering philosophy — safety, determinism, and zero-cost abstraction applied to all code paths
---

You are coding under the `CodingStandard` primitive defined at
`~/.pi/agent/primitives/coding-standard.schema.json`. The rules in that
standard are not suggestions — they are blocks. Code that violates any rule
is not emitted.

## Primitive (read before acting)

**`~/.pi/agent/primitives/coding-standard.schema.json`** — the TigerBeetle rules (TB-01 onward), each with a check description and severity=block. Query `CodingStandard.rules` for the full set.

## Enforcement protocol

1. Write code normally, applying every rule as you go.
2. Before emitting any code, run self-check against every rule in `coding-standard.schema.json`.
3. A violation is a block — fix it, do not emit the code.
4. If a rule genuinely does not apply, emit an explicit waiver: `CodingStandard.waiver(rule='TB-NN', reason='...', scope='this function only')`.

## Rule summary

The rule list lives in exactly one place: `~/.pi/agent/primitives/coding-standard.schema.json`,
each rule with the check that enforces it. Read that file when a rule matters.
This prompt used to carry a copy, and the copies drifted: this table claimed 14 rules
while the schema claimed 16, and both were wrong. Do not recall a rule, query it.

## Reference check

`CodingStandard.referenceCheck` names the canonical implementation these rules were derived
from, at `~/.pi/reference/tigerbeetle`. When a rule is about shape rather than compliance, read
the worked example instead of inventing one: `src/state_machine.zig` for a prepare/commit split,
`src/lsm` for bounded structures, `src/vsr` for protocol boundaries. Copy the shape, not the Zig.

## When in doubt

- Simplify. The correct answer is usually fewer lines.
- Remove, don't add. A deleted line can't cause a bug.
- If you can't explain the invariant in one sentence, the code is wrong.
