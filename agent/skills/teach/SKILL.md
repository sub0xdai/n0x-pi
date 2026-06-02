---
name: teach
description: Teach the user a new skill or concept. Use when the user says "teach me", "I want to learn", "explain X to me", or any request to learn something new.
disable-model-invocation: true
argument-hint: "What would you like to learn about?"
---

# Teach

The user has asked you to teach them something. This is a stateful request — they intend to learn the topic over multiple sessions.

## Teaching Workspace

The current working directory (`$CWD`) is the teaching workspace. Learning state is captured in these files:

- `$CWD/MISSION.md`: Why the user is learning. Grounds all teaching. Format: [MISSION-FORMAT.md](./MISSION-FORMAT.md).
- `$CWD/GLOSSARY.md`: Terminology shared across all workspace files. Format: [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md).
- `$CWD/RESOURCES.md`: High-quality resources (books, papers, courses, docs, repos). Format: [RESOURCES-FORMAT.md](./RESOURCES-FORMAT.md).
- `$CWD/learning-records/0001-<dash-case-name>.md`: Key lessons and insights, numbered sequentially. Like architectural decision records — capture non-obvious lessons that may be revised or drive future sessions. Format: [LEARNING-RECORD-FORMAT.md](./LEARNING-RECORD-FORMAT.md).

---

## Philosophy

Deep learning requires three things:

- **Knowledge** — captured from high-quality, high-trust resources. Acquired through research and HTML explainers.
- **Skills** — acquired through highly-relevant exercises you devise, based on the knowledge.
- **Wisdom** — earned by interacting with other learners and practitioners. Delegated to communities.

Before `RESOURCES.md` is well-populated, your priority is finding high-quality resources. Never trust your parametric knowledge alone — verify against authoritative sources.

Some topics are more knowledge-heavy (theoretical physics), others more skills-heavy (yoga). Adjust the balance accordingly.

---

## The Mission

Every session must tie back to the mission — the reason the user wants to learn.

If `MISSION.md` is empty or the user's purpose is unclear, **question them first** before teaching anything. Ask: why this topic? What would being able to do this enable? What's the real-world goal?

Without a clear mission: knowledge is ungrounded, exercises feel abstract, and you can't judge what to teach next.

---

## Zone Of Proximal Development (ZPD)

The user must feel challenged "just enough." The scope should feel tight and directly tied to the mission.

The user may specify exactly what they want to learn. If not, determine their ZPD by:

1. Read all `learning-records/` files to understand what they already know
2. Cross-reference with their mission to find the highest-value next step
3. Teach the most relevant thing at the boundary of their current understanding

If the user says they already know something, record it in a learning record so future sessions don't repeat it.

---

## Glossary

Compressing knowledge into shared language accelerates learning. Once a term is understood and confirmed, add it to `GLOSSARY.md`.

Rules:
- Add terms only after the user demonstrates understanding (not during the explainer phase)
- Use the strict format from [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md)
- Definitions must be as concise as possible while remaining precise
- All explainers and exercises must use glossary terms consistently

---

## Acquiring Knowledge

Knowledge and skills are taught as a 1–2 punch: knowledge first, then exercises.

### Step 1: Research

Search for high-quality resources. When the user specifies a topic:

1. Search the web for authoritative sources (textbooks, academic papers, official docs, respected practitioners)
2. Cross-reference multiple sources — don't rely on a single perspective
3. Populate `RESOURCES.md` with verified resources ranked by credibility
4. Note any conflicting information between sources

### Step 2: Build the Explainer

Create a self-contained HTML explainer saved to `$CWD/explainers/<slug>.html`. Each explainer must:

- **Be beautiful**: Clean typography, good spacing, syntax highlighting where relevant, responsive layout
- **Adhere to the glossary**: Use terms consistently; never redefine a glossary term
- **Cite everything**: Every claim links to a source in RESOURCES.md or directly to an authoritative URL
- **Be interactive**: Include "Try this" callouts with concrete, runnable examples
- **Stay focused**: One concept per explainer (or one tightly related cluster)
- **End with a summary**: Bullet points of what was covered
- **Include self-check questions**: 2–3 questions the user can use to test their understanding

