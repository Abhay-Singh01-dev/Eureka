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

from app.config import AZURE_SPEECH_API_KEY, AZURE_SPEECH_REGION

logger = logging.getLogger(__name__)

router = APIRouter()

_DEFAULT_VOICE = "en-GB-SoniaNeural"
AUDIO_TTL_HOURS = 72  # Clean up audio files older than this

# ── Simple in-memory rate limiter (per-IP, 120 requests / 60 seconds) ───
_RATE_LIMIT = 120
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
    """Run Azure TTS synchronously with a 15-second watchdog thread."""
    import threading

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

    # ResultFuture.get() accepts NO arguments — wrap in a thread with a watchdog
    result_holder: list[speechsdk.SpeechSynthesisResult] = []
    exc_holder: list[Exception] = []

    def _call():
        try:
            result_holder.append(synthesizer.speak_text_async(text).get())
        except Exception as e:
            exc_holder.append(e)

    t = threading.Thread(target=_call, daemon=True)
    t.start()
    t.join(timeout=15)  # 15-second wall-clock timeout

    if t.is_alive():
        raise RuntimeError("TTS synthesis timed out (15s)")
    if exc_holder:
        raise exc_holder[0]
    if not result_holder:
        raise RuntimeError("TTS synthesis produced no result")

    # Explicitly release the SDK objects so Windows closes the file handle
    # before we return. Without this the file may be 0 bytes when served.
    del synthesizer
    del audio_config
    del speech_config
    import time as _time
    _time.sleep(0.1)  # give the OS a moment to flush

    return result_holder[0]


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

    # Cache hit — only serve if the file has actual content (guard against
    # 0-byte files left behind by previous failed syntheses).
    if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
        return {"audioUrl": audio_url}
    elif os.path.exists(file_path):
        # Stale 0-byte file from a previous failure — remove it and re-synthesise
        try:
            os.remove(file_path)
        except OSError:
            pass

    # ── Synthesise via Azure Neural TTS (non-blocking) ──────────────────
    api_key = AZURE_SPEECH_API_KEY
    region = AZURE_SPEECH_REGION

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

    # Double-check the file actually has content before returning the URL.
    # (Handles edge cases where synthesis "succeeded" but wrote nothing.)
    if os.path.getsize(file_path) == 0:
        try:
            os.remove(file_path)
        except OSError:
            pass
        raise HTTPException(
            status_code=503,
            detail="TTS synthesis produced an empty file.",
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
