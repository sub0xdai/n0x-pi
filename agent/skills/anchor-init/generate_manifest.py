#!/usr/bin/env python3
"""Anchor manifest generator — indexes @anchor tokens across the workspace.

Deployed by anchor:init to .anchor/generate_manifest.py in target projects.
Run independently: python3 .anchor/generate_manifest.py
"""
import json
import re
from pathlib import Path


def load_config():
    config_path = Path(".anchor/config.json")
    if not config_path.exists():
        print("ERROR: .anchor/config.json not found. Run anchor:init first.")
        raise SystemExit(1)
    with open(config_path, "r") as f:
        return json.load(f)


def find_project_root():
    """Walk up from cwd until we find .anchor/config.json."""
    current = Path.cwd()
    for parent in [current, *current.parents]:
        if (parent / ".anchor" / "config.json").exists():
            return parent
    return current


def generate_manifest():
    cfg = load_config()
    token = cfg["rules"]["token_identifier"]
    tag_token = cfg["rules"]["tag_identifier"]
    exclude_patterns = cfg.get("exclude", [])

    root = find_project_root()
    manifest = {"surfaces": {}, "meta": {"generated_from": str(root)}}

    ext_map = {
        ".ts": "typescript", ".tsx": "typescript",
        ".js": "typescript", ".jsx": "typescript",
        ".rs": "rust",
        ".py": "python",
        ".lean": "lean",
    }

    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix not in ext_map:
            continue

        rel = str(path.relative_to(root))

        excluded = False
        for pat in exclude_patterns:
            if path.match(pat) or path.match(f"**/{pat}"):
                excluded = True
                break
        if excluded:
            continue

        try:
            content = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        anchors = re.findall(r"@anchor\s+([a-zA-Z0-9:\-_]+)", content)

        for anchor in anchors:
            tags_match = re.search(
                r"@tags\s+([a-zA-Z0-9:,\-_ ]+)", content
            )
            tags = (
                [t.strip() for t in tags_match.group(1).split(",")]
                if tags_match
                else []
            )

            if anchor not in manifest["surfaces"]:
                manifest["surfaces"][anchor] = {
                    "locations": [],
                    "tags": tags,
                }

            if rel not in manifest["surfaces"][anchor]["locations"]:
                manifest["surfaces"][anchor]["locations"].append(rel)

    manifest_path = root / ".anchor" / "anchor-manifest.json"
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    total_anchors = len(manifest["surfaces"])
    total_locations = sum(
        len(v["locations"]) for v in manifest["surfaces"].values()
    )
    print(
        f"Manifest: {total_anchors} anchors across {total_locations} locations"
    )
    return manifest


if __name__ == "__main__":
    generate_manifest()
