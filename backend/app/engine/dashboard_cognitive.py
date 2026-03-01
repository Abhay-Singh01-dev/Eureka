"""
Dashboard Cognitive Profile — long-term user modelling.

Stores and updates a per-user cognitive profile in MongoDB using
exponential moving average (EMA) to smooth noisy per-message signals.

MongoDB collection: `user_profiles`

Schema:
{
  "user_id":              str,
  "reasoning_style":      "intuitive" | "analytical" | "hybrid",
  "abstraction_comfort":  float 0–1,
  "curiosity_index":      float 0–1,
  "precision_score":      float 0–1,
  "challenge_tolerance":  float 0–1,
  "subject_strength":     { "physics": 0.5, "math": 0.8, … },
  "dominant_topics":      ["AI", "cosmology", …],
  "message_count":        int,
  "created_at":           datetime,
  "updated_at":           datetime,
}

Per-conversation state collection: `dashboard_conv_state`

Schema:
{
  "conversation_id":      str,
  "user_id":              str,
  "depth_level":          int 1–7,
  "reasoning_score_avg":  float 0–1,
  "misconception_count":  int,
  "go_deeper_count":      int,
  "topic_history":        [str],
  "abstraction_mode":     "low" | "medium" | "high",
  "challenge_issued":     int,
  "statement_log":        [{"claim": str, "turn": int}],
  "created_at":           datetime,
  "updated_at":           datetime,
}
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

import os
from pymongo import MongoClient

from app.engine.dashboard_depth_controller import DepthController

# ── MongoDB setup ────────────────────────────────────────────────────────

_MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
_MONGO_DB = os.getenv("MONGO_DB", "eureka")
_client: MongoClient = MongoClient(_MONGO_URI)
_db = _client[_MONGO_DB]
_profiles = _db["user_profiles"]
_conv_state = _db["dashboard_conv_state"]

# ── EMA constant ─────────────────────────────────────────────────────────
# α = 0.1 → very smooth, requires ~10+ messages to shift significantly
# α = 0.2 → moderately responsive
EMA_ALPHA = 0.12


# ══════════════════════════════════════════════════════════════════════════
#  Long-term Cognitive Profile
# ══════════════════════════════════════════════════════════════════════════

DEFAULT_PROFILE = {
    "reasoning_style": "hybrid",
    "abstraction_comfort": 0.5,
    "curiosity_index": 0.5,
    "precision_score": 0.5,
    "challenge_tolerance": 0.5,
    "subject_strength": {},
    "dominant_topics": [],
    "message_count": 0,
}


def get_or_create_profile(user_id: str) -> Dict:
    """
    Load existing profile or create a new one with defaults.
    Always returns a full profile dict.
    """
    if not user_id:
        return {**DEFAULT_PROFILE, "user_id": "anonymous"}

    doc = _profiles.find_one({"user_id": user_id})
    if doc:
        doc.pop("_id", None)
        return doc

    # Create new
    profile = {
        **DEFAULT_PROFILE,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    _profiles.insert_one(profile)
    profile.pop("_id", None)
    return profile


def update_profile_ema(
    user_id: str,
    classification: Dict,
    detected_topic: Optional[str] = None,
) -> Dict:
    """
    Update the long-term profile using exponential moving average.

    classification should contain:
      - reasoning_quality:  float 0–1
      - curiosity_level:    float 0–1
      - abstraction_level:  "low" | "medium" | "high"
      - energy_level:       "low" | "medium" | "high"
      - misconception_detected: bool
      - intent: str

    detected_topic (optional): e.g. "physics", "math", "cs"
    """
    if not user_id:
        return get_or_create_profile(user_id)

    profile = get_or_create_profile(user_id)
    α = EMA_ALPHA

    # ── EMA: Abstraction comfort ──
    abstraction_numeric = {"low": 0.25, "medium": 0.5, "high": 0.85}
    abs_obs = abstraction_numeric.get(
        classification.get("abstraction_level", "medium"), 0.5
    )
    old_abs = profile.get("abstraction_comfort", 0.5)
    new_abs = α * abs_obs + (1 - α) * old_abs

    # ── EMA: Curiosity index ──
    curiosity_obs = classification.get("curiosity_level", 0.5)
    old_curiosity = profile.get("curiosity_index", 0.5)
    new_curiosity = α * curiosity_obs + (1 - α) * old_curiosity

    # ── EMA: Precision score ──
    rq_obs = classification.get("reasoning_quality", 0.5)
    old_precision = profile.get("precision_score", 0.5)
    new_precision = α * rq_obs + (1 - α) * old_precision

    # ── EMA: Challenge tolerance ──
    # High energy + go_deeper/challenge_self → high tolerance
    # Confusion/low energy → lower tolerance
    intent = classification.get("intent", "exploration")
    energy = classification.get("energy_level", "medium")
    challenge_obs = 0.5
    if intent in ("go_deeper", "challenge_self", "deep_theory"):
        challenge_obs = 0.85
    elif intent in ("confusion", "just_tell_me"):
        challenge_obs = 0.2
    elif energy == "high":
        challenge_obs = 0.7
    elif energy == "low":
        challenge_obs = 0.3

    old_challenge = profile.get("challenge_tolerance", 0.5)
    new_challenge = α * challenge_obs + (1 - α) * old_challenge

    # ── Reasoning style (categorical, slower to shift) ──
    # Use a very conservative update — only change after sustained patterns
    msg_count = profile.get("message_count", 0) + 1
    reasoning_style = profile.get("reasoning_style", "hybrid")
    if msg_count >= 10:
        if new_precision > 0.7 and new_abs > 0.65:
            reasoning_style = "analytical"
        elif new_precision < 0.3 and new_abs < 0.35:
            reasoning_style = "intuitive"
        else:
            reasoning_style = "hybrid"

    # ── Subject strength ──
    subject_strength = dict(profile.get("subject_strength", {}))
    if detected_topic:
        topic_key = detected_topic.lower()
        old_subj = subject_strength.get(topic_key, 0.5)
        # Subject strength is inferred from reasoning quality in that topic
        subj_obs = rq_obs
        subject_strength[topic_key] = round(
            α * subj_obs + (1 - α) * old_subj, 3
        )

    # ── Dominant topics ──
    dominant_topics = list(profile.get("dominant_topics", []))
    if detected_topic and detected_topic not in dominant_topics:
        dominant_topics.append(detected_topic)
        # Keep max 20
        if len(dominant_topics) > 20:
            dominant_topics = dominant_topics[-20:]

    # ── Write back ──
    update_doc = {
        "$set": {
            "reasoning_style": reasoning_style,
            "abstraction_comfort": round(new_abs, 4),
            "curiosity_index": round(new_curiosity, 4),
            "precision_score": round(new_precision, 4),
            "challenge_tolerance": round(new_challenge, 4),
            "subject_strength": subject_strength,
            "dominant_topics": dominant_topics,
            "message_count": msg_count,
            "updated_at": datetime.now(timezone.utc),
        }
    }
    _profiles.update_one({"user_id": user_id}, update_doc)

    updated = get_or_create_profile(user_id)
    return updated


def get_profile_dict(user_id: str) -> Dict:
    """Get profile as a plain dict suitable for prompt injection."""
    p = get_or_create_profile(user_id)
    return {
        "reasoning_style": p.get("reasoning_style", "hybrid"),
        "abstraction_comfort": p.get("abstraction_comfort", 0.5),
        "curiosity_index": p.get("curiosity_index", 0.5),
        "precision_score": p.get("precision_score", 0.5),
        "challenge_tolerance": p.get("challenge_tolerance", 0.5),
        "subject_strength": p.get("subject_strength", {}),
        "dominant_topics": p.get("dominant_topics", []),
        "message_count": p.get("message_count", 0),
    }


# ══════════════════════════════════════════════════════════════════════════
#  Per-Conversation State
# ══════════════════════════════════════════════════════════════════════════

DEFAULT_CONV_STATE = {
    "depth_level": 3,          # Start at "competent adult" (level 3 of 7)
    "reasoning_score_avg": 0.5,
    "misconception_count": 0,
    "go_deeper_count": 0,
    "topic_history": [],
    "abstraction_mode": "medium",
    "challenge_issued": 0,
    "last_challenge_turn": 0,
    "energy_level": "medium",
    "statement_log": [],       # For intellectual consistency tracking
}


def get_or_create_conv_state(
    conversation_id: str,
    user_id: str,
    profile: Optional[Dict] = None,
) -> Dict:
    """
    Load existing conversation state or create from profile.
    If a cognitive profile is provided, the initial depth is adjusted:
      - High precision + high abstraction → start at depth 4
      - Low precision → start at depth 2
      - Otherwise → depth 3
    """
    doc = _conv_state.find_one({"conversation_id": conversation_id})
    if doc:
        doc.pop("_id", None)
        return doc

    # Derive initial depth from profile using DepthController
    initial_depth = DepthController.derive_initial_depth(profile) if profile else 3

    state = {
        **DEFAULT_CONV_STATE,
        "depth_level": initial_depth,
        "conversation_id": conversation_id,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    _conv_state.insert_one(state)
    state.pop("_id", None)
    return state


def update_conv_state(
    conversation_id: str,
    classification: Dict,
    detected_topic: Optional[str] = None,
    user_claim: Optional[Dict] = None,
    turn_number: int = 0,
) -> Dict:
    """
    Update per-conversation state based on the latest classification.

    Handles:
      - Depth escalation / de-escalation (via DepthController)
      - Running reasoning score average
      - Misconception + go_deeper counters
      - Topic history
      - Abstraction mode
      - Energy level tracking
      - Statement log for consistency tracking (context-aware)
    """
    state = _conv_state.find_one({"conversation_id": conversation_id})
    if not state:
        return DEFAULT_CONV_STATE

    current_depth = state.get("depth_level", 3)
    misconception = classification.get("misconception_detected", False)
    old_rq_avg = state.get("reasoning_score_avg", 0.5)

    # ── Depth control (delegated to DepthController) ──
    depth, new_rq_avg, go_deeper_delta = DepthController.compute_new_depth(
        current_depth, classification, old_rq_avg,
    )
    go_deeper_count = state.get("go_deeper_count", 0) + go_deeper_delta

    # ── Energy level (from classification) ──
    energy_level = classification.get("energy_level", "medium")

    # ── Misconception count ──
    misconception_count = state.get("misconception_count", 0)
    if misconception:
        misconception_count += 1

    # ── Topic history ──
    topic_history = list(state.get("topic_history", []))
    if detected_topic and (not topic_history or topic_history[-1] != detected_topic):
        topic_history.append(detected_topic)
        # Keep max 30
        if len(topic_history) > 30:
            topic_history = topic_history[-30:]

    # ── Abstraction mode (follows current depth mostly) ──
    if depth >= 5:
        abstraction_mode = "high"
    elif depth >= 3:
        abstraction_mode = "medium"
    else:
        abstraction_mode = "low"

    # ── Statement log (context-aware consistency tracking) ──
    statement_log = list(state.get("statement_log", []))
    if user_claim:
        if isinstance(user_claim, dict):
            entry = {
                "claim": user_claim.get("claim", "")[:300],
                "turn": turn_number,
                "domain": user_claim.get("domain", "general"),
                "context_tags": user_claim.get("context_tags", []),
            }
        else:
            # Backward compatibility: plain string claim
            entry = {"claim": str(user_claim)[:300], "turn": turn_number}
        statement_log.append(entry)
        # Keep max 20 most recent
        if len(statement_log) > 20:
            statement_log = statement_log[-20:]

    # ── Challenge tracking ──
    challenge_issued = state.get("challenge_issued", 0)

    # ── Write ──
    update_doc = {
        "$set": {
            "depth_level": depth,
            "reasoning_score_avg": round(new_rq_avg, 4),
            "misconception_count": misconception_count,
            "go_deeper_count": go_deeper_count,
            "topic_history": topic_history,
            "abstraction_mode": abstraction_mode,
            "challenge_issued": challenge_issued,
            "energy_level": energy_level,
            "statement_log": statement_log,
            "updated_at": datetime.now(timezone.utc),
        }
    }
    _conv_state.update_one({"conversation_id": conversation_id}, update_doc)

    updated = _conv_state.find_one({"conversation_id": conversation_id})
    if updated:
        updated.pop("_id", None)
    return updated or DEFAULT_CONV_STATE


def increment_challenge_count(
    conversation_id: str,
    turn_number: int = 0,
) -> None:
    """Track that a spontaneous challenge was issued, with turn number for gap tracking."""
    _conv_state.update_one(
        {"conversation_id": conversation_id},
        {
            "$inc": {"challenge_issued": 1},
            "$set": {
                "last_challenge_turn": turn_number,
                "updated_at": datetime.now(timezone.utc),
            },
        },
    )


def get_conv_state_dict(conversation_id: str) -> Dict:
    """Get conversation state as a plain dict suitable for prompt injection."""
    doc = _conv_state.find_one({"conversation_id": conversation_id})
    if not doc:
        return DEFAULT_CONV_STATE
    doc.pop("_id", None)
    doc.pop("created_at", None)
    doc.pop("updated_at", None)
    doc.pop("user_id", None)
    doc.pop("conversation_id", None)
    return doc


# NOTE: extract_claims() has been moved to dashboard_consistency_tracker.py
# as ConsistencyTracker.extract_claim() with enhanced domain + context tagging.
# Import from there for new code.
