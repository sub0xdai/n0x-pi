---
name: prolong
description: Programmatic memory for long-horizon tasks. Maintain a single structured log of every observation, action, and outcome, and retrieve from it with grep/Python instead of relying on context. Use on long tasks, multi-session work, big refactors, or any task where context depth matters. Triggers on "prolong", "PRO-LONG", "long-horizon", "memory log", "log my work", or when a task spans many steps and early decisions still matter.
---
# PRO-LONG: Programmatic Memory

Append every observation, action, and outcome verbatim to one structured log file. Retrieve and reason over it programmatically (grep, Python). No subagents, no specialized retrieval, no summarization of the log.

## The log

Path: `<project-root>/.prolong/log.txt`. Create it on first use. Add `.prolong/` to `.gitignore`.

Entry format, one entry per line:

```
[YYYY-MM-DD HH:MM] <TYPE>: <verbatim content>
```

Types: `OBS` (what you saw), `ACT` (what you did), `OUT` (what happened as a result), `DEC` (a decision and why).

## Append (after every significant step)

- `OBS` - what the code/config/output actually says. Quote it verbatim. No paraphrasing.
- `ACT` - the exact command, edit, or action taken.
- `OUT` - the raw result: error text, test output, diff summary. Verbatim.
- `DEC` - the decision and its rationale, in one line.

Do not summarize multiple steps into one entry. If it moved the task forward, it gets a line.

## Retrieve (before every decision that builds on prior work)

1. `grep` the log for relevant keywords, types, or timestamps.
2. If the answer needs synthesis across entries, use Python to parse the log.
3. Reason over what the log shows before acting. The log is the source of truth for what has been tried and what happened.

## Rules

- Never summarize or truncate the log. Verbatim or nothing.
- Never rely on memory of what happened earlier in the session - check the log.
- If a step fails, log the error verbatim before retrying.
- Logs are append-only. Never edit or delete past entries.

## Trigger pattern

When this skill is active, every assistant turn that performs a tool call or receives a tool result appends to the log before producing its final answer. Final answers cite the log entries that support them when relevant.
