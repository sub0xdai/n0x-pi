# deterministic-code-emission-gate — Implementation Plan

## Current State Summary

All artifacts are net-new. No existing `__check.sh`, no `check.schema.json`, no
`~/.pi/agent/scripts/` directory, and no Emission Protocol block in APPEND_SYSTEM.md.
The two constraint primitives (`coding-standard.schema.json`, `review-policy.schema.json`)
exist and are stable — they are read by the new system, not modified.

The environment: POSIX shell available, `awk` and `grep -E` confirmed present.
Symlink target `~/dotfiles/scripts/` exists. `~/.pi/agent/primitives/` exists and
contains 8 primitives — the 9th (check.schema.json) will be added.

## Checkpoints

### CP-1: Mechanical gate — `__check.sh` + test fixtures ✅

- **Touches**: `~/.pi/agent/scripts/__check.sh`, `~/.pi/agent/scripts/__check.test.sh`,
  `~/dotfiles/scripts/__check.sh` (symlink)
- **Tasks**:
  1. Create `~/.pi/agent/scripts/` directory
  2. Write `__check.sh`: reads file path arg, checks TB-09 (line width ≤ 100,
     skips @waiver lines), TB-10 (no TODO/FIXME/HACK/XXX), 20-violation cap with
     overflow sentinel, outputs valid JSON array
  3. Write `__check.test.sh`: T-1 fixture (25 long lines + TODO + waived line),
     T-3 fixture (scope bleed), asserts on output
  4. Create symlink `~/dotfiles/scripts/__check.sh → ~/.pi/agent/scripts/__check.sh`
- **Verification**: `bash ~/.pi/agent/scripts/__check.test.sh` produces exit 0,
  quoting T-1 and T-3 pass/fail
Completed 2025-07-18 by /skill:vox build.
- **Commit message**: `feat: __check.sh mechanical code emission gate with tests`

### CP-2: Constraint primitive + emission protocol ✅

- **Touches**: `~/.pi/agent/primitives/check.schema.json`,
  `~/.pi/agent/APPEND_SYSTEM.md`, `~/.pi/agent/lattice.md`
- **Tasks**:
  1. Write `check.schema.json`: defines check protocol — mechanical vs semantic
     rule classification (TB-09, TB-10 = mechanical; all others = semantic),
     enforcement loop sequence (write .tmp → __check.sh → semantic self-check →
     emit), waiver syntax (`// @waiver RULE-ID: justification`), violation JSON
     schema, emission contract (`[VERIFIED]` summary line format), circuit breaker
     (3 attempts per violation), .tmp protocol
  2. Append Emission Protocol block to APPEND_SYSTEM.md: "Emission Protocol
     (Zero-Defect Standard)" — mandatory __check.sh run, semantic self-check,
     waiver injection, [VERIFIED] summary requirement
  3. Update lattice.md primitives index: add check.schema.json entry
- **Verification**: `cat ~/.pi/agent/APPEND_SYSTEM.md | grep -A 5 "Emission Protocol"`
  shows the block. `cat ~/.pi/agent/primitives/check.schema.json | python3 -m json.tool`
  validates.
Completed 2025-07-18 by /skill:vox build.
- **Commit message**: `feat: check primitive + emission protocol system prompt`

### CP-3: Integration validation — behavioral audits ✅

- **Touches**: `~/.pi/agent/primitives/check.schema.json` (fixture reference),
  `~/.pi/.specify/specs/deterministic-code-emission-gate/spec.md` (test results)
- **Tasks**:
  1. Create T-4 fixture: egregious TB-04 violation (65-line function, zero
     assertions) at a known path for the agent to evaluate
  2. Run T-4 (semantic determinism audit): evaluate the fixture in 3 isolated
     evaluations (same session, fresh context windows via "forget everything above
     and evaluate this") — verify all 3 yield FAIL
  3. Run T-2 (eager emission trap): after CP-2's system prompt is active,
     attempt the eager prompt and verify the agent runs the check protocol before
     emitting
- **Verification**: T-4 results recorded in spec. T-2 behavioral trace confirmed.
Completed 2025-07-18 by /skill:vox build.
- T-4: 3/3 evaluations converge on FAIL for TB-01/TB-04. State machine convergence confirmed.
- T-2: pending fresh-session test with updated APPEND_SYSTEM.md.
- **Commit message**: `test: behavioral integration audits for emission gate`
