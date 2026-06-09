---
name: audit
description: "Two-pass code audit: adversarial deep review followed by standard second opinion. Use after implementing features, fixing multi-file bugs, or when asked to audit. Checks types, API contracts, data consistency, auth, pagination, dead code, edge cases, and anything that looks off. Stack-aware — auto-detects Node/Python/Rust/Go/Deno/Bun."
---

# Code Audit — Two-Pass Adversarial Review

Two-pass audit on recent changes or specified files. Pass 1 is adversarial (assume broken until proven otherwise); Pass 2 is a standard review second opinion on the fixed state. Both passes run in-process — there are no subagents in pi.

## How this works

**Pass 1 — Adversarial deep audit.** You (the agent) adopt an adversarial mindset: assume every line is wrong until you prove it correct. Read the diff, run verification commands, and produce a structured report covering all checklist categories. **Do not fix anything during Pass 1.** Only read, grep, and run verification — report every finding.

**Pass 2 — Standard review second opinion.** After Pass 1 findings are fixed, switch to a standard PR-review mindset. Re-read the final state and answer: *"Would a fresh reviewer approve this?"* Produce `verdict: approve` or `verdict: change requested` with specific issues.

**Adversarial escalation (Pass 2 variant).** For security-critical changes only, re-run the adversarial checklist instead of the standard review. The three narrow triggers:

- Changes to code that **enforces** the authentication/authorization boundary (auth middleware, token signing/verification, session validation, password hashing). Not routine new endpoints that reuse existing auth.
- Direct use of **cryptographic primitives** (any new code using `crypto.*`, `webcrypto`, `node:crypto`, signing, encryption, key derivation).
- User explicitly flags the change as security-critical.

If none of these apply, use the standard Pass 2. Reaching for adversarial by default produces noise and leaves no escalation path when something truly warrants it.

## Scoping the audit

**With arguments** (e.g. `/skill:audit src/routes/admin.ts src/lib/auth.ts`): scope to those files and their related code.

**Without arguments**: audit the most recent feature or fix. Identify it by:
1. `git diff` / `git status` for uncommitted changes
2. If tree is clean, `git log origin/HEAD..HEAD` for unpushed commits
3. If multiple unrelated changes are in flight, ask the user which one to audit
4. Focus on the single coherent change — not the session's full output

Before starting, summarize the change: what was changed, which files, design decisions made, known edge cases.

## Stack auto-detection

Before starting the audit, detect the project's stack from these signals (check in order):

| Signal | Stack | Type check | Test runner | Lint |
|--------|-------|------------|-------------|------|
| `bun.lock` or `bunfig.toml` | Bun | `bunx tsc --noEmit` | `bun test` | `bunx eslint` |
| `package.json` + `pnpm-lock.yaml` | pnpm | `pnpm tsc --noEmit` | `pnpm test` | `pnpm lint` |
| `package.json` + `yarn.lock` | Yarn | `yarn tsc --noEmit` | `yarn test` | `yarn lint` |
| `package.json` (default) | npm | `npx tsc --noEmit` | `npm test` | `npx eslint` |
| `deno.json` or `deno.lock` | Deno | `deno check` | `deno test` | `deno lint` |
| `Cargo.toml` | Rust | `cargo check` | `cargo test` | `cargo clippy` |
| `pyproject.toml` + `uv.lock` | Python (uv) | `uv run mypy` | `uv run pytest` | `uv run ruff check` |
| `pyproject.toml` (default) | Python | `python -m mypy` | `python -m pytest` | `python -m ruff check` |
| `go.mod` | Go | `go vet` | `go test ./...` | `golangci-lint run` |
| `mix.exs` | Elixir | `mix compile --warnings-as-errors` | `mix test` | `mix credo` |
| None of the above | Unknown | Skip type checks | Try `make test` | Try `make lint` |

Only run the type check if the relevant tool is available (check with `which` or `command -v`). If a tool is missing, note it as an INFO finding and skip that check.

### Language-specific type safety patterns

When checking section 1 (Type safety), look for these language-specific red flags:

**TypeScript/JavaScript:**
- `as` casts, `any` types, `!` non-null assertions, `@ts-ignore`, `@ts-expect-error`
- `unknown` cast directly to a concrete type without validation
- Optional chaining chains that silently swallow errors

