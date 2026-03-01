# pyright: reportMissingImports=false
"""
POST /api/tts/generate
  Body:  { "text": "...", "voice": "en-GB-SoniaNeural" }
  Returns: { "audioUrl": "/static/audio/<md5>.mp3" }

Audio files are cached on disk by MD5 hash of (text + voice), so identical
requests are served instantly without re-calling Azure on repeated loads.
Old audio files are cleaned up after AUDIO_TTL_HOURS hours.
"""

import asyncio
import hashlib
import logging
import os
import time
from collections import defaultdict

import azure.cognitiveservices.speech as speechsdk
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

_DEFAULT_VOICE = "en-GB-SoniaNeural"
AUDIO_TTL_HOURS = 72  # Clean up audio files older than this

# ── Simple in-memory rate limiter (per-IP, 30 requests / 60 seconds) ───
_RATE_LIMIT = 30
_RATE_WINDOW = 60  # seconds
_rate_buckets: dict[str, list[float]] = defaultdict(list)


def _check_rate_limit(client_ip: str) -> bool:
    """Return True if the request is allowed, False if rate-limited."""
    now = time.time()
    bucket = _rate_buckets[client_ip]
    # Prune old entries
    _rate_buckets[client_ip] = [t for t in bucket if now - t < _RATE_WINDOW]
    if len(_rate_buckets[client_ip]) >= _RATE_LIMIT:
        return False
    _rate_buckets[client_ip].append(now)
    return True


# ── Audio file cleanup ─────────────────────────────────────────────────
_last_cleanup = 0.0
_CLEANUP_INTERVAL = 3600  # Check once per hour


def _cleanup_old_audio():
    """Remove audio files older than AUDIO_TTL_HOURS."""
    global _last_cleanup
    now = time.time()
    if now - _last_cleanup < _CLEANUP_INTERVAL:
        return
    _last_cleanup = now

    audio_dir = os.path.join("app", "static", "audio")
    if not os.path.isdir(audio_dir):
        return

    ttl_seconds = AUDIO_TTL_HOURS * 3600
    removed = 0
    for fname in os.listdir(audio_dir):
        fpath = os.path.join(audio_dir, fname)
        try:
            if os.path.isfile(fpath) and (now - os.path.getmtime(fpath)) > ttl_seconds:
                os.remove(fpath)
                removed += 1
        except OSError:
            pass
    if removed:
        logger.info(f"[tts] Cleaned up {removed} old audio file(s)")


class TTSRequest(BaseModel):
    text: str
    voice: str = _DEFAULT_VOICE


def _synthesise(file_path: str, text: str, voice: str, api_key: str, region: str) -> speechsdk.SpeechSynthesisResult:
    """Run Azure TTS synchronously with a 10-second timeout."""
    import concurrent.futures

    speech_config = speechsdk.SpeechConfig(subscription=api_key, region=region)
    speech_config.speech_synthesis_voice_name = voice
    speech_config.set_speech_synthesis_output_format(
        speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3
    )

    audio_config = speechsdk.audio.AudioOutputConfig(filename=file_path)
    synthesizer = speechsdk.SpeechSynthesizer(
        speech_config=speech_config,
        audio_config=audio_config,
    )

    future = synthesizer.speak_text_async(text)
    try:
        return future.get(timeout=10000)  # 10 second timeout (ms)
    except Exception as e:
        logger.error(f"[tts] Synthesis timed out or failed: {e}")
        raise RuntimeError("TTS synthesis timed out") from e


@router.post("/generate")
async def generate_tts(request: TTSRequest, req: Request) -> dict[str, str]:
    # ── Rate-limit check ────────────────────────────────────────────────
    client_ip = req.client.host if req.client else "unknown"
    if not _check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Too many TTS requests. Please wait a moment.",
        )

    # ── Periodic cleanup of old audio files ─────────────────────────────
    _cleanup_old_audio()

    voice = request.voice or _DEFAULT_VOICE

    # ── Cache lookup (keyed on text + voice) ────────────────────────────
    cache_key = hashlib.md5(
        f"{voice}::{request.text}".encode("utf-8")
    ).hexdigest()
    file_name = f"{cache_key}.mp3"
    file_path = os.path.join("app", "static", "audio", file_name)
    audio_url = f"/static/audio/{file_name}"

    if os.path.exists(file_path):
        return {"audioUrl": audio_url}

    # ── Synthesise via Azure Neural TTS (non-blocking) ──────────────────
    api_key = os.getenv("AZURE_SPEECH_API_KEY")
    region = os.getenv("AZURE_SPEECH_REGION")

    if not api_key or not region:
        raise HTTPException(
            status_code=503,
            detail="Azure Speech credentials not configured. "
            "Set AZURE_SPEECH_API_KEY and AZURE_SPEECH_REGION in backend/.env",
        )

    try:
        result = await asyncio.to_thread(
            _synthesise, file_path, request.text, voice, api_key, region
        )
    except Exception as e:
        logger.error(f"[tts] Synthesis exception: {e}")
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
        raise HTTPException(
            status_code=503,
            detail="TTS synthesis timed out or failed. Use browser fallback.",
        )

    if result.reason != speechsdk.ResultReason.SynthesizingAudioCompleted:
        # Clean up any partial file to avoid serving corrupt audio.
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass
        cancel = result.cancellation_details
        logger.error(f"[tts] Synthesis failed: reason={result.reason}, "
                     f"cancel_reason={cancel.reason if cancel else 'N/A'}, "
                     f"error={cancel.error_details if cancel else 'N/A'}")
        raise HTTPException(
            status_code=503,
            detail=f"Azure TTS failed: {result.reason}. Use browser fallback.",
        )

    return {"audioUrl": audio_url}
