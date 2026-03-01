"""
Dashboard Hybrid Classifier — classifies user messages for the cognitive engine.

Two-stage approach:
  Stage 1 — Rule-based pre-filter (fast, ~0ms)
    Pattern matching + heuristics. If confidence ≥ 0.8, return immediately.

  Stage 2 — GPT classification (only when uncertain)
    Lightweight GPT call with classification-only prompt. Returns structured JSON.

Returns:
  {
    "intent": str,
    "reasoning_quality": float,     # 0–1
    "curiosity_level": float,       # 0–1
    "misconception_detected": bool,
    "abstraction_level": str,       # "low" / "medium" / "high"
    "energy_level": str,            # "low" / "medium" / "high"
    "confidence": float,            # 0–1 (how sure the classifier is)
  }
"""

from __future__ import annotations

import json
import os
import re
from typing import Dict, Optional

import httpx


# ── Intent Types (broader than I'm Curious) ──────────────────────────────

INTENT_TYPES = [
    "utility_non_academic", # weather, time, shopping, news — non-academic
    "clarification",       # "why does", "how does", "what is"
    "deep_theory",         # "derive", "proof", "mathematically"
    "go_deeper",           # "go deeper", "elaborate", "more detail"
    "intuition",           # "intuitively", "simple terms", "help me understand"
    "application",         # "real world", "example", "practical"
    "confusion",           # "don't get", "confused", "lost"
    "visual_request",      # "show me", "diagram", "draw"
    "code_request",        # "write code", "implement", "program"
    "challenge_self",      # "test me", "quiz me", "challenge"
    "exploration",         # open-ended curiosity
    "just_tell_me",        # "just tell me", "skip"
    "socratic_response",   # answering a previous micro-question
    "meta",                # questions about Eureka itself
]


# ── Stage 1: Rule-based Pre-filter ───────────────────────────────────────

# Ordered by specificity — first match wins
_INTENT_PATTERNS: dict[str, list[str]] = {
    # ── Utility / Non-academic queries (checked FIRST — highest priority) ──
    "utility_non_academic": [
        # Weather & environment (exclude celestial/planetary science contexts)
        r"what(?:'?s| is) the (?:weather|forecast)(?!.{0,15}\b(?:on|of|in|at) (?:mars|jupiter|venus|saturn|mercury|neptune|uranus|pluto|titan|europa)\b)",
        r"is it (?:raining|sunny|cold outside|hot outside)",
        r"(?:today'?s|tomorrow'?s|this week'?s) (?:weather|forecast)",
        # Time & date (exclude academic "time complexity", "time series", etc.)
        r"what(?:'?s| is) the time(?!\s+(?:complexity|constant|series|period|dilation|value|domain|interval|step|derivative|evolution|integral|dimension|scale))\b",
        r"what(?:'?s| is) the date\b",
        r"what time is it",
        r"what day is (?:it|today)",
        # Shopping & commerce (handle articles before excluded academic terms)
        r"(?:where (?:can i|do i|to) |how (?:do i |to ))buy\b",
        r"\bbuy (?:me |us )?(?:a |some |the )?(?:pizza|burger|coffee|lunch|dinner|groceries|gift|snack|drink)",
        r"\bprice of (?!(?:(?:a|an|the) )?(?:electron|photon|particle|atom|energy|proton|neutron|quark|ion|reaction)\b)",
        r"\border (?:food|pizza|groceries|takeout|delivery)",
        r"\bshopping (?:list|cart|online)",
        r"\bcheapest\b.*\b(?:store|shop|price)",
        # Navigation & local
        r"\bdirections to\b",
        r"\bnearest (?:store|restaurant|hospital|pharmacy|gas station|atm)",
        r"\broute to\b",
        r"\bhow (?:do i |to )get to\b",
        # News & entertainment
        r"\b(?:today'?s|latest|breaking) news\b",
        r"\bheadlines\b",
        r"\bsports? scores?\b",
        r"\bmovie (?:times?|tickets?|showings?|showtimes?)",
        # Food & cooking (non-academic)
        r"\brecipe (?:for|of)\b",
        r"\bhow (?:do i |to )cook\b",
        # Travel & booking
        r"\bbook (?:a |the )?(?:flight|hotel|ticket|cab|ride)",
        r"\bflight(?:s)? (?:to|from)\b",
        # Phone & contacts
        r"\bphone number (?:of|for)\b",
        r"\bcall (?:a )?(?:taxi|uber|lyft|plumber|electrician)",
        # Reminders & alarms
        r"\bset (?:a |an )?(?:alarm|timer|reminder)",
        r"\bremind me (?:to|at|in)\b",
        # Translation (non-academic sense)
        r"\btranslate .{2,40} (?:to|into) (?:english|spanish|french|hindi|german|chinese|japanese)",
    ],
    "just_tell_me": [
        r"just tell me", r"just explain", r"just show", r"skip",
        r"give me the answer", r"stop asking",
    ],
    "visual_request": [
        r"show me", r"visuali[sz]e", r"diagram", r"draw",
        r"picture", r"can you show", r"\bimage\b", r"see it",
        r"illustration", r"illustrate",
    ],
    "code_request": [
        r"write (?:a |the )?code", r"implement", r"program",
        r"write (?:a |the )?function", r"coding", r"script",
        r"write (?:a |the )?class", r"algorithm",
    ],
    "challenge_self": [
        r"test me", r"quiz", r"check my understanding",
        r"question me", r"assess me", r"challenge me",
    ],
    "go_deeper": [
        r"go deeper", r"more depth", r"elaborate",
        r"tell me more", r"expand on", r"dig deeper",
        r"deeper dive", r"in more detail", r"more about",
    ],
    "deep_theory": [
        r"mathematically", r"derive", r"\bproof\b", r"formally",
        r"theoretically", r"in detail", r"\bequation\b",
        r"\bformula\b", r"derivation",
    ],
    "intuition": [
        r"intuiti", r"make sense of", r"help me understand",
        r"in simple terms", r"eli5", r"explain like",
        r"dumb it down", r"layman",
    ],
    "application": [
        r"real world", r"real life", r"example of",
        r"where is this used", r"practical", r"in daily life",
        r"application", r"use case",
    ],
    "confusion": [
        r"confused", r"don'?t get", r"don'?t understand",
        r"not sure", r"help me", r"\blost\b", r"\bstuck\b",
        r"makes? no sense", r"\bhuh\b", r"i'?m confused",
    ],
    "meta": [
        r"what are you", r"who are you", r"what can you do",
        r"how do you work", r"are you (?:ai|gpt|chatgpt)",
    ],
    "clarification": [
        r"why does", r"why doesn'?t", r"how does",
        r"what causes", r"explain why", r"what is",
        r"what are", r"what'?s the difference",
    ],
}

