---
name: project-orientation
description: >
  Orient into a project directory and await instructions. Triggers on "study the
  project", "study the codebase", "get up to speed on this repo", "explore the
  project and await instructions", or any fresh-session start in an unfamiliar
  directory where the user wants the agent context-loaded before giving tasks.
allowed-tools: ls, find, read, bash
---

# Project Orientation

Load the full context of a project directory and report a concise understanding,
then stop. Do not start work - the user will give tasks after orientation.

## Phase 1 - Root inventory

1. `ls` the project root (including dotfiles).
2. `find` for `AGENTS.md` anywhere in the tree (project instructions).
3. `find` for `README.md`, `CLAUDE.md`, `CONTEXT.md`, `contexts/`, and handoff
   files (`*handoff*.md`, `HANDOFF.md`, `*HANDOFF*.md`).

## Phase 2 - Read governing docs

Read, in priority order:

1. `AGENTS.md` (nearest to root) - the binding project contract.
2. `README.md` - what the project is and how it is laid out.
3. `CONTEXT.md` / `contexts/` map or similar navigation index - the project's
   own doc map; read the one page a task would need.
4. Most recent handoff doc - what happened last and what is next.
5. `CLAUDE.md` if present and no AGENTS.md exists.

For multi-repo projects (submodules, workspaces), also read the nested
`AGENTS.md` of each submodule.

## Phase 3 - Git state

```bash
git log --oneline -10
git status --short | head -30
```

Read recent commits to learn what the project has been working on. Note the
current branch and dirty state.

## Phase 4 - Domain conventions

- For content/video projects: inventory the naming conventions of past outputs
  (e.g. `n0x-video-N`, per-project `assets/` dirs). Follow them unless told
  otherwise.
- For code projects: note language, test runner, and verification commands from
  the docs read above.

## Phase 5 - Report and await

Report in a few lines: what the project is, its stack/layout, current git state,
and what the user was last doing. Then await instructions. Do not propose work,
do not start editing, do not run tests unless asked.

## Verification

- Every doc you cite was actually read (paths you list came from `ls`/`find`).
- The report contains no invented facts about the project.