**Python:**
- Bare `except:` or `except Exception:` that swallows errors
- `# type: ignore` comments, `Any` from typing, unchecked `Optional` access
- `getattr`/`setattr` dynamic attribute access bypassing type checks
- Dict accessed with string keys where a TypedDict/dataclass would catch typos

**Rust:**
- `unwrap()` or `expect()` in non-startup/non-test code
- `unsafe` blocks, raw pointer derefs, `transmute`
- `as` casts that silently truncate (e.g. `u64 as u32`)
- `todo!()` or `unimplemented!()` left in non-WIP code

**Go:**
- Bare `interface{}` or `any` where a concrete type exists
- Error silently ignored (`_ = err` or just not assigning)
- Nil pointer/map/slice access without guard
- Type assertion without ok check: `x.(Type)` instead of `x, ok := y.(Type)`

**General (all languages):**
- Null/nil/None propagation through code paths without explicit handling
- Implicit type coercion between numeric types (float↔int, signed↔unsigned)

## Pass 1 — Adversarial Deep Audit

### Mindset

You are an adversarial code auditor. Find every bug, type safety issue, dead code artifact, and design problem in the change below. **Assume broken until proven otherwise.**

Read the diff fully. Read every changed file in its final state. Run every applicable verification command. Work through every checklist item — and flag anything off-checklist that looks wrong, smells off, or could break in production.

### Rules

1. **Read/Grep/Bash to verify — do NOT edit or write files.** The audit is read-only.
2. **Work every applicable checklist item.** Skip sections that clearly don't apply, but explain why you skipped them.
3. **Report every finding in the table.** Be specific: `file:line`, actual value, expected value. No vague "this seems off."
4. **Severity levels:**
   - **CRITICAL** — breaks core functionality, data loss, security vulnerability, crash
   - **HIGH** — user-visible wrong behavior, broken API contract, auth bypass
   - **MEDIUM** — type safety gap, data integrity risk, missing error handling
   - **LOW** — dead code, unused imports, style drift, missing cleanup
   - **INFO** — observations, suggestions, things to watch
5. **Zero findings is a valid answer.** Don't invent problems. But verify thoroughly before concluding zero.

### Shell command safety rules

- **No `$VAR` for secrets.** Extract once via `grep KEY= .env`, paste the literal into later commands. Never `source .env && curl -H "Bearer $TOKEN"`.
- **No `$(...)` substitution in curl/auth commands.** Run the inner command, paste its output.
- **Heredocs: always quote the delimiter** (`<<'EOF'`). Unquoted heredocs execute `$vars`/`$(cmds)`.
- **Never print secrets.** Your stdout → context → report. Extract, use, return findings only. Never include API keys, JWTs, passwords, or `.env` contents in output.

### Audit checklist

Work through each category in order.

#### 1. Type safety

- Do runtime values match their declared types? Especially nullability — if code sets a field to `null`, is the type `T | null` (or equivalent)?
- Are there casts, type assertions, `any`/`interface{}`/`unknown`, or non-null assertions that bypass the type system? Are they justified?
- Do API response shapes match the consumer-side type interfaces field-by-field?
- Run the project's type checker. Do not proceed until you have its output.

#### 2. API contracts

- **Request validation**: does the endpoint validate input correctly (required fields, types, constraints, ranges)?
- **Response shape**: does every field the consumer reads exist in the response? Same name, same type, same structure?
- **Status codes**: are success/error codes used correctly (200 vs 201, 400 vs 403 vs 404, 500 only for unexpected failures)?
- **Auth**: which roles/keys/tokens can access this endpoint? Is each case tested?
- **Error format**: are error responses consistent with the project's error format?

#### 3. Data consistency

- If data is merged from multiple sources: is the combined result correctly shaped, sorted, deduplicated, sized?
- If pagination is affected: does `total` match reality? Does `limit` cap correctly? Does `offset` work across pages?
- If filters are added: does every UI filter value exist in the backend's allowed list? Does the backend handle each correctly?
- Are label maps, constant lists, enum values, and dropdown options in sync between frontend and backend?
- If there's a database: are query results correctly mapped to response types?

#### 4. State and side effects

