# Delta Analysis: Current Workflow vs. Cherno Methodology

> Generated 2026-07-06. Comparative audit between baseline pi agent harness and
> Cherno/Cherny AI integration methodology. Actionable gaps with priority ordering.
>
> **Note:** pi uses `AGENTS.md` as the root context convention (NOT `CLAUDE.md`).
> The structural insight holds regardless of naming — the point is a single flat
> file with non-negotiable rules, not the specific filename.

---

## State A: Current (Baseline)

- **Agent:** pi with 14 procedural skills, extension litmus test, lattice spatial protocol
- **Context:** Multi-level DOX chain (`~/AGENTS.md` → workspace → project → constitution)
- **Spec-driven:** Vox (plan → build → TDD with vertical checkpoints)
- **Standards:** TigerBeetle coding floor (assertion density, no unwrap, function length limits)
- **Extensions:** Notifications, plan-mode (gates destructive ops), tmux manager, boxed editor
- **Knowledge:** Noesis (Neo4j dual-tract), Obsidian PARA/Zettelkasten vault, graphify skill
- **Verification:** Manual `cargo clippy && cargo test` (not gated)

## State B: Target (Cherno/Cherny Composite)

- Flat ~100-line `CLAUDE.md` at repo root with non-negotiable architectural rules
- Procedural skill files mapped to CLI commands for automated checks
- AI hooked to unit tests, sanitizers, benchmarks as hard gates before human review
- Architecture Decision Records (ADRs) as documentation discipline
- "Architectural documents first, code second" — human writes design, AI implements
- Full human code review of every AI-produced line

---

## 1. Where Current Is Ahead

| Area | Current | Target | Verdict |
|------|---------|--------|---------|
| Skills infrastructure | 14 skills, lattice governance, extension litmus test | `/cr` and procedural `.md` commands | **Stronger** |
| Spec-driven workflow | Vox plan→build→TDD, vertical checkpoints, gap analysis, constitution | "Plan then execute in one shot" | **Deeper** |
| Coding standards | TigerBeetle (assertion density, no unwrap, 70-line functions) | Not articulated | **More rigorous** |
| Extension ecosystem | Notifications, plan-mode gating, tmux sessions, boxed editor | 5 terminal tabs | **More structured** |

---

## 2. Where Target Is Ahead

### 2.1 Flat, non-negotiable root context file

**Current:** Non-negotiable rules scattered across 6 files:

| File | Content |
|------|---------|
| `~/AGENTS.md` | General guidelines, routing table |
| `~/1-projects/AGENTS.md` | Workspace router |
| `testudo/AGENTS.md` | Project workflow, do-not list |
| `.specify/memory/constitution.md` | Core principles, tech stack, TDD protocol |
| TigerBeetle prompt | Code-level non-negotiables |
| Ponytail skill | Simplification ladder |

**Problem 1 — Contradiction surface:** Testudo constitution mandates
`Co-Authored-By: Claude <noreply@anthropic.com>`. Root `~/AGENTS.md` says
"NEVER auto-add. No Co-authored-by." An agent reading both must pick one.

**Problem 2 — Context latency:** 6 files consumed before the agent can start work.
Cherny's single `CLAUDE.md` is ~500 tokens.

### 2.2 Automated verification as a hard gate

**Current:** Manual. The agent runs `cargo clippy --all-targets && cargo test`
because vox says to. Nothing prevents skipping it. Nothing hooks into pre-commit.
Nothing blocks a merge on red.

**Missing Rust equivalents of Cherno's C++ tools:**

| Cherno tool | Rust equivalent | Status |
|-------------|----------------|--------|
| ASAN | `cargo test -Z sanitizer=address` | Not in pipeline |
| UBSAN | `cargo miri test` | Not installed/configured |
| nano bench | `criterion` / `cargo bench` | Not gating |
| MSAN | `cargo careful` / `cargo-valgrind` | Not in pipeline |

### 2.3 Architecture Decision Records

**Zero ADRs anywhere in the workspace.** No `docs/adr/`, no `.adr.md` files.
`.specify/spec-archive/` has some architectural content but lacks standard ADR
format and is not an enforced discipline.

### 2.4 Knowledge graph disconnected from agent

Noesis (Neo4j, BGE-M3, dual-tract) exists but a pi agent coding on testudo has
zero awareness of it. Graphify produces output artifacts, not live query surfaces.

### 2.5 Obsidian Zettelkasten disconnected from agent

