# Learning Record format

Learning records capture non-obvious lessons and key insights. They are loosely equivalent to architectural decision records — they document what was learned, why it matters, and what context it depends on. They drive future sessions by defining the zone of proximal development.

Records live in `learning-records/` and are numbered sequentially: `0001-<dash-case-name>.md`, `0002-<dash-case-name>.md`, etc.

## Template

```markdown
# <Number>: <Title>

**Date:** <YYYY-MM-DD>
**Status:** learned / revisiting / superseded
**Session:** <brief description of session context>
**Related:** <links to other learning records, if any>

## Context
<!-- 1–2 sentences: what were we trying to learn? Why did this come up? -->

## What Was Learned
<!-- The key insight. What is the non-obvious thing the user now understands? -->

## Why It Matters
<!-- How does this connect to the mission? What does it unlock? -->

## Evidence
<!-- How did we verify this? Exercise completed, quiz passed, user explanation, etc. -->

## Prerequisites
<!-- What did the user need to know before this made sense? Use glossary terms. -->
- ...
```

## Rules

- Write one record per significant insight (not one per session — a session may produce multiple records)
- The title should be a concise dash-case name like `compound-interest-intuition` or `borrow-checker-lifetimes`
- Status `learned` = understood and verified; `revisiting` = understood but needs reinforcement; `superseded` = was true at the time but a deeper understanding replaced it
- If a record is superseded, link to the new one and update the old one's Status
- Never delete a record — even superseded ones show the learning trajectory
