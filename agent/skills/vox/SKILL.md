---
name: vox
description: >-
  Goal-to-verified-change spine. Writes a short goal file (outcome, acceptance
  lines that each name their check, non-goals, ordered units) instead of a
  planning document, then builds one verifiable unit at a time and proves it on
  the real surface. No test-first requirement.
  Use when a change needs more than one verified step:
  "/skill:vox goal <goal>", then "/skill:vox build", then "/skill:vox ship".
---

# Vox - goal to verified change

The best spec is code.
Vox writes down only what the diff cannot show: the outcome, the lines that say it is done, and the exact thing that proves each line.
There is no proposal, no design document, and no test-first rule.

Commands: `/skill:vox goal <goal>`, `/skill:vox build`, `/skill:vox ship`.

## Rules

1. **A goal is an outcome, not a task list.** One sentence that someone who uses the change would recognize, plus the check that settles it.
2. **Every unit ends verifiable.** Someone else must be able to run one command and see it done.
3. **Evidence, not memory.** A claim of done quotes output produced in this session. "It compiles" is not evidence.
4. **The smallest change that meets an acceptance line.** No scaffolding for later, no bonus cleanup in a feature diff.
5. **No TDD.** A test is one form of evidence, not a workflow. Write one when it is the cheapest way to pin behavior you cannot otherwise show. Never require one before the change.
6. **Prove it on the surface the user touches.** A UI runs in a browser, an API answers a curl, a CLI runs its command, a library runs its example. A test run alone does not settle a runtime-surface change.
7. **Stop at the unit boundary.** One unit per build invocation. Report, then wait.

## Storage

The goal file is `docs/goals/<slug>.md`.
Use the project's own convention when its `AGENTS.md` names one.

A design written before the goal, by `/brainstorm` or a grill session, stays at `docs/specs/<name>.md` and feeds the goal.
Vox never writes a second copy of it.

---

## Goal mode

Triggered by `/skill:vox goal <goal>`. No code is written in this mode.

**0. Load the coding standard**

    cat ~/.pi/agent/prompts/tigerbeetle.md

Acceptance lines, unit sizing, and the change itself all conform to it.
When a trade-off arises, safety beats performance, simplicity beats cleverness, determinism beats convenience.

**1. Play the goal back**

State four things in the reply before doing anything else:

- Outcome: what changes for the person who uses this.
- Acceptance: the observable statements that mean it is done.
- Verification path: the command or surface that proves each statement.
- Non-goals: what this change will not do.

Ask only what cannot be observed: preference, scope, an irreversible step.
A fact you could settle by running something is not a question for the user, it is a prototype or a read.

**2. Read before writing**

Does the code already do this?
Locate the surface with `ffgrep`/`fffind`, then `read` the entry points.
Quote the lines that answer it. A goal whose behavior already exists is a finding, not a task.

If the change introduces state, name the data shape first: the types, their variants, which states are illegal.
Read TB-15 and TB-16 in `~/.pi/agent/primitives/coding-standard.schema.json`.
If the change writes shared or persisted state, name the action that performs the write, from the spec's `actionTypes` when a spec exists.

**3. Write the goal file**

```markdown
# <slug>

## Outcome

One or two sentences. What changes for the person who uses this.

## Acceptance

Every line names the check that proves it.

- [ ] <observable statement> - `<command or surface>`, pass means <output or state>
- [ ] <observable statement> - `<command or surface>`, pass means <output or state>

## Non-goals

- <what this change will not do>

## Units

Ordered. Each one ends in a state a reviewer can verify.
Every unit names the action type it implements, or `none` with the reason it writes nothing.
A write with no action behind it is a spec gap: fix the spec, then the unit.

- [ ] <unit> - touches <files> - `<check>` - action <actionType | none: why>
- [ ] <unit> - touches <files> - `<check>` - action <actionType | none: why>
```

**4. Stop**

Summarize the goal in one line and point at the first unit.
Do not write production code.
If the change turns out to be one unit with one check, say so: that is a fix, not a goal, and it does not need this mode.

---

## Build mode

Triggered by `/skill:vox build [slug]`. Executes one unit per invocation.
Without a slug, use the only goal file under `docs/goals/`, or ask which one.

**0. Load the coding standard**

    cat ~/.pi/agent/prompts/tigerbeetle.md

**1. Load context**

- The goal file.
- The design at `docs/specs/<name>.md` when the goal names one.
- Project `AGENTS.md` and the verification commands it names.
- Any rule file covering the components the unit touches.

**2. Pick the unit**

Take the first unchecked unit.
If every unit is checked, say so and point at `/skill:vox ship`.

**3. Restate it in one line**

The unit, the files it touches, the action it implements, and the check that will prove it.
Then start. Do not recount the whole goal.

**4. Make the smallest change**

Read a file before you edit it.
The change stops at the acceptance line it serves.
The gate runs `__check.sh` on every edit and write, so the coding standard is enforced as you go.

**5. Prove it**

Run the unit's check and quote the output.
Run the project's verification commands and quote what changed.
If a check fails, fix the cause, not the assertion.
If the check cannot run on this machine, say what replaced it and why that is enough.

**6. Mark it done**

In the goal file, check the unit box and append the evidence on the same line:

    - [x] <unit> - touches <files> - `<check>` - action <actionType> -> <result>, <YYYY-MM-DD>

Check an acceptance box only when its own check passed, not because a unit that seemed related is done.

**7. Stop**

Report the files changed, the quoted evidence, and the suggested commit message.
Name the next unit, or say that every unit is done and `/skill:vox ship` is next.

---

## Ship mode

Triggered by `/skill:vox ship [slug]`. Every unit must already be checked.

**1. Audit the goal file mechanically**

    grep -n '\- \[ \]' docs/goals/<slug>.md
    grep -n 'touches ' docs/goals/<slug>.md | grep -v ' - action '

An empty result from the first means every unit and acceptance line is checked.
Any hit is unverified work. Stop and report the line.
An empty result from the second means every unit names its action.
A unit that does not is either a write with no spec behind it or a line to rewrite.

**2. Run the gates**

Run the project's verification commands and quote the output.
A failing gate is a block, not a note to add to the summary.

**3. Commit one unit per commit**

Conventional title, and a body that states the evidence for that unit.
No trailers of any kind.

**4. Push and open the PR when asked**

Report the commit range and the evidence that backs it.
Leave the goal file in the tree as the record of what was claimed and what proved it.

---

## Failure handling

- A check that still fails after a reasonable attempt: stop, quote what failed, and say what you tried. Do not widen scope to work around it.
- The goal turns out wrong: edit the goal file, state what changed and why, then continue or stop for the user.
- The unit is bigger than the goal said: split it in the goal file before building it, not after.
- Never `--no-verify` to get past a hook.
