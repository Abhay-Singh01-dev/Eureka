# pyright: reportMissingImports=false
"""
Generate scene-by-scene narration with duration matching.

For each scene:
  1. Synthesise TTS → temp WAV
  2. Measure actual duration
  3. If shorter than target  → pad with silence
  4. If longer  than target  → speed up prosody (max 1.10×)
  5. Concatenate all scenes  → final language MP3
  6. Write timing manifest   → scene-timings.json

Usage
-----
    cd eureka-manim
    .venv\\Scripts\\python.exe scripts/generate_narration_v2.py

Requires:
    pip install azure-cognitiveservices-speech pydub
    FFmpeg on PATH (pydub needs it)
"""

import json
import math
import os
import struct
import sys
import wave
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

try:
    import azure.cognitiveservices.speech as speechsdk
except ImportError:
    print("✖ azure-cognitiveservices-speech not installed.")
    sys.exit(1)

try:
    from pydub import AudioSegment
except ImportError:
    print("✖ pydub not installed.  pip install pydub")
    sys.exit(1)


# ── config ────────────────────────────────────────────────
VOICES = {
    "en": "en-GB-SoniaNeural",
    "hi": "hi-IN-SwaraNeural",
    "sw": "sw-KE-ZuriNeural",
}

# Max absolute speaking rate to allow (1.25 = natural upper bound)
MAX_ABS_RATE = 1.25
# Min absolute speaking rate
MIN_ABS_RATE = 0.75
# Default speaking rate
BASE_RATE = 0.95

SCRIPT_FILE = "narration/what-is-motion-script-v2.json"
OUTPUT_DIR  = "output/audio"
TEMP_DIR    = "output/audio/_temp"


def _synth_scene_wav(
    scene_text: str,
    voice: str,
    lang: str,
    rate: float,
    out_wav: str,
    api_key: str,
    region: str,
) -> bool:
    """Synthesise one scene's text → WAV file.  Returns True on success."""
    cfg = speechsdk.SpeechConfig(subscription=api_key, region=region)
    cfg.speech_synthesis_voice_name = voice
    # Use WAV output for precise duration measurement
    cfg.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Riff24Khz16BitMonoPcm
    )

    rate_pct = int(round((rate - 1.0) * 100))
    rate_str = f"{rate_pct:+d}%"

    ssml = (
        f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        f'xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="{lang}">'
        f'<voice name="{voice}">'
        f'<prosody rate="{rate_str}" pitch="+0%">'
        f'{scene_text}'
        f'</prosody></voice></speak>'
    )

    audio_cfg = speechsdk.audio.AudioOutputConfig(filename=out_wav)
    synth = speechsdk.SpeechSynthesizer(speech_config=cfg, audio_config=audio_cfg)

    result = synth.speak_ssml_async(ssml).get()
    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        return True

    err = result.cancellation_details if hasattr(result, "cancellation_details") else result.reason
    print(f"    ✖ Synthesis failed: {err}")
    return False


def _wav_duration_s(wav_path: str) -> float:
    """Get exact duration of a WAV file in seconds."""
    seg = AudioSegment.from_wav(wav_path)
    return len(seg) / 1000.0


def _pad_or_trim(wav_path: str, target_s: float, out_path: str) -> float:
    """
    Pad with silence (if short) or trim (if longer than target + 0.5 s).
    Returns actual output duration.
    """
    seg = AudioSegment.from_wav(wav_path)
    actual_ms = len(seg)
    target_ms = int(target_s * 1000)

    if actual_ms < target_ms:
        # Add silence at the end
        silence = AudioSegment.silent(duration=target_ms - actual_ms, frame_rate=seg.frame_rate)
        result = seg + silence
    elif actual_ms > target_ms + 500:
        # Trim (shouldn't happen often since we adjust rate)
        result = seg[:target_ms]
    else:
        result = seg

    result.export(out_path, format="wav")
    return len(result) / 1000.0


