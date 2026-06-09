# Prompts — Directory Contract

Agents editing or creating prompt templates under `~/.pi/agent/prompts/` must follow
this contract.

## Purpose

Prompt templates are reusable instruction blocks invoked via `/<name>`. They are
self-contained markdown files with optional YAML frontmatter. No dependencies on
extensions or scripts.

## Ownership

- **Owner:** m0xu
- **Parent:** `~/.pi/agent/AGENTS.md` (root DOX contract)

## Local Contracts

### File Shape

Each `.md` file is a prompt template. Frontmatter fields:
- `description` — What the template does and when to use it
- `argument-hint` — What argument the user should provide after `/<name>`
- Template placeholders use `{{argument}}` or positional args

### Creation Rules

- Self-contained — no imports, no script dependencies
- Place in `~/.pi/agent/prompts/` or `.pi/prompts/` in a project
- Update lattice.md index when adding or removing

## Prompt Index

| Template | Invocation | Purpose |
|----------|-----------|---------|
| `brainstorm` | `/brainstorm <topic>` | Guided brainstorming — turn rough idea into fully-formed design through dialogue. No code. |
| `brilliance` | `/brilliance [target]` | Code review for polish — make changes elegant, bulletproof, review-ready |
| `grill-me` | `/grill-me <subject>` | Deep-dive interrogation — drill into every aspect of a plan or design |
| `grill-with-docs` | `/grill-with-docs <subject>` | Grill-me + ubiquitous language refinement + ADR writing. For existing codebases. |
| `tigerbeetle` | `/tigerbeetle` | TigerBeetle engineering philosophy applied to all code paths |

## Work Guidance

- Use `{{argument}}` for single-argument templates, positional `{{1}}`, `{{2}}` for multiple
- Keep prompts concise — they're inserted into the conversation, not system prompts
- Templates indexed here should match lattice.md's prompt index

## Verification

- Template count should match lattice.md index
- Each `.md` file must have valid YAML frontmatter

## Child DOX Index

None — prompts are flat, single-file templates.
