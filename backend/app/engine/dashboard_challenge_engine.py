"""
Dashboard Challenge Engine — controlled spontaneous challenge system.

Manages when Eureka should issue spontaneous intellectual challenges,
with annoyance prevention:
  - MAX_CHALLENGES_PER_CONV: hard cap per conversation
  - MIN_GAP_MESSAGES: minimum messages between consecutive challenges
  - Cognitive gates: tolerance, depth, reasoning quality, intent

Extracted from dashboard_orchestrator.py for modularity.
"""

from __future__ import annotations

from typing import Dict


class ChallengeEngine:
    """
    Determines if a spontaneous challenge should be issued.

    Constraints:
      - Maximum challenges per conversation (hard cap)
      - Minimum message gap between challenges (annoyance prevention)
      - Cognitive gates (tolerance, depth, reasoning, intent)
    """

    MAX_CHALLENGES_PER_CONV = 2
    MIN_GAP_MESSAGES = 10

    # Cognitive thresholds
    MIN_TOLERANCE = 0.5
    MIN_DEPTH = 4
    MIN_REASONING_AVG = 0.6

    # Intents that block challenges
    BLOCKING_INTENTS = frozenset({"confusion", "just_tell_me", "meta"})

    @staticmethod
    def should_challenge(
        profile: Dict,
        conv_state: Dict,
        classification: Dict,
        turn_number: int = 0,
    ) -> bool:
        """
        Determine if Eureka should issue a spontaneous challenge.

        All conditions must be met:
          1. Challenge tolerance > MIN_TOLERANCE
          2. Current depth >= MIN_DEPTH
          3. Reasoning score avg >= MIN_REASONING_AVG
          4. Fewer than MAX_CHALLENGES_PER_CONV issued
          5. Not a blocking intent (confusion / just_tell_me / meta)
          6. At least MIN_GAP_MESSAGES since last challenge (annoyance gate)
          7. Engagement signals present (go_deeper or high depth)
        """
        tolerance = profile.get("challenge_tolerance", 0.5)
        depth = conv_state.get("depth_level", 3)
        rq_avg = conv_state.get("reasoning_score_avg", 0.5)
        challenges_so_far = conv_state.get("challenge_issued", 0)
        last_challenge_turn = conv_state.get("last_challenge_turn", 0)
        intent = classification.get("intent", "exploration")
        go_deeper = conv_state.get("go_deeper_count", 0)

        # Gate 1: Tolerance
        if tolerance < ChallengeEngine.MIN_TOLERANCE:
            return False

        # Gate 2: Depth
        if depth < ChallengeEngine.MIN_DEPTH:
            return False

        # Gate 3: Reasoning quality
        if rq_avg < ChallengeEngine.MIN_REASONING_AVG:
            return False

        # Gate 4: Max challenges per conversation
        if challenges_so_far >= ChallengeEngine.MAX_CHALLENGES_PER_CONV:
            return False

        # Gate 5: Blocking intents
        if intent in ChallengeEngine.BLOCKING_INTENTS:
            return False

        # Gate 6: Minimum gap between challenges (annoyance prevention)
        if last_challenge_turn > 0:
            gap = max(0, turn_number - last_challenge_turn)
            if gap < ChallengeEngine.MIN_GAP_MESSAGES:
                return False

        # Gate 7: Engagement signals
        if go_deeper < 1 and depth < 5:
            return False

        return True

    @staticmethod
    def build_challenge_injection() -> str:
        """
        Build the system prompt injection text for a spontaneous challenge.
        """
        return (
            "\n\n[SYSTEM DIRECTIVE — SPONTANEOUS CHALLENGE]\n"
            "The student is performing well. After answering their question, "
            "end your response with a thought-provoking challenge:\n"
            "- A 'what if' scenario that extends their current understanding\n"
            "- A connection to a different domain they might not expect\n"
            "- A prediction question that tests deeper understanding\n"
            "Make it feel natural, not forced. Frame it with curiosity.\n"
        )
