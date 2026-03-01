#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────
# Render the "What is Motion?" silent video
#   Output: 1920×1080 @ 60 fps, no audio
# ──────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "▸ Rendering What-is-Motion scene …"
manim -qh --format=mp4 --media_dir=./output what_is_motion.py WhatIsMotion

SRC="./output/videos/1080p60/WhatIsMotion.mp4"
DEST="./output/what-is-motion-silent.mp4"

if [ -f "$SRC" ]; then
  cp "$SRC" "$DEST"
  echo "✔ Render complete → $DEST"
else
  echo "⚠  Expected output not found at $SRC"
  echo "   Check the Manim media_dir structure."
  exit 1
fi