# Reasoning indicators
_REASONING_WORDS = [
    "because", "since", "therefore", "so", "this means",
    "which implies", "as a result", "due to", "if then",
    "leads to", "follows that", "hence", "thus",
    "i think", "my reasoning", "i believe",
]

# Enthusiasm markers
_ENTHUSIASM_WORDS = [
    "wow", "cool", "amazing", "fascinating", "incredible",
    "love", "awesome", "whoa", "mind-blowing", "brilliant",
    "interesting", "curious", "excited", "wait",
]

# Uncertainty markers
_UNCERTAINTY_WORDS = [
    "idk", "i guess", "maybe", "not sure", "confused",
    "don't get", "lost", "stuck", "huh", "um",
    "i don't know", "not certain",
]

# Academic vocabulary
_ACADEMIC_TERMS = [
    "velocity", "acceleration", "derivative", "integral", "entropy",
    "momentum", "eigenvalue", "topology", "manifold", "tensor",
    "hamiltonian", "lagrangian", "thermodynamic", "quantum",
    "differential", "polynomial", "matrix", "vector", "scalar",
    "convergence", "divergence", "gradient", "laplacian",
    "algorithm", "complexity", "recursion", "abstraction",
    "isomorphism", "homeomorphism", "bijection",
]


def _count_matches(text: str, word_list: list[str]) -> int:
    """Count how many words/phrases from the list appear in the text."""
    lower = text.lower()
    return sum(1 for w in word_list if w in lower)


def _detect_equations(text: str) -> bool:
    """Check if text contains mathematical notation."""
    patterns = [
        r"\$\$.+\$\$",          # block LaTeX
        r"\$.+\$",              # inline LaTeX
        r"\\frac\{",            # LaTeX fraction
        r"[a-z]\s*=\s*[a-z0-9]",  # simple equation
        r"\^[0-9{]",            # exponent
        r"∫|∑|∏|√|∂",          # math symbols
    ]
    return any(re.search(p, text) for p in patterns)


