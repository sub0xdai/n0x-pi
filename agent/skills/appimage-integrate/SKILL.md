---
name: appimage-integrate
description: >
  Install an AppImage so it launches from the desktop launcher (rofi, dmenu,
  application menu): extract, install .desktop and icon, fix the Exec line,
  test launch. Triggers on "set up this AppImage", "install <app>.AppImage",
  "the app is not launching from rofi", "make <app> appear in my launcher".
allowed-tools: bash, read, ask_user
---

# AppImage Desktop Integration

Turn a downloaded `.AppImage` into a launcher-integrated desktop app. Covers
both first-time setup and the common "installed but will not launch from
rofi" failure.

## Phase 1 - Verify the artifact

```bash
file <app>.AppImage
```

Confirm it is an ELF executable, then `chmod +x`. If it is not executable,
fix that first.

## Phase 2 - Ask before integrating

`ask_user`: full desktop integration (launcher entry + icon) vs. running the
binary directly from a terminal. Default to full integration for GUI apps.

## Phase 3 - Extract

```bash
cd /tmp && <path>/<app>.AppImage --appimage-extract
```

Some AppImages need `--appimage-extract-and-run` or fail outside a shell -
if extraction errors, try `--appimage-extract` with `APPIMAGE_EXTRACT_AND_RUN=1`.
Inspect `squashfs-root/` for the `.desktop` file and icon.

## Phase 4 - Install desktop entry and icon

1. Move the AppImage to a stable location: `~/Applications/` or `~/.local/bin/`.
2. Read the extracted `.desktop` file. Fix the `Exec=` line: it must point at
   the stable AppImage path (or the extracted binary) with absolute path, and
   Chromium-based apps need `--no-sandbox` added: `Exec=<path>/<app>.AppImage --no-sandbox %U`.
3. Copy the `.desktop` to `~/.local/share/applications/<app>.desktop`.
4. Copy the icon to
   `~/.local/share/icons/hicolor/512x512/apps/<app>.png` (use the icon size
   dir that matches the extracted icon).
5. Refresh caches:

```bash
update-desktop-database ~/.local/share/applications
gtk-update-icon-cache ~/.local/share/icons/hicolor -f
```

## Phase 5 - Validate and test launch

```bash
desktop-file-validate ~/.local/share/applications/<app>.desktop
gtk-launch <app> & sleep 2 && pgrep -f <app-binary-name>
```

- Fix every desktop-file-validate complaint (missing `Type=`, bad `Exec`,
  relative paths).
- If the app does not appear in rofi, confirm the .desktop filename matches
  the app name rofi searches for, and that `StartupWMClass` matches the app's
  WM class.
- If it launches from `gtk-launch` but not rofi, rofi caches the app list -
  restart rofi or run `rofi -show drun` fresh.

## Verification

- `desktop-file-validate` passes with zero errors.
- `gtk-launch <app>` starts the process (verified via `pgrep`).
- The AppImage lives at a stable path that outlives `/tmp`.
