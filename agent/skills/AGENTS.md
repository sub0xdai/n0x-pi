---
description: Contract and index for all skill directories. Defines creation rules, invocation conventions, conflict resolution, and verification procedures.
---

# Skills — Directory Contract

Agents editing or invoking skills under `~/.pi/agent/skills/` must follow this contract
and the boundary rules in `~/.pi/agent/AGENTS.md`.

## Purpose

Skills are behavioral workflows — each defines how the agent should act for a specific
task. Skills do not contain executable code or tool definitions; they provide procedural
instructions. Tools come from extensions or native pi tools.

## Ownership

- **Owner:** m0xu
- **Parent:** `~/.pi/agent/AGENTS.md` (root DOX contract)
- **Protocol:** `~/.pi/agent/AGENTS.md` (directory map, naming, boundaries)

## Local Contracts

### Directory Shape

Each skill is a directory containing exactly one `SKILL.md` file. No other assets
(templates, assets) belong in the skill directory. Script companions live
at `~/dotfiles/scripts/<skill-name>*.sh`.

### Vendored skills

A skill copied from an upstream plugin keeps its own tree: `SKILL.md`,
`references/`, `scripts/`, `LICENSE`, and a `VENDOR` file naming the source, the commit,
the refresh command, and every local patch.
The `VENDOR` file exempts that subtree from `scripts/__check.sh` and
`extensions/state-guard.ts`, because the house rules cover code we write, not upstream's style.
The marker is honoured only when it is a regular file containing an `Upstream:` line, so a stray
empty `VENDOR` cannot quietly switch the gate off for a whole tree.

Never put the marker on a skill we author.

A vendored skill may carry a local patch, and the patch is not an edit in place: it is a step
to re-apply. Record every patch as a `Patched:` line in the `VENDOR` file, because a refresh
re-copies the tree and drops the change.
Patch frontmatter and prose only. A patched `scripts/` file stops being upstream's code, so a
behavioural fix belongs in a wrapper skill or an upstream issue instead.

The patches in use:

- `disable-model-invocation: true` is removed from `blast-radius`, `benchmark-checklist`,
  `correct`, and `typescript-best-practices`, so pi selects them from the description.
  It stays on `statechart`, `sharpen`, `create-formal-verification-skill`, and
  `maintain-formal-verification-skill`, which are deliberate, expensive, or both.

Vendored skills carry one toolchain note each:

- `statechart` runs TLC. Set `TLA2TOOLS=<path>/tla2tools.jar` and `JAVA=/usr/bin/java` to use
the installed Java 21. Without them the skill installs Java 25 and TLC through `mise` on first run.

### Creation Rules

- Must follow Agent Skills standard (YAML frontmatter: name, description, optional
  allowed-tools, argument-hint, disable-model-invocation)
- Description must specify trigger conditions clearly
- If skill requires scripts, create them in `~/dotfiles/scripts/` with the
  `<skill-name>` prefix convention
