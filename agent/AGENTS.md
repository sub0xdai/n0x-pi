# Pi Agent Configuration - DOX Root


# NO words 
 These are words or phrases that are banned:

 'delve, landscape, tapestry, robust, seam, seamless, cutting-edge, transformative, pioneering, leverage, in today's world, it's important to note, ultimately, moreover, furthermore
'

This is the root DOX contract for `~/.pi/agent/`. Agents editing any file under this
tree must read this doc plus the nearest child AGENTS.md along the path.

## Purpose

`~/.pi/agent/` houses all pi coding agent configuration. Every edit here changes pi's
behavior in every project. This file is the single contract for layout and boundaries.
There is no separate map file: a second document that describes the first is a second
thing to drift.

## Ownership

- **Owner:** m0xu
- **Versioned:** in the repository at `~/.pi`, alongside these files, so the contract and
  the tree it describes change in one commit
- **Pi loads:** `APPEND_SYSTEM.md` rides in the system prompt. `AGENTS.md` files load by
  directory discovery when the working directory is under this tree.

## Local contracts

### Directory map

| Path | Purpose | Rule |
|---|---|---|
| `skills/` | Behavioral workflows, one directory per skill | exactly one `SKILL.md`, no other files unless the skill ships an asset |
| `prompts/` | Reusable instruction templates, invoked as `/<name>` | self-contained; no dependency on an extension |
| `extensions/` | Hooks into the pi event loop, `.ts` only | must pass the boundary test below |
| `primitives/` | Typed ground truth, `.schema.json` only | typed data, never prose instruction |
| `themes/` | pi theme JSON | one theme per file |
| `scripts/` | The mechanical gate and its test | loaded by `state-guard`, not by pi |
| `~/dotfiles/scripts/` | Executable logic that skills invoke | absolute paths only |

### The extension boundary

An extension exists to modify the harness event loop. If a workflow can be a bash script
driven through the native `bash` tool, an extension for it is a mistake.

An extension may exist only if it does one of these three things:

1. **Lifecycle interception** - blocks or modifies the agent event loop.
   `state-guard` refuses blind edits and runs the gate; `notifications` reacts to turns.
2. **TTY/UI manipulation** - changes terminal rendering.
3. **Persistent transport** - needs a stateful socket to an external API.

An extension that registers a wrapper tool and passes none of the three is
execution-plane leakage. Prefer `bash <command>`, and flag the extension rather than
writing another one.

### Naming and pathing

- Scripts are `<name>.sh` in `~/dotfiles/scripts/`, grouped by prefix (`scythe_*`).
- A skill named `<name>` uses scripts matching `~/dotfiles/scripts/<name>*.sh`.
- Paths outside the workspace are always absolute. A skill has no local assets; its
  template is a prompt in `prompts/`, referenced absolutely.
- If a capability is missing, say so and use `bash`. Do not invent a tool.

### Runtime configuration

`settings.json` is the only source for provider, model, theme, and packages. `pi list` is
the source of truth for what is actually installed, because pi reconciles the settings
array against disk at startup.

`agent/mcp.json` holds MCP servers for pi's builtin MCP support. Do not declare an MCP
adapter package: pi answers a declared MCP extension by writing `extensions:
["-builtin:mcp"]`, which silently disables every server.

### Verification

- `bash scripts/__check.test.sh` - the gate's own tests (22)
- `node extensions/state-guard.check.mjs` - the runtime guard's assertions
- `__check.sh` runs automatically after every `edit` and `write`, and on files a bash call
  changed inside a git repository. A failing gate is a block, not a warning.

## Child DOX index

| Child | Scope | Description |
|---|---|---|
| `skills/AGENTS.md` | `~/.pi/agent/skills/` | skill creation rules and the script each skill invokes |
| `extensions/AGENTS.md` | `~/.pi/agent/extensions/` | extension index, the boundary criterion each one meets, loader limits |
| `prompts/AGENTS.md` | `~/.pi/agent/prompts/` | prompt conventions and the primitives each one reads |
| `primitives/AGENTS.md` | `~/.pi/agent/primitives/` | schema conventions and which prompt reads each |
| `themes/AGENTS.md` | `~/.pi/agent/themes/` | theme file conventions |
