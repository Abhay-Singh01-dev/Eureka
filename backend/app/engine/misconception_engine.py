"""
Misconception Detection & Micro-Question Engine

Detects student misconceptions from their answers and drives
Socratic micro-question sequences (max 3 questions, one at a time).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


# ── Data classes ──────────────────────────────────────────────────────────


@dataclass
class MicroQuestion:
    text: str
    concept_focus: str
    expected_insight: str


@dataclass
class MisconceptionPath:
    misconception_id: str
    description: str
    detection_keywords: list[str]
    micro_questions: list[MicroQuestion]
    final_concept: str
    closure_modes: dict[str, str]


# ── Detector ──────────────────────────────────────────────────────────────


class MisconceptionDetector:
    """Detects known misconceptions from student messages."""

    def __init__(self, knowledge: dict):
        self.paths: dict[str, MisconceptionPath] = {}
        self._load(knowledge.get("misconception_paths", {}))

    def _load(self, raw: dict):
        for mid, data in raw.items():
            mqs = [
                MicroQuestion(
                    text=q,
                    concept_focus=f"concept_{i}",
                    expected_insight=data["final_concept"],
                )
                for i, q in enumerate(data["micro_questions"])
            ]
            self.paths[mid] = MisconceptionPath(
                misconception_id=mid,
                description=data["description"],
                detection_keywords=data.get("detection_keywords", []),
                micro_questions=mqs,
                final_concept=data["final_concept"],
                closure_modes=data["closure_modes"],
            )

    def detect(self, user_answer: str) -> Optional[str]:
        """Return the ID of a detected misconception, or None."""
        lower = user_answer.lower()
        for mid, path in self.paths.items():
            for kw in path.detection_keywords:
                if kw in lower:
                    return mid
        return None

    def get_path(self, misconception_id: str) -> Optional[MisconceptionPath]:
        return self.paths.get(misconception_id)

    def select_closure(
        self,
        misconception_id: str,
        quality_score: float,
        struggled: bool,
    ) -> tuple[str, str]:
        """Select closure mode → (mode_name, closure_text)."""
        path = self.paths.get(misconception_id)
        if not path:
            return ("summary", "Concept clarified.")

        if struggled:
            mode = "summary"
        elif quality_score > 0.7:
            mode = "challenge"
        else:
            mode = "analogy"

        return (mode, path.closure_modes[mode])


# ── Micro-Question Controller (per conversation session) ─────────────────


@dataclass
class MicroQController:
    """
    Manages a single Socratic micro-question sequence.
    Max 3 questions; exits early on understanding or frustration.
    """

    max_questions: int = 3
    current_index: int = 0
    early_understanding: bool = False
    questions_asked: list[MicroQuestion] = field(default_factory=list)

    def should_continue(self) -> bool:
        if self.early_understanding:
            return False
        return self.current_index < self.max_questions

    def next_question(self, sequence: list[MicroQuestion]) -> Optional[MicroQuestion]:
        if not self.should_continue():
            return None
        if self.current_index >= len(sequence):
            return None
        q = sequence[self.current_index]
        self.questions_asked.append(q)
        self.current_index += 1
        return q

    @staticmethod
    def analyse_response(user_response: str) -> Dict:
        lower = user_response.lower()
        words = user_response.split()
        word_count = len(words)

        understanding_phrases = [
            "yes", "i see", "i understand", "that makes sense",
            "oh", "right", "exactly", "of course", "got it",
        ]
        frustration_phrases = [
            "just tell me", "i don't know", "i give up",
            "this is confusing", "too hard", "no idea",
        ]

        shows_understanding = any(p in lower for p in understanding_phrases)
        shows_frustration = any(p in lower for p in frustration_phrases)
        correct_reasoning = word_count > 5 and shows_understanding

        return {
            "shows_understanding": shows_understanding,
            "correct_reasoning": correct_reasoning,
            "shows_frustration": shows_frustration,
            "word_count": word_count,
        }

    def update(self, analysis: Dict):
        if analysis["correct_reasoning"] or analysis["shows_frustration"]:
            self.early_understanding = True
