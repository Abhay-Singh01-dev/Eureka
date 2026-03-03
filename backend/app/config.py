"""
Centralised configuration — single source of truth for all settings.

All environment variables are read here and exposed as module-level
constants.  Engine / API modules import from ``app.config`` instead of
calling ``os.getenv()`` directly.

Usage:
    from app.config import MONGO_URI, MONGO_DB, AZURE_OPENAI_ENDPOINT
"""

from __future__ import annotations

import os

# ── MongoDB ───────────────────────────────────────────────────────────────

MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB: str = os.getenv("MONGO_DB", "eureka")

# ── Azure OpenAI (GPT) ───────────────────────────────────────────────────

AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")

# ── Azure Speech (TTS / STT) ─────────────────────────────────────────────

AZURE_SPEECH_API_KEY: str = os.getenv("AZURE_SPEECH_API_KEY", "")
AZURE_SPEECH_REGION: str = os.getenv("AZURE_SPEECH_REGION", "eastus")

# ── Google AI (Imagen / Veo) ─────────────────────────────────────────────

GOOGLE_AI_KEY: str = os.getenv("GOOGLE_AI_KEY", "")

# ── CORS ──────────────────────────────────────────────────────────────────
# Comma-separated origins, e.g. "http://localhost:5173,https://eureka.example.com"

ALLOWED_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:4173",
    ).split(",")
    if o.strip()
]
