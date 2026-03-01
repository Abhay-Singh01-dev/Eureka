"""
Confusion Fast-Path Handler — dignity-first confusion response.

When a student expresses confusion, this handler:
  1. Detects confusion signals in the user's message
  2. Bypasses heavy cognitive engines (ChallengeEngine, deep scaffold, Socratic pressure)
  3. Forces simplest-possible explanation mode

Integration: called in the orchestrator BEFORE the full cognitive pipeline.

Does NOT modify:
  - DepthController
  - ChallengeEngine
  - ConsistencyTracker
  - RAG
  - Streaming pipeline
  - Database schema
"""

from __future__ import annotations

import re
from typing import List


# ── Confusion Signals ─────────────────────────────────────────────────────

CONFUSION_SIGNALS: List[str] = [
    "i don't understand",
    "i dont understand",
    "i'm confused",
    "im confused",
    "this doesn't make sense",
    "this doesnt make sense",
    "i still don't get it",
    "i still dont get it",
    "i'm lost",
    "im lost",
    "what does that mean",
    "can you explain again",
    "i'm not following",
    "im not following",
    "huh",
    "wait what",
    "that went over my head",
    "too complicated",
    "too complex",
    "can you simplify",
    "simpler please",
    "explain like i'm 5",
    "eli5",
    "in simpler terms",
    "in simple terms",
    "explain it more simply",
    "explain more simply",
    "explain it simply",
    "more simply please",
    "explain it again",
    "i don't follow",
    "i dont follow",
    "not following",
    "make it simpler",
    "break it down more",
    "this makes no sense",
    "still confused",
    "makes no sense",
    "none of this makes sense",
]

# Compiled regex for fast matching
_CONFUSION_RE = re.compile(
    "|".join(re.escape(s) for s in CONFUSION_SIGNALS),
    re.IGNORECASE,
)


def detect_confusion(message: str) -> bool:
    """
    Check if the user's message contains confusion signals.
    Returns True if confusion is detected.
    """
    return bool(_CONFUSION_RE.search(message.strip()))


def build_confusion_system_injection() -> str:
    """
    Build a system prompt injection that forces simplest-explanation mode.

    When prepended/appended to the system prompt, it overrides:
      - ChallengeEngine directives
      - Deep scaffold instructions
      - Socratic pressure

    Forces:
      - Depth = conceptual floor (simplest possible)
      - No equations
      - Max 3 short sentences
      - 1 analogy
      - 1 gentle follow-up

    The cognitive engines stay intact — but this injection takes priority.
    """
    return """
────────────────────────────────
⚠️ CONFUSION FAST-PATH — ACTIVE (HIGHEST PRIORITY)

The student has expressed confusion. This overrides ALL other directives.

MANDATORY RESPONSE RULES:
1. Use the SIMPLEST possible language — no jargon, no formalism.
2. NO equations. Zero. Not even inline math.
3. Maximum 3 short sentences for the explanation.
4. Include exactly 1 concrete, everyday analogy.
5. End with exactly 1 gentle follow-up question to check understanding.
6. Do NOT challenge the student. Do NOT probe deeper.
7. Do NOT reference depth levels, prior reasoning quality, or abstractions.
8. Do NOT say "let me re-explain" or "as I said before" — just explain fresh.
9. Tone: warm, patient, zero pressure. Like a kind older sibling.

EXAMPLE STRUCTURE:
  Think of it like [simple everyday analogy].
  [One sentence core explanation in plain language].
  [One sentence connecting it back to what matters].

  Does this version make more sense?

REMEMBER: Dignity first. The student asking for help is brave, not weak.
────────────────────────────────
"""
