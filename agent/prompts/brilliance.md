---
description: Code review for brilliance — polish changes until they're elegant, bulletproof, and leave reviewers with nothing to say but "LGTM"
argument-hint: "[target: git diff, branch, commit, file...]"
---

You are in **brilliance mode**. The goal is not just to pass review — it's
to make the reviewer pause, nod, and move on because every question they'd
ask has already been anticipated.

Target: $@ (defaults to staged changes + working tree diff if omitted)

## Primitives (read before acting)

1. **`~/.pi/agent/primitives/project-context.schema.json`** — query for conventions, constraints, language, and module boundaries before forming opinions.
2. **`~/.pi/agent/primitives/review-policy.schema.json`** — the 7 review dimensions (RP-01 through RP-07) and severity classification. Every finding must be tagged with its dimension ID.
3. **`~/.pi/agent/primitives/review-result.schema.json`** — structured output format. Produce a ReviewResult, not unstructured markdown.

## Phase 0 — Ground yourself

Before reviewing, understand the context:

1. **Read the diff.** If no target is given, use `git diff` + `git diff --cached`.
2. **Read the surrounding code.** A change is only brilliant in context.
   Skim the files adjacent to the diff — imports, callers, callees, tests.
3. **Query ProjectContext** for conventions (`project-context.schema.json`).
   Brilliance means consistency with the codebase.

## Review dimensions (from review-policy.schema.json)

For every changed line, evaluate against each dimension:

- **RP-01 Naming** — intent without comment, consistent vocabulary, units in names, no obscure abbreviations
- **RP-02 Shape** — single responsibility, no surprises, shallow nesting, ≤40 lines, ≤4 args
- **RP-03 Correctness** — edge cases, off-by-one, race conditions, resource lifecycle
- **RP-04 ErrorHandling** — not swallowed, actionable messages, context propagation, panic only for invariant violation
- **RP-05 Testing** — catches the bug you'd introduce, behavior-named, no accidental passes
- **RP-06 Minimalism** — no dead code, no TODO without ticket, no unearned abstraction
- **RP-07 Consistency** — matches existing patterns, line width ≤100, commit convention

## Process

1. **Ground first.** Query ProjectContext before forming opinions.
2. **Tag every finding** with its dimension ID (RP-NN) and severity from `review-policy.schema.json`.
3. **Show the fix.** Every non-praise finding must include a concrete diff.
4. **Praise is mandatory.** At least one finding with severity=praise.

## Output format (from review-result.schema.json)

Produce a structured ReviewResult:

```
## Brilliance review

### Critical / High
- [file:line] RP-NN | Issue → Suggested fix (diff)

### Medium
- [file:line] RP-NN | Issue → Suggested fix (diff)

### Low
- [file:line] RP-NN | Issue → Suggested fix (diff)

### What shines ✨
- [file:line] RP-NN | praise | What's good

### Overall
Verdict. If zero non-praise findings: "Ship it. 🚢"
```
