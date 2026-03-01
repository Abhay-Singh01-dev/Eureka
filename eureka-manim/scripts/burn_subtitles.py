"""
Burn SRT subtitles permanently into a silent video using FFmpeg.

Usage
-----
    python scripts/burn_subtitles.py

Requires FFmpeg on PATH.
"""

import os
import subprocess
import sys

SUBTITLE_STYLE = (
    "FontName=Inter,"
    "FontSize=28,"
    "PrimaryColour=&HFFFFFF&,"
    "OutlineColour=&H000000&,"
    "Outline=2,"
    "Shadow=1,"
    "MarginV=60"
)

LANGUAGES = {
    "en": "subtitles/what-is-motion-en-v2.srt",
    "hi": "subtitles/what-is-motion-hi.srt",
    "sw": "subtitles/what-is-motion-sw.srt",
}


def burn(video_in: str, srt_path: str, video_out: str, lang: str) -> None:
    cmd = [
        "ffmpeg", "-y",
        "-i", video_in,
        "-vf", f"subtitles={srt_path}:force_style='{SUBTITLE_STYLE}'",
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "slow",
        "-an",          # no audio track
        video_out,
    ]
    print(f"  [{lang}] burning subtitles...")
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"  [{lang}] OK {video_out}")


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)

    src = "output/what-is-motion-silent.mp4"
    if not os.path.isfile(src):
        print(f"ERROR: Source video not found: {src}")
        print("  Run  scripts/render.sh  first.")
        sys.exit(1)

    os.makedirs("output", exist_ok=True)

    for lang, srt in LANGUAGES.items():
        if not os.path.isfile(srt):
            print(f"  [{lang}] WARNING: {srt} not found - skipping")
            continue
        out = f"output/what-is-motion-{lang}.mp4"
        burn(src, srt, out, lang)


if __name__ == "__main__":
    main()
