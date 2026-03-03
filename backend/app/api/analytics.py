"""
Analytics API — stores Socratic dialogue interactions and reflections.

Uses MongoDB (local) via motor (async driver).
Collections:
  - eureka.socratic_interactions  – answer choices, timing, correctness
  - eureka.reflections            – student reflections
"""

import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Lazy MongoDB connection ──────────────────────────────────────────────────
_db = None


def _get_db():
    global _db
    if _db is not None:
        return _db

    try:
        _db = get_db()
        # Quick ping to verify connection
        _db.client.admin.command("ping")
        return _db
    except Exception as exc:
        logger.error("[analytics] MongoDB connection failed: %s", exc)
        return None


# ── Request models ───────────────────────────────────────────────────────────


class SocraticInteraction(BaseModel):
    nodeId: str
    questionId: str
    selectedOption: str
    isCorrect: bool
    timestamp: int


class ReflectionSubmission(BaseModel):
    nodeId: str
    phase: str
    reflection: str
    selectedOption: str | None = None
    timestamp: int


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.post("/socratic")
async def save_socratic_interaction(data: SocraticInteraction) -> dict:
    """Save a Socratic dialogue answer interaction."""
    db = _get_db()
    if db is None:
        # Graceful degradation — don't block the frontend
        return {"status": "skipped", "reason": "database_unavailable"}

    doc = data.model_dump()
    doc["createdAt"] = datetime.now(timezone.utc)

    try:
        result = db["socratic_interactions"].insert_one(doc)
        return {"status": "saved", "id": str(result.inserted_id)}
    except Exception as exc:
        logger.error("Failed to save socratic interaction: %s", exc)
        return {"status": "error", "reason": str(exc)}


@router.post("/reflection")
async def save_reflection(data: ReflectionSubmission) -> dict:
    """Save a student reflection."""
    db = _get_db()
    if db is None:
        return {"status": "skipped", "reason": "database_unavailable"}

    doc = data.model_dump()
    doc["createdAt"] = datetime.now(timezone.utc)

    try:
        result = db["reflections"].insert_one(doc)
        return {"status": "saved", "id": str(result.inserted_id)}
    except Exception as exc:
        logger.error("Failed to save reflection: %s", exc)
        return {"status": "error", "reason": str(exc)}
