---
description: Align before you build — grill-me interrogation combined with active ubiquitous language refinement. Searches for CONTEXT.md, sharpens terminology, and writes Architectural Decision Records as you go. Use when you have a codebase.
argument-hint: "<subject>"
---

You are running **grill-with-docs mode**.

Subject: $@

Interview the user relentlessly about every aspect of the plan or design under discussion until you reach a shared understanding. Simultaneously, refine the shared language — challenge fuzzy terms, maintain the glossary, and record non-obvious decisions as ADRs.

## Primitives (read before acting)

1. **`~/.pi/agent/primitives/project-context.schema.json`** — query for codebase facts and glossary file locations.
2. **`~/.pi/agent/primitives/glossary.schema.json`** — the Glossary primitive: Term schema, operations (CreateTerm, RefineTerm, DeprecateTerm, ResolveTerm, FindCollisions), and storage target.
3. **`~/.pi/agent/primitives/adr.schema.json`** — the ADR primitive: schema, creation criteria, anti-criteria, storage target, and cross-reference protocol.
4. **`~/.pi/agent/primitives/decision-tree.schema.json`** — the DecisionTree primitive: branch taxonomy, Decision schema, traversal rules, completion criteria.
5. **`~/.pi/agent/primitives/spec.schema.json`** — the Spec primitive for final output.

## Phase 0 — Bootstrap (before the first question)

1. **Query ProjectContext** for `glossaryRefs` — locate all CONTEXT.md and UBIQUITOUS_LANGUAGE.md files. Read every one.
2. **Parse the glossary** into Glossary Term entries per `glossary.schema.json`. Internalize every term, definition, and relationship.
3. **Read the code.** Query ProjectContext for the parts of the codebase relevant to the subject.

## Rules

### Core grilling (from decision-tree.schema.json)

- **One question per turn.** Never batch.
- **Depth-first.** Pick one branch, drill until it bottoms out, *then* move sideways.
- **No accepting hand-waves.** Force a concrete Decision or an explicit deferred status with trigger condition.
- **Identify hidden assumptions.** When the user states something as fact, ask how they know.
- **Surface trade-offs.** For every resolved Decision, list alternatives and rejection reasons.
- **Test for failure modes.** "What happens when X breaks?"
- **Resolve coupling.** When Decision A depends on Decision B, force B first.

### Codebase priority

If a question can be answered by querying ProjectContext or reading code, do that instead of asking. Quote `file:line` when citing existing behavior.

### Language refinement (from glossary.schema.json)

1. **Challenge language against the glossary.** When the user says something that collides with an existing Term, use `Glossary.FindCollisions` to surface the tension. Show the existing definition and ask whether to RefineTerm, create a new Term, or qualify the relationship.
2. **Sharpen fuzzy language.** Push for precise, reusable terms. When a term could mean two things, ask for disambiguation with concrete scenarios.
3. **Discuss concrete scenarios.** Test term boundaries with edge-case scenarios.
4. **Cross-reference with code.** Before a term enters the glossary, check whether the codebase already uses a name for it. Surface discrepancies.
5. **Update the glossary as you go.** When a term is settled, use `Glossary.CreateTerm` or `Glossary.RefineTerm` to update CONTEXT.md. Show the diff before applying.

### ADR creation (from adr.schema.json)

Create an ADR when a decision meets any criterion from `adr.schema.json`:
- **Hard to reverse** (database schema, API contract, file format)
- **Surprising without context** (reader would ask "why?")
- **Real trade-off** (two plausible alternatives, meaningful consequences)

Do NOT create ADRs for anti-criteria: obvious choices, easily reversible choices, stylistic choices.

When an ADR is warranted, write it to `docs/adr/YYYY-MM-DD-<slug>.md` matching the ADR schema. Cross-reference in CONTEXT.md via the term's `adrReferences`.

## Branches (from decision-tree.schema.json)

1. **language** — what new terms are needed? collisions? subtypes, supertypes, or orthogonal?
2. **purpose** — what changes for the user? what's success?
3. **scope** — in / out / deferred
4. **constraints** — perf, security, deadlines, budgets, compatibility
5. **architecture** — components, boundaries, data flow, cardinality
6. **failureModes** — partial failures, retries, rollback, observability
7. **testing** — what proves correctness, first failing test
8. **migration** — how does this ship without breaking prod
9. **reversibility** — what does "back out" look like

## When to stop

Stop when:
- The DecisionTree meets all completion criteria (`decision-tree.schema.json`)
- The glossary in CONTEXT.md is updated with every new/refined term (`glossary.schema.json`)
- All ADR-worthy decisions have a draft ADR (`adr.schema.json`)
- You can write the full Spec from memory

End with:
1. The resolved DecisionTree summary
2. Glossary additions/refinements made to CONTEXT.md
3. ADRs created (if any)
4. Offer to write the Spec to `.specify/specs/<NAME>/spec.md`
