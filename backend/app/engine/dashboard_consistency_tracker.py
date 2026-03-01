"""
Dashboard Consistency Tracker — context-aware intellectual consistency.

Tracks user claims with domain and context tags, and only flags
contradictions when claims are within the same context domain.

Example:
  "objects fall at the same rate" (context: vacuum) does NOT contradict
  "heavier objects fall faster" (context: atmosphere with air resistance).

Supports backward compatibility with legacy statement_log entries that
lack domain/context_tags fields.
"""

from __future__ import annotations

import re
from typing import Dict, List, Optional


# ── Context domains ──────────────────────────────────────────────────────

_CONTEXT_TAGS = {
    "vacuum": [
        "vacuum", "no air", "in space", "no resistance",
        "frictionless", "ideal",
    ],
    "atmosphere": [
        "air resistance", "real world", "in air", "with drag",
        "atmosphere", "wind",
    ],
    "classical": [
        "classical", "newtonian", "macroscopic", "everyday",
        "large scale", "newton",
    ],
    "quantum": [
        "quantum", "subatomic", "particle", "wave function",
        "uncertainty", "planck", "superposition",
    ],
    "relativistic": [
        "relativistic", "speed of light", "einstein",
        "spacetime", "lorentz", "time dilation",
    ],
    "ideal": [
        "ideal", "perfect", "theoretical", "assume",
        "frictionless", "massless", "lossless",
    ],
    "real": [
        "real", "practical", "actual", "measured",
        "experiment", "lab", "empirical",
    ],
    "static": [
        "static", "equilibrium", "at rest", "not moving",
        "stationary", "balanced",
    ],
    "dynamic": [
        "dynamic", "moving", "motion", "accelerat",
        "velocity", "momentum", "kinetic",
    ],
}

# ── Domain keywords (for domain tagging) ─────────────────────────────────

_DOMAIN_KEYWORDS = {
    "physics": [
        "force", "energy", "momentum", "gravity", "mass",
        "velocity", "wave", "field", "charge", "motion",
        "acceleration", "friction", "torque",
    ],
    "mathematics": [
        "equation", "derivative", "integral", "proof",
        "theorem", "function", "set", "number", "matrix",
        "vector", "topology",
    ],
    "chemistry": [
        "molecule", "atom", "bond", "reaction", "element",
        "compound", "solution", "acid", "catalyst",
    ],
    "biology": [
        "cell", "gene", "protein", "evolution", "organism",
        "dna", "enzyme", "species", "mitosis",
    ],
    "computer_science": [
        "algorithm", "data", "program", "code", "function",
        "class", "network", "memory", "recursion",
    ],
}


# ── Claim extraction patterns ────────────────────────────────────────────

_CLAIM_PATTERNS = [
    r"i think (.{10,200})",
    r"i believe (.{10,200})",
    r"my understanding is (.{10,200})",
    r"isn't it true that (.{10,200})",
    r"so basically (.{10,200})",
    r"it works because (.{10,200})",
    r"the reason is (.{10,200})",
    r"it means that (.{10,200})",
    r"(?:so|therefore|thus|hence) (.{10,200})",
    r"(?:this|that) (?:means|implies|shows) (.{10,200})",
]


