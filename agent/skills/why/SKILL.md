---
name: why
description: >-
  Reconstruct the intent behind existing code from parallel evidence: git history and blame,
  commit and PR discussion, repo docs and ADRs, and the Obsidian vault. Returns a current-state
  brief that separates what was decided on purpose from what is accident. Use before changing
  code whose constraints are unexplained, when asked "why is this like this", "why is this flag
  off", "is this deliberate", or when a fix would otherwise remove a guard nobody can justify.
---

# Why - intent reconstruction

Code says what happens. This skill finds out what someone meant, and whether it still holds.

## Why this exists

TB-17 bans comments, so intent lives outside the source: in commit bodies, PR threads, ADRs, and
notes. Without this pass, a deliberate constraint looks like an accident and gets deleted.

## Steps

1. **Write the question as a claim to test.** Not "why is this like this" but "this timeout was
   chosen for a reason, or it is a placeholder". A vague question returns a vague answer.
2. **Locate the code.** `git blame -w -M -C` on the lines. The commit hash is the anchor for
   every later query.
3. **Dispatch the evidence sweep in parallel.** One `Task` per evidence class, `researcher`
   subagent, read-only. Each returns findings with citations, and says "nothing found" rather
   than guessing.
   - **History**: `git log -S '<symbol>' --oneline`, `git log --follow -- path`, the full body of
     the blamed commit, and the commits that changed the same lines since.
   - **Discussion**: `gh pr list --search '<symbol>'`, `gh pr view <n> --comments`, and the
     review threads on the commit's PR. Commit trailers and issue links count.
   - **Repo docs**: `rg -l '<symbol>'` over `docs/`, `adr/`, `*.md` at the root, and the project
     `AGENTS.md`. An ADR that names the constraint outranks a commit message.
   - **Notes**: `vault-context` grep over `~/1-projects/vaults/sub0x_vault/` for the component,
     the incident, or the decision.
4. **Collect, do not merge.** One finding per line: source, date, what it says. Contradictions
   stay visible.
5. **Answer the question.** Three cases, stated plainly:
   - **Deliberate**: the constraint is documented, name the source and whether the reason still
     applies.
   - **Accidental**: no source, and the code shape suggests drift. Say so, then check whether
     anything now depends on the behavior before proposing removal.
   - **Unknown**: the evidence does not settle it. Say what artifact would (a Slack thread, an
     incident, a person) instead of inventing a rationale.
6. **Record the outcome.** If the answer is "deliberate" and undocumented, write the ADR
   (`/skill:adr`). An intent that survives only in a chat log will be re-litigated.

## Rules

- Cite, never infer: commit hash, PR number, file:line, or note title for every claim.
- Absence of evidence is a finding. "No commit, PR, ADR, or note explains this" is an answer.
- A commit message that restates the diff is not intent. Look for the constraint, the incident,
  or the rejected alternative.
- Never let a subagent's summary replace the quoted line. Ask for the quote.
- One sweep per question. If the sweep returns nothing, widen the symbol, not the speculation.

## Output shape

```
Claim: <what you are testing>
Verdict: deliberate | accidental | unknown
Evidence:
  - <source> <date>: <quoted line or citation>
  - ...
Still true: yes | no | cannot tell, because <reason>
Consequences for the change: <what you may now do, or must preserve>
```