def generate_language(script: dict, lang: str, api_key: str, region: str) -> str | None:
    """Generate the full narration MP3 for one language."""
    voice = VOICES.get(lang, VOICES["en"])
    scenes = script["scenes"]
    temp_dir = Path(TEMP_DIR) / lang
    temp_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n  [{lang}] Generating with voice: {voice}")
    print(f"  [{lang}] Scenes: {len(scenes)}")

    scene_segments = []
    timing_data = []

    for scene in scenes:
        sid = scene["id"]
        target_dur = scene["duration"]
        text = scene["text"]
        print(f"\n    [{sid}] target={target_dur}s, text={len(text)} chars")

        # ── Pass 1: Generate at base rate ──────────────
        temp_wav = str(temp_dir / f"{sid}_raw.wav")
        ok = _synth_scene_wav(text, voice, lang, BASE_RATE, temp_wav, api_key, region)
        if not ok:
            print(f"    [{sid}] ✖ Failed — aborting language {lang}")
            return None

        actual = _wav_duration_s(temp_wav)
        print(f"    [{sid}] raw duration: {actual:.1f}s  (target: {target_dur}s)")

        # ── Decide if we need rate adjustment ──────────
        ratio = actual / target_dur

        if ratio > 1.05:
            # Audio too long → speed up proportionally
            # If raw was 40s and target is 30s, we need 33% faster → rate 0.95*1.33=1.27
            needed_rate = BASE_RATE * ratio
            adj_rate = min(needed_rate, MAX_ABS_RATE)
            print(f"    [{sid}] too long (ratio {ratio:.2f}) — re-generating at rate {adj_rate:.2f}")

            temp_wav2 = str(temp_dir / f"{sid}_adj.wav")
            ok = _synth_scene_wav(text, voice, lang, adj_rate, temp_wav2, api_key, region)
            if ok:
                temp_wav = temp_wav2
                actual = _wav_duration_s(temp_wav)
                print(f"    [{sid}] adjusted duration: {actual:.1f}s")

                # If still too long after max rate, try one more time at max
                if actual > target_dur * 1.1 and adj_rate < MAX_ABS_RATE:
                    print(f"    [{sid}] still too long — retrying at max rate {MAX_ABS_RATE}")
                    temp_wav3 = str(temp_dir / f"{sid}_adj2.wav")
                    ok2 = _synth_scene_wav(text, voice, lang, MAX_ABS_RATE, temp_wav3, api_key, region)
                    if ok2:
                        temp_wav = temp_wav3
                        actual = _wav_duration_s(temp_wav)
                        print(f"    [{sid}] final adjusted duration: {actual:.1f}s")

        elif ratio < 0.80:
            # Audio too short → slow down
            needed_rate = BASE_RATE * ratio
            adj_rate = max(needed_rate, MIN_ABS_RATE)
            print(f"    [{sid}] too short (ratio {ratio:.2f}) — re-generating at rate {adj_rate:.2f}")

            temp_wav2 = str(temp_dir / f"{sid}_adj.wav")
            ok = _synth_scene_wav(text, voice, lang, adj_rate, temp_wav2, api_key, region)
            if ok:
                temp_wav = temp_wav2
                actual = _wav_duration_s(temp_wav)
                print(f"    [{sid}] adjusted duration: {actual:.1f}s")

        # ── Pad/trim to exact target ───────────────────
        padded_wav = str(temp_dir / f"{sid}_final.wav")
        final_dur = _pad_or_trim(temp_wav, target_dur, padded_wav)
        print(f"    [{sid}] final duration: {final_dur:.1f}s ✔")

        scene_segments.append(padded_wav)
        timing_data.append({
            "sceneId": sid,
            "startTime": scene["startTime"],
            "endTime": scene["endTime"],
            "targetDuration": target_dur,
            "actualSpeechDuration": round(actual, 2),
            "finalDuration": round(final_dur, 2),
        })

    # ── Concatenate all scenes → one MP3 ──────────────
    print(f"\n  [{lang}] Concatenating {len(scene_segments)} scenes...")
    combined = AudioSegment.empty()
    for wav_path in scene_segments:
        seg = AudioSegment.from_wav(wav_path)
        combined += seg

    total_dur = len(combined) / 1000.0
    print(f"  [{lang}] Total duration: {total_dur:.1f}s (target: 180s)")

    out_mp3 = os.path.join(OUTPUT_DIR, f"what-is-motion-{lang}.mp3")
    combined.export(out_mp3, format="mp3", bitrate="48k")
    print(f"  [{lang}] ✔ {out_mp3} ({os.path.getsize(out_mp3) / 1024:.0f} KB)")

    # ── Write timing manifest ─────────────────────────
    manifest_path = os.path.join(OUTPUT_DIR, f"scene-timings-{lang}.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({
            "language": lang,
            "voice": voice,
            "totalDuration": round(total_dur, 2),
            "scenes": timing_data,
        }, f, indent=2)
    print(f"  [{lang}] ✔ timing manifest: {manifest_path}")

    return out_mp3


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)

    api_key = os.getenv("AZURE_SPEECH_API_KEY")
    region  = os.getenv("AZURE_SPEECH_REGION")
    if not api_key or not region:
        print("✖ AZURE_SPEECH_API_KEY / AZURE_SPEECH_REGION not set.")
        print("  Create a .env file or export them.")
        sys.exit(1)

    with open(SCRIPT_FILE, "r", encoding="utf-8") as f:
        script = json.load(f)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Only generate requested languages (default: just English)
    langs = sys.argv[1:] if len(sys.argv) > 1 else ["en"]
    for lang in langs:
        if lang not in VOICES:
            print(f"✖ Unknown language: {lang}")
            continue
        generate_language(script, lang, api_key, region)

    print("\n✔ Done!")


if __name__ == "__main__":
    main()
