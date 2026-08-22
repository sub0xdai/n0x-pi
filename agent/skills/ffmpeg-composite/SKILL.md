---
name: ffmpeg-composite
description: >
  Build a composite video with a hand-written ffmpeg filtergraph: timeline
  segments, glitch effects, text/image overlays, and concat. Triggers when a
  video needs a custom cut/assemble/overlay build that the scythe cutlist
  pipeline does not cover, or when debugging ffmpeg filtergraph errors
  ("concat", "filtergraph", "filter_complex" in the error).
allowed-tools: bash, read, write, edit
---

# ffmpeg Composite Build and Debug

Assemble multiple clips/images/audio into one MP4 with a hand-built ffmpeg
filtergraph. Most of this skill is the failure-mode table - the concat
normalization rule prevents the most common multi-hour debugging spiral.

## Phase 1 - Inspect every input

Before writing any filtergraph:

```bash
ffprobe -v error \
  -show_entries stream=codec_name,width,height,sample_aspect_ratio,r_frame_rate \
  -show_entries format=duration <input>
```

Record for every input: resolution, SAR, fps, duration. Everything downstream
depends on these numbers.

## Phase 2 - Plan the timeline

Define segments: which source plays from which timestamp, for how long; where
overlays (drawtext, images) appear and disappear; where audio comes from and
any offset (`-ss`/`-itsoffset` or `adelay`).

## Phase 3 - Normalize every input before concat

**The rule:** every video input feeding a `concat` must have identical
resolution, SAR, fps, and pixel format. Normalize each input chain:

```
[0:v]trim=...,setpts=PTS-STARTPTS, \
  scale=WxH:force_original_aspect_ratio=increase, \
  crop=WxH,fps=N,setsar=1,format=yuv420p[s0];
```

Apply the same normalization to every segment, then concat:

```
[s0][s1][s2]concat=n=3:v=1:a=0,format=yuv420p[vout]
```

## Phase 4 - Failure-mode table

**Failure modes** (error text is verbatim from ffmpeg - grep for it):

- `Input link in0:v0 parameters (size A, SAR 1:1) do not match ... (size B, SAR 1:1)`
  Cause: concat inputs differ in resolution/SAR. Fix: identical WxH +
  `setsar=1` + `fps` before concat.
- `Output with label 'vout' does not exist`
  Cause: output label not produced. Fix: label must end the concat chain;
  match it in `-map`.
- `Invalid file index 2 in filtergraph`
  Cause: `[2:v]` has no matching `-i`. Fix: inputs are 0-indexed by `-i`
  order; count them.
- `Nothing was written` / `moov atom not found`
  Cause: an earlier filter failed. Fix: find the first filter error upstream,
  fix, re-encode.
- `rgbashift` produces empty output
  Cause: filter needs a concrete format. Fix: append `format=yuv420p` after
  `rgbashift`.
- drawtext breaks on `:` / `,` / `'`
  Cause: special chars unescaped. Fix: escape `\\:` in filter text; quote
  the whole arg; test the text alone first.
- `deprecated pixel format` warnings
  Cause: yuv range not set. Fix: add `format=yuv420p` at chain end.

## Phase 5 - Debug by bisection

When a complex filtergraph fails, do not keep editing the whole graph:

1. Extract the failing subgraph into the smallest reproducer (two segments).
2. Confirm it fails identically.
3. Vary one thing at a time (trim type, scale, format, split, source) until it
   works.
4. Re-add the removed parts one by one, re-testing each time.

Test partial chains by writing the filtergraph to a file (`-filter_complex_script`)
and rendering to a small `/tmp/minN.mp4` output.

## Phase 6 - Overlays and effects

- Text overlay:
  `drawtext=fontfile=<abs path>:text='...':fontsize=N:fontcolor=white:`
  `borderw=2:bordercolor=black:x=(w-text_w)/2:y=(h-th)/2`, with
  `alpha='min(1,t/0.5)'` expressions for fades.
- Glitch look (one filter chain, use verbatim):
  `rgbashift=rh=2:rv=-2,noise=alls=10:allf=t+u,crop=w=iw-16:h=ih-16:`
  `x='mod(sin(t*97)*437,16)':y='mod(sin(t*53)*337,16)',vignette=angle=PI/4.5`.
- Image overlays: loop the image (`-loop 1`), scale/crop to the target region,
  overlay with enable windows: `overlay=x=..:y=..:enable='between(t,A,B)'`.
- Keep audio: `-c:a aac -b:a 192k`; for cut-only builds use `asetpts` aligned
  with the video timeline.

## Phase 7 - Render and verify

Render the full composite, then run the `video-render-qa` skill on the output.
A composite is only done when QA passes.

## Verification

- Every input probed before the graph was written.
- concat inputs all share resolution, SAR, fps, format.
- The final render passes `video-render-qa`.
