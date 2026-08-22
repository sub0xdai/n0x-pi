# Scythe Brutalist Kinetic Video - Cut-List Generator

When generating a cut-list for the scythe kinetic video renderer, produce valid JSON conforming to the cutlist schema. You are the editor - output valid JSON only, no conversational filler.

## Primitives (read before generating)

Before generating any cutlist, read these ground-truth files:

1. **`~/1-projects/scythe/schemas/cutlist.schema.json`** - authoritative schema. Every segment must conform. Contains computable validation rules for: no-gaps, filter adjacency, filter-effect compatibility, phase duration bounds, text constraints.
2. **`~/1-projects/scythe/schemas/filter-effect-matrix.json`** - 8×5 compatibility table. `white_flash` is asset-destructive: it replaces the clip with a blank white frame. Motion effects (`ken_burns_slow`, `ken_burns_fast`, `snap_zoom`) are nonsensical on `white_flash`. Only null, `strobe`, or `word_flash` effects are valid with `white_flash`.

## Constraints enforced by schema (do not improvise)

These rules are validated mechanically. You must satisfy them:

| Rule | Source |
|------|--------|
| `segment[i].end == segment[i+1].start` - no gaps | cutlist.schema.json#noGaps |
| `segment[i].filter != segment[i+1].filter` - vary filters | cutlist.schema.json#filterAdjacency |
| `white_flash` filter → effect ∈ {null, `strobe`, `word_flash`} | filter-effect-matrix.json |
| Hook phase: 1.0–1.5s per segment, 4–6s total | cutlist.schema.json#$defs/phaseDurationBounds |
| Drop/kinetic phase: 0.3–0.8s per segment | cutlist.schema.json#$defs/phaseDurationBounds |
| All text UPPERCASE, 2–5 words | cutlist.schema.json#textUppercase |
| `text` must be null when `filter` is `white_flash` | cutlist.schema.json#textNullOnFlash |
| `asset` required unless `filter` is `white_flash` | cutlist.schema.json#assetRequiredUnlessGenerated |
| Total duration ≤ soundtrack length (queried from project audio/) | external constraint |

## Fields (from cutlist.schema.json)

| Field | Type | Values |
|-------|------|--------|
| `start` | float | Start timestamp (seconds) |
| `end` | float | End timestamp (seconds), must be > start |
| `phase` | enum | `hook`, `drop_transition`, `kinetic_cut` |
| `text` | string\|null | UPPERCASE overlay. Null on flash frames |
| `asset` | string\|null | Relative path from project root. Null only for `white_flash` segments |
| `filter` | enum\|null | See filter registry in filter-effect-matrix.json |
| `effect` | enum\|null | See effect registry in filter-effect-matrix.json |
| `clip_start` | float | (Optional) Subclip start offset. Default 0 |
| `clip_end` | float | (Optional) Subclip end offset. Default auto |

## Output Video Specs

- Duration: 15–30 seconds
- Aspect ratio: 9:16 vertical (1080×1920) unless the user specifies otherwise
- Two-phase structure synchronized to the soundtrack

### Phase 1 - The Hook (0:00–0:05)
- Slow, tense, rhetorical
- Ken Burns effect on footage
- Monochrome visuals
- Text builds tension - short, punchy phrases

### Phase 2 - The Core Drop (0:05–End)
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

## Copywriting Rules

- UPPERCASE only, 2–5 words per text segment
- Declarative, mechanical tone
- No marketing fluff, no adjectives
- Each text segment should advance the narrative - do not repeat

## Asset Selection

- Inventory available assets from the project's `raw_footage/` directory
- Cycle through all assets - use every clip at least once
- Reserve the most visually striking asset for the opening hook
- Vary filters across segments per the adjacency rule (schema-enforced)
- White flash frames (`filter: "white_flash"`) mark beat drops and transitions. These must have `text: null` and `effect: null` (or `strobe`/`word_flash`)
- Overlay images from `overlays/` on slower segments

## Validation (run before output)

Before emitting the cutlist, self-check against these schema rules. Each check must pass:

1. **No gaps:** for all i, `segments[i].end == segments[i+1].start`
2. **Filter adjacency:** for all i, `segments[i].filter != segments[i+1].filter`
3. **white_flash compatibility:** `white_flash` segments have `effect` in {null, `strobe`, `word_flash`}
4. **Phase bounds:** hook per-segment ∈ [1.0, 1.5], hook total ∈ [4.0, 6.0]; drop per-segment ∈ [0.3, 0.8]
5. **Text format:** all non-null text is UPPERCASE, 2-5 words
6. **Null text on flash:** `white_flash` segments have `text: null`
7. **Asset on non-flash:** segments without `white_flash` must have a non-null `asset`
8. **Duration:** total duration ≤ soundtrack length

Output only the JSON array after passing all checks.
