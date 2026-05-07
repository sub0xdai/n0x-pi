#!/bin/sh
#
# Thin wrapper around the canonical find-nvim-socket script that ships with
# the shannon nvim plugin. Kept here so that the SKILL.md path
# `scripts/shannon-find-nvim.sh` continues to resolve.
#
# Checks both standard pack location and lazy.nvim install path.

set -eu

# lazy.nvim install path (primary)
CANONICAL="$HOME/.local/share/nvim/lazy/shannon/bin/find-nvim-socket"

# Fallback: standard pack location
if [ ! -x "$CANONICAL" ]; then
  CANONICAL="$HOME/.config/nvim/pack/bundle/opt/shannon/bin/find-nvim-socket"
fi

if [ ! -x "$CANONICAL" ]; then
  echo "error: shannon's find-nvim-socket not found" >&2
  echo "       (the wincent/shannon nvim plugin must be installed)" >&2
  exit 1
fi

exec "$CANONICAL" "$@"
