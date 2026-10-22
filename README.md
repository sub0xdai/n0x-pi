# n0x-pi

My pi config.
The agent knows where everything lives, follows a coding standard, and checks its own output before showing it to me.
Looking to decrease bloat where possible.

- [Contract](agent/AGENTS.md) - directory layout, naming, the extension boundary test
- [Harness map](agent/harness-map.md) - every count in the tree, read off disk, with diagrams
- [TigerBeetle](agent/prompts/tigerbeetle.md) - 17 coding rules, always enforced
- [Ponytail](agent/git/github.com/DietrichGebert/ponytail/skills/ponytail/SKILL.md) - lazy-first, the smallest solution that works
- [Vox](agent/skills/vox/SKILL.md) - spec to plan to TDD checkpoints
- [jev-sieve](jev-sieve.md) - design record for the Jev context sieve, including its security review

## Shape

Three layers, applied in order.
Ponytail is the default posture.
Vox drives a specified feature from spec to verified checkpoints.
TigerBeetle is the floor under both: no comments, typed errors, assertion density at every trust boundary.

Only these extensions hook the harness event loop: `state-guard`, `jev-sieve`, `notifications`, `tmux-manager`, `herdr-agent-state`.
Anything that could be a bash script is a bash script.
The boundary test and the per-extension index are in the [extension contract](agent/extensions/AGENTS.md).

The workflows live in [skills](agent/skills/AGENTS.md) and [prompts](agent/prompts/AGENTS.md).
The typed ground truth they read is in [primitives](agent/primitives/AGENTS.md).
Each index is the only copy of its list.

## Guardrails (always on)

- **state-guard** derives DISCOVER / MUTATE / VERIFY from tool events instead of trusting the model to declare state.
  It blocks an edit to a file the session never read.
  It does not settle a runtime-surface change on a test or lint run: the turn needs a run artifact.
- **The gate** runs `__check.sh` after every edit and write, and appends its violations to the tool result.
  Line width, banned tokens, comments, markdown fences, invalid JSON.
  A failing gate is a block, not a warning.
- **TigerBeetle** enforces assertion density, typed errors, and zero tech debt.
- **No comments (TB-17)** - no explanation, banner, docblock, or commented-out code.
  Only `@waiver`, `@anchor`/`@tags`, and `ponytail:` survive, because a tool reads them.
- **The receipt** - every code block ends with a `[VERIFIED]` line, and a missing receipt means the agent skipped the gate.

## Verify

```bash
bash agent/scripts/__check.test.sh          # the gate's own tests
node agent/extensions/state-guard.check.mjs # the guard's assertions
```
