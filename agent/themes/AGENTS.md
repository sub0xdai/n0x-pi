# Themes — Directory Contract

Agents editing or creating themes under `~/.pi/agent/themes/` must follow this contract.

## Purpose

Themes control pi's terminal color palette and visual styling. They are JSON files
following pi's theme schema. Pi loads them from `~/.pi/agent/themes/`, `.pi/themes/`,
and pi packages.

## Ownership

- **Owner:** m0xu
- **Parent:** `~/.pi/agent/AGENTS.md` (root DOX contract)

## Local Contracts

### File Shape

- Valid JSON conforming to pi's theme schema
- `name` field matches the theme display name
- `$schema` field points to the canonical schema URL

### Creation Rules

- Place in `~/.pi/agent/themes/` for global, `.pi/themes/` for project-local
- Use pi's theme schema reference: `https://raw.githubusercontent.com/earendil-works/pi-mono/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json`
- Themes hot-reload automatically — no restart needed

### Active Theme

Current: **vanilla-amoled** (set in `~/.pi/agent/settings.json`)

## Theme Index

| Theme | Source | Notes |
|-------|--------|-------|
| `vanilla-amoled` | `~/.pi/agent/themes/vanilla-amoled.json` | User-created, active |
| `kanso-ink` | `~/.pi/agent/themes/kanso-ink.json` | User-created |
| `blackboard` | `pi-blackboard-theme` package | From npm |
| `blackboard-pro` | `pi-blackboard-theme` package | From npm |
| ANSI themes (various) | `pi-ansi-themes` package (git) | Collection |
| Additional themes | `pi-themes` package (git) | Collection |

## Work Guidance

- Themes are purely visual — no behavioral side effects
- Do not edit package themes in `npm/node_modules/` or `git/`
- To switch themes: use `/settings` in interactive mode or edit `settings.json` → `theme`
- Custom powerline footer theming goes in
  `~/.pi/agent/extensions/powerline-footer/theme.json`

## Verification

- Theme JSON must be parseable and conform to schema
- `name` field must be unique

## Child DOX Index

None — themes are flat JSON files with no sub-structure.
