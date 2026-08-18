---
name: video-render-qa
description: >
  Verify a rendered video against its intended design: codec/resolution sanity,
  frame extraction at key timestamps, pixel statistics, OCR of text overlays,
  and audio levels. Triggers after any video render ("check the render", "verify
  the video", "does the output look right", QA of output/render.mp4) or as the
  final phase of a video build workflow.
allowed-tools: bash, read
---

# Video Render QA

Prove a rendered video matches its intent before declaring success. This is the
verification loop used after every render in the video pipelines. Each check is
cheap; run all of them.

## Phase 1 - Container sanity

```bash
ffprobe -v error \
  -show_entries format=duration,size \
  -show_entries stream=codec_name,width,height,r_frame_rate <render.mp4>
```

Check against intent:

- Resolution matches the preset (1920x1080 widescreen, 1080x1920 vertical).
- Duration matches the plan (cutlist total or target length).
- Video codec is h264, audio stream present.
- File size is sane (a 60s 1080p render is tens of MB, not 100 KB).

## Phase 2 - Frame extraction at key timestamps

Extract frames where the design has structure: hook/start, transitions, text
flash moments, and the end card:

```bash
ffmpeg -v error -ss <t> -i <render.mp4> -frames:v 1 -y /tmp/qa_<t>.png
```

The timestamps come from the cutlist/plan - do not guess; read the plan's
segment starts and overlay windows.

## Phase 3 - Pixel statistics

Per frame, compute with Pillow (or ffmpeg signalstats):

- Black/white/colored pixel percentages - verify the intended look (dark
  background videos should be mostly black; text frames should show white
  peaks).
- Brightness in specific regions - verify an overlay actually lands where it
  was placed (e.g. end-card text region is bright at its window).

If numpy is missing, drop to pure-Pillow histogram math - do not install
dependencies for a one-off check.

## Phase 4 - OCR of text overlays

OCR frames that should contain text (wallet addresses, callouts, end cards):

```bash
tesseract /tmp/qa_<t>.png stdout
```

- Verify expected strings are present (e.g. the wallet address, "BUY NOW").
- If tesseract fails with "Failed loading language 'eng'", point
  `TESSDATA_PREFIX` at the tessdata dir that contains `eng.traineddata`.

## Phase 5 - Audio levels

```bash
ffmpeg -i <render.mp4> -af volumedetect -f null - 2>&1 | grep -E "mean_volume|max_volume"
```

- Mean volume should be in a sane range (roughly -20 to -8 dB for music-backed
  content). Near-silence or clipping mean the mix is wrong.
- If the design calls for a fade-out, spot-check the final seconds stay quiet.

## Phase 6 - Region diff checks

For overlays that flash in and out, compare a frame inside the window against a
frame just outside it:

```bash
# mean absolute pixel difference in the overlay region between the two frames
```

A real overlay produces a large region diff (tens of points); a control region
stays small. This catches overlays that never appeared or never left.

## Phase 7 - Verdict

Report each check as pass/fail with the numbers. If anything fails, go back to
the build/cutlist, fix, re-render, and re-run this skill. Do not call a render
done until every check passes.

## Verification

- All checks in this list ran; none were skipped silently.
- Every timestamp used came from the actual plan, not a guess.