- If skill requires prompt templates, create them in `~/.pi/agent/prompts/`

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
| `audit` | `/skill:audit` | Two-pass code audit; after implementing features, fixing multi-file bugs, or "audit this" | no |
| `bridge-recon` | `/skill:bridge-recon` | Recon and fund-path probing for cross-chain swap and bridge front-ends; "recon this bridge", "is this swap exploitable" | no |
| `cloudflare-devops` | `/skill:cloudflare-devops` | Cloudflare deployments, wrangler, Pages/Workers, CI/CD, domain management, tunnel setup | no |
| `diff-review` | `/skill:diff-review` | Visual HTML diff review of branches, commits, PRs, or working tree changes | no |
| `ffmpeg-composite` | `/skill:ffmpeg-composite` | Hand-built ffmpeg composite builds and filtergraph debugging; custom cut/assemble/overlay video, concat errors | no |
| `graphify` | `/skill:graphify` | Codebase analysis, architecture questions, file relationships; especially if graphify-out/ exists | no |
| `handoff` | `/skill:handoff` | "write a handoff", "summarise this session", wrapping up a session | no |
| `humanizer` | `/skill:humanizer` | Removing AI-generated writing patterns from text; editing/reviewing for natural voice | no |
| `mode` | `/skill:mode` | Routed rigor for a non-trivial task; classifies into investigate, fix, feature, refactor, perf, or land, prints the steps, and holds the turn to that shape's exit condition | no |
| `scythe` | `/skill:scythe` | Generate brutalist kinetic marketing/promo videos for any project; triggers on "generate a video", "make a promo video", "brutalist video", "scythe" | yes: scythe_build.sh, scythe_bootstrap.sh, scythe_ingest.sh, scythe_render.sh |
| `nuclear-review` | `/skill:nuclear-review` | Thermo-nuclear code quality review; deep maintainability audit | no |
| `onchain` | `/skill:onchain` | On-chain wallet/token forensics for hidden alpha and connections; triggers on "analyze this wallet", "trace this token", "who is behind X", "money trail", "dev wallet analysis", "is this token safe" on Ethereum, ETH-adjacent chains, or Solana | no |
| `prolong` | `/skill:prolong` | Programmatic memory for long-horizon tasks; single structured log appended to and retrieved with grep; long tasks, multi-session work, big refactors | no |
| `project-orientation` | `/skill:project-orientation` | Orient into a project and await instructions; "study the project/codebase", fresh-session context loading | no |
| `shannon` | `/skill:shannon` | Neovim interaction; show "in Neovim", annotated code review, walkthrough, error markers | shannon-find-nvim.sh |
| `ste-writing` | `/skill:ste-writing` | Rewrite prose in ASD-STE100 Simplified Technical English to remove AI slop; two modes: strict (procedures) and STE-flavored (general prose). Triggers on "ste", "STE", "de-slop", "anti-slop", "make this not sound like AI", "clean up this doc". | ste_lint.py |
| `teach` | `/skill:teach` (explicit only) | "teach me", "I want to learn", "explain X". Uses sub-skills for glossary, learning records, missions, resources | no |
| `typesafe-ai` | `/skill:typesafe-ai` | Build AI features from small typed judgment units; programmable common sense, a structured decision instead of prompt-and-parse | no |
| `video-render-qa` | `/skill:video-render-qa` | Verify a rendered video against its design; "check the render", post-render QA, frame/pixel/OCR/audio checks | no |
| `verify-ui` | `/skill:verify-ui` | Prove a UI change on the real surface through kitesurf chrome-devtools; screenshot, console, and network calls as the artifact | no |
| `yt-dlp-download` | `/skill:yt-dlp-download` | YouTube downloads with 403 player-client recovery; "download this YouTube video", "grab the audio from this link" | no |
| `vault-context` | `/skill:vault-context` | Search Obsidian vault for relevant knowledge before coding decisions; "what do I know about X", "check my notes", before /skill:vox goal | no |
| `vox` | `/skill:vox goal` → `/skill:vox build` → `/skill:vox ship` | Goal-to-verified-change spine; writes `docs/goals/<slug>.md` with outcome, acceptance lines that each name their check, non-goals, and ordered units, then one verified unit per invocation. No planning document, no TDD requirement | no |
| `why` | `/skill:why` | Reconstruct the intent behind code from git history, PR discussion, repo docs, and vault notes in parallel; "why is this like this", "is this deliberate" | no |
| `benchmark-checklist` | `/skill:benchmark-checklist` | Vet a perf number before reporting or acting on it; a speedup, regression, or tool choice | vendored |
| `blast-radius` | `/skill:blast-radius` | What a change breaks beyond the diff, with the safety fact proven by running code | vendored |
| `correct` | `/skill:correct` | Turn repeated agent mistakes into architecture, types, or a lint whose error names the fix | vendored |
| `create-formal-verification-skill` | `/skill:create-formal-verification-skill` | Model-check the code where a bug costs most; generates the project-local verify skill, pairs with `statechart` | vendored |
| `maintain-formal-verification-skill` | `/skill:maintain-formal-verification-skill` | Bring a formal check back in line after merges; tells drift from a real bug | vendored |
| `sharpen` | `/skill:sharpen` | Make a task deeper, not bigger, then rewrite the prompt | vendored |
| `statechart` | `/skill:statechart` (explicit only) | TLA+ model of a state machine, checked by TLC, drawn as a Mermaid statechart with the shortest path to each broken rule | vendored: scripts/ |
| `typescript-best-practices` | `/skill:typescript-best-practices` | Reading or editing any `.ts` or `.tsx` file | vendored |

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

- Every skill directory holds exactly one SKILL.md
- Each skill must have a single `SKILL.md` with valid YAML frontmatter
- No extra files in skill directories beyond SKILL.md (except explicit assets like
  `shannon/scripts/`)

## Child DOX Index

No child AGENTS.md files in individual skill directories. Skill contracts are entirely
contained in their SKILL.md files.
