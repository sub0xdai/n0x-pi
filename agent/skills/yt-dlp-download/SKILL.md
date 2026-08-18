---
name: yt-dlp-download
description: >
  Download YouTube audio or video with yt-dlp, including recovery from the common
  HTTP 403 / player-client failures. Triggers on "download this YouTube video",
  "grab the audio from this link", "use this YouTube video as footage/audio",
  or any request that fetches media from YouTube URLs.
allowed-tools: bash, read
---

# YouTube Download with 403 Recovery

Download a YouTube URL to a local file. YouTube rotates client restrictions,
so the plain command frequently fails with `HTTP Error 403: Forbidden`; the
recovery ladder below is the core of this skill.

## Phase 1 - Pick the target format

- Audio only (music beds, soundtracks): `-f 140` (m4a) or `-f 251` (webm/opus).
- Best quality video + audio: `-f "bestvideo+bestaudio"` (yt-dlp merges via
  ffmpeg into the container you request with `--merge-output-format mp4`).
- Known exact format: pass its id directly.

Always pass an explicit `-o <path>` so the artifact lands where the workflow
expects it (e.g. `audio/music.webm` or `raw_footage/clip.mp4`).

## Phase 2 - Plain attempt

```bash
yt-dlp -f <fmt> -o <path> <url>
```

## Phase 3 - 403 / player-client ladder

On `HTTP Error 403` or `unable to download video data`, retry the same command
with each player client in order, stopping at the first success:

1. `--extractor-args "youtube:player_client=default"`
2. `--extractor-args "youtube:player_client=android"`
3. `--extractor-args "youtube:player_client=tv"`
4. `--extractor-args "youtube:player_client=ios"`
5. `--extractor-args "youtube:player_client=web"`

Notes from the field:

- `android` frequently succeeds when `default` 403s; `ios` is a common
  second fallback.
- Warnings like "Some android client https formats have been skipped" or
  "SABR-only streaming experiment" mean that client cannot serve the format -
  skip to the next client rather than retrying the same one.
- If a client downloads but with "Requested format is not available": run
  `yt-dlp --list-formats <url>`, pick an available format id, and pass it
  explicitly with the working client.
- DRM-protected videos ("only images are available for download") cannot be
  downloaded - tell the user, do not loop.

## Phase 4 - Verify

```bash
ffprobe -v error \
  -show_entries format=duration,size \
  -show_entries stream=codec_name,width,height <path>
```

Report: path, duration, codecs, resolution. If duration is 0 or the file is
tiny, the download was a stub - redo with a different client/format.

## Verification

- Output file exists at the requested path with sane duration and size.
- The format matches the intent (audio-only request yields no video stream).
