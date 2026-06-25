---
name: n0x-content
description: >
  Generate brutalist kinetic marketing/promo videos for any project using the
  n0x-content pipeline. Triggers on "generate a video", "make a promo video",
  "create a marketing video", "brutalist video", "kinetic video", "n0x-content",
  "n0x video", or any request to produce video content from project assets.
allowed-tools: read, write, edit, bash
---

# n0x-content — Kinetic Video Generation

Generate brutalist, beat-synced short-form videos from a project's assets using
the n0x-content pipeline. This skill orchestrates: bootstrap → asset ingestion →
LLM-generated cutlist → containerized render.

## Engine Location

The n0x-content engine lives at `~/1-projects/n0x-content/`. It is an independent
project containing the Python renderer (`main.py`), Podman `Containerfile`, shell
scripts, and project templates. The agent never edits the engine.

Wrapper scripts in `~/dotfiles/scripts/` bridge the engine into pi:

| Script | Purpose |
|--------|---------|
| `~/dotfiles/scripts/n0x_build.sh` | Ensure the Podman container image exists |
| `~/dotfiles/scripts/n0x_bootstrap.sh <dir>` | Scaffold a video project directory |
| `~/dotfiles/scripts/n0x_ingest.sh <dir> [opts]` | Fetch royalty-free audio, video, images |
| `~/dotfiles/scripts/n0x_render.sh <dir> [opts]` | Build container + render MP4 |

The prompt template is at `~/.pi/agent/prompts/n0x-cutlist.md`.

## Workflow

### Phase 1 — Determine project location

The video project needs a directory. Options, in priority order:

1. **User specifies:** `--output <path>` or names a directory
2. **Inside current project:** If the user is working in a project (CWD), create
   `<cwd>/n0x-video/` as the video project directory
3. **Explicit ask:** `"Where should I create the video project?"`

The agent must resolve an absolute path before proceeding to phase 2.

### Phase 2 — Bootstrap the scaffold

```bash
bash ~/dotfiles/scripts/n0x_bootstrap.sh <absolute-target-dir>
```

This creates the directory with: `audio/`, `raw_footage/`, `overlays/`, `prompts/`,
`output/`, `config.json`, and a README.

After bootstrapping, inspect the current project (CWD) for usable assets:
- Screenshots in the project tree
- A logo or icon (`logo.png`, `icon.png`, `favicon.png`, etc.)
- Any existing video or image files in the project

Copy or symlink discovered assets into the appropriate subdirectories:
- Screenshots/images → `raw_footage/`
- Logo → `overlays/`

Check whether `audio/` has any files after bootstrapping (it won't, unless the
user has pre-placed them).

### Phase 3 — Asset ingestion (if needed)

If the project has no audio in `audio/`:
1. Tell the user: *"No audio found. I can fetch royalty-free tracks, or you can
   drop your own soundtrack into `<dir>/audio/`."*
2. If the user wants auto-ingestion, ask what vibe they want (default:
   *"dark aggressive drill beat"*) and run:

```bash
bash ~/dotfiles/scripts/n0x_ingest.sh <dir> --audio-query "<vibe>"
```

If `raw_footage/` is empty beyond what was copied from the project:
1. Tell the user: *"No video footage found. I can fetch public domain films from
   the Internet Archive, or you can drop clips into `<dir>/raw_footage/`."*
2. If the user wants auto-ingestion:

```bash
bash ~/dotfiles/scripts/n0x_ingest.sh <dir> --no-audio --ia-id <identifier>
```

Use `--no-preprocess` if the user wants the raw unprocessed look.

**Do not auto-ingest without asking.** The user should confirm, especially for
audio where the vibe matters.

### Phase 4 — Generate the cutlist (the agent's core task)

This is where the agent does the creative work.

1. **Read the prompt template:**
   ```
   ~/.pi/agent/prompts/n0x-cutlist.md
   ```
   Internalize its aesthetic rules, timing discipline, filter/effect vocabulary,
   and JSON output format.

2. **Inventory available assets.** List all files in `raw_footage/` and
   `overlays/`. Note which are videos vs. images.

3. **Determine the soundtrack duration.** If `audio/` has a file, note its
   length. If not, assume 15–30 seconds (state the assumption to the user).

4. **Compose the cutlist.** Following the prompt template's rules exactly:
   - Hook phase: 4–6 seconds, slow cuts (1.0–1.5s per segment), Ken Burns,
     monochrome, tension-building text
   - Drop transition: one or two white flash strobe segments
   - Kinetic phase: rapid cuts (0.3–0.8s per segment), cycling filters,
     alternating text
   - Use every available asset at least once
   - Text: UPPERCASE, 2–5 words, declarative, mechanical tone
   - No gaps — `end` of one segment equals `start` of next

5. **Write the cutlist:**
   ```
   write <project-dir>/prompts/cutlist.json
   ```

   The content must be valid JSON — an array of segment objects as defined in
   the prompt template.

6. **Report to the user.** Summarize: duration, segment count, assets used,
   text headlines used. Offer to adjust: *"Does this look right? I can tweak
   timing, text, or filter choices before rendering."*

### Phase 5 — Render

Once the user approves the cutlist:

```bash
bash ~/dotfiles/scripts/n0x_render.sh <project-dir>
```

Optionally pass style overrides:
```
--resolution 1920x1080     # for widescreen instead of vertical
--font LiberationSans-Bold # font override
--font-size 52             # smaller text
--audio-offset 5           # skip first 5s of audio
```

The render runs inside a Podman container (auto-built on first use). Report progress
and the final output path: `<project-dir>/output/render.mp4`.

## Config Overrides

The default `config.json` uses the `vertical` preset (1080×1920, serif font).
The user can change the preset or individual settings by editing `config.json`:

```json
{ "preset": "widescreen" }
```

Valid presets: `vertical`, `widescreen`, `square`, `story`, `cinematic`.

## Asset Discovery from the Host Project

When bootstrapping inside an existing project, look for:
- `*.png`, `*.jpg`, `*.gif` — screenshots, diagrams, UI mockups
- `logo.*`, `icon.*`, `favicon.*`, `brand.*` — branding assets → `overlays/`
- `demo*.mp4`, `screen*.mp4`, `*.mov` — existing footage
- A `README.md` — mine it for product name, tagline, and key phrases to use as
  cutlist text

Always tell the user what you found and ask before including sensitive or
unreleased material in the video.

## Dependencies

- `podman` (or `docker`) — for the containerized render
- `ffmpeg`, `yt-dlp`, `wget`, `ia` (internetarchive) — for ingestion
- Run `~/1-projects/n0x-content/scripts/install_deps.sh` if deps are missing

## Verification

- `~/dotfiles/scripts/n0x_build.sh` must succeed before render
- `prompts/cutlist.json` must exist and be valid JSON before render
- `audio/` should contain at least one file (warn if not)
