# Eureka – Manim Video Pipeline

Generate the silent animated videos, burn subtitles, and synthesise
Azure Neural TTS narration for the Eureka learning platform.

## Quick-start

```bash
# 1. Create & activate a virtual-env
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS / Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Render the silent video  (requires Manim + FFmpeg)
bash scripts/render.sh
#  → output/what-is-motion-silent.mp4

# 4. Burn subtitles for each language  (requires FFmpeg)
python scripts/burn_subtitles.py
#  → output/what-is-motion-en.mp4
#  → output/what-is-motion-hi.mp4
#  → output/what-is-motion-sw.mp4

# 5. Generate Azure TTS narration
#    Set AZURE_SPEECH_API_KEY and AZURE_SPEECH_REGION first
python scripts/generate_narration.py
#  → output/audio/what-is-motion-en.mp3
#  → output/audio/what-is-motion-hi.mp3
#  → output/audio/what-is-motion-sw.mp3

# 6. Copy outputs into the Eureka frontend /public tree
#    (video files → public/videos/motion/  audio files → public/audio/motion/)
```

## Directory layout

```
eureka-manim/
├── what_is_motion.py          # Manim scene (6 scenes, 3 min)
├── manim.cfg                  # 1920×1080 @ 60 fps, #1e1b4b bg
├── requirements.txt
├── subtitles/
│   └── what-is-motion-en.srt  # English subtitles
├── narration/
│   └── what-is-motion-script.json   # Scene-by-scene narration text
├── scripts/
│   ├── render.sh              # Render silent mp4
│   ├── burn_subtitles.py      # FFmpeg subtitle burn-in
│   └── generate_narration.py  # Azure TTS → mp3
└── output/                    # (generated, git-ignored)
```

## Adding a new language

1. Translate `subtitles/what-is-motion-en.srt` → `what-is-motion-XX.srt`.
2. Translate `narration/what-is-motion-script.json` scene texts.
3. Add the voice mapping in `scripts/generate_narration.py` under `VOICES`.
4. Re-run `burn_subtitles.py` and `generate_narration.py`.
