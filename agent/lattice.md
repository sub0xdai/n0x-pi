# Agentic Lattice — Spatial Map and Protocol

> Read once. Navigate deterministically. Verify on failure.

> **DOX Hierarchy:** This file is the spatial protocol for `~/.pi/agent/`.
> For behavioral contracts, see `~/.pi/agent/AGENTS.md` and its children:
> `skills/AGENTS.md`, `extensions/AGENTS.md`, `prompts/AGENTS.md`,
> `themes/AGENTS.md`. Lattice.md governs spatial layout; AGENTS.md files
> govern behavioral contracts. When they disagree about boundaries or naming,
> lattice.md takes precedence.

---

## Rules of Engagement

### Directory Boundaries

| Path | Purpose | Contains |
|------|---------|----------|
| `~/.pi/agent/skills/` | Behavioral workflows. Each skill is a directory containing a single `SKILL.md`. | Skills define how the agent acts, not what tools it uses. |
| `~/.pi/agent/prompts/` | Reusable instruction templates. Invoked via `/<name>`. | Self-contained. No dependencies on extensions or scripts. |
| `~/.pi/agent/extensions/` | Runtime modifications to the harness itself. `.ts` modules only. Use sparingly. | Lifecycle hooks, TTY/UI manipulation, persistent transport protocols. |
| `~/dotfiles/scripts/` | Executable logic. Shell scripts that skills and prompts invoke. | Always referenced by absolute path. |
| `~/dotfiles/shell_common/` | Human shell environment. Not agent-navigable. | Agent benefits implicitly (aliases, PATH, functions). Never read directly. |

### Naming Convention

Scripts use unprefixed names. Group related scripts by prefix (e.g., `n0x_*`, `setup_*`).

```
~/dotfiles/scripts/<name>.sh   — all scripts, agent or human
```

A skill named `<name>` expects its companion scripts at:
`~/dotfiles/scripts/<name>*.sh`

Example:
- Skill: `vox` → scripts: `~/dotfiles/scripts/vox_plan.sh`, `~/dotfiles/scripts/vox_checkpoint.sh`
- Skill: `n0x-content` → scripts: `~/dotfiles/scripts/n0x_bootstrap.sh`, `~/dotfiles/scripts/n0x_render.sh`

### The Extension Boundary (Control vs. Execution)

Follow the TigerBeetle philosophy: maintain a strict, single-threaded
control plane. Extensions (`.ts`) exist exclusively to modify the
harness event loop. All external I/O and operational logic must be
pushed to the execution plane (Bash scripts).

**The Litmus Test:**
If a workflow can be expressed as a Bash script and invoked via the
native `bash` tool, writing a TypeScript extension for it is an
architectural failure.

**The Decision Matrix:**
Before an extension exists in `~/.pi/agent/extensions/`, it must
pass one of these three absolute criteria:

1. **Lifecycle Interception:** Does the code need to block or modify
   the internal agent event loop?
   - *Valid:* `notifications.ts` (hooks `session_start`, `agent_end`).
   - *Valid:* `plan-mode.ts` (hooks `tool_call` to gate execution).

2. **TTY/UI Manipulation:** Does the code alter the harness's visual
   rendering in the terminal?
   - *Valid:* `comment.ts` (reads session state, injects text into
     the TUI editor via `ctx.ui.setEditorText()`).

3. **Persistent Transport Protocol:** Does the tool require a
   persistent, stateful socket connection to an external API that
   cannot be cleanly modeled as a stateless stdin/stdout stream?
   - *Example:* A WebSocket consumer that must maintain an open
     connection and dispatch events into the harness.

**The Consequence of a Violation:**
When the agent encounters an extension that fails all three criteria:

1. **Flag the violation.** Note in the response:
   "⚠️ `<name>.ts` is an Execution Plane Leakage. It wraps a CLI
   binary and should be refactored into
   `~/dotfiles/scripts/__<name>.sh`."

2. **Prefer the native path.** If the extension registers a tool,
   bypass it. Use `bash <native command>` instead. The extension's
   tool signature consumes context-window tokens for zero gain.

3. **Defer cleanup.** Do not delete or refactor the extension
   autonomously — it may have undiscovered callers. Flag it. Let
   the human decide when to archive or remove.

