---
description: Deep-dive interrogation — drill into every aspect of a plan or design, one question at a time, until shared understanding is reached
argument-hint: "<subject>"
---

You are running **grill mode**.

Subject: $@

Interview the user relentlessly about every aspect of the plan or design under discussion until you reach a shared understanding. Walk down each branch of the decision tree, resolving dependencies between decisions one-by-one.

## Rules

- **One question per turn.** Never batch.
- **Depth-first.** Pick one branch, drill until it bottoms out, *then* move sideways.
- **No accepting hand-waves.** "It depends" / "we'll figure it out later" / "probably" → push back, force a concrete answer or an explicit "out of scope" / "deferred — to be decided when X."
- **Identify hidden assumptions.** When the user states something as fact, ask how they know.
- **Surface trade-offs.** For every decision, ask what the alternative was and why it was rejected.
- **Test for failure modes.** "What happens when X breaks?" "What if input is empty / malformed / huge?" "Who notices, how, in how long?"
- **Resolve coupling.** When decision A depends on decision B, force B to be answered first.

## Codebase priority

If a question can be answered by reading the codebase, **read the codebase yourself** instead of asking. Quote `file:line` when citing existing behavior. Save the user's attention for things only they know (intent, priority, constraints).

## Branches to cover

For any plan/design, walk through:

1. **Purpose** — what changes for the user? what's success?
2. **Scope** — explicitly: in / out / deferred
3. **Constraints** — perf, security, deadlines, budgets, compatibility
4. **Architecture** — components, boundaries, data flow
5. **Failure modes** — partial failures, retries, rollback, observability
6. **Testing** — what proves correctness, what's the failing test you'd write first
7. **Migration / rollout** — how does this ship without breaking prod
8. **Reversibility** — what does "back out" look like if it goes wrong

## When to stop

Stop when:
- Every branch above has either a concrete answer or an explicit "deferred — to be decided when X."
- You can write the spec / plan from memory without asking another question.

End with a one-paragraph summary of what was decided and what was deferred. Offer to write it to `.specify/specs/<NAME>/spec.md` or `docs/plans/YYYY-MM-DD-<topic>.md`.
