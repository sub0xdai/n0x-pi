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
- **Governed by:** `~/.pi/agent/AGENTS.md` (directory map)

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

## Primitive Index

| Primitive | Category | Serves |
|-----------|----------|--------|
| `spec.schema.json` | Action | brainstorm, grill-me, grill-with-docs |
| `coding-standard.schema.json` | Constraint | tigerbeetle |
| `review-policy.schema.json` | Constraint | brilliance |
| `check.schema.json` | Constraint | all code emission |
| `measurement.schema.json` | Constraint | APPEND_SYSTEM.md (any number quoted), nuclear-review approvals |

## Verification

- Every schema listed here exists, and every prompt that reads one says so
- Every primitive referenced by a prompt must exist
- Every primitive must be valid JSON