- **Database writes**: constraints respected (NOT NULL, FK, CHECK, UNIQUE)? Transactions used where needed?
- **Idempotency**: can the operation run twice without corruption?
- **Error paths**: what happens if an external call fails mid-operation? Is state left consistent?
- **Rollback**: if multiple writes, do they all succeed or all fail?
- **Caches**: are cache invalidation/update patterns correct? No stale data windows?
- **Queues/jobs**: are job payloads correctly shaped? Retry behavior defined?

#### 5. Auth and access control

- New or changed write endpoints: does every role/tier get the correct access (allowed or blocked)?
- Any endpoint accidentally public or missing an auth gate?
- User identity fields populated correctly (`created_by`, `triggered_by`, `user_id`, etc.)?
- Can a lower-privilege user access or modify another user's data (IDOR)?
- Are auth checks enforced server-side (not just client-side)?

#### 6. Dead code and cleanup

- Imports for removed components/functions/classes also removed?
- CSS classes/styles for removed UI components also removed?
- Type definitions/interfaces for removed features also removed?
- Commented-out blocks, unused variables, unreachable code?
- Orphaned files that nothing imports/references anymore?
- Test files for removed features deleted or updated?

#### 7. Edge cases

- **Empty state**: what happens with zero results, null input, empty string, empty array?
- **Null/missing propagation**: does consuming code handle optional/null values without crashing?
- **Boundary values**: `limit=0`, `offset=999999`, empty string, max int, negative values, zero?
- **Concurrent access**: can two requests/processes conflict on the same data (race conditions)?
- **Time zones**: are timestamps handled correctly across time zones?
- **Unicode**: are non-ASCII inputs handled correctly (names, URLs, text)?
- **Large payloads**: what happens with very large inputs or result sets?

#### 8. Live verification

*Only applicable if the change affects HTTP endpoints, CLI commands, or other runnable interfaces. Skip otherwise.*

- Start or confirm the dev server is running.
- Call the changed endpoint(s) with valid auth. Does the response match expectations?
- Call with each auth tier if relevant (admin, user, anonymous, viewer).
- Test at least 3 different parameter combinations, including one edge case.
- Test error cases: invalid input, missing auth, wrong method.
- If UI-visible: do labels, badges, filters all render correctly?
- For CLI tools: run with valid args, invalid args, `--help`.

#### 9. Open investigation

- Anything else that looks wrong, fragile, or likely to cause problems?
- Patterns that work today but would break under reasonable future changes?
- Performance concerns: N+1 queries, unbounded loops, missing indexes, large allocations?
- Security concerns: injection, privilege escalation, data leakage, CSRF, XSS?
- Anything that contradicts the project's documented invariants in `CLAUDE.md` or similar?
- Does the change introduce new dependencies? Are they necessary? Any supply-chain concerns?

### Pass 1 report format

Produce the report at the end of Pass 1. Do not produce it incrementally.

```
## Audit Report — Pass 1 (Adversarial): <change summary>

**Scope:** <files/diff covered>
**Stack detected:** <stack name>
**Verification commands run:** <list with exit codes>

---

### Issues found

| # | File:Line | Severity | Category | Issue | Expected | Actual |
|---|-----------|----------|----------|-------|----------|--------|
| 1 | src/foo.ts:42 | HIGH | API Contract | Missing field in response | Response includes `email` | Field missing |

### Verified OK
<!-- Check off items you explicitly verified -->

- [ ] Type safety: type checker passes ✓
- [ ] API contracts: request validation correct ✓
- [ ] API contracts: response shape matches consumer ✓
- [ ] Data consistency: pagination/filtering correct ✓
- [ ] State/side effects: constraints, idempotency ✓
- [ ] Auth: access gates correct per role ✓
- [ ] Dead code: no orphaned imports/types ✓
- [ ] Edge cases: empty/null/boundary handled ✓
- [ ] Live verification: endpoints tested ✓

### Live test results (if applicable)

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| GET /api/items?limit=10 (admin) | 200, 10 items | 200, 10 items | ✓ |

### Open observations
- (Anything the checklist didn't cover, but you noticed)
```

## After Pass 1

