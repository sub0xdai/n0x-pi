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

- New extensions must declare which criterion they satisfy in a comment at the top
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
| `tmux-manager.ts` | Lifecycle Interception (#1) | Registers tmux tool (tmux_new_session, capture_pane, send_keys, kill_session) for tmux session management |
| `powerline-footer/` | TUI/UI Manipulation (#2) | (from pi-powerline-footer package) Custom powerline-style footer with git info, token stats, shortcuts |

### Package-Provided Extensions (active via settings.json)

| Package | Extension | Purpose |
|---------|-----------|---------|
| `pi-web-access` | web tools | Registers `web_search`, `fetch_content`, `code_search`, `get_search_content` tools |
| `@tungthedev/pi-extensions` | boxed editor | Floating detached input box with extensible status row and fixed editor mode |

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
