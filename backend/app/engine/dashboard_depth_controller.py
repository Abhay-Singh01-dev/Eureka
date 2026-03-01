"""
Dashboard Depth Controller — modular depth computation.

Extracts depth escalation / de-escalation logic into a clean,
testable module.  Depth ranges from 1 (surface) to 7 (theoretical
unification).

Escalation rules:
  - "go_deeper" intent → always +1
  - "deep_theory" intent with reasoning quality ≥ 0.4 → +1
  - Sustained high reasoning (avg > 0.75, depth < 5) → +1 (natural drift)

De-escalation rules:
  - "confusion" / "just_tell_me" → −1
  - "intuition" when depth > 3 → −1 (towards simpler)

Clamped to [1, 7] always.
"""

from __future__ import annotations

from typing import Dict, Tuple


class DepthController:
    """Computes new depth level based on classification signals."""

    MIN_DEPTH = 1
    MAX_DEPTH = 7

    # Reasoning-quality thresholds
    ESCALATION_RQ_THRESHOLD = 0.4
    NATURAL_DRIFT_RQ_THRESHOLD = 0.75
    NATURAL_DRIFT_MAX_DEPTH = 5

    # EMA for conversation-level reasoning score (faster than profile EMA)
    REASONING_EMA_ALPHA = 0.3

    @staticmethod
    def compute_new_depth(
        current_depth: int,
        classification: Dict,
        reasoning_score_avg: float = 0.5,
    ) -> Tuple[int, float, int]:
        """
        Compute the new depth level and updated reasoning average.

        Returns:
            (new_depth, new_reasoning_avg, go_deeper_delta)
            go_deeper_delta: 1 if go_deeper was requested, else 0
        """
        intent = classification.get("intent", "exploration")
        rq = classification.get("reasoning_quality", 0.5)

        depth = current_depth
        go_deeper_delta = 0

        # ── Escalation ──
        if intent in ("go_deeper", "deep_theory"):
            if intent == "go_deeper":
                # User explicitly asked — always escalate
                go_deeper_delta = 1
                depth = min(DepthController.MAX_DEPTH, depth + 1)
            elif rq >= DepthController.ESCALATION_RQ_THRESHOLD:
                # deep_theory needs sufficient reasoning quality
                go_deeper_delta = 1
                depth = min(DepthController.MAX_DEPTH, depth + 1)

        # ── De-escalation ──
        if intent in ("confusion", "just_tell_me"):
            depth = max(DepthController.MIN_DEPTH, depth - 1)
        elif intent == "intuition" and depth > 3:
            depth = max(3, depth - 1)

        # ── Natural drift (sustained high reasoning) ──
        α = DepthController.REASONING_EMA_ALPHA
        new_rq_avg = α * rq + (1 - α) * reasoning_score_avg

        if (
            new_rq_avg > DepthController.NATURAL_DRIFT_RQ_THRESHOLD
            and depth < DepthController.NATURAL_DRIFT_MAX_DEPTH
            and intent not in ("confusion", "just_tell_me", "intuition")
        ):
            depth = min(DepthController.MAX_DEPTH, depth + 1)

        # ── Final clamp ──
        depth = max(DepthController.MIN_DEPTH, min(DepthController.MAX_DEPTH, depth))

        return depth, round(new_rq_avg, 4), go_deeper_delta

    @staticmethod
    def derive_initial_depth(profile: Dict) -> int:
        """
        Derive the starting conversation depth from a cognitive profile.

        - High precision + abstraction → start at depth 4
        - Low precision → start at depth 2
        - Default → depth 3
        """
        precision = profile.get("precision_score", 0.5)
        abstraction = profile.get("abstraction_comfort", 0.5)

        if precision > 0.65 and abstraction > 0.6:
            return 4
        elif precision < 0.35:
            return 2
        return 3
