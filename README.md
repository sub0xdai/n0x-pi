# n0x-pi

pi, re-forged. Extended, disciplined, and alive.

## What's different

- **🧭 [Lattice](agent/lattice.md)** — the agent's self-model. Directory boundaries, naming conventions, a 3-criteria litmus test for when extensions are warranted, and a discovery loop. The agent knows what it can do and where its tools live.

- **📐 [TigerBeetle standards](agent/prompts/tigerbeetle.md)** — enforced on all code paths. Assertion density ≥ 2 per function, typed errors, zero tech debt, units in variable names. Safety over performance, determinism over convenience.

- **🫁 [Vox](agent/skills/vox/SKILL.md)** — spec-driven development pipeline. `plan` (gap analysis → checkpoints) then `build` (TDD checkpoint execution). Model-agnostic — configure plan/build models via env vars. *Vox* = voice, the creative force that speaks structure into chaos.

- **🎨 Kanso-Ink** — custom dark theme. Ink-blue accents, muted parchment tones.

- **🔧 Extensions** (kept to a minimum):
  | Extension | Why |
  |-----------|-----|
  | `plan-mode` | Step-tracked plans, gates destructive tools |
  | `comment` | Load agent responses into `$EDITOR` |
  | `tmux-manager` | LLM-callable tmux tools for background jobs |
  | `notifications` | Desktop pings on long tasks & completion |

- **🧠 Skills**: `shannon` (Neovim RPC for annotated code reviews), `diff-review` (visual HTML diff with architecture comparison)

- **💬 Prompts**: `brainstorm` (guided design, one question per turn), `grill-me` (depth-first interrogation, no hand-waves), `tigerbeetle` (active coding standards)


## vs. Stock pi

Stock pi ships as a blank canvas. n0x-pi ships as a workshop — the agent has a self-model, a philosophy, a design pipeline, a theme, and knows its boundaries. Extensions are gated behind a strict litmus test; almost everything is bash scripts invoked by convention (`~/dotfiles/scripts/__*.sh`). The lattice ensures deterministic capability discovery instead of ad-hoc tool use.
