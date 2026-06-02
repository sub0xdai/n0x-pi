# MISSION.md format

Every teaching workspace must contain a `MISSION.md` file that captures the reason the user is learning this topic. It grounds all teaching decisions and ensures every session connects to real-world goals.

## Template

```markdown
# Mission

## Topic
<!-- One-liner: what is the broad domain? E.g., "Distributed systems", "Oil painting", "Spanish language" -->

## Why This Matters
<!-- 3–5 sentences. What would being competent in this topic enable? What's the concrete real-world outcome? -->

## Success Looks Like
<!-- 3–5 bullet points. Measurable or observable outcomes that signal progress. -->

- ...
- ...
- ...

## Constraints
<!-- Time, budget, access to equipment, preferences, learning style, etc. -->

## Community Preference
<!-- One of: "welcome", "prefer-not" (the user would rather not join communities) -->
```

## Rules

- Keep it concise — this is a compass, not a novel
- Update when the mission evolves (e.g., the user discovers a more specific goal)
- If the user is unclear about their mission, leave `Why This Matters` and `Success Looks Like` empty and prompt them to reflect
- Community preference defaults to "welcome" unless the user explicitly says otherwise
