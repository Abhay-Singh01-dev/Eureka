"""
Intent Classifier — classifies student intent from their message.

Used by the Teaching Orchestrator to route responses.
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Dict


class IntentType(str, Enum):
    CLARIFICATION = "clarification"
    INTUITION = "intuition"
    DEEP_THEORY = "deep_theory"
    APPLICATION = "application"
    CONFUSION = "confusion"
    VISUAL_REQUEST = "visual_request"
    ASSESSMENT = "assessment"
    EXPLORATION = "exploration"
    GO_DEEPER = "go_deeper"
    JUST_TELL_ME = "just_tell_me"


# Ordered by specificity — first match wins
_PATTERNS: dict[IntentType, list[str]] = {
    IntentType.JUST_TELL_ME: [
        r"just tell me",
        r"just explain",
        r"just show",
        r"skip",
        r"give me the answer",
        r"stop asking",
    ],
    IntentType.VISUAL_REQUEST: [
        r"show me",
        r"visualize",
        r"visualise",
        r"diagram",
        r"draw",
        r"picture",
        r"can you show",
        r"image",
        r"see it",
        r"illustration",
    ],
    IntentType.ASSESSMENT: [
        r"test me",
        r"quiz",
        r"check my understanding",
        r"question me",
        r"assess",
    ],
    IntentType.GO_DEEPER: [
        r"go deeper",
        r"more depth",
        r"elaborate",
        r"tell me more",
        r"expand on",
        r"dig deeper",
        r"deeper dive",
        r"in more detail",
    ],
    IntentType.DEEP_THEORY: [
        r"mathematically",
        r"derive",
        r"proof",
        r"formally",
        r"theoretically",
        r"in detail",
        r"equation",
        r"formula",
    ],
    IntentType.INTUITION: [
        r"intuition",
        r"intuitively",
        r"make sense of",
        r"help me understand",
        r"in simple terms",
        r"eli5",
        r"explain like",
    ],
    IntentType.APPLICATION: [
        r"real world",
        r"real life",
        r"example",
        r"where is this used",
        r"practical",
        r"in daily life",
        r"application",
    ],
    IntentType.CONFUSION: [
        r"confused",
        r"don't get",
        r"don't understand",
        r"not sure",
        r"help me",
        r"lost",
        r"stuck",
        r"makes no sense",
    ],
    IntentType.CLARIFICATION: [
        r"why does",
        r"why doesn't",
        r"how does",
        r"what causes",
        r"explain why",
        r"what is",
        r"what are",
    ],
}

# Physics terminology for quality scoring
_PHYSICS_TERMS: list[str] = [
    "velocity", "acceleration", "reference frame", "inertia",
    "momentum", "force", "vector", "component", "magnitude",
    "direction", "coordinate", "relativity", "displacement",
    "kinetic", "potential", "newton", "friction", "gravity",
    "mass", "weight", "energy", "work", "torque",
]

# Reasoning indicators
_REASONING_INDICATORS: list[str] = [
    "because", "since", "therefore", "so", "this means",
    "which implies", "as a result", "due to", "if then",
    "leads to", "follows that",
]


def classify_intent(user_message: str) -> IntentType:
    """Classify user intent from their message text."""
    msg = user_message.lower()

    for intent_type, patterns in _PATTERNS.items():
        for pattern in patterns:
            if re.search(r'\b' + pattern + r'\b', msg):
                return intent_type

    # Fallback: question → clarification, otherwise exploration
    if "?" in user_message:
        return IntentType.CLARIFICATION

    return IntentType.EXPLORATION


def analyse_response_quality(user_message: str) -> Dict:
    """
    Analyse a student's message to gauge reasoning quality.
    Used for depth adaptation.
    """
    msg_lower = user_message.lower()
    words = user_message.split()
    word_count = len(words)

    term_count = sum(1 for t in _PHYSICS_TERMS if t in msg_lower)
    reasoning_count = sum(1 for r in _REASONING_INDICATORS if r in msg_lower)

    quality_score = min(1.0, (
        (min(word_count, 100) / 100) * 0.3
        + (min(term_count, 5) / 5) * 0.4
        + (min(reasoning_count, 3) / 3) * 0.3
    ))

    if term_count >= 3:
        complexity = "advanced"
    elif term_count >= 1:
        complexity = "medium"
    else:
        complexity = "basic"

    return {
        "quality_score": round(quality_score, 2),
        "word_count": word_count,
        "terminology_count": term_count,
        "reasoning_indicators": reasoning_count,
        "complexity": complexity,
    }
