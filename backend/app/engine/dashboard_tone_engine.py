"""
Dashboard Tone Engine — multi-dimensional tone computation.

Computes 6 axes of tone from cognitive profile + conversation state:
  Priority (computed first, applied first):
  1. Psychological Safety  (0.0–1.0)   ← NEW: always computed first
  2. Warmth                (0–10)
  3. Clarity               (implicit — controls formality/precision)
  4. Formality              (0–10)
  5. Precision              (0–10)
  6. Question Freq          (0–10)

  Beauty-gated:
  7. Dramatic               (0–10)      ← gated by depth + safety

Extracted from dashboard_prompt.py for modularity and testability.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


@dataclass
class ToneAxes:
    """Computed tone axis values."""
    psychological_safety: float   # 0.0–1.0 (1.0 = maximum safety)
    formality: int
    warmth: int
    dramatic: int
    precision: int
    question_freq: int


class ToneEngine:
    """
    Computes and converts multi-dimensional tone from profile + state.

    Priority hierarchy:
      psychological_safety → warmth → clarity → formality → socratic_pressure
    """

    @staticmethod
    def compute_axes(profile: Dict, conv_state: Dict) -> ToneAxes:
        """
        Compute the 6 tone axes from cognitive profile and conversation state.
        Psychological safety is computed FIRST and influences other axes.
        """
        # Extract profile values
        abstraction = profile.get("abstraction_comfort", 0.5)
        curiosity = profile.get("curiosity_index", 0.5)
        precision_score = profile.get("precision_score", 0.5)

        # Extract conversation state
        depth = conv_state.get("depth_level", 2)
        energy = conv_state.get("energy_level", "medium")
        misconception_count = conv_state.get("misconception_count", 0)
        message_count = profile.get("message_count", 0)
        reasoning_avg = conv_state.get("reasoning_score_avg", 0.5)

        # ──────────────────────────────────────────────────────────────
        # AXIS 1 — Psychological Safety (computed FIRST, applied FIRST)
        # ──────────────────────────────────────────────────────────────
        safety = 0.8  # baseline: assume safe

        # Boost safety when energy is low (student may be fragile)
        if energy == "low":
            safety = min(1.0, safety + 0.15)

        # Boost safety when misconceptions are active
        if misconception_count > 0:
            safety = min(1.0, safety + 0.1)

        # Boost safety in early messages (trust not yet established)
        if message_count < 5:
            safety = min(1.0, safety + 0.1)

        # Slightly reduce safety ceiling for high-depth, high-reasoning
        # (student has demonstrated resilience)
        if depth >= 5 and reasoning_avg > 0.7 and energy != "low":
            safety = max(0.5, safety - 0.15)

        safety = max(0.0, min(1.0, round(safety, 2)))

        # ──────────────────────────────────────────────────────────────
        # AXIS 2 — Warmth (boosted by safety)
        # ──────────────────────────────────────────────────────────────
        warmth_base = 7 - int(abstraction * 2)  # less abstract → more warmth
        warmth_safety_boost = int(safety * 2)    # high safety → more warmth
        warmth = min(10, max(3, warmth_base + warmth_safety_boost
                             + (1 if energy == "low" else 0)))

        # ── Formality ──
        formality = min(10, max(1, int(3 + abstraction * 4 + depth * 0.5)))

        # ── Dramatic intensity (BEAUTY-GATED) ──
        # At low depth or high safety → suppress dramatic
        dramatic_raw = min(8, max(1, int(
            2 + curiosity * 4 + (1 if energy == "high" else 0)
        )))
        if depth <= 2:
            dramatic = min(2, dramatic_raw)  # cap at 2 for low depth
        elif safety > 0.85:
            dramatic = min(3, dramatic_raw)  # cap at 3 for high safety
        else:
            dramatic = dramatic_raw

        # ── Precision ──
        precision = min(10, max(2, int(
            3 + precision_score * 4 + depth * 0.5
        )))

        # ── Question frequency (reduced during high safety) ──
        question_freq = min(8, max(1, int(
            3 + curiosity * 3 - (2 if misconception_count > 0 else 0)
        )))
        # Don't pressure with too many questions when safety is high
        if safety > 0.85:
            question_freq = min(4, question_freq)

        return ToneAxes(
            psychological_safety=safety,
            formality=formality,
            warmth=warmth,
            dramatic=dramatic,
            precision=precision,
            question_freq=question_freq,
        )

    @staticmethod
    def to_instructions(profile: Dict, conv_state: Dict) -> str:
        """
        Compute tone axes and return formatted prompt instructions.
        Priority: safety → warmth → clarity → formality → socratic_pressure
        """
        axes = ToneEngine.compute_axes(profile, conv_state)
        reasoning_style = profile.get("reasoning_style", "hybrid")

        tone_desc = []

        # ── Psychological Safety (ALWAYS FIRST) ──
        if axes.psychological_safety >= 0.85:
            tone_desc.append(
                "SAFETY HIGH — prioritise warmth and gentleness. "
                "No intellectual pressure. No grandiose framing. "
                "Speak like a patient older sibling at a kitchen table."
            )
        elif axes.psychological_safety >= 0.6:
            tone_desc.append(
                "SAFETY MODERATE — balance warmth with intellectual engagement. "
                "Light Socratic questions are okay. Keep tone inviting."
            )
        else:
            tone_desc.append(
                "SAFETY LOW — the student is confident and resilient. "
                "Full intellectual engagement permitted. "
                "You may use vivid framing and gentle challenges."
            )

        # ── Warmth (SECOND priority) ──
        if axes.warmth >= 7:
            tone_desc.append(
                "Be warm and encouraging. Use 'we' and 'you' naturally. "
                "'Let's work through this together.'"
            )
        elif axes.warmth >= 4:
            tone_desc.append(
                "Maintain calm professionalism with genuine warmth."
            )
        else:
            tone_desc.append(
                "Be direct and concise. Let ideas speak for themselves."
            )

        # Formality
        if axes.formality >= 7:
            tone_desc.append(
                "Use precise academic language. Maintain scholarly structure."
            )
        elif axes.formality >= 4:
            tone_desc.append(
                "Balance accessibility with intellectual precision."
            )
        else:
            tone_desc.append(
                "Use conversational language. Be direct and approachable."
            )

        # Dramatic (beauty-gated)
        if axes.dramatic >= 6:
            tone_desc.append(
                'Build gentle cognitive tension. Use reveals and narrative '
                'momentum. "Notice something subtle..."'
            )
        elif axes.dramatic >= 3:
            tone_desc.append(
                "Use occasional vivid framing to sustain engagement."
            )
        else:
            tone_desc.append(
                "Stay understated. Minimal dramatic language. "
                "Warmth without grandeur."
            )

        # Precision
        if axes.precision >= 7:
            tone_desc.append(
                "Be mathematically precise. Define terms rigorously. Show derivations."
            )
        elif axes.precision >= 4:
            tone_desc.append(
                "Use clean notation but prioritize intuition over formalism."
            )
        else:
            tone_desc.append(
                "Favour intuitive explanations over formal notation."
            )

        # Question frequency
        if axes.question_freq >= 6:
            tone_desc.append(
                "Weave questions naturally into explanations to sustain active thinking."
            )
        elif axes.question_freq >= 3:
            tone_desc.append(
                "Ask occasional reflective questions. Don't overdo it."
            )
        else:
            tone_desc.append(
                "Minimise questions. Deliver insights gently and directly."
            )

        # Explanation style from reasoning_style
        if reasoning_style == "intuitive":
            tone_desc.append(
                "Prefer metaphors, vivid imagery, and visualisation. "
                "Build from concrete to abstract."
            )
        elif reasoning_style == "analytical":
            tone_desc.append(
                "Prefer equations, logical structure, and step-by-step derivation."
            )
        else:
            tone_desc.append(
                "Blend intuitive framing with analytical rigour as appropriate."
            )

        return "\n".join(f"- {t}" for t in tone_desc)
