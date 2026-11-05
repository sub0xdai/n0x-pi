# Extensions — Directory Contract

Agents editing or creating extensions under `~/.pi/agent/extensions/` must follow this
contract and the boundary rules in `~/.pi/agent/AGENTS.md`.

## Purpose

Extensions are TypeScript modules that modify the pi harness runtime — lifecycle hooks,
TUI manipulation, or persistent transport. They are not general-purpose tools. General
logic belongs in shell scripts (`~/dotfiles/scripts/`), invoked via the native `bash` tool.

## Ownership

- **Owner:** m0xu
- **Parent:** `~/.pi/agent/AGENTS.md` (root DOX contract)
- **Protocol:** `~/.pi/agent/AGENTS.md` (directory map, boundary test)

## Local Contracts

### The Boundary Test (from the root AGENTS.md)

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
| `notifications.ts` | Lifecycle Interception (#1) | Hooks `tool_execution_start/end` and `agent_end` to send desktop and OSC 777 terminal notifications |
| `tmux-manager.ts` | Lifecycle Interception (#1) | Registers tmux tool (tmux_new_session, capture_pane, send_keys, kill_session) for tmux session management |
| `jev-sieve.ts` | Lifecycle Interception (#1) | Hooks `tool_result` to judge large read/bash/grep results block by block and replace confident-irrelevant blocks with a cache-backed stub; the judgment runs in `~/dotfiles/scripts/jev.sh`. Defaults to `off`, and a result whose path, content, or task names a secret is never sent, never cached, and never modified. A reading whose served model is not the pinned one is discarded as no reading |
| `herdr-agent-state.ts` | Persistent Transport (#3) | Reports agent state to the Herdr platform over `HERDR_SOCKET_PATH`, inert unless `HERDR_ENV=1` and a pane id are set. Vendor-managed: reinstalling the Herdr integration overwrites the file, so add hooks beside it rather than editing it |
| `state-guard.ts` | Lifecycle Interception (#1) | Derives `DISCOVER`/`MUTATE`/`VERIFY` from tool events instead of trusting the model to declare state. Blocks `edit`/`write` on an existing file the session never read, and asks for one continuation when a turn ends with unverified mutations. A runtime-surface diff (source or style extensions, case-insensitive) is not settled by a test or lint run. The turn needs a run artifact: a bash or powershell command whose segment starts an execution (`RUN_COMMAND`), excluding commands named like a test runner (`TEST_ONLY`), or a successful page-touching `mcp__kitesurf__` call, whether issued directly or from a `codemode` script (`PAGE_SCRIPT`). A run clears only dirt that is not already failing the gate, so a TB violation survives it; a test or lint command (`checked`) clears a docs/config-only diff and does nothing for source. The first turn end gets a continuation demanding the artifact, a second gets a displayed `Settled without a run artifact` warning, then no further loops. Tests remain useful but are treated as a proxy, matching `APPEND_SYSTEM.md`. The gate still runs `__check.sh` on every `edit`/`write` result, appends its violations to the tool result, and re-gates the stored ones in the settle nudge so it names only the paths that fail right now, so the mechanical gate cannot be skipped. Blocks a bash command that redirects into a gated file outside `/tmp`, and catches indirect shell writes by comparing a git fingerprint (path, size, mtime) taken before and after each bash call. A path under `node_modules/` is never gated, never dirtied, and never named in the settle nudge: vendored third-party code is not ours to fix and an extension update overwrites it anyway, so the exemption is the correct answer to a dependency that breaks TB-09 or TB-17. A directory with a `VENDOR` file at any ancestor gets the same exemption, which keeps a vendored skill upstream-identical while the gate keeps covering everything we author. The file must be a regular file containing an `Upstream:` line, so an empty marker cannot disable the gate by accident, and `__check.sh` honours the same rule. State is per-session, in memory, reset on `session_start`. Limits: only the `read` tool marks a file read, so a file inspected through `ffgrep`, `grep`, or `codemode` still needs one `read` (a snippet is not enough context for a patch). Paths are canonicalized with `realpathSync.native`, so a symlinked alias such as `~/dotfiles/scripts/__check.sh` and its target count as one file. Hardlinks stay two paths: same inode, no symlink to resolve. Check: `node state-guard.check.mjs` (`.mjs` is not auto-loaded, `.ts` and `.js` are) |

### Package-Provided Extensions (active via settings.json)

| Package | Extension | Purpose |
|---------|-----------|---------|
| `pi-web-access` | web tools | Registers `web_search`, `source_check`, `fetch_content`, `get_search_content`, plus the WebSearch/WebSummary/FetchUrl shims and the curator layer |
| `@tungthedev/pi-extensions` | boxed editor, subagents | Floating detached input box with extensible status row and fixed editor mode; Task subagents writing to `~/.pi/subagents/sessions/` |
| `@ff-labs/pi-fff` | path and content search | Registers `ffgrep` and `fffind`; frecency and history stores live in `agent/fff/` |
| `eko24ive/pi-ask` | ask gate | Registers `ask_user` and the ask-user skill; keymaps and model settings in `eko24ive-pi-ask.json` |
| `@upstash/context7-pi` | docs lookup | Registers `resolve-library-id` and `query-docs`, plus the context7-docs skill |
| `@yeliu84/pi-model-router` | model routing | Per-turn model selection, configured in `agent/model-router.json` |
| `ponytail` | none | Ships 6 skills, no extension code |
| `vim-motions-pi` | vim keybindings | Registers `VimEditor` through `ctx.ui.setEditorComponent` on `session_start`, the same event the boxed editor uses, and it is last in `settings.json`, so it takes the slot. Neither editor composes with the other: `VimEditor` and `CodexBoxedEditor` both extend the base `CustomEditor` and neither class is exported, so load order only decides which one is lost. `VimEditor` imports from `@mariozechner/pi-coding-agent@0.73.1`, a hoisted duplicate, while the running core is 0.87.0 |

`pi list` is the source of truth for what is registered. Pi reconciles `settings.json`
against installed packages on startup, so the array is not stable across runs.

Also sitting in this directory but not an extension: `eko24ive-pi-ask.json`, which is
package config, and `state-guard.check.mjs`, which is the self-check for `state-guard.ts`
(`.mjs` is not loaded by `discoverExtensionsInDir`, which accepts only `.ts` and `.js`).

## Work Guidance

### Flagging Leakages

When encountering an extension that fails all three litmus test criteria:
1. Note in response: "⚠️ `<name>.ts` is an Execution Plane Leakage..."
2. Prefer the native path: use `bash` with the equivalent CLI command instead of the extension's registered tool
3. **Defer cleanup** — do not delete or refactor autonomously; let the human decide

### Editing Extensions

- Read the full extension file before editing
- Respect the boundary: push logic to scripts, keep extensions as thin harness hooks
- After editing, verify the extension still passes its declared criterion

## Verification

- Each local extension declares which boundary criterion it meets, in this index
- No extension should wrap a CLI binary without passing a criterion
- Package extensions are managed by `pi install/remove/update`, not manual editing

## Child DOX Index

No child AGENTS.md files in individual extension directories. Each extension is a single
`.ts` file (or directory with an `index.ts`) with purpose documented here.
