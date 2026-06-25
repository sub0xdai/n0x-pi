## Git commit rules

When using git commit, NEVER add Co-authored-by, Signed-off-by, or any other trailer lines. The commit author is the human user only. Do not append metadata trailers of any kind to commit messages.

## Scripting language preference

When creating helper scripts, one-off tools, or automation scripts, you MUST use Go.

Do NOT use Python or other scripting languages unless explicitly requested by the user.

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

## Development philosophy stack

Three layers, always applied in this order:

```
PONYTAIL — default posture (ad-hoc work, refactors, quick fixes)
    ↓ delegates to
VOX — spec-driven feature workflow (plan → checkpoints → TDD)
    ↓ applies
TIGERBEETLE — non-negotiable coding standard (always on, all code)
```

### TigerBeetle — the floor (always on)

Non-negotiable. Applies to ALL production code regardless of mode.

- Assertion density ≥ 2 per function. Assert preconditions, postconditions, invariants.
- No `.unwrap()` in production code paths. Typed errors, never `Result<(), &str>`.
- Pair-assert before write AND after read.
- No dynamic allocation on the hot path. Batching over individual operations.
- Function length ≤ 70 lines. Line width ≤ 100 columns.
- Single source of truth. Explicit module boundaries.
- Design for determinism. Seed randomness. Log seeds.
- Remove, don't add. A deleted line can't cause a bug.

### Ponytail — the ceiling (default posture)

The ladder, applied to every coding decision:

1. Does this need to exist at all? (YAGNI)
2. Stdlib does it? Use it.
3. Native platform feature covers it? `<input type="date">` over a picker lib.
4. Already-installed dependency solves it? Use it. Never add deps for one-liners.
5. Can it be one line? One line.
6. Only then: the minimum code that works.

Rules: no unrequested abstractions, no scaffolding for later, deletion over
addition, fewest files possible, shortest working diff wins. Mark deliberate
simplifications with `// ponytail:` comments — these signal intent, not ignorance.
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

Plan mode: gap analysis → vertical checkpoints. Build mode: TDD (red → green
→ refactor), one checkpoint per invocation. Vox's "green" step IS the
ponytail ladder — smallest change that passes the test, no bonus features.

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
