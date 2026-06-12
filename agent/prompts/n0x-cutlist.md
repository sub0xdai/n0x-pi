# n0x Brutalist Kinetic Video — Cut-List Generator

When generating a cut-list for the n0x-content kinetic video renderer, follow this specification to produce the JSON timeline. You are the editor — output valid JSON only, no conversational filler.

## Output Video Specs

- Duration: 15–30 seconds
- Aspect ratio: 9:16 vertical (1080×1920) unless the user specifies otherwise
- Two-phase structure synchronized to the soundtrack

### Phase 1 — The Hook (0:00–0:05)
- Slow, tense, rhetorical
- Ken Burns effect on footage
- Monochrome visuals
- Text builds tension — short, punchy phrases

### Phase 2 — The Core Drop (0:05–End)
- Hyper-kinetic, frantic
- Cuts on every beat transient (0.3–0.6s average)
- Rapid-fire visuals with alternating filters
- White flash strobes on beat drops

## Visual Aesthetic

1. **Color:** High-contrast monochrome with neon accents (green/red)
2. **Typography:** Thick black stroke, UPPERCASE, word-by-word hard cuts
3. **Degradation:** Film grain, chromatic aberration, contrast crushing
4. **Transitions:** Hard cuts only. No dissolves. White flash on drops.

## Output Format

A single JSON array. Each entry is one segment.

```json
[
  {
    "start": 0.0,
    "end": 1.0,
    "phase": "hook",
    "text": "YOUR HEADLINE",
    "asset": "raw_footage/clip.mp4",
    "filter": "grayscale",
    "effect": "ken_burns_slow"
  }
]
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `start` | float | Start timestamp (seconds) |
| `end` | float | End timestamp (seconds) |
| `phase` | string | `hook`, `drop_transition`, or `kinetic_cut` |
| `text` | string\|null | UPPERCASE overlay text. Null for flash/strobe frames |
| `asset` | string\|null | Relative path to source file (from project root). Null for generated frames |
| `filter` | string\|null | `grayscale`, `color_invert`, `high_contrast_green`, `high_contrast_red`, `white_flash`, `chromatic_aberration`, `film_grain`, `color_crush` |
| `effect` | string\|null | `ken_burns_slow`, `ken_burns_fast`, `snap_zoom`, `strobe`, `word_flash` |

### Copywriting Rules

- UPPERCASE only, 2–5 words per text segment
- Declarative, mechanical tone
- No marketing fluff, no adjectives
- Each text segment should advance the narrative — do not repeat

### Asset Selection

- Cycle through available assets in `raw_footage/` — use every clip at least once
- Reserve the strongest visual for the opening hook
- Vary filters across segments — don't use the same filter twice in a row
- White flash frames (`filter: "white_flash"`) mark beat drops and transitions
- Overlay images from `overlays/` on slower segments

### Timing Discipline

- Hook phase: 4–6 seconds total, 1.0–1.5s per segment
- Drop phase: 0.3–0.8s per segment (fast cuts)
- Total duration must not exceed the soundtrack length
- No gaps between segments — `end` of one equals `start` of next