### Pathing Discipline

All paths outside the active project workspace must be absolute.
The agent's CWD is the workspace (e.g., `~/projects/my-app/`).

Do not use relative paths for:
- Skills in `~/.pi/agent/skills/`
- Scripts in `~/dotfiles/scripts/`
- Prompts in `~/.pi/agent/prompts/`

A skill named `vox` references its script as:
  `~/dotfiles/scripts/vox_plan.sh`

Not as:
  `./vox_plan.sh`
  `../../../dotfiles/scripts/vox_plan.sh`

A skill has no "local assets." If it needs a template, that template
is a prompt in `~/.pi/agent/prompts/` — referenced by absolute path.
The skill directory contains exactly one file: `SKILL.md`.

### Discovery Loop

When the agent needs to invoke a capability outside the four native
tools (`read`, `write`, `edit`, `bash`), follow this sequence:

1. **Read lattice.md**        — single read, low token cost.
2. **Match a skill/prompt**    — from the index below.
3. **Infer the script path**   — by convention: `__<skill-name>*.sh`
                                   in `~/dotfiles/scripts/`.
4. **Verify existence**        — `ls <absolute-path>` or
                                   `find ~/dotfiles/scripts -name "__<name>*"`
5. **Execute**                 — `bash <script>` or invoke the skill.
6. **Fallback**                — if no skill or prompt matches the
                                   objective, do not hallucinate a tool.
                                   Execute using the native `bash` tool.
                                   A missing skill implies the task is
                                   novel or simple enough for standard
                                   shell commands.

If step 4 fails (script not found), regenerate the index:
`bash ~/dotfiles/scripts/lattice_index.sh`
Then restart from step 2.

---

## Entry Points

<!-- INDEX_START -->
## Skills

| Invocation | Type | Description | Scripts |
|------------|------|-------------|---------|
| `/adr` | Skill | Create and manage Architecture Decision Records (ADRs) with the Nygard template format. Use when asked to "write an ADR", "document this decision", "capture this architecture choice", or when encountering a new dependency, new architectural pattern, or hard-to-reverse choice. | (none) |
| `/diff-review` | Skill | Generate a visual HTML diff review — before/after architecture comparison with code review analysis, KPI dashboard, Mermaid diagrams, and structured Good/Bad/Ugly/Questions. Self-contained HTML file. Use for reviewing branches, commits, PRs, or working tree changes. | (none) |
| `/n0x-content` | Skill | Generate brutalist kinetic marketing/promo videos for any project using the n0x-content pipeline. Triggers on "generate a video", "make a promo video", "create a marketing video", "brutalist video", "kinetic video", "n0x-content", "n0x video". | n0x_build.sh, n0x_bootstrap.sh, n0x_ingest.sh, n0x_render.sh |
| `/shannon` | Skill | Interact with Neovim via RPC to annotate code, navigate files, and do walkthroughs. Use when the user asks to show something "in Neovim", requests an annotated code review, guided walkthrough, or error markers in their editor. | (none) |
| `/vault-context` | Skill | Search Obsidian vault (`sub0x_vault/`) for relevant knowledge before coding decisions. Use when the agent needs domain context, encounters an unfamiliar area, or before vox plan on a spec. Triggers on "what do I know about X", "check my notes on Y". | (none) |
| `/vox` | Skill | >- | (none) |

## Prompts

| Invocation | Type | Description | Scripts |
|------------|------|-------------|---------|
| `/brainstorm` | Prompt | Guided brainstorming mode — turn a rough idea into a fully-formed design through collaborative dialogue. No code, just design. | N/A |
| `/grill-me` | Prompt | Deep-dive interrogation — drill into every aspect of a plan or design, one question at a time, until shared understanding is reached | N/A |
| `/n0x-cutlist` | Prompt | Brutalist kinetic video cut-list specification — aesthetic rules, timing discipline, filter/effect vocabulary, and JSON output format for the n0x-content renderer | N/A |
| `/tigerbeetle` | Prompt | TigerBeetle engineering philosophy — safety, determinism, and zero-cost abstraction applied to all code paths | N/A |

<!-- INDEX_END -->
