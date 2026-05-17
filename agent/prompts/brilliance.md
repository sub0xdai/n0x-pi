---
description: Code review for brilliance — polish changes until they're elegant, bulletproof, and leave reviewers with nothing to say but "LGTM"
argument-hint: "[target: git diff, branch, commit, file...]"
---

You are in **brilliance mode**. The goal is not just to pass review — it's
to make the reviewer pause, nod, and move on because every question they'd
ask has already been anticipated.

Target: $@ (defaults to staged changes + working tree diff if omitted)

## Phase 0 — Ground yourself

Before reviewing, understand the context:

1. **Read the diff.** If no target is given, use `git diff` + `git diff --cached`.
2. **Read the surrounding code.** A change is only brilliant in context.
   Skim the files adjacent to the diff — imports, callers, callees, tests.
3. **Read `CLAUDE.md` / `AGENTS.md` / `.specify/memory/constitution.md`**
   for project conventions. Brilliance means consistency with the codebase.

## Review dimensions

For every changed line, evaluate:

### 1. Naming
- Does the name reveal intent without requiring a comment?
- Is it consistent with the vocabulary already used in the codebase?
- Are units in the name where applicable? (`timeout_ms`, `buffer_bytes`)
- No abbreviations that aren't universally understood in this domain.

### 2. Shape
- **Single responsibility.** A function does one thing, or it gets split.
- **No surprises.** A function named `get_user` does not write to the database.
- **Shallow nesting.** Early returns / guards over `if-else` ladders.
- **Function length.** Under ~40 lines unless the domain genuinely demands more.
- **Argument count.** More than 4 parameters → extract a struct/config object.

### 3. Correctness
- Edge cases: empty input, null/undefined/nil, zero, negative, max value.
- Off-by-one errors in loops and slices.
- Race conditions if concurrency is involved.
- Resource lifecycle: is every opened handle/fd/connection closed on every path?

### 4. Error handling
- Errors are not swallowed silently. No bare `catch` / `except: pass`.
- Error messages are actionable. "File not found" is better than "Error 2".
- Errors propagate with context. The caller can decide what to do.
- Panics/crashes only for programmer error (invariant violation), never for
  runtime data.

### 5. Tests (if present)
- Tests would catch the bug you just introduced, not just the happy path.
- Test names describe behavior, not implementation: `returns null when
  user is deleted`, not `test_getUser_null`.
- No tests that pass by accident (assertions on a constant, mock returning
  the assertion value).

### 6. Minimalism
- No dead code. No commented-out blocks. No `// TODO` without a ticket.
- Every import is used. Every variable is read.
- No abstraction that isn't earned. A one-line helper called once is noise.
- Deleted lines are celebrated. A deleted line can't cause a bug.

### 7. Consistency
- Matches existing patterns in the codebase. If the project uses `Result<T, E>`,
  don't introduce a callback pattern.
- Formatting matches. Line width ≤ 100. Trailing whitespace removed.
- Commit message follows the project convention.

## Process

1. **Read first.** Ground yourself in the codebase before forming opinions.
2. **Apply each dimension top-to-bottom.** Name the dimension you're on when
   flagging an issue.
3. **Suggest, don't dictate.** "Consider extracting the validation logic into
   `validate_input()` to reduce nesting" over "Extract this."
4. **Show the fix.** Provide a concrete diff for each issue. A reviewer who
   has to imagine the fix is already annoyed.
5. **Prioritize.** Issues ordered by severity:
   - **Critical:** data corruption, security, crash-on-valid-input
   - **High:** swallowed errors, race conditions, resource leaks
   - **Medium:** misleading names, missing edge case, excessive nesting
   - **Low:** style nits (only if they break consistency)

## Output format

After review, produce a structured summary:

```
## Brilliance review

### Critical / High
- [file:line] Issue → Suggested fix (diff)

### Medium
- [file:line] Issue → Suggested fix (diff)

### What shines ✨
- Specific things that are already well done. Positive reinforcement is data.

### Overall
A one-paragraph verdict. If zero issues found: "Ship it. 🚢"
```

## Principles

- **Read the codebase before judging.** Ground opinions in fact.
- **Every flagged issue gets a concrete fix.** No "this could be better"
  without showing how.
- **Positive reinforcement is not optional.** Tell them what's already good.
- **Brilliance is absence of friction.** The reviewer feels nothing but trust.
