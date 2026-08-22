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
at `~/dotfiles/scripts/<skill-name>*.sh`.

### Creation Rules

- Must follow Agent Skills standard (YAML frontmatter: name, description, optional
  allowed-tools, argument-hint, disable-model-invocation)
- Description must specify trigger conditions clearly
- If skill requires scripts, create them in `~/dotfiles/scripts/` with the
  `<skill-name>` prefix convention
- If skill requires prompt templates, create them in `~/.pi/agent/prompts/`
- Update lattice.md index when adding or removing a skill

### Invocation

Skills are invoked via `/skill:<name>` or auto-loaded by the agent when description
matches the task. Some skills (`teach`) use `disable-model-invocation: true` and
require explicit invocation.

## Skill Index

| Skill | Invocation | Triggers On | Has Scripts |
|-------|-----------|-------------|-------------|
| `adr` | `/skill:adr` | Create and manage Architecture Decision Records; "write an ADR", "document this decision", new dependency or pattern introduction | no |
| `appimage-integrate` | `/skill:appimage-integrate` | Install an AppImage into the desktop launcher; "set up this AppImage", "not launching from rofi" | no |
| `cover-letter` | `/skill:cover-letter` | Write a job application cover letter from a pasted posting, grounded in real resume + past letters; "make me a cover letter", "help me apply to <job>" | no |
| `anchor-init` | `/skill:anchor-init` | Scaffolding anchor tags for codebase navigation; "new" or "existing" project with language target | generate_manifest.py |
| `anchor-verify` | `/skill:anchor-verify` | Validating anchor compliance on "staged" or "all" files | pre-commit hook |
| `audit` | `/skill:audit` | Two-pass code audit; after implementing features, fixing multi-file bugs, or "audit this" | no |
| `cloudflare-devops` | `/skill:cloudflare-devops` | Cloudflare deployments, wrangler, Pages/Workers, CI/CD, domain management, tunnel setup | no |
| `diff-review` | `/skill:diff-review` | Visual HTML diff review of branches, commits, PRs, or working tree changes | no |
| `ffmpeg-composite` | `/skill:ffmpeg-composite` | Hand-built ffmpeg composite builds and filtergraph debugging; custom cut/assemble/overlay video, concat errors | no |
| `graphify` | `/skill:graphify` | Codebase analysis, architecture questions, file relationships; especially if graphify-out/ exists | no |
| `handoff` | `/skill:handoff` | "write a handoff", "summarise this session", wrapping up a session | no |
| `humanizer` | `/skill:humanizer` | Removing AI-generated writing patterns from text; editing/reviewing for natural voice | no |
| `scythe` | `/skill:scythe` | Generate brutalist kinetic marketing/promo videos for any project; triggers on "generate a video", "make a promo video", "brutalist video", "scythe" | yes: scythe_build.sh, scythe_bootstrap.sh, scythe_ingest.sh, scythe_render.sh |
| `nuclear-review` | `/skill:nuclear-review` | Thermo-nuclear code quality review; deep maintainability audit | no |
| `onchain` | `/skill:onchain` | On-chain wallet/token forensics for hidden alpha and connections; triggers on "analyze this wallet", "trace this token", "who is behind X", "money trail", "dev wallet analysis", "is this token safe" on Ethereum, ETH-adjacent chains, or Solana | no |
| `prolong` | `/skill:prolong` | Programmatic memory for long-horizon tasks; single structured log appended to and retrieved with grep; long tasks, multi-session work, big refactors | no |
| `project-orientation` | `/skill:project-orientation` | Orient into a project and await instructions; "study the project/codebase", fresh-session context loading | no |
| `shannon` | `/skill:shannon` | Neovim interaction; show "in Neovim", annotated code review, walkthrough, error markers | shannon-find-nvim.sh |
| `ste-writing` | `/skill:ste-writing` | Rewrite prose in ASD-STE100 Simplified Technical English to remove AI slop; two modes: strict (procedures) and STE-flavored (general prose). Triggers on "ste", "STE", "de-slop", "anti-slop", "make this not sound like AI", "clean up this doc". | ste_lint.py |
| `teach` | `/skill:teach` (explicit only) | "teach me", "I want to learn", "explain X". Uses sub-skills for glossary, learning records, missions, resources | no |
| `video-render-qa` | `/skill:video-render-qa` | Verify a rendered video against its design; "check the render", post-render QA, frame/pixel/OCR/audio checks | no |
| `yt-dlp-download` | `/skill:yt-dlp-download` | YouTube downloads with 403 player-client recovery; "download this YouTube video", "grab the audio from this link" | no |
| `vault-context` | `/skill:vault-context` | Search Obsidian vault for relevant knowledge before coding decisions; "what do I know about X", "check my notes", before vox plan | no |
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
