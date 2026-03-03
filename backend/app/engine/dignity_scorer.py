"""
Dignity Scorer — Telemetry & judge metric for psychological safety.

Scores responses 0.0–1.0 for psychological safety.
Used for analytics dashboard, not user-visible.

Does NOT modify responses — purely observational.
"""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from app.database import get_db


# ── Scorer ────────────────────────────────────────────────────────────────

class DignityScorer:
    """
    Scores responses 0.0–1.0 for psychological safety.
    Used for analytics, not user-visible.
    """

    BANNED_INDICATORS = [
        "simply",
        "obviously",
        "clearly",
        "it's easy",
        "it is easy",
        "basic",
        "trivial",
        "as you should know",
        "that's wrong",
        "you're wrong",
    ]

    VALIDATION_INDICATORS = [
        "let's explore",
        "that's a natural way to think",
        "confusion here is normal",
        "let's slow down",
        "you're on the right track",
        "let's figure this out",
        "let's work through",
        "that's a thoughtful",
        "good instinct",
        "let's look at this together",
        "let's take it step by step",
        "does this version make more sense",
        "every question",
    ]

    def score(self, text: str) -> float:
        """
        Score a response for psychological safety.
        1.0 = perfectly safe, 0.0 = highly condescending.
        """
        score = 1.0
        lower = text.lower()

        # Penalize banned indicators
        for banned in self.BANNED_INDICATORS:
            if banned in lower:
                score -= 0.15

        # Reward validation indicators
        for positive in self.VALIDATION_INDICATORS:
            if positive in lower:
                score += 0.05

        # Reward gentle questioning (signals Socratic, non-lecture approach)
        question_count = text.count("?")
        score += min(0.15, question_count * 0.03)

        return max(0.0, min(1.0, round(score, 3)))


# ── Persistence ───────────────────────────────────────────────────────────


def _db():
    return get_db()


def log_dignity_score(
    conversation_id: str,
    user_id: str,
    text: str,
    dignity_score: float,
    depth_level: int,
    intent: str = "",
    confusion_fastpath: bool = False,
) -> None:
    """
    Log a dignity score to the dashboard_dignity_logs collection.
    Additive — does not modify existing collections.
    """
    _db()["dashboard_dignity_logs"].insert_one({
        "conversation_id": conversation_id,
        "user_id": user_id,
        "dignity_score": dignity_score,
        "depth_level": depth_level,
        "intent": intent,
        "confusion_fastpath": confusion_fastpath,
        "text_length": len(text),
        "timestamp": time.time(),
    })


def get_dignity_metrics(user_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Aggregate dignity metrics for admin dashboard.

    Returns:
      median_dignity_score, below_threshold_percent,
      confusion_fastpath_trigger_rate, total_responses
    """
    col = _db()["dashboard_dignity_logs"]

    query = {}
    if user_id:
        query["user_id"] = user_id

    docs = list(col.find(query, {"dignity_score": 1, "confusion_fastpath": 1, "_id": 0}))

    if not docs:
        return {
            "median_dignity_score": None,
            "below_threshold_percent": 0.0,
            "confusion_fastpath_trigger_rate": 0.0,
            "total_responses": 0,
        }

    scores = sorted(d["dignity_score"] for d in docs)
    n = len(scores)

    # Median
    if n % 2 == 1:
        median = scores[n // 2]
    else:
        median = (scores[n // 2 - 1] + scores[n // 2]) / 2

    # Below threshold (< 0.7)
    below = sum(1 for s in scores if s < 0.7)
    below_pct = round(100 * below / n, 1)

    # Confusion fast-path trigger rate
    confusion_count = sum(1 for d in docs if d.get("confusion_fastpath", False))
    confusion_pct = round(100 * confusion_count / n, 1)

    return {
        "median_dignity_score": round(median, 3),
        "below_threshold_percent": below_pct,
        "confusion_fastpath_trigger_rate": confusion_pct,
        "total_responses": n,
    }


# Module-level singleton
dignity_scorer = DignityScorer()
