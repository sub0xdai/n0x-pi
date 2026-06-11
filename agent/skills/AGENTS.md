---
description: Contract and index for all skill directories. Defines creation rules, invocation conventions, conflict resolution, and verification procedures.
---

# Skills — Directory Contract

Agents editing or invoking skills under `~/.pi/agent/skills/` must follow this contract
and the spatial protocol in `~/.pi/agent/lattice.md`.

## Purpose

Skills are behavioral workflows — each defines how the agent should act for a specific
task. Skills do not contain executable code or tool definitions; they provide procedural
instructions. Tools come from extensions or native pi tools.

## Ownership

- **Owner:** m0xu
- **Parent:** `~/.pi/agent/AGENTS.md` (root DOX contract)
- **Protocol:** `~/.pi/agent/lattice.md` (spatial map, naming, boundaries)

## Local Contracts

### Directory Shape

Each skill is a directory containing exactly one `SKILL.md` file. No other assets
(lattices, scripts, templates) belong in the skill directory. Script companions live
at `~/dotfiles/scripts/__<skill-name>*.sh`.

### Creation Rules

- Must follow Agent Skills standard (YAML frontmatter: name, description, optional
  allowed-tools, argument-hint, disable-model-invocation)
- Description must specify trigger conditions clearly
- If skill requires scripts, create them in `~/dotfiles/scripts/` with the
  `__<skill-name>` prefix convention
- If skill requires prompt templates, create them in `~/.pi/agent/prompts/`
- Update lattice.md index when adding or removing a skill

### Invocation

Skills are invoked via `/skill:<name>` or auto-loaded by the agent when description
matches the task. Some skills (`teach`) use `disable-model-invocation: true` and
require explicit invocation.

## Skill Index

| Skill | Invocation | Triggers On | Has Scripts |
|-------|-----------|-------------|-------------|
| `anchor-init` | `/skill:anchor-init` | Scaffolding anchor tags for codebase navigation; "new" or "existing" project with language target | generate_manifest.py |
| `anchor-verify` | `/skill:anchor-verify` | Validating anchor compliance on "staged" or "all" files | pre-commit hook |
| `audit` | `/skill:audit` | Two-pass code audit; after implementing features, fixing multi-file bugs, or "audit this" | no |
| `cloudflare-devops` | `/skill:cloudflare-devops` | Cloudflare deployments, wrangler, Pages/Workers, CI/CD, domain management, tunnel setup | no |
| `diff-review` | `/skill:diff-review` | Visual HTML diff review of branches, commits, PRs, or working tree changes | no |
| `graphify` | `/skill:graphify` | Codebase analysis, architecture questions, file relationships; especially if graphify-out/ exists | no |
| `handoff` | `/skill:handoff` | "write a handoff", "summarise this session", wrapping up a session | no |
| `humanizer` | `/skill:humanizer` | Removing AI-generated writing patterns from text; editing/reviewing for natural voice | no |
| `kami` | `/skill:kami` | Typesetting PDFs, resumes, one-pagers, white papers, slide decks; "做 PDF", "排版", "make this presentable" | no |
| `nuclear-review` | `/skill:nuclear-review` | Thermo-nuclear code quality review; deep maintainability audit | no |
| `shannon` | `/skill:shannon` | Neovim interaction; show "in Neovim", annotated code review, walkthrough, error markers | shannon-find-nvim.sh |
| `teach` | `/skill:teach` (explicit only) | "teach me", "I want to learn", "explain X". Uses sub-skills for glossary, learning records, missions, resources | no |
| `vox` | `/skill:vox plan` → `/skill:vox build` | Spec-driven development with TDD checkpoints; two-step pipeline from spec to code | no |

### Skill Conflicts

When multiple skills match a task — either because their trigger descriptions overlap or
the agent interprets a request as within the scope of more than one skill — conflicts
must be resolved by the following priority rules, in order:

1. **Explicit invocation wins.** If the user types `/skill:foo`, run `foo` regardless
   of any auto-detected matches.
2. **Narrower trigger wins.** A skill whose description matches the specific detail of
   the request takes precedence over a skill whose trigger is broader. Example:
   `/skill:nuclear-review` over `/skill:audit` when the user asks for "a thermonuclear
   code quality review."
3. **User resolution.** If ambiguity remains after rules 1–2, present the user with a
   brief choice (list conflicted skills and ask which they intended). Do not silently
   guess.

Skill-to-skill nesting (a skill that invokes another skill) is not a conflict — it is
legitimate composition. However, the calling skill must declare any sub-skill
invocations it performs.

## Work Guidance

- Before invoking a skill, verify its SKILL.md exists at the expected path
- Read the full SKILL.md before acting on it — descriptions in this index are summaries
- If a skill has companion scripts, verify they exist before invoking
- Respect `disable-model-invocation` — never auto-load these skills

## Verification

- Skill count should match lattice.md index
- Each skill must have a single `SKILL.md` with valid YAML frontmatter
- No extra files in skill directories beyond SKILL.md (except explicit assets like
  `anchor-init/generate_manifest.py` or `shannon/scripts/`)

## Child DOX Index

No child AGENTS.md files in individual skill directories. Skill contracts are entirely
contained in their SKILL.md files.