def rule_based_classify(
    message: str,
    history: list[Dict] | None = None,
) -> Dict:
    """
    Stage 1: Fast rule-based classification.

    Returns classification dict with confidence score.
    If confidence < 0.8, the caller should fall through to GPT.
    """
    msg_lower = message.lower()
    words = message.split()
    word_count = len(words)

    # ── Intent detection ──
    detected_intent = "exploration"
    intent_confidence = 0.5

    for intent, patterns in _INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, msg_lower):
                detected_intent = intent
                intent_confidence = 0.85
                break
        if intent_confidence >= 0.85:
            break

    # Fallback: question → clarification
    if intent_confidence < 0.8 and "?" in message:
        detected_intent = "clarification"
        intent_confidence = 0.7

    # Check if this might be a response to a micro-question
    if history:
        last_assistant = None
        for m in reversed(history):
            if m.get("role") == "assistant":
                last_assistant = m.get("content", "")
                break
        if last_assistant and last_assistant.strip().endswith("?"):
            # The previous message was a question — this might be a response
            if word_count <= 30 and detected_intent == "exploration":
                detected_intent = "socratic_response"
                intent_confidence = 0.75

    # ── Reasoning quality ──
    reasoning_count = _count_matches(message, _REASONING_WORDS)
    has_equations = _detect_equations(message)
    academic_count = _count_matches(message, _ACADEMIC_TERMS)

    reasoning_quality = min(1.0, (
        reasoning_count * 0.15 +
        (0.2 if has_equations else 0) +
        academic_count * 0.1 +
        min(0.3, word_count / 100)
    ))

    # ── Curiosity level ──
    enthusiasm_count = _count_matches(message, _ENTHUSIASM_WORDS)
    question_count = message.count("?")
    why_count = len(re.findall(r"\bwhy\b", msg_lower))
    how_count = len(re.findall(r"\bhow\b", msg_lower))

    curiosity_level = min(1.0, (
        enthusiasm_count * 0.15 +
        question_count * 0.1 +
        (why_count + how_count) * 0.1 +
        (0.15 if detected_intent == "go_deeper" else 0) +
        (0.1 if word_count > 30 else 0)
    ))

    # ── Misconception detection (heuristic) ──
    misconception_phrases = [
        r"heavier.*fall.*faster",
        r"force.*(?:needed|required).*(?:to )?move",
        r"in space.*no gravity",
        r"cold.*(?:is|travels|moves)",
        r"electricity.*(?:consumed|used up)",
        r"evolution.*(?:goal|purpose|direction)",
        r"atom.*(?:look|shaped).*solar system",
        r"mass.*(?:same|equals?).*weight",
    ]
    misconception_detected = any(
        re.search(p, msg_lower) for p in misconception_phrases
    )

    # ── Abstraction level ──
    if academic_count >= 3 or has_equations:
        abstraction_level = "high"
    elif academic_count >= 1 or word_count > 40:
        abstraction_level = "medium"
    else:
        abstraction_level = "low"

    # ── Energy level ──
    exclamation_count = message.count("!")
    upper_words = sum(1 for w in words if w.isupper() and len(w) > 1)
    uncertainty_count = _count_matches(message, _UNCERTAINTY_WORDS)

    high_signals = exclamation_count + upper_words + enthusiasm_count
    low_signals = uncertainty_count + (1 if word_count <= 3 else 0)

    if high_signals >= 2 or (word_count > 40 and enthusiasm_count >= 1):
        energy_level = "high"
    elif low_signals >= 2 or (word_count <= 3 and question_count == 0):
        energy_level = "low"
    else:
        energy_level = "medium"

    # ── Overall confidence ──
    # Higher if intent match was strong and signals are clear
    confidence = min(1.0, (
        intent_confidence * 0.5 +
        (0.2 if reasoning_count > 0 or academic_count > 0 else 0.1) +
        (0.15 if enthusiasm_count > 0 or uncertainty_count > 0 else 0.05) +
        (0.1 if word_count > 5 else 0.05)
    ))

    return {
        "intent": detected_intent,
        "reasoning_quality": round(reasoning_quality, 2),
        "curiosity_level": round(curiosity_level, 2),
        "misconception_detected": misconception_detected,
        "abstraction_level": abstraction_level,
        "energy_level": energy_level,
        "confidence": round(confidence, 2),
    }


# ── Stage 2: GPT Classification (Fallback) ──────────────────────────────