1. Present the report.
2. **Fix every CRITICAL and HIGH issue.** MEDIUM should be fixed; LOW and INFO are at your discretion but should not be silently ignored.
3. After fixing, decide whether to re-run Pass 1 before Pass 2. **Re-run Pass 1 if:**
   - ≥3 CRITICAL or ≥8 total findings
   - The fix touched >5 files or rewrote >30 lines in any function
   - This is already a second audit-fix cycle (cap: max 2 total Pass 1 runs)
4. Otherwise, proceed to Pass 2.

## Pass 2 — Standard Review Second Opinion

After all Pass 1 findings are resolved (and optionally re-audited), run the standard review.

### Mindset

You are a fresh reviewer seeing this code for the first time. You are not adversarial — you are thorough and fair. Your job: *"Would I approve this PR?"*

### What to do

1. Re-read the final diff (original change + all fixes applied).
2. Verify every Pass 1 finding has been addressed.
3. Check for **regressions** — did any fix introduce a new problem?
4. Check for **missed issues** — did Pass 1 overlook anything that a standard review would catch?
5. Check overall code quality: clarity, consistency with project conventions, test coverage.

### Pass 2 report format

```
## Audit Report — Pass 2 (Standard Review): <change summary>

### Verdict: **approve** | **change requested**

### Pass 1 resolution
<!-- For each Pass 1 finding, note the resolution -->

| # | Original finding | Resolution | Status |
|---|-----------------|------------|--------|
| 1 | src/foo.ts:42 — missing field | Added `email` to response | ✓ Fixed |

### Additional findings (if any)

| # | File:Line | Severity | Issue |
|---|-----------|----------|-------|

### Overall assessment
<!-- Brief: is this code ready to ship? What's the residual risk? -->
```

### Pass 2 variant: Adversarial escalation

If the change triggers one of the three security-critical criteria (auth enforcement code, cryptographic primitives, or user-flagged), **re-run the full Pass 1 adversarial checklist** instead of the standard review. Label it "Pass 2 (Adversarial Escalation)" and use the Pass 1 report format.

## Caps and escalation

- **Pass 1 max 2 total runs.** If two adversarial audits still find issues, stop — there may be a fundamental design problem. Escalate to the user with a diagnosis.
- **Pass 2 max 3 iterations** (fix → review → fix → review → fix → review). If Codex-equivalent review keeps finding regressions, escalate.
- **Do not loop indefinitely.** If either cap is hit, present the user with:
  - A summary of findings that remain unresolved
  - The diagnosis of why the audit can't close
  - A recommendation (defer, redesign, or human review)
- **Commit only after Pass 2 returns `verdict: approve`.**

## Autonomous trigger rules

To make audits self-triggering without you having to remember, paste the snippet below into your project's `CLAUDE.md` (or equivalent context file):

```markdown
**Audit Skill (MANDATORY)** — after completing any of the following, you **MUST run
`/skill:audit`** before committing:
  - A new feature that adds a public surface (new endpoint, command, exported function, or UI flow)
  - A fix that touches 3+ source files (excluding tests and config), or rewrites more than ~30 lines in a single function
  - Any change to authentication, authorization, or access control
  - Any change to database schema, migrations, or data persistence
  - Refactors that move or rename code across multiple modules
  - Public API contract changes (request/response shapes, status codes, error formats)
  - Pagination, filtering, sorting, or aggregation logic
  - Code that combines results from multiple upstream sources (different services, tables, or APIs)
  - Any change to security-sensitive flows (credentials, tokens, webhooks, payments)

**Audit is NOT required for:** docs-only changes, comment-only changes, formatting / linting passes, dependency bumps that don't include accompanying code changes, or revert commits.

The `/skill:audit` skill runs a two-pass code audit: an adversarial deep review followed by a standard second opinion. Do NOT skip it — treat audit findings as blockers that must be fixed before the commit. If the audit caps without approval (max 2 Pass 1 runs, max 3 Pass 2 iterations), escalate to the user — do not push past it.
```

Adapt the trigger list to your project's risk surface — add domain-specific patterns (e.g. "any change to billing logic", "any change to RLS policies") or remove items that don't apply.

## Prerequisites

- **Git** — required for diff scoping
- **Project dev tools** — type checker, test runner, linter for your stack (see stack auto-detection table above)
- **Live verification** — if checking HTTP endpoints, have the dev server running on `localhost` before starting the audit
- **`CLAUDE.md` (recommended)** — project invariants document; the audit cross-references it in section 9
