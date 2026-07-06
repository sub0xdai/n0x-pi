---
name: vault-context
description: Search Obsidian vault for relevant knowledge before coding decisions. Use when the agent needs domain context, encounters an unfamiliar area, or before vox plan on a spec. Triggers on "what do I know about X", "check my notes on Y", "vault context for Z", or when about to make architectural decisions in an area with vault coverage.
---

# Vault Context — Obsidian Knowledge Bridge

Load relevant notes from `~/1-projects/vaults/sub0x_vault/` into the current session.
The vault is plain markdown — no databases, no APIs, no infrastructure. grep + read.

## When to Use

- Before vox plan on a spec — check if vault has relevant architectural notes,
  past decisions, or domain knowledge
- When the agent hits an unfamiliar domain (e.g., "I'm writing a kernel module
  but I've never done that")
- When asked "what do I know about X" or "check my notes on Y"
- When about to make an architectural decision — check if the vault has prior
  art or lessons learned

## How It Works

### 1. Understand the vault schema

Read `~/1-projects/vaults/sub0x_vault/CLAUDE.md` — this defines the vault's
structure and the LLM wiki maintenance contract. Key locations:

| Path | Content | Relevance |
|------|---------|-----------|
| `0-zettel/` | Atomic notes on topics (coding, linux, finance, security, etc.) | Primary search target |
| `1-project/` | Project-specific pages (testudo, Homelab, Ixios, etc.) | Project context |
| `2-area/` | Areas of responsibility (infrastructure) | Infrastructure context |
| `5-journal/` | Daily notes, meeting notes | Recent context |
| `7-library/` | Raw source material | Reference only |

### 2. Search for relevant pages

Grep `0-zettel/` and `1-project/` for the topic. Use multiple search angles:

```bash
# By topic keyword
grep -ril "topic" ~/1-projects/vaults/sub0x_vault/0-zettel/
grep -ril "topic" ~/1-projects/vaults/sub0x_vault/1-project/

# By project name
grep -ril "testudo\|trading\|exchange\|crypto" ~/1-projects/vaults/sub0x_vault/0-zettel/
grep -ril "testudo\|trading\|exchange\|crypto" ~/1-projects/vaults/sub0x_vault/1-project/

# By technology
grep -ril "rust\|tokio\|sqlx\|actix" ~/1-projects/vaults/sub0x_vault/0-zettel/
```

Limit to ~5 most relevant pages to avoid context bloat. Prefer pages with
descriptive slugs (`rust.md`) over UUID filenames.

### 3. Read and inject

Read the matching pages. For each:

- Extract architectural notes, lessons learned, past decisions
- Note any contradictions with the current codebase or spec
- Inject findings into context as structured output (see format below)

If a page has a `CLAUDE.md` frontmatter section with tags, use those to validate
relevance.

### 4. Output format

```
## Vault Context

### Pages consulted
- `0-zettel/rust.md` — notes on Rust patterns, error handling conventions
- `1-project/testudo.md` — testudo architecture decisions, agent wallet design

### Relevant knowledge
- [Key finding 1 with source page reference]
- [Key finding 2]

### Contradictions with current work
- [Any vault knowledge that conflicts with the current spec/code]

### Gaps
- [What the vault doesn't cover that it should — suggest filing a note]
```

## Examples

**Before vox plan on a database migration spec:**
```
vault context for postgres migration testudo
→ finds 0-zettel/database.md, 0-zettel/database-storage-1.md,
  1-project/testudo.md → injects past decisions about Decimal types,
  connection pooling patterns, migration strategy
```

**When hitting an unfamiliar domain:**
```
vault context for iouring linux
→ finds 0-zettel/iouring.md, 0-zettel/kernel-dev.md,
  0-zettel/linux-systems-administration.md → injects iouring patterns,
  gotchas, syscall notes
```

## Boundaries

- **Read only.** Never write to the vault unless explicitly asked.
- **Respect the vault CLAUDE.md contract.** `5-journal/` is read-only.
  Raw sources in `7-library/` are immutable.
- **Don't overload context.** Stop at 5 pages max. If more are relevant,
  list them and ask the human which to read.
- **Flag, don't resolve.** If vault knowledge contradicts current work, flag
  the contradiction. The human resolves it.
