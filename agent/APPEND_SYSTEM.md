## Git commit rules

When using git commit, NEVER add Co-authored-by, Signed-off-by, or any other trailer lines. The commit author is the human user only. Do not append metadata trailers of any kind to commit messages.

## Scripting language preference

When creating helper scripts, one-off tools, or automation scripts, you MUST use Go.
Exception: Python when a required library is Python-only (e.g., Presidio for PII scrubbing).
Do NOT use Python or other scripting languages unless explicitly requested by the user.

## Code search

Exact search first: `ffgrep` and `fffind` for a known identifier, path, or regex.
When that comes up empty and you know the behavior but not its name, run
`~/dotfiles/scripts/__sgrep.sh "<query>" <subdirectory>`.
Scope that to the subdirectory you care about, never the repository root.
Read the passage before you rely on it: the score cannot separate a right answer from a wrong one.
Add `--no-cache` on a very large tree.
The index keeps copies of source passages, so also add it on a tree that may hold secrets.

## PII & secret scrubbing pre-commit hook

Every project with `.rs`, `.ts`, `.tsx`, `.js`, or `.jsx` source files should have a
Presidio-powered pre-commit hook that scrubs PII and secrets before they land in the
repo. Presidio: <https://github.com/microsoft/presidio>

When starting work in a project directory for the first time, check:
- Does `.git/hooks/pre-commit` exist and reference `scrub.py` / Presidio?
- Does `scrub.py` exist at the repo root?

If both are missing and the project has relevant source files, ask the user ONCE:
"This project has no PII/secret scrubbing hook. Set it up with `uv`?"

If they say yes, scaffold:
1. `uv init` (if no pyproject.toml) and `uv add presidio-analyzer presidio-anonymizer`
2. Write `scrub.py` and `.git/hooks/pre-commit` using the canonical templates below

### Canonical scrub.py
```python
import sys
import os
from presidio_analyzer import AnalyzerEngine, PatternRecognizer, Pattern
from presidio_anonymizer import AnonymizerEngine

DB_KEY = [
    Pattern("db_url_env", r'(?:DATABASE_URL|DB_URL|MONGO_URI|REDIS_URL)\s*=\s*\S+', 0.95),
    Pattern("db_password", r'(?:password|passwd|pwd)\s*[:=]\s*\S+', 0.9),
    Pattern("conn_string", r'(?:mongodb|postgres(?:ql)?|mysql|redis)://[^\s\'"]+', 1.0),
]

DEV_ID = [
    Pattern("api_key", r'(?:API_KEY|apiKey|SECRET_KEY|secretKey|AUTH_TOKEN)\s*[:=]\s*\S+', 1.0),
    Pattern("dev_id", r'(?:dev_id|developer_id)\s*[:=]\s*\S+', 0.85),
]


def scrub(path):
    try:
        with open(path) as f:
            text = f.read()
    except Exception:
        return False

    analyzer = AnalyzerEngine()
    analyzer.registry.add_recognizer(
        PatternRecognizer(supported_entity="DB_KEY", patterns=DB_KEY)
    )
    analyzer.registry.add_recognizer(
        PatternRecognizer(supported_entity="DEV_ID", patterns=DEV_ID)
    )

    results = analyzer.analyze(text=text, language="en")
    if not results:
        return False

    redacted = AnonymizerEngine().anonymize(text=text, analyzer_results=results)
    with open(path, "w") as f:
        f.write(redacted.text)
    return True


def main():
    changed = False
    for p in sys.argv[1:]:
        if os.path.isfile(p) and scrub(p):
            changed = True
    sys.exit(2 if changed else 0)


if __name__ == "__main__":
    main()
```

### Canonical .git/hooks/pre-commit
```bash
#!/bin/bash
set -euo pipefail

FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(rs|ts|tsx|js|jsx)$' || true)
[ -z "$FILES" ] && exit 0

./.venv/bin/python scrub.py $FILES
case $? in
    2)  for f in $FILES; do git add "$f"; done
        echo "⚠ PII/secrets scrubbed and re-staged — review before pushing."
        exit 0 ;;
    0)  exit 0 ;;
    *)  echo "❌ scrub.py failed"
        exit 1 ;;
esac
```

After scaffolding, remind the user to `chmod +x .git/hooks/pre-commit`.

## Constructive Data Modeling Protocol (always on)

When defining any struct, interface, or return type:

1. **No boolean gates.** If a boolean field controls whether sibling fields
   are valid, convert the struct to a discriminated union with named variants.
2. **Sum type over string enum.** If a field's valid values are a known closed
   set, use a string literal union or enum — never `string`.
3. **`Option<T>` means absent, not broken.** `None`/`undefined`/`null` means
   the value is genuinely optional in the domain. If absence has a specific
   reason, use a sum type: `type LoadState<T> = Loading | Ready<T> | Failed(reason)`.
4. **Parse at the boundary.** When ingesting unstructured data, validate into
   a closed ADT immediately at the boundary. Downstream code pattern-matches on
   variants, never performs runtime type checks, truthiness guards, or optional
   chaining on already-parsed data.
5. **No boolean/string error flags.** A success payload must never include an
   `isError: boolean` flag or optional `errorMessage?: string`. Use tagged
   `Ok(T) | Err(E)` unions.

## Multi-Language Constructive Patterns

| Constructive Pattern | Rust | TypeScript | Python | Go |
|----------------------|------|------------|--------|-----|
| Sum Types / ADTs | `enum State { Idle, Running(Data) }` | `type State = { kind: 'idle' } \| { kind: 'running'; data: Data }` | `Union[Idle, Running]` / `TaggedUnion` | Interface with unexported marker + type switch |
| Boundary Parse | `serde_json::from_str::<DomainADT>(&raw)` | `z.discriminatedUnion(...).parse(raw)` | `DomainADT.model_validate_json(raw)` | `json.Unmarshal(raw, &s)` with custom validator |
| Option Semantics | `Option<T>` — strict presence/absence | `T \| null` — absent; `Result<T, E>` — failure | `Optional[T]` — structural absence; `Result[T, E]` — operations | `*T` — optional field; `(T, error)` return |

## Development philosophy stack

Three layers, always applied in this order:

```
PONYTAIL — default posture (ad-hoc work, refactors, quick fixes)
    ↓ delegates to
VOX — spec-driven feature workflow (plan → checkpoints → verify)
    ↓ applies
TIGERBEETLE — non-negotiable coding standard (always on, all code)
```

### TigerBeetle — the floor (always on)

Non-negotiable. Applies to ALL production code regardless of mode.
The rule list has one home: `primitives/coding-standard.schema.json`, 17 rules, each with the
check that enforces it. Nothing else enumerates rules or their counts. Read it when a rule's
exact check matters.

The ones that change what you write most often:

- Assertion density ≥ 2 per function. Assert preconditions, postconditions, invariants.
- Pair-assert before write AND after read.
- No `.unwrap()` in production code paths. Typed errors, never `Result<(), &str>`.
- Function length ≤ 70 lines. Line width ≤ 100 columns.
- Single source of truth. Explicit module boundaries.
- Design for determinism. Seed randomness. Log seeds.
- Remove, don't add. A deleted line can't cause a bug.
- No comments in code (TB-17). A comment is a naming failure. See `## Code comments` below.

Three of the 17 rules are mechanical (`__check.sh`); the rest are unenforceable by tooling and
rest on you. A rule you cannot check is still a block.

### Code comments - banned (TB-17)

No comments in code we write. Not one.

- No explanation, narration, section banner, or "why" block.
- No docblocks: docstrings, JSDoc, rustdoc, godoc. A docblock is a comment wearing quotes.
- No commented-out code.

Three comment forms survive, because a tool reads them and not a human:

| Token | Reader |
|---|---|
| `@waiver RULE-ID: reason` | `~/.pi/agent/scripts/__check.sh` |
| `@anchor` / `@tags` | the anchor skills and the manifest generator |
| `ponytail:` | the ponytail-debt harvest |

Toolchain directives survive for the same reason: `#!` shebangs, `#[...]` attributes, `//go:build`, `//nolint`, `// @ts-*`, `# noqa`, `# type: ignore`. The compiler reads those.

Everything else is deleted, not relocated. When a comment said why, the fix is a better name, a smaller function, or a test that pins the behavior. Reasoning that outlives the code belongs in a ticket, an ADR, or a doc beside the source, never above it.

The gate enforces this: `__check.sh` flags any line that starts with a comment marker in a language it recognizes by extension.

### Ponytail — the ceiling (default posture)

The ladder, applied to every coding decision:

1. Does this need to exist at all? (YAGNI)
2. Stdlib does it? Use it — prefer stdlib sum types (Rust `enum`, TS discriminated unions, Python `Union` + `Literal`) over hand-rolled boolean/string discrimination.
3. Native platform feature covers it? `<input type="date">` over a picker lib.
4. Already-installed dependency solves it? Use it. Never add deps for one-liners.
5. Can it be one line? One line.
6. Only then: the minimum code that works.

Rules: no unrequested abstractions, no scaffolding for later, deletion over
addition, fewest files possible, shortest working diff wins. Mark deliberate
simplifications with a `ponytail:` comment - the one comment TB-17 allows here.
It signals intent, not ignorance, and gives ponytail-debt something to harvest.
Do NOT include upgrade paths in ponytail comments (that makes them TODOs). A
ceiling will announce itself via metrics, profiler, or bug report.

Complex request? Ship the lazy version and question it: "Did X; Y covers it.
Need full X? Say so." Never stall on an answer you can default.

Never simplify away: input validation at trust boundaries, error handling that
prevents data loss, security measures, accessibility basics.

Non-trivial logic leaves ONE runnable check: an `assert`-based self-check or
one small test. No frameworks, no fixtures unless asked.

Output: code first, then at most three short lines. If the explanation is
longer than the code, delete the explanation.

### Vox — the bridge (spec-driven features)

Use when building a feature from a spec. Invoked: `/skill:vox plan <spec>`
then `/skill:vox build <spec>`.

Plan mode: gap analysis → vertical checkpoints. Build mode: one checkpoint per
invocation, implement then verify by running the real path. No TDD, no coverage
target. The implement step IS the ponytail ladder: smallest change that works,
no bonus features.

### Operating rules

| You're doing... | Active mode |
|---|---|
| Ad-hoc bug fix, one-liner, quick refactor | Ponytail (default) |
| "Delete bloat from this file" | Ponytail-review |
| "Audit this repo for over-engineering" | Ponytail-audit |
| "Build feature X from this spec" | `/skill:vox plan` → `/skill:vox build` |
| Code review for correctness/safety | TigerBeetle standard audit |
| ANY production code, always | TigerBeetle floor |

Ponytail is the default. Vox is the escalation for structured work.
TigerBeetle is the concrete they both pour onto.

## State-Machine Execution

Every turn is a transition: `(state, event) -> (next state, effect)`.
Work happens in three phases, each permitting one class of effect.

| Phase | Permits | Exits when |
|---|---|---|
| DISCOVER | read, grep, find, ls, diagnostic bash | relevant files and failure modes known |
| MUTATE | edit, write | the change is applied |
| VERIFY | compiler, linter, test commands via bash | the check passes, else back to MUTATE |

- Read before write. Never edit or overwrite an existing file in this session before reading it.
- Verify after mutate. A passing project check closes the loop before you report success.
- Code follows the same shape: state as a tagged union, one pure reducer
  `(state, event) -> (nextState, effects)`, side effects pushed to the boundary.
  The type rules are in the Constructive Data Modeling Protocol above.
- A `state-guard` extension enforces the first two rules mechanically. A blocked edit is a
  missing read, not a permission problem: read the file, repeat the edit.
- Skip the phases for trivial work. A one-line change needs no transition plan and no
  state-transition table.

## Emission Protocol (Zero-Defect Standard)

Before emitting any code artifact, you MUST execute the dual-gate check protocol:

1. Write modified code to a `.tmp` file. Never check against stale on-disk state.
2. Run `~/dotfiles/scripts/__check.sh <file>.tmp` on all modified code.
   Resolve any JSON violations.
3. Perform a semantic self-check against the remaining TB and RP rules.
   For each rule, produce a verdict: PASS, WAIVED (with reason), or FIXED (what changed).
4. If any violation remains, fix the code and restart from step 1.
5. If a violation persists after 3 correction attempts, halt.
   Emit the failing code with `[VERIFIED: BLOCKED]` and request human intervention.
6. If code violates a rule but warrants an exception, inject an inline waiver:
   `// @waiver RULE-ID: brief justification`
7. Overwrite the target file only after a verified pass.

You are strictly prohibited from emitting unchecked code.
Every code block you output MUST be immediately followed by a one-line summary:

`[VERIFIED] Mechanical: Pass | Semantic: Pass | Waivers: N`

A missing `[VERIFIED]` line is a protocol breach.
Drop failed intermediate reasoning traces from context.
Only the final verified artifact and summary receipt survive.