_CLASSIFIER_PROMPT = """You are an internal classifier for an educational AI system.
Classify the following student message into a structured JSON object.
Return ONLY valid JSON, no other text.

Student message: "{message}"

Conversation context (last 3 messages):
{context}

Return this exact JSON structure:
{{
  "intent": "<one of: utility_non_academic, clarification, deep_theory, go_deeper, intuition, application, confusion, visual_request, code_request, challenge_self, exploration, just_tell_me, socratic_response, meta>",
  "reasoning_quality": <float 0-1>,
  "curiosity_level": <float 0-1>,
  "misconception_detected": <true/false>,
  "abstraction_level": "<low/medium/high>",
  "energy_level": "<low/medium/high>"
}}

Rules:
- intent "utility_non_academic" = non-academic everyday queries (weather, time, shopping, news, directions, recipes, booking, reminders). NOT academic topics phrased casually.
- reasoning_quality: 0 = no reasoning shown, 1 = expert-level reasoning with evidence
- curiosity_level: 0 = no curiosity, 1 = deeply curious with follow-ups
- misconception_detected: true if the message contains a factual or conceptual error
- abstraction_level: based on vocabulary and conceptual framing
- energy_level: based on enthusiasm, length, punctuation"""


async def gpt_classify(
    message: str,
    history: list[Dict] | None = None,
) -> Dict:
    """
    Stage 2: GPT-based classification for uncertain cases.
    Uses a lightweight GPT call with classification-only prompt.
    """
    # Build context from last 3 messages
    context_lines = []
    if history:
        for msg in history[-3:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")[:200]
            context_lines.append(f"{role}: {content}")
    context = "\n".join(context_lines) if context_lines else "(no prior context)"

    prompt = _CLASSIFIER_PROMPT.format(message=message[:500], context=context)

    endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    api_key = os.getenv("AZURE_OPENAI_API_KEY", "")

    if not endpoint or not api_key:
        # Fall back to rule-based if no credentials
        result = rule_based_classify(message, history)
        result["confidence"] = 0.6
        return result

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                endpoint,
                json={
                    "messages": [
                        {"role": "system", "content": "You are a classifier. Return ONLY JSON."},
                        {"role": "user", "content": prompt},
                    ],
                    "max_completion_tokens": 200,
                },
                headers={
                    "api-key": api_key,
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            # Extract JSON from potential markdown wrapping
            content = content.strip()
            if content.startswith("```"):
                content = re.sub(r"^```(?:json)?\s*", "", content)
                content = re.sub(r"\s*```$", "", content)

            result = json.loads(content)

            # Ensure all fields exist with defaults
            return {
                "intent": result.get("intent", "exploration"),
                "reasoning_quality": float(result.get("reasoning_quality", 0.5)),
                "curiosity_level": float(result.get("curiosity_level", 0.5)),
                "misconception_detected": str(result.get("misconception_detected", False)).lower() in ("true", "1", "yes"),
                "abstraction_level": result.get("abstraction_level", "medium"),
                "energy_level": result.get("energy_level", "medium"),
                "confidence": 0.9,  # GPT classification is high-confidence
            }

    except Exception as exc:
        print(f"[classifier] GPT classification failed: {exc}")
        # Fall back to rule-based
        result = rule_based_classify(message, history)
        result["confidence"] = 0.6
        return result


# ── Hybrid Classifier Entry Point ────────────────────────────────────────

CONFIDENCE_THRESHOLD = 0.8


async def classify_message(
    message: str,
    history: list[Dict] | None = None,
) -> Dict:
    """
    Hybrid classifier: rule-based first, GPT fallback when uncertain.

    Returns complete classification dict.
    """
    # Stage 1: Rule-based
    result = rule_based_classify(message, history)

    if result["confidence"] >= CONFIDENCE_THRESHOLD:
        print(f"[classifier] Rule-based (conf={result['confidence']:.2f}): "
              f"intent={result['intent']}, rq={result['reasoning_quality']:.2f}")
        return result

    # Stage 2: GPT fallback
    print(f"[classifier] Rule-based uncertain (conf={result['confidence']:.2f}), "
          f"falling back to GPT...")
    gpt_result = await gpt_classify(message, history)
    print(f"[classifier] GPT result: intent={gpt_result['intent']}, "
          f"rq={gpt_result['reasoning_quality']:.2f}")
    return gpt_result
