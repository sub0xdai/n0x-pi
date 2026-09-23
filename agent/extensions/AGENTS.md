# Extensions — Directory Contract

Agents editing or creating extensions under `~/.pi/agent/extensions/` must follow this
contract and enforce the spatial protocol in `~/.pi/agent/lattice.md`.

## Purpose

Extensions are TypeScript modules that modify the pi harness runtime — lifecycle hooks,
TUI manipulation, or persistent transport. They are not general-purpose tools. General
logic belongs in shell scripts (`~/dotfiles/scripts/`), invoked via the native `bash` tool.

## Ownership

- **Owner:** m0xu
- **Parent:** `~/.pi/agent/AGENTS.md` (root DOX contract)
- **Protocol:** `~/.pi/agent/lattice.md` (spatial map, litmus test, boundaries)

## Local Contracts

### The Litmus Test (from lattice.md)

Every extension must pass one of these three criteria. If it passes none, it is an
Execution Plane Leakage and must be flagged.

1. **Lifecycle Interception** — Blocks or modifies the agent event loop
2. **TTY/UI Manipulation** — Alters harness visual rendering in the terminal
3. **Persistent Transport Protocol** — Requires a stateful socket connection to an
   external API

### Creation Rules

- New extensions must declare which criterion they satisfy in this file's extension table
- General-purpose CLI wrappers go to `~/dotfiles/scripts/__<name>.sh`, not extensions
- Extensions register tools only when justified by lifecycle/UI/transport criteria
- Never duplicate a native pi tool as an extension tool

### Pi Packages vs. Local Extensions

Extensions from pi packages live in `~/.pi/agent/npm/node_modules/` or
`~/.pi/agent/git/`. Do not edit those directly. Local extensions in
`~/.pi/agent/extensions/` are user-maintained.

## Extension Index

### Local Extensions

| File | Criterion | Purpose |
|------|-----------|---------|
| `comment.ts` | TUI/UI Manipulation (#2) | Reads last assistant response and injects `#`-prefixed comment into editor via `ctx.ui.setEditorText()` |
| `notifications.ts` | Lifecycle Interception (#1) | Hooks `tool_execution_start/end` and `agent_end` to send desktop and OSC 777 terminal notifications |
| `plan-mode.ts` | Lifecycle Interception (#1) | Registers `/plan` command and hooks `tool_call` to gate destructive operations when plan mode is active |
| `jev-sieve.ts` | Lifecycle Interception (#1) | Hooks `tool_result` to judge large read/bash/grep results block by block and replace confident-irrelevant blocks with a cache-backed stub; the judgment runs in `~/dotfiles/scripts/jev.sh`. Defaults to `off`, and a result whose path, content, or task names a secret is never sent, never cached, and never modified |
| `tmux-manager.ts` | Lifecycle Interception (#1) | Registers tmux tool (tmux_new_session, capture_pane, send_keys, kill_session) for tmux session management |
| `herdr-agent-state.ts` | Persistent Transport (#3) | Reports agent state to the Herdr platform over `HERDR_SOCKET_PATH`, inert unless `HERDR_ENV=1` and a pane id are set. Vendor-managed: reinstalling the Herdr integration overwrites the file, so add hooks beside it rather than editing it |

### Package-Provided Extensions (active via settings.json)

| Package | Extension | Purpose |
|---------|-----------|---------|
| `pi-web-access` | web tools | Registers `web_search`, `source_check`, `fetch_content`, `get_search_content`, plus the WebSearch/WebSummary/FetchUrl shims and the curator layer |
| `@tungthedev/pi-extensions` | boxed editor, subagents | Floating detached input box with extensible status row and fixed editor mode; Task subagents writing to `~/.pi/subagents/sessions/` |
| `pi-mcp-adapter` | MCP gateway | Registers `mcp` and `mcpScript`, plus the mcp-scripting skill |
| `@ff-labs/pi-fff` | path and content search | Registers `ffgrep` and `fffind`; frecency and history stores live in `agent/fff/` |
| `eko24ive/pi-ask` | ask gate | Registers `ask_user` and the ask-user skill; keymaps and model settings in `eko24ive-pi-ask.json` |
| `@upstash/context7-pi` | docs lookup | Registers `resolve-library-id` and `query-docs`, plus the context7-docs skill |
| `@yeliu84/pi-model-router` | model routing | Per-turn model selection, configured in `agent/model-router.json` |
| `pi-blackboard-theme`, `pi-ansi-themes`, `pi-themes` | none | Ship themes only |
| `ponytail` | none | Ships 6 skills, no extension code |
| `vim-motions-pi` | vim keybindings | Registers `VimEditor` through `ctx.ui.setEditorComponent` on `session_start`, the same event the boxed editor uses, and it is last in `settings.json`, so it takes the slot. Neither editor composes with the other: `VimEditor` and `CodexBoxedEditor` both extend the base `CustomEditor` and neither class is exported, so load order only decides which one is lost. `VimEditor` imports from `@mariozechner/pi-coding-agent@0.73.1`, a hoisted duplicate, while the running core is 0.87.0 |

`pi list` is the source of truth for what is registered. Pi reconciles `settings.json`
against installed packages on startup, so the array is not stable across runs.

Also sitting in this directory but not an extension: `eko24ive-pi-ask.json`, which is
package config.

## Work Guidance

### Flagging Leakages

When encountering an extension that fails all three litmus test criteria:
1. Note in response: "⚠️ `<name>.ts` is an Execution Plane Leakage..."
2. Prefer the native path: use `bash` with the equivalent CLI command instead of the extension's registered tool
3. **Defer cleanup** — do not delete or refactor autonomously; let the human decide

### Editing Extensions

- Read the full extension file before editing
- Respect the lattice.md boundary: push logic to scripts, keep extensions as thin harness hooks
- After editing, verify the extension still passes its declared criterion

## Verification

- Each local extension must have a declared lattice criterion in this index
- No extension should wrap a CLI binary without passing a criterion
- Package extensions are managed by `pi install/remove/update`, not manual editing

## Child DOX Index

No child AGENTS.md files in individual extension directories. Each extension is a single
`.ts` file (or directory with an `index.ts`) with purpose documented here.
