# Primitives — Directory Contract

Primitives are the smallest unit of meaning exposed by the agent's prompt system.
They are structured, queryable ground truth that prompts reference instead of
inventing context, constraints, or output shapes ad-hoc.

## Purpose

A primitive is a `.schema.json` or `.json` file defining one bounded concept.
Prompts read primitives by absolute path before acting. Primitives never contain
prose instruction — only structured data, enumeration sets, compatibility
matrices, and computable validation rules.

## Ownership

- **Owner:** m0xu
- **Parent:** `~/.pi/agent/AGENTS.md` (root DOX contract)
- **Governed by:** `lattice.md` (spatial protocol)

## Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| **Knowledge** | What the agent reads before acting | `ProjectContext`, `Glossary`, `ADR` |
| **Action** | What the agent produces (typed output) | `Spec`, `DecisionTree`, `ReviewResult` |
| **Constraint** | What the agent must obey | `CodingStandard`, `ReviewPolicy` |

## Creation Rules

- Every primitive is a self-contained JSON file
- No prose instruction — only structured data
- Referenced by absolute path from prompts (e.g. `~/.pi/agent/primitives/coding-standard.json`)
- A primitive must have exactly one purpose — split before merging
- Update `lattice.md` index when adding or removing primitives

## Primitive Index

| Primitive | Category | Serves |
|-----------|----------|--------|
| `project-context.schema.json` | Knowledge | brainstorm, brilliance, grill-me, grill-with-docs |
| `glossary.schema.json` | Knowledge | grill-with-docs |
| `adr.schema.json` | Knowledge | grill-with-docs, adr skill |
| `spec.schema.json` | Action | brainstorm, grill-me, grill-with-docs |
| `decision-tree.schema.json` | Action | grill-me, grill-with-docs |
| `review-result.schema.json` | Action | brilliance |
| `coding-standard.schema.json` | Constraint | tigerbeetle |
| `review-policy.schema.json` | Constraint | brilliance |
| `check.schema.json` | Constraint | all code emission |

## Verification

- Primitive count should match `lattice.md` index
- Every primitive referenced by a prompt must exist
- Every primitive must be valid JSON