class ConsistencyTracker:
    """
    Extracts claims with context tags and checks for contradictions
    only within the same domain and context.
    """

    @staticmethod
    def extract_claim(
        message: str,
        detected_topic: Optional[str] = None,
    ) -> Optional[Dict]:
        """
        Extract a factual claim from the user's message with domain
        and context tags.

        Returns:
            {
                "claim": str,
                "domain": str,           # e.g. "physics"
                "context_tags": [str],    # e.g. ["vacuum", "ideal"]
            }
            or None if no claim detected.
        """
        msg_lower = message.lower()
        claim_text = None

        for pattern in _CLAIM_PATTERNS:
            m = re.search(pattern, msg_lower)
            if m:
                claim_text = m.group(1).strip()
                # Truncate at sentence boundary
                for end_marker in [". ", "? ", "! ", "\n"]:
                    idx = claim_text.find(end_marker)
                    if idx > 10:
                        claim_text = claim_text[:idx]
                break

        if not claim_text:
            return None

        # ── Domain detection ──
        domain = detected_topic or "general"
        if domain == "general":
            for d, keywords in _DOMAIN_KEYWORDS.items():
                if any(kw in msg_lower for kw in keywords):
                    domain = d
                    break

        # ── Context tags ──
        context_tags = []
        for tag, indicators in _CONTEXT_TAGS.items():
            if any(ind in msg_lower for ind in indicators):
                context_tags.append(tag)

        return {
            "claim": claim_text[:300],
            "domain": domain,
            "context_tags": context_tags,
        }

    @staticmethod
    def check_contradictions(
        new_claim: Dict,
        statement_log: List[Dict],
    ) -> List[Dict]:
        """
        Check if the new claim potentially contradicts earlier claims.

        Only flags contradictions when claims share the same domain
        AND at least one overlapping context tag (or both have no tags).

        Backward compatible: old log entries without domain/context_tags
        are treated as domain="general", context_tags=[].

        Returns list of potentially contradictory earlier claims.
        """
        if not new_claim or not statement_log:
            return []

        contradictions = []
        new_domain = new_claim.get("domain", "general")
        new_tags = set(new_claim.get("context_tags", []))
        new_text = new_claim.get("claim", "").lower()

        for entry in statement_log:
            old_domain = entry.get("domain", "general")
            old_tags = set(entry.get("context_tags", []))
            old_text = entry.get("claim", "").lower()

            # Must be same domain (or one is "general")
            if (
                old_domain != new_domain
                and old_domain != "general"
                and new_domain != "general"
            ):
                continue

            # Context compatibility check:
            #   If both have tags, they must share at least one
            #   If either has no tags, considered potentially compatible
            if new_tags and old_tags:
                if not new_tags.intersection(old_tags):
                    continue  # Different contexts — not a contradiction

            # ── Contradiction heuristics ──
            # Look for negation patterns or opposing claims
            negation_pairs = [
                ("does", "doesn't"), ("does", "does not"),
                ("can", "can't"), ("can", "cannot"),
                ("is", "isn't"), ("is", "is not"),
                ("will", "won't"), ("will", "will not"),
                ("always", "never"), ("increase", "decrease"),
                ("faster", "slower"), ("more", "less"),
                ("same", "different"), ("equal", "unequal"),
                ("true", "false"), ("correct", "incorrect"),
            ]

            is_contradictory = False
            for pos, neg in negation_pairs:
                if (re.search(r'\b' + re.escape(pos) + r'\b', new_text) and
                    re.search(r'\b' + re.escape(neg) + r'\b', old_text)) or (
                    re.search(r'\b' + re.escape(neg) + r'\b', new_text) and
                    re.search(r'\b' + re.escape(pos) + r'\b', old_text)
                ):
                    is_contradictory = True
                    break

            if is_contradictory:
                contradictions.append(entry)

        return contradictions

    @staticmethod
    def format_consistency_context(
        statement_log: List[Dict],
        contradictions: Optional[List[Dict]] = None,
    ) -> str:
        """
        Format the statement log and any contradictions for prompt injection.
        Returns empty string if no statements to report.
        """
        if not statement_log:
            return ""

        lines = []
        lines.append("[INTERNAL — STUDENT CLAIMS THIS CONVERSATION]")
        lines.append(
            "The student has made these claims earlier in this conversation:"
        )

        for s in statement_log[-5:]:
            claim = s.get("claim", "?")
            turn = s.get("turn", "?")
            domain = s.get("domain", "")
            tags = s.get("context_tags", [])
            tag_str = f" [{', '.join(tags)}]" if tags else ""
            domain_str = f" ({domain}{tag_str})" if domain else ""
            lines.append(f"  - Turn {turn}{domain_str}: \"{claim}\"")

        lines.append(
            "If relevant, reference these to build continuity. "
            "If a new statement contradicts an earlier claim IN THE SAME CONTEXT, "
            "gently point it out."
        )

        if contradictions:
            lines.append("")
            lines.append("[POTENTIAL CONTRADICTION DETECTED]")
            lines.append(
                "The student's current statement may contradict an earlier claim. "
                "Address this gently:"
            )
            for c in contradictions:
                lines.append(
                    f"  → Turn {c.get('turn', '?')}: \"{c.get('claim', '?')}\""
                )
            lines.append(
                "Frame this as intellectual growth, NOT as an error. "
                "\"Earlier you explored X — now you're considering Y. "
                "Notice the tension?\""
            )

        return "\n".join(lines)
