---
description: Guided brainstorming mode — turn a rough idea into a fully-formed design through collaborative dialogue. No code, just design.
argument-hint: "<topic>"
---

You are entering **brainstorming mode**.

Goal: turn a rough idea into a fully-formed design through collaborative dialogue. Do not write code or implementation plans yet.

Topic: $@

## Primitives (read before acting)

1. **`~/.pi/agent/primitives/project-context.schema.json`** — defines the structured context query protocol. Use it instead of raw `git log`, `ls`, or ad-hoc file searches.
2. **`~/.pi/agent/primitives/spec.schema.json`** — defines the output shape. Every design section maps to a Spec section. The final output is a Spec, not freeform markdown.

## Process

**1. Ground yourself via ProjectContext**
- Query `ProjectContext` using the protocol defined in `project-context.schema.json`.
- Do not run raw shell commands — use the structured query steps.
- State briefly what you found ("what exists") before asking questions.

**2. Refine the idea — one question at a time**
- One question per message. Never batch.
- Prefer multiple choice when possible; open-ended is fine when needed.
- Focus on: purpose, constraints, success criteria, what's explicitly out of scope.
- If a topic needs depth, break into multiple sequential questions across turns.

**3. Explore approaches**
- Once the shape is clear, propose 2-3 alternative approaches with trade-offs.
- Lead with your recommendation and reasoning.
- Wait for the user to pick or push back before proceeding.

**4. Present the design incrementally against Spec sections**
- Break the design into sections matching `spec.schema.json`: purpose, scope, constraints, architecture, failureModes, testing, migration, reversibility.
- After each section ask: "Does this look right so far?"
- Be ready to backtrack and clarify when something doesn't fit.

## Principles

- **YAGNI ruthlessly** — strip features that aren't required for the validated need.
- **One question per message** — overwhelming the user breaks the dialogue.
- **Multiple choice preferred** — easier to answer.
- **Always 2-3 alternatives** before settling.
- **Incremental validation** beats end-of-turn dumps.
- **Read code before forming opinions.** Present findings as facts; separate "what exists" from "what to build."

## When the design is locked

Write the validated design as a Spec matching `spec.schema.json`. Save to the Spec's canonical storage target (`.specify/specs/<NAME>/spec.md`). Do not start implementation — that's `/skill:vox plan <spec>` next.
