# n0x-pi

pi, re-forged. Extended, disciplined, and alive.

Batteries-included pi config. The agent knows its own filesystem, follows strict coding standards, and has a spec-to-code pipeline that ships. Extensions are rare and justified. Everything else is plain bash scripts called by naming convention.

## What's inside

### 🧭 Self-model: [Lattice](agent/lattice.md)

The agent reads this file once and knows where everything lives. Directory boundaries, naming conventions, a 3-criteria test for when a TypeScript extension is warranted, and a deterministic discovery loop. No guessing what tools exist.

### 📐 Coding standards: [TigerBeetle](agent/prompts/tigerbeetle.md)

Enforced on every code path by default. Assertion density ≥ 2 per function. Typed errors, not strings. Zero tech debt on commit. Units in variable names. Safety over performance, determinism over convenience.

### 🫁 Spec pipeline: [Vox](agent/skills/vox/SKILL.md)

Two-step spec-to-code workflow. `plan` does gap analysis and decomposes work into vertical checkpoints. `build` runs TDD checkpoint execution — red, green, refactor, verify. Runs one checkpoint per invocation. Never skips a gate.

### Extensions (only 4, each justifies its existence)

| Extension | Why it's here |
|---|---|
| `plan-mode` | Tracks checkpoints in a markdown file. Gates destructive tool calls when plan mode is active |
| `comment` | Opens the agent's last response in `$EDITOR` so you can edit before sending |
| `tmux-manager` | Exposes `tmux_new_session`, `tmux_capture_pane`, `tmux_send_keys`, `tmux_kill_session` as LLM-callable tools. Background jobs without leaving the session |
| `notifications` | Desktop pings when a long task finishes and when the agent is ready for the next command |

### Skills

**Code & review:**  
`vox` — spec-driven plan and build. `diff-review` — visual HTML diff with architecture comparison. `shannon` — annotate code in your Neovim session via RPC.

**Infra & deploy:**  
`cloudflare-devops` — deploy to Cloudflare Workers/Pages, manage tunnels.

**Docs & research:**  
`kami` — typeset resumes, one-pagers, white papers, slide decks to PDF. `graphify` — turn any folder into a knowledge graph. `handoff` — write a session summary for the next agent. `librarian` — research open-source library internals with GitHub permalinks.

**Editing:**  
`humanizer` — strip AI-isms from text.

### Prompts

`/brainstorm` — guided design, one question per turn.  
`/grill-me` — depth-first interrogation, no hand-waves.  
`/grill-with-docs` — grill-me, but also refines your project's ubiquitous language and writes ADRs as you go.  
`/brilliance` — push changes until the reviewer has nothing to flag.  
`/tigerbeetle` — the coding standard, loaded explicitly when needed.

### Themes

- **kanso-ink** — custom dark theme. Ink-blue accents on muted charcoal.  
- **vanilla-amoled** — pure black background, high contrast. The active default.  

Plus pi-ansi-themes and pi-themes packages for catppuccin, dracula, monokai, rose-pine, solarized, and a dozen more.

### pi packages

`pi-powerline-footer` (compact status bar), `pi-web-access` (web search + librarian skill), `pi-blackboard-theme`, `pi-ansi-themes` + `pi-themes` (community theme collections: catppuccin, dracula, monokai, rose-pine, solarized, and more).

## vs. stock pi

Stock pi is a blank canvas. n0x-pi is a workshop. The agent has a self-model, a philosophy, a design pipeline, themes, and knows its boundaries. Extensions pass a strict litmus test or they don't ship. Almost every capability is a bash script following the `__<name>.sh` naming convention in `~/dotfiles/scripts/`. The lattice makes capability discovery deterministic instead of ad-hoc.