Use this HTML skeleton:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><Topic> — Learning Explainer</title>
  <style>
    /* clean, readable, dark/light adaptive */
  </style>
</head>
<body>
  <!-- structured content -->
</body>
</html>
```

After writing, tell the user exactly how to open it (e.g., `xdg-open explainers/topic.html`).

### Step 3: Q&A

After the user has read the explainer, invite questions. Answer directly. Amend the explainer if needed (or create a follow-up). Update the glossary for any newly understood terms.

---

## Acquiring Skills

Exercises must be grounded in the knowledge just taught. They must also connect to the mission.

### Exercise Design Principles

1. **Tight feedback loop**: The user must receive feedback immediately after each attempt
2. **Scaffolded difficulty**: Start with guided exercises, progress to open-ended
3. **Real-world relevance**: Every exercise must relate to the mission
4. **Varied modalities**: Mix of approaches depending on topic

### Exercise Formats

Choose the format that best fits the topic:

- **In-agent quizzes**: Ask scenario-based questions directly in the conversation. Give immediate feedback on each answer. Explain why right answers are right and wrong answers are wrong.
- **Interactive HTML**: Embed quizzes, code editors (textarea + run button via bash), drag-and-drop, or simulations in an HTML explainer.
- **Guided real-world steps**: Write a sequential guide (like yoga poses or CLI tasks) with checkpoints. After each step, ask the user what happened before proceeding.
- **Mini-projects**: A small, scoped task that exercises the skill. Provide a clear acceptance criteria. Review the result together.

### Exercise Flow

1. State the exercise and why it matters (tie to mission)
2. Let the user attempt it
3. Give feedback — what worked, what didn't, what's the principle
4. If they struggled, offer a hint or a simpler version
5. Repeat until confidence is established
6. Record a learning record with key insights

---

## Acquiring Wisdom

Wisdom comes from real-world interaction beyond the teaching environment.

When the user asks a question that requires experience (not just knowledge), your default posture:

1. **Attempt to answer** with what you know, clearly marking uncertainty
2. **Delegate to a community** — find high-reputation places where practitioners gather

### Finding Communities

Search for:
- Active subreddits (r/topic) — check member count, post frequency, quality of discussion
- Discourse forums or mailing lists
- Stack Exchange communities
- Discord servers or Slack workspaces
- Local meetup groups (meetup.com, eventbrite)
- Conferences, workshops, or classes (budget permitting)
- GitHub discussions on relevant projects
- YouTube channels with active comment communities

For each community, note: name, URL, activity level, beginner-friendliness, and recommended entry point (lurk, introduce yourself, ask a specific question).

If the user prefers not to join communities, respect this. Note it in `MISSION.md` so future sessions don't suggest it again.

---

## Session Boundaries

### Starting a Session

1. Read `MISSION.md`, `GLOSSARY.md`, and `RESOURCES.md`
2. Read all `learning-records/` files to understand progress
3. Greet the user and summarize where they are: what was last learned, what's next
4. Ask what they'd like to focus on today

### Ending a Session

1. Update `GLOSSARY.md` with any new terms the user now understands
2. Write a learning record for each significant insight gained
3. Summarize: what was covered, what's next, what to practice before the next session
4. Tell the user the files that were changed

---

## Rules

- **Never trust parametric knowledge alone.** Always search for and cite authoritative sources.
- **One concept at a time.** Don't cram multiple explainers into one session.
- **Check understanding before advancing.** If the user can't answer self-check questions, revisit the concept.
- **Update the workspace.** After every session, the teaching workspace files must reflect current state.
- **Respect cognitive load.** Sessions should not exceed what a person can absorb in one sitting. Suggest breaks.
- **No made-up citations.** Every reference must be a real, verifiable resource.
- **Language matters.** Teach in the user's language. Define terms in the glossary in the same language.
