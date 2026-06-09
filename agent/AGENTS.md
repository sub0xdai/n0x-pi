# Pi Agent Configuration — DOX Root

This is the root DOX contract for `~/.pi/agent/`. Agents editing any file under this
tree must read this doc plus the nearest child AGENTS.md along the path.

## Purpose

`~/.pi/agent/` houses all pi coding agent configuration: skills, extensions, prompts,
themes, packages, settings, and the spatial protocol (`lattice.md`). Every edit here
changes pi's behavior across all projects.

## Ownership

- **Owner:** m0xu
- **Machine-local:** This directory is not synced, version-controlled, or portable
- **Pi loads this:** Pi reads `APPEND_SYSTEM.md` as system prompt appendix.
  AGENTS.md files in this tree are loaded by pi via `AGENTS.md` discovery
  when cwd is under `~/.pi/agent/`.

## Local Contracts

### Spatial Protocol (`lattice.md`)

`lattice.md` is the binding spatial map and protocol for this configuration. It defines:
- Directory boundaries (skills = behavior, extensions = harness modification)
- Naming conventions (double-underscore prefix for agent-invoked scripts)
- The extension litmus test: extensions must pass lifecycle interception, TUI/UI
  manipulation, or persistent transport protocol criteria
- Pathing discipline (absolute paths only outside workspace)
- Discovery loop for locating capabilities

**lattice.md is authoritative for all spatial and boundary decisions.** When
lattice.md and an AGENTS.md disagree about directory boundaries or naming conventions,
lattice.md controls. AGENTS.md files add local detail within lattice.md's framework.

### System Prompt (`APPEND_SYSTEM.md`)

Contains git commit rules: no Co-authored-by, Signed-off-by, or trailer lines.

### Runtime Configuration (`settings.json`)

- Default model: DeepSeek v4 Pro, thinking level: high
- Theme: vanilla-amoled, thinking blocks hidden
- Powerline footer in compact mode with fixed editor
- Six installed pi packages (powerline-footer, web-access, themes, vim-motions)

### Pi Packages Installed

| Package | Provides |
|---------|----------|
| `pi-powerline-footer` | Custom footer with git status, context usage, shortcuts |
| `pi-web-access` | web_search, fetch_content, code_search tools + librarian skill |
| `pi-blackboard-theme` | Blackboard and Blackboard Pro themes |
| `vim-motions-pi` | Vim-like motions in pi editor |
| `pi-ansi-themes` (git) | ANSI theme collection |
| `pi-themes` (git) | Theme collection |

## Work Guidance

- Extensions go through the lattice.md litmus test before creation
- Skills must follow the Agent Skills standard (one SKILL.md per directory)
- Prompt templates are self-contained markdown with optional YAML frontmatter
- Themes are JSON files following pi's theme schema
- Do not edit `npm/node_modules/` or `git/` contents directly — use `pi install/remove`

## Verification

- `lattice.md` index should remain current → edit lattice.md when skills/prompts change
- Extensions must declare which lattice.md criterion they satisfy in their AGENTS.md entry

## Child DOX Index

| Child | Scope | Description |
|-------|-------|-------------|
| `skills/AGENTS.md` | `~/.pi/agent/skills/` | Skill contracts, triggers, and invocation rules |
| `extensions/AGENTS.md` | `~/.pi/agent/extensions/` | Extension contracts enforcing lattice.md criteria |
| `prompts/AGENTS.md` | `~/.pi/agent/prompts/` | Prompt template index and usage conventions |
| `themes/AGENTS.md` | `~/.pi/agent/themes/` | Theme file conventions |
