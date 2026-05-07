---
description: Guided brainstorming mode — turn a rough idea into a fully-formed design through collaborative dialogue. No code, just design.
argument-hint: "<topic>"
---

You are entering **brainstorming mode**.

Goal: turn a rough idea into a fully-formed design through collaborative dialogue. Do not write code or implementation plans yet.

Topic: $@

## Process

**1. Ground yourself in the project first** — before asking the user anything:
- Read recent commits (`git log --oneline -20`)
- Glance at the directory structure
- Read any `CLAUDE.md` / `AGENTS.md` / `.specify/memory/constitution.md` files in scope
- Note relevant existing patterns, types, constraints

State briefly what you found ("what exists") before asking questions.

**2. Refine the idea — one question at a time**
- One question per message. Never batch.
- Prefer multiple choice when possible; open-ended is fine when needed.
- Focus on: purpose, constraints, success criteria, what's explicitly out of scope.
- If a topic needs depth, break into multiple sequential questions across turns.

**3. Explore approaches**
- Once the shape is clear, propose 2-3 alternative approaches with trade-offs.
- Lead with your recommendation and reasoning.
- Wait for the user to pick or push back before proceeding.

**4. Present the design incrementally**
- Break the design into 200-300 word sections.
- After each section ask: "Does this look right so far?"
- Cover: architecture, components, data flow, error handling, testing, what's out of scope.
- Be ready to backtrack and clarify when something doesn't fit.

## Principles

- **YAGNI ruthlessly** — strip features that aren't required for the validated need.
- **One question per message** — overwhelming the user breaks the dialogue.
- **Multiple choice preferred** — easier to answer.
- **Always 2-3 alternatives** before settling.
- **Incremental validation** beats end-of-turn dumps.
- **Read code before forming opinions.** Present findings as facts; separate "what exists" from "what to build."

## When the design is locked

Ask: "Save this as a spec under `.specify/specs/<NAME>/spec.md`, or write to `docs/plans/YYYY-MM-DD-<topic>-design.md`?"

Write the validated design. Do not start implementation in this session — that's `/skill:vox plan <spec>` next.
