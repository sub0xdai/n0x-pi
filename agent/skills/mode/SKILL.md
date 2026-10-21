---
name: mode
description: Routed rigor for non-trivial tasks. Classifies the request into one of six shapes (investigate, fix, feature, refactor, perf, land), states the shape's steps as a checklist before acting, routes to the skills each step needs, and holds the turn to that shape's exit condition. Use at the start of any task that needs more than one step, or when the user says "mode", "be rigorous", "do this properly".
---

# Mode - Playbook Router

Pick one shape, print its steps, run them in order, stop at the exit condition. This skill
chooses the shape and the order; every skill it names keeps its own contract, and an explicit
`/skill:<name>` from the user wins over the route.

## Rules

1. One shape per task. When two apply, the narrower one wins: fix beats feature, investigate beats fix when the defect is not yet understood.
2. Print the shape's steps as a numbered checklist in the reply before the first action. The user must be able to see what "done" will mean.
3. Steps are copied, not summarized. A step lost in paraphrase is a step skipped.
4. If the task changes shape mid-run, say so, print the new checklist, and start its step 1.
5. The exit condition is the only definition of done. "Tests pass" is not an exit condition for any shape that touches a runtime surface.

## Shape: investigate

Read-only. No edits, no writes, no state changes.

1. Restate the question in one sentence, and say what answer would settle it.
2. Map the surface: `ffgrep`/`fffind` for identifiers, `graphify` for structure, `read` the entry points.
3. Get intent: `/skill:why` for history, or `project-orientation` for a cold repo.
4. Answer with file:line evidence for every claim. Mark anything unread as unknown.

Exit: the question is answered with evidence, or the answer is "cannot be determined from this tree" plus what would determine it.

Route: `vault-context` when the notes may already hold the answer.

## Shape: fix

1. Reproduce on the surface the user hit. Paste the failing command and its output. A fix without a repro is a guess.
2. Find the first place the system goes wrong, not the last place it shows. `git log -S` if the code changed recently.
3. Write the smallest failing test that pins the repro, if a cheap local path exists. Watch it fail.
4. Fix the root cause in the shared code, not at the call site that complained. Grep every caller first.
5. Prove it: rerun the repro and quote the new output. Then run the project's checks.
6. `audit` if the fix touched 3+ source files, auth, persistence, or a public contract.

Exit: the original repro passes, the quoted output is in the reply, and the checks are green.

Route: `why` when the root cause makes no sense, `verify-ui` when the symptom is in a browser.

## Shape: feature

1. Name the data shape before the code: the types, their variants, and which states are illegal. Read `~/.pi/agent/primitives/coding-standard.schema.json` TB-15 and TB-16.
2. Settle the boundary: what the caller passes in, what comes back, which module owns the state.
3. Write the spec and the checkpoints: `/skill:vox plan <spec>`.
4. Build one checkpoint at a time: `/skill:vox build <spec>`, which runs red, green, refactor, and quotes the verification output.
5. Prove it on the real surface: `verify-ui` for anything with a screen, a curl or a script run for anything without.
6. `/skill:vox archive <spec>` when every checkpoint is done.

Exit: every checkpoint verified, the run artifact quoted, and the delta merged into the living spec.

Route: `/brainstorm` when the shape is unsettled, `ask_user` only for scope and preference.

## Shape: refactor

Behavior-preserving. The old behavior is the spec.

1. Capture the behavior first: run the thing and save its output, or name the tests that cover it.
2. Grep every caller of the surface you are about to move.
3. Move and migrate callers in the same wave. Delete the old API; do not leave a compatibility shim unless a real external consumer needs it, and say which.
4. Keep the diff one reviewable unit: no opportunistic feature work, no reformatting of untouched lines.
5. Prove behavior is unchanged: run the captured case, diff the output, then run the checks.

Exit: the captured output is identical (or the difference is named and intended), the old API is gone, and no caller was left behind.

Route: `nuclear-review` before landing, `audit` for multi-module moves.

## Shape: perf

1. Establish the baseline with `~/.pi/agent/primitives/measurement.schema.json`: command, environment, repeats, variance.
2. Profile the real path, not a synthetic one. Name what the instrument counted.
3. Change one thing. Rerun the same command, same environment, same input.
4. Quote baseline, new number, spread, and the alternatives you ruled out. A speedup inside the spread is not a result.
5. Keep the change only if the effect survives a rerun. Otherwise revert and say what you learned.

Exit: a measurement record that meets the primitive's required fields, plus the run artifact.

Route: `nuclear-review`, `graphify` for hot-path mapping.

## Shape: land

Getting verified work into the base branch. This is the last mile, not a formality.

1. Confirm the stack is verified: every unit has a quoted artifact from its own shape.
2. Check the base: conflicts, review threads, CI state, and what landed since you started.
3. Order the work bottom-up: one commit per verified unit, conventional commit title, body that states the evidence.
4. Land, then verify the base branch is green. A merged red branch is not landed.
5. Report the commit range and the verification that backs it.

Exit: the base branch contains the change and is green, or the blocker is named with its owner.

Route: `handoff` when the run continues elsewhere, `diff-review` for a reviewable summary.

## Anti-patterns

- Starting to edit before the shape is named. That is how a fix becomes a rewrite.
- A checklist printed after the work is done. The checklist exists to constrain the work.
- Declaring an exit condition met from memory. Quote the artifact.
- Two shapes interleaved because neither was finished. Finish or say which is abandoned.
