# Spec: Deterministic Code Emission Gate

## Purpose

Rules that are currently advisory prose become mechanically verified before code reaches
the user. The agent runs a dual-gate check protocol — a POSIX shell script for mechanical
rules, a structured self-evaluation for semantic rules — against every code artifact.
Code that violates a "block" rule is trapped in a correction loop. Only verified code with
a `[VERIFIED]` summary line reaches the user. The user sees only code that has passed
the gate.

## Scope

### IN

- `coding-standard.schema.json`: all 14 TB rules
- `review-policy.schema.json`: all 7 RP dimensions
- Mechanical gate: TB-09 (line width), TB-10 (forbidden tokens) via `__check.sh`
- Semantic gate: all 21 rules via agent self-check
- Enforcement loop: check → fail → fix → recheck → pass → emit (3-attempt circuit breaker)
- Waiver protocol: inline `// @waiver RULE-ID: justification` annotations, rule-scoped, not line-scoped
- Violation cap: 20 violations per run with overflow sentinel

### OUT

- APPEND_SYSTEM.md prose rules (git trailers, scripting language, PII hook)
- Ponytail ladder rules
- Project-specific AGENTS.md rules
- Harness-level enforcement (pi extension)
- Pre-commit hooks
- TB-08 (function lines), TB-11 (units in names), RP-06 (dead code) — moved to semantic gate

### DEFERRED

- Rule-authoring primitive
- Language-specific check variants
- Violation analytics dashboard
- Sub-agent structural enforcement (Option B from loop automation)

## Constraints

| Category | Requirement |
|---|---|
| Dependencies | Zero. POSIX `awk` + `grep -E` only |
| Performance | `<100ms` for any file under 10K lines |
| Side effects | `__check.sh` is stateless, read-only. Agent owns all mutation |
| Violation cap | Max 20 violations per run, overflow sentinel signals remainder |
| Portability | POSIX-compliant. Linux, macOS, BSD |
| Harness | No pi extension, no TUI change, no tool registration |

## Architecture

### Components

1. **`~/dotfiles/scripts/__check.sh`** (canonical path via symlink from
   `~/.pi/agent/scripts/`) — POSIX shell script. Reads a file, outputs JSON array of
   mechanical violations. 2 rules: TB-09, TB-10. Respects `@waiver` annotations.
   Enforces 20-violation cap.

2. **`~/.pi/agent/primitives/check.schema.json`** — new constraint primitive. Defines the
   check protocol: mechanical vs semantic rule classification, enforcement loop sequence,
   waiver syntax, violation JSON schema, emission contract (`[VERIFIED]` summary line).

3. **Agent self-check protocol** — after mechanical gate passes, evaluates all 21 rules
   semantically. Produces one-line verdict per rule: PASS | WAIVED | FIXED.

### Data Flow

```
agent writes code to .tmp
  → __check.sh <file>.tmp (mechanical gate)
    → pass → semantic self-check
    → fail → fix → loop (max 3 attempts per violation)
  → semantic self-check
    → pass → overwrite target file → emit + [VERIFIED]
    → fail → fix → loop to mechanical gate
```

### Cardinality

- 1 `check.schema.json` → 21 rules
- 1 `__check.sh` → 2 mechanical rules
- 1 agent self-check → all 21 rules
- 1 violation → 1 fix or 1 waiver

## Failure Modes

| # | Scenario | Impact | Mitigation |
|---|---|---|---|
| FM-1 | Infinite correction loop | Pipeline halt, token burn | Circuit breaker: 3 attempts, then halt + request human intervention |
| FM-2 | I/O desynchronization (stale file checked) | False PASS | Write to `.tmp`, check `.tmp`, overwrite target only on pass |
| FM-3 | Context window exhaustion | Protocol abandonment | Drop failed intermediates; only final artifact + summary survive |
| FM-4 | Regex false positives | Blocked on valid code | `@waiver` resolves. Accepted cost of parser-less checks |
| FM-5 | Agent skips the check | Unchecked code emitted | Missing `[VERIFIED]` line is human-detectable protocol breach |
| FM-6 | Malformed JSON from `__check.sh` | Misinterpreted as "no violations" | Agent must validate JSON before proceeding; block on parse failure |
| FM-7 | Waiver rot | Suppressed violations on changed code | Agent re-evaluates waivers when surrounding code changes |
| FM-8 | Semantic self-check inconsistency | Lost trust in gate | Concrete evaluation criteria in each rule description |

## Testing

| # | Test | Proves | Category |
|---|---|---|---|
| T-1 | Feed `__check.sh` 25 lines >100 chars, one `TODO`, one long line with `// @waiver TB-09` | Valid JSON, 20-item cap, overflow sentinel, TB-10 flagged, waived line absent | Automated Unit |
| T-2 | Prompt agent: "Output a bash function right now that prints a 150-char string containing FIXME." | Agent refuses urgency. Trace shows `.tmp` → `__check.sh` → resolution → `[VERIFIED]` | Behavioral Audit |
| T-3 | Feed `__check.sh`: `let r = "FIXME"; // @waiver TB-09` | TB-09 suppressed, TB-10 flagged. Waivers are rule-scoped | Automated Unit |
| T-4 | Feed egregious TB-04 violation (zero assertions) into 3 cold-start sessions | All 3 yield FAIL. State machine convergence | Stochastic Evaluation |

## Migration

| Step | Action | Rollback |
|---|---|---|
| M-1 | Create `~/.pi/agent/scripts/__check.sh` + `__check.test.sh` | `rm` both files |
| M-2 | Symlink to `~/dotfiles/scripts/__check.sh` | `rm` symlink |
| M-3 | Run T-1, T-3 against script | N/A (non-destructive) |
| M-4 | Create `check.schema.json` primitive | `rm` primitive |
| M-5 | Run T-4 (semantic determinism) | N/A |
| M-6 | Append Emission Protocol to APPEND_SYSTEM.md | Revert diff |
| M-7 | Run T-2 (eager emission trap) | Revert APPEND_SYSTEM.md if T-2 fails |

## Reversibility

Delete `__check.sh` and its symlink, remove `check.schema.json`, and revert the Emission
Protocol block from `APPEND_SYSTEM.md`. The dual-gate architecture relies entirely on
isolated diagnostic probes and prompt-level constraints rather than core harness
modifications — reversion is instantaneous and clean. The agent resumes baseline
unverified code emission without orphaned state or disruption to active project pipelines.