`sub0x_vault/` has `0-zettel/coding/`, `0-zettel/finance/`, project pages,
journal entries. The vault is plain Markdown — an agent could read it. Nothing
tells it to.

---

## 3. Itemized Gap Assessment

| State B item | Present? | Quality | Real gap |
|---|---|---|---|
| CLI-centric AI agent | Yes (pi, tmux) | Strong | — |
| Root non-negotiable rules | Partial | Weak | Scattered, contradictory |
| Procedural skills mapped to commands | Yes | Stronger | — |
| Automated verification hooks | Partial | Weak | Manual, no sanitizers/benchmarks |
| ADR documentation | No | Absent | Zero ADRs |
| AI-generated deep-dive reports | Yes (diff-review, audit) | Adequate | Not structured as ADRs |

---

## 4. Priority-Ordered Action Items

| # | Gap | Effort | Impact |
|---|-----|--------|--------|
| 1 | **Flatten non-negotiable rules** | Hours | Eliminates contradictions, reduces context latency 10x |
| 2 | **Pre-commit verification gate** | 1 line in AGENTS.md | Turns manual checklist into behavioral requirement |
| 3 | **ADR skill + template** | ~140 lines SKILL.md | Architectural decisions become discoverable, reviewable, reversible |
| 4 | **Obsidian vault bridge skill** | ~30 lines SKILL.md | Agent gains access to accumulated domain knowledge |
| 5 | **Human review gate** (IMPLEMENTATION_SUMMARY.md) | Thin output format | Human stays in the loop |
| 6 | **Sanitizers/benchmarks in verification pipeline** | Days of tuning | Catches UB, perf regressions |

---

## 5. Integration Blueprint (Details)

### 5.1 Root constraint file (AGENTS.md convention)

Flatten the existing `AGENTS.md` chain so a single file at the project root
contains ONLY non-negotiable rules. Pi discovers `AGENTS.md` automatically.
The current chain delegates constraints downward; instead, have each
`AGENTS.md` reference the root constraint file and keep routing separate.

- Commit format, no trailers
- Rust: `Result<T,E>`, never `unwrap()`, Decimal for finance
- TypeScript: Zod schemas
- Assertion density ≥ 2, function length ≤ 70 lines
- Verification commands as BLOCKING gates

AGENTS.md files remain as routing infrastructure but delegate all constraints to
a single root constraint file (or a top-level section in the project AGENTS.md).
The key structural change: constraints in one place, not six.

### 5.2 Pre-commit verification gate

```bash
#!/bin/bash
# .git/hooks/pre-commit
set -euo pipefail
cd testudo-exchange
cargo clippy --all-targets -- -D warnings || exit 1
cargo test || exit 1
```

Escalation path: add `cargo audit`, `cargo bench`, `cargo miri test`.

### 5.3 ADR template

`docs/adr/0001-template.md` with standard format: Status, Date, Deciders,
Context, Decision, Consequences. Enforcement: vox plan step checks for relevant
ADRs. New architectural decisions (service boundary, data store, external dep,
protocol change) require an ADR before implementation.

### 5.4 Obsidian vault bridge

A pi skill that greps `~/1-projects/vaults/sub0x_vault/0-zettel/` for the
current spec topic, reads matching pages, and injects relevant architectural
notes, cautions, and past decisions into context. Plain grep + read — no
Neo4j, no vectors, no infrastructure.

### 5.5 Human review gate

After vox build completes all checkpoints, agent produces
`IMPLEMENTATION_SUMMARY.md` with: what changed, verification results,
diff-review HTML, self-identified risks. Human reviews before merge.

---

## 6. What to Defer

- **Parallel agent instances (Cherny's 5 tabs):** Tmux extension supports this
  technically, but vox's "one checkpoint per invocation" is safety-first by design.
  Don't cargo-cult unless trading safety for throughput is intentional.

- **Sanitizers on day one:** `cargo miri test` surfaces real bugs + noise.
  Introduce after pre-commit gate stabilizes.

- **Neo4j agent memory (struck):** Noesis was shelved — the pace of LLM improvement
  made structured knowledge graphs unnecessary for agentic memory. Long-context
  models infer relationships from flat markdown better than a graph DB can serve
  them. The Obsidian vault bridge (item 4) is the right architecture: zero
  infrastructure, human-maintainable, future-proof.

---

## 7. Completeness Audit

Items 1-4 actionable this week. Item 5 is process, not code. Item 6 requires
separate planning. Item 7 (Neo4j bridge) struck — architectural mismatch.
