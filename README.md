# n0x-pi

> pi, re-forged. A bespoke build of the pi coding harness — extended, disciplined, and alive.

This is not stock pi. It is pi shaped around one developer's workflows, philosophy, and toolchain. If you clone this repo, you inherit the agent's entire memory: its skills, its rules, its aesthetic, its judgment.

---

## What makes n0x-pi different

### 🧭 The Agentic Lattice

At the heart of this build is [`lattice.md`](agent/lattice.md) — a spatial map and protocol that teaches the agent how to navigate its own capabilities. It defines:

- **Directory boundaries** — what lives where (skills, prompts, extensions, dotfiles scripts)
- **Naming conventions** — `__`-prefixed scripts are agent-invoked subroutines; unprefixed are human-facing tools
- **The extension boundary litmus test** — three criteria for when a TypeScript extension is justified vs. when it's architectural failure (spoiler: almost everything should be a bash script)
- **Pathing discipline** and a **discovery loop** for deterministic capability lookup
- An **auto-indexable entry point** table — run `~/dotfiles/scripts/__lattice_index.sh` to regenerate it

The lattice is the agent's self-model. It knows what it can do, where its tools live, and when it should refuse to act.

### 📐 TigerBeetle Philosophy

All code produced by this agent conforms to [TigerBeetle's engineering standards](agent/prompts/tigerbeetle.md): assertion density ≥ 2 per function, no unwrap in production paths, typed errors, pair-assert on I/O, no dynamic allocation on hot paths, zero technical debt, units in variable names. Safety over performance, determinism over convenience.

### 🫁 Vox — Breath of God

[Vox](agent/skills/vox/SKILL.md) is a spec-driven development pipeline built directly into the agent. Two modes:

- **`/skill:vox plan <spec>`** — gap analysis + task decomposition into vertical checkpoints (runs on Opus)
- **`/skill:vox build <spec>`** — TDD checkpoint execution, one checkpoint per invocation (runs on Sonnet with high effort)

The name is deliberate: *vox* (Latin: voice) — the creative force that speaks things into existence. The companion shell scripts (`__setup_vox.sh`, `vox.sh`, `vox-optimize.sh`) scaffold entire projects with `.specify/` directories, constitutions, advisor gate protocols, and autonomous build loops. The builder loop orchestrates Claude Code instances with model-per-mode dispatch (Opus for planning, Sonnet for building) and prompt-cache-optimized context assembly.

### 🎨 Kanso-Ink

A custom dark theme (`kanso-ink`) built around warm ink-blues and muted parchment tones. Named for the Japanese aesthetic of austere simplicity. Living in [`agent/themes/kanso-ink.json`](agent/themes/kanso-ink.json).

### 🔧 Custom Extensions

Extensions are kept to a minimum — only what requires lifecycle interception, TTY manipulation, or persistent transport:

| Extension | Purpose | Justification |
|-----------|---------|---------------|
| `plan-mode.ts` | Step-tracked plan mode with destructive-tool gating | Lifecycle interception (hooks `tool_call`) |
| `comment.ts` | Open last assistant response in `$EDITOR`, load back quoted | TTY/UI manipulation (reads session, sets editor text) |
| `tmux-manager.ts` | 4 LLM-callable tmux tools + `/tmux` slash commands | Persistent transport (spawns and monitors tmux processes) |
| `notifications.ts` | Desktop notifications on long tasks + agent completion | Lifecycle interception (hooks `tool_execution_start/end`, `agent_end`) |

### 🧠 Skills & Prompts

| `/skill:` | Description |
|-----------|-------------|
| `vox` | Spec-driven development — plan → build pipeline |
| `diff-review` | Visual HTML diff review with architecture comparison, KPI dashboard, Mermaid diagrams, Good/Bad/Ugly/Questions |
| `shannon` | Neovim RPC for annotated code reviews, walkthroughs, and error markers |

| `/prompt` | Description |
|-----------|-------------|
| `brainstorm` | Guided collaborative design — one question per turn, incremental validation |
| `grill-me` | Depth-first interrogation — one question per turn, no hand-waves accepted |
| `tigerbeetle` | TigerBeetle engineering philosophy as active coding standards |

### 🏗️ Dotfiles Integration

28 `__`-prefixed shell scripts in `~/dotfiles/scripts/` form the agent's execution plane. These are the actual workhorses — the lattice ensures the agent discovers and invokes them by convention rather than by registry.

### 📦 Packages

- `pi-powerline-footer` — compact powerline-style context bar in the footer
- `pi-web-access` — web search, code search, and content fetching tools

### ⚙️ Defaults

| Setting | Value |
|---------|-------|
| Provider | deepseek |
| Model | deepseek-v4-pro |
| Thinking | high |
| Vibe | zen |

---

## Repository structure

```
.pi/
├── agent/
│   ├── lattice.md              # 🧭 The Agentic Lattice — spatial map & protocol
│   ├── settings.json           # Global settings
│   ├── extensions/             # TypeScript extensions (the 3-criteria wall)
│   │   ├── plan-mode.ts
│   │   ├── comment.ts
│   │   ├── tmux-manager.ts
│   │   └── notifications.ts
│   ├── skills/                 # Agent Skills (SKILL.md per directory)
│   │   ├── vox/SKILL.md        #   🫁 Spec-driven development pipeline
│   │   ├── diff-review/SKILL.md #  📊 Visual HTML diff reviews
│   │   └── shannon/SKILL.md    #   📝 Neovim RPC interaction
│   ├── prompts/                # Prompt templates (/<name>)
│   │   ├── brainstorm.md       #   Guided design dialogue
│   │   ├── grill-me.md         #   Deep-dive interrogation
│   │   └── tigerbeetle.md      #   Engineering philosophy
│   ├── themes/
│   │   └── kanso-ink.json      #   Custom dark theme
│   └── sessions/               # Session history
└── README.md                   # This file
```

The companion execution plane lives in `~/dotfiles/scripts/__*.sh` — 28 agent-invokable subroutines discoverable through the lattice.

---

## Philosophy

- **The agent knows itself.** The lattice is read once per session. After that, the agent navigates its capabilities deterministically.
- **Extensions are a last resort.** If it can be a bash script invoked by the native `bash` tool, it should be. The litmus test is strict. Violations are flagged, not deleted.
- **Safety is non-negotiable.** TigerBeetle standards apply to every code path — from one-liner fixes to multi-week features.
- **The agent extends human will.** Vox speaks structure into chaos. Brainstorm refines raw ideas. Grill-me surfaces hidden assumptions. The agent doesn't replace judgment — it sharpens it.
- **One question per turn.** In brainstorm and grill modes, the agent never overwhelms. Depth over breadth.
- **Vertical slices over horizontal layers.** In vox build, every checkpoint is independently testable, independently committable, and end-to-end.

---

## vs. Stock pi

| Aspect | Stock pi | n0x-pi |
|--------|----------|--------|
| Self-model | None — the agent doesn't know its own capabilities | Lattice with discovery loop, auto-indexing |
| Engineering standards | Model defaults | TigerBeetle philosophy enforced on all code paths |
| Development workflow | Ad-hoc | Vox: spec → plan → build pipeline with advisor gates |
| Extensions philosophy | "Build what you want" | 3-criteria wall — almost everything is bash |
| Theme | `dark` / `light` built-ins | `kanso-ink` custom theme |
| Default model | Configurable | deepseek-v4-pro @ high thinking |
| Notifications | None | Desktop notifications (OSC 777 + notify-send) |
| Tmux integration | None | Full tmux tool surface for background jobs |
| Plan mode | "Build it with extensions" | Built-in step-tracking plan mode with destructive-tool gating |
| Editor integration | None | `/comment` loads agent responses into $EDITOR; Shannon RPC for Neovim annotations |
| Prompt templates | User-defined | 3 bespoke templates for design, interrogation, and standards |
| Dotfiles coupling | None | 28 `__`-prefixed scripts form the execution plane |

---

## Getting started (if you're not me)

This repo is deeply personal. It assumes:

- `~/dotfiles/scripts/` exists with the `__`-prefixed subroutines
- `~/dotfiles/shell_common/` provides the shell environment
- Neovim with the Shannon plugin for editor RPC
- i3 window manager (notifications use `notify-send`)
- tmux for background job management
- DeepSeek API key for the default model

If you want to adapt it:

1. Fork and strip what doesn't apply
2. Replace the dotfiles scripts with your own execution plane
3. Update `lattice.md` with your directory boundaries
4. Run `~/dotfiles/scripts/__lattice_index.sh` to regenerate the index
5. Modify `settings.json` for your provider/model preferences

---

## License

MIT (inherited from pi). The custom extensions, skills, prompts, theme, and lattice are original work.
