# n0x-pi

My pi config. The agent knows where everything lives, follows a coding standard, and checks its own output before showing it to me.

- [Lattice](agent/lattice.md) — directory layout, naming rules, the extension litmus test
- [TigerBeetle](agent/prompts/tigerbeetle.md) — 14 coding rules, always enforced
- [Vox](agent/skills/vox/SKILL.md) — spec → plan → TDD checkpoints
- [Emission gate](agent/primitives/check.schema.json) — script + AI self-check before any code reaches me

## Extensions

Four total. Each one modifies the harness event loop — no CLI wrappers dressed up as extensions.

| Extension | Does |
|---|---|
| `plan-mode` | Gates destructive tools when a build plan is active |
| `comment` | Opens the last response in `$EDITOR` so I can edit before sending |
| `tmux-manager` | Background jobs in tmux, callable by the agent |
| `notifications` | Pings my desktop when a task finishes |

## Skills

`anchor:init`, `anchor:verify` — structural @anchor tags, pre-commit enforcement.
`vox` — plan/build from specs.
`diff-review` — visual HTML diff, architecture diagrams.
`shannon` — annotate code in Neovim via RPC.
`librarian` — library internals with source links.
`cloudflare-devops` — Workers/Pages, tunnels, CI/CD.
`graphify` — codebase to knowledge graph.
`handoff` — session summary for the next agent.
`humanizer` — strip AI-isms from text.

## Prompts

`/brainstorm` — guided design, one question at a time.
`/grill-me` — depth-first interrogation, no surface-level answers.
`/grill-with-docs` — grill-me but also refines project language and writes ADRs.
`/brilliance` — iterate until there's nothing left to flag.
`/tigerbeetle` — load the coding standard explicitly.

## Guardrails (always on)

- **anchor:verify** blocks commits with un-annotated files, auto-syncs the manifest.
- **TigerBeetle** — assertion density, typed errors, zero tech debt. Always enforced.
- **Emission gate** — `__check.sh` scans for line width and forbidden tokens. Then the AI self-checks all 21 rules. Every code block needs a `[VERIFIED]` receipt. Missing receipt = the agent skipped the gate.

## Workflow

```
New project:       anchor:init → vox plan → vox build → anchor:verify
Existing code:     anchor:init → graphify → librarian → diff-review
Feature work:      vox plan → vox build → /grill-me → /brilliance → diff-review
Session end:       handoff
```

Stock pi is a blank config. This one ships with opinions and checks. Almost everything outside the four extensions is a bash script in `~/dotfiles/scripts/`. The lattice file maps it all.
