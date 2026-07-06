---
name: adr
description: Create and manage Architecture Decision Records (ADRs). Use when asked to "write an ADR", "document this decision", "capture this architecture choice", or when the agent encounters a new dependency, new architectural pattern, or hard-to-reverse choice that warrants documentation. Also triggers on "ADR", "architecture decision record", or "decision log".
---

# ADR — Architecture Decision Records

Write ADRs as executable specifications for future agents. An ADR captures *what* was
decided, *why*, and *how to implement it*. A future agent reading the ADR should be
able to write correct code without asking follow-up questions.

## When to Write an ADR

Write an ADR when a decision:

- Introduces a new dependency or removes one
- Creates a new architectural pattern (error handling strategy, data access layer, API convention)
- Chooses between two or more real alternatives with non-obvious tradeoffs
- Changes infrastructure, deployment, or build tooling
- Is hard to reverse once code is written against it

Do NOT write an ADR for bug fixes, routine implementation within established patterns,
style preferences covered by linters, or decisions already captured in an existing ADR
(update it instead).

### Agent Triggers

If you are coding and hit any of these, **stop and propose an ADR** before continuing:

- About to add a new dependency not already in the project
- About to create a new pattern other code will need to follow
- Choosing between two real alternatives with non-obvious tradeoffs
- About to change something that contradicts an existing accepted ADR
- Writing a long code comment explaining "why" — that reasoning belongs in an ADR

Tell the human what decision you've hit, why it matters, and ask if they want to
capture it as an ADR. If yes, write it. If no, note the decision in a code comment
and move on.

## Creating an ADR

### 1. Find the ADR directory

Check these locations (in order): `docs/adr/`, `docs/decisions/`, `adr/`,
`contributing/decisions/`. Use whichever exists.

If none exists, create `docs/adr/`.

### 2. Choose a filename

`NNNN-slug-with-dashes.md` where NNNN is the next sequential number (0001, 0002, ...).
If an index file exists, read it to find the next number. Otherwise scan the directory.

### 3. Write the ADR

Use the template below. Fill every section. No placeholder text.

```markdown
# ADR-NNNN: Title (verb phrase — "Use PostgreSQL for primary storage")

- **Status:** proposed
- **Date:** YYYY-MM-DD
- **Deciders:** @handle

## Context

What is the issue motivating this decision? What forces are at play?
What constraints exist (tech stack, timeline, team, compliance)?
What happens if we do nothing?

## Decision

What did we decide? Be specific enough for an agent to implement —
"Use PostgreSQL 16 with the `pgvector` extension" not "use a database."

## Alternatives Considered

| Option | Pros | Cons | Why rejected? |
|--------|------|------|---------------|
| ... | ... | ... | ... |

## Consequences

### Positive
- What becomes easier, faster, or cheaper?

### Negative
- What becomes harder, slower, or riskier?
- What new complexity is introduced?

### Follow-up Tasks
- [ ] Concrete action item from this decision
- [ ] Another action item

## Non-Goals

What are we explicitly NOT doing or changing as part of this decision?

## Implementation Plan

- **Affected paths:** `src/db/`, `src/config/database.ts`, `tests/integration/db/`
- **Pattern:** all database queries go through `src/db/client.ts`; never inline SQL in handlers
- **Tests:** integration tests in `tests/integration/db/` using testcontainers
- **Migration:** existing SQLite data migrates via `scripts/migrate-to-pg.ts`

## Verification

- [ ] All existing tests pass with new database
- [ ] Migration script runs successfully on a copy of production data
- [ ] Query latency < 50ms p95 under expected load
```

### 4. Update the index

If an index file exists (`README.md` or `index.md` in the ADR directory),
add the new ADR to it. Keep chronological or numerical ordering.

## Code ↔ ADR Linking

Add a lightweight comment at the entry point of code governed by an ADR:

```typescript
// ADR: using PostgreSQL for primary storage
// See: docs/adr/0001-use-postgresql.md
import { pgClient } from './db/client';
```

One comment at the entry point, not on every line. Goal: discoverability.

## Updating an ADR

- **Accept:** change Status to `accepted`, update Date.
- **Reject:** change Status to `rejected`, add a brief reason in Context.
- **Deprecate:** Status → `deprecated`, add replacement path.
- **Supersede:** create a new ADR that references the old one. Add
  "Superseded by [ADR-NNNN](./NNNN-slug.md)" to the old ADR's Context.
- **Add learnings:** append to a `## Notes` section with a date stamp.

## Consulting ADRs

Before implementing changes in a codebase: find the ADR directory, scan
titles and statuses, read relevant accepted ADRs fully. Respect active
decisions. If you find a conflict between code and ADR, flag it to the human.
