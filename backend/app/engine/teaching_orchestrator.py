"""
Teaching Orchestrator — the main coordinator for the adaptive teaching system.

Manages:
  - Intent classification
  - User learning state (MongoDB)
  - Misconception detection & micro-question sequences
  - Teaching prompt construction
  - GPT-5.2-chat streaming
  - Image generation triggering
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from typing import AsyncGenerator, Dict, List, Optional

logger = logging.getLogger(__name__)

import httpx
from pymongo import MongoClient

from app.engine.intent_classifier import IntentType, classify_intent, analyse_response_quality
from app.engine.misconception_engine import MisconceptionDetector, MicroQController
from app.engine.teaching_prompt import build_teaching_system_prompt
from app.engine.latex_formatter import normalize_latex_delimiters
from app.engine.multimodal import (
    generate_image, generate_video,
    extract_image_tags, extract_video_tags,
    strip_all_media_tags,
)
from app.engine.dignity_filter import dignity_filter, StreamingDignityFilter
from app.engine.dignity_scorer import dignity_scorer, log_dignity_score
from app.knowledge.motion_forces import get_node_knowledge, NODE_ID_MAP


# ── Config ────────────────────────────────────────────────────────────────

def _get_azure_endpoint():
    return os.getenv("AZURE_OPENAI_ENDPOINT", "")

def _get_azure_key():
    return os.getenv("AZURE_OPENAI_API_KEY", "")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "eureka")

# Singleton MongoDB client
_mongo: Optional[MongoClient] = None


def _db():
    global _mongo
    if _mongo is None:
        _mongo = MongoClient(MONGO_URI)
    return _mongo[MONGO_DB]


# ── User Learning State ──────────────────────────────────────────────────


def get_user_state(session_id: str, node_id: str) -> Dict:
    """Get or create user learning state from MongoDB."""
    col = _db()["user_learning_state"]
    doc = col.find_one({"session_id": session_id, "node_id": node_id})
    if doc:
        return doc
    default = {
        "session_id": session_id,
        "node_id": node_id,
        "depth_level": 1,
        "terminology": "basic",
        "reasoning_quality_score": 0.5,
        "messages_count": 0,
        "go_deeper_count": 0,
        "misconceptions_detected": [],
        "micro_q_active": False,
        "micro_q_misconception_id": None,
        "micro_q_index": 0,
        "created_at": time.time(),
        "updated_at": time.time(),
    }
    col.insert_one(default)
    return default


def update_user_state(session_id: str, node_id: str, updates: Dict):
    """Update user learning state in MongoDB."""
    col = _db()["user_learning_state"]
    updates["updated_at"] = time.time()
    col.update_one(
        {"session_id": session_id, "node_id": node_id},
        {"$set": updates},
        upsert=True,
    )


def save_conversation(session_id: str, node_id: str, role: str, content: str):
    """Save a conversation message to MongoDB."""
    col = _db()["curious_conversations"]
    col.insert_one({
        "session_id": session_id,
        "node_id": node_id,
        "role": role,
        "content": content,
        "timestamp": time.time(),
    })


def log_misconception(session_id: str, node_id: str, misconception_id: str):
    """Log a detected misconception."""
    col = _db()["misconception_logs"]
    col.insert_one({
        "session_id": session_id,
        "node_id": node_id,
        "misconception_id": misconception_id,
        "timestamp": time.time(),
    })


# ── Node-specific suggestions ────────────────────────────────────────────

NODE_SUGGESTIONS: Dict[str, List[str]] = {
    "what_is_motion": [
        "If I'm sitting on a moving train, am I at rest or in motion?",
        "Why do we say motion is relative?",
        "What did Galileo discover about motion on his ship?",
        "Can something be still and moving at the same time?",
    ],
    "speed_and_velocity": [
        "What's the real difference between speed and velocity?",
        "Can speed stay the same while velocity changes?",
        "How do vectors help us describe motion?",
        "Why does direction matter in physics?",
    ],
    "acceleration": [
        "What does it feel like to accelerate?",
        "Can something accelerate while moving at constant speed?",
        "What's the difference between speeding up and accelerating?",
        "What happens to acceleration in free fall?",
    ],
    "newtons_first_law": [
        "Why does a ball keep rolling even after I stop pushing?",
        "What would happen if friction disappeared?",
        "How is inertia different from mass?",
        "Why do passengers lurch forward when a bus brakes?",
    ],
    "newtons_second_law": [
        "Why is F=ma so important?",
        "How does mass affect acceleration?",
        "What happens when multiple forces act at once?",
        "How do we measure force?",
    ],
    "newtons_third_law": [
        "If every action has a reaction, why do things move?",
        "Does the Earth pull on me as much as I pull on it?",
        "How do rockets work in empty space?",
        "What's the difference between action-reaction and balanced forces?",
    ],
    "friction_and_resistance": [
        "Why does friction sometimes help us?",
        "What would a world without friction look like?",
        "How does air resistance affect falling objects?",
        "Why do heavier cars brake faster than lighter ones?",
    ],
    "gravity_and_free_fall": [
        "Do heavier objects fall faster?",
        "What did Galileo prove about falling objects?",
        "What does it mean to be in free fall?",
        "Why do astronauts float in the space station?",
    ],
}


def get_suggestions_for_node(node_id: str) -> List[str]:
    """Get context-appropriate suggestions for a node."""
    return NODE_SUGGESTIONS.get(node_id, [
        "What's the key idea behind this concept?",
        "How does this connect to everyday experience?",
        "Can you help me build intuition for this?",
        "What's the most surprising thing about this concept?",
    ])


# ── Student Energy Detection ──────────────────────────────────────────────

def detect_student_energy(message: str) -> str:
    """
    Analyse the student's message to gauge their energy level.
    Returns: "low", "medium", or "high"

    Signals:
    - High: exclamation marks, ALL CAPS words, long messages, enthusiasm words
    - Low: very short messages, hedging language, uncertainty markers
    - Medium: everything else
    """
    words = message.split()
    word_count = len(words)
    exclamation_count = message.count("!")
    question_count = message.count("?")
    upper_words = sum(1 for w in words if w.isupper() and len(w) > 1)

    # Enthusiasm markers
    enthusiasm_words = [
        "wow", "cool", "amazing", "fascinating", "incredible",
        "love", "awesome", "whoa", "mind-blowing", "brilliant",
        "interesting", "curious", "excited", "wait",
    ]
    msg_lower = message.lower()
    enthusiasm_count = sum(1 for w in enthusiasm_words if w in msg_lower)

    # Uncertainty markers
    uncertainty_words = [
        "idk", "i guess", "maybe", "not sure", "confused",
        "don't get", "lost", "stuck", "huh", "um",
    ]
    uncertainty_count = sum(1 for w in uncertainty_words if w in msg_lower)

    # Scoring
    high_signals = exclamation_count + upper_words + enthusiasm_count
    low_signals = uncertainty_count + (1 if word_count <= 3 else 0)

    if high_signals >= 2 or (word_count > 40 and enthusiasm_count >= 1):
        return "high"
    if low_signals >= 2 or (word_count <= 3 and question_count == 0):
        return "low"
    return "medium"


# ── Teaching Orchestrator ─────────────────────────────────────────────────


class TeachingOrchestrator:
    """
    Coordinates the full teaching pipeline:
    1. Classify intent
    2. Detect misconceptions
    3. Manage micro-question sequences
    4. Build adaptive system prompt
    5. Stream GPT-5.2-chat response
    6. Generate images inline
    7. Update user state
    """

    def __init__(self, session_id: str, node_id: str, module_id: str = "motion_forces"):
        self.session_id = session_id
        self.node_id = node_id
        self.module_id = module_id

        # Load knowledge for this node
        self.knowledge = get_node_knowledge(node_id) or {}

        # Load user state
        self.user_state = get_user_state(session_id, node_id)

        # Misconception detector
        self.detector = MisconceptionDetector(self.knowledge) if self.knowledge else None

    def _build_display_name(self) -> str:
        return self.knowledge.get("display_name", self.node_id.replace("_", " ").title())

    async def process_message(
        self,
        user_message: str,
        history: List[Dict],
    ) -> AsyncGenerator[dict, None]:
        """
        Process a student message and yield SSE events.

        Event types:
          {"type": "token",  "content": "word "}
          {"type": "image",  "base64": "...", "mime": "image/png", "description": "..."}
          {"type": "done",   "intent": "...", "depth": 1}
          {"type": "error",  "content": "..."}
          {"type": "suggestions", "items": [...]}
        """

        # 1. Save user message
        await asyncio.to_thread(save_conversation, self.session_id, self.node_id, "user", user_message)

        # 2. Classify intent
        intent = classify_intent(user_message)

        # 3. Analyse response quality
        quality = analyse_response_quality(user_message)

        # 4. Update user state based on quality
        state_updates = {
            "messages_count": self.user_state.get("messages_count", 0) + 1,
            "reasoning_quality_score": quality["quality_score"],
            "terminology": quality["complexity"],
        }

        # Track go_deeper requests
        if intent in (IntentType.GO_DEEPER, IntentType.DEEP_THEORY):
            gd = self.user_state.get("go_deeper_count", 0) + 1
            state_updates["go_deeper_count"] = gd
            # Adapt depth based on repeated deeper requests
            if gd >= 3:
                state_updates["depth_level"] = min(5, self.user_state.get("depth_level", 1) + 1)
            elif gd >= 1 and quality["quality_score"] > 0.6:
                state_updates["depth_level"] = min(5, self.user_state.get("depth_level", 1) + 1)

        # Misconception handling
        micro_q_override = None
        if self.detector:
            misconception_id = self.detector.detect(user_message)
            if misconception_id:
                log_misconception(self.session_id, self.node_id, misconception_id)
                if misconception_id not in self.user_state.get("misconceptions_detected", []):
                    state_updates.setdefault("misconceptions_detected", 
                        self.user_state.get("misconceptions_detected", []))
                    state_updates["misconceptions_detected"].append(misconception_id)

                # Check if we should start or continue micro-questions
                if self.user_state.get("micro_q_active") and self.user_state.get("micro_q_misconception_id") == misconception_id:
                    # Continue existing sequence
                    path = self.detector.get_path(misconception_id)
                    if path:
                        ctrl = MicroQController(
                            current_index=self.user_state.get("micro_q_index", 0)
                        )
                        analysis = ctrl.analyse_response(user_message)
                        ctrl.update(analysis)

                        if ctrl.should_continue():
                            mq = ctrl.next_question(path.micro_questions)
                            if mq:
                                micro_q_override = mq.text
                                state_updates["micro_q_index"] = ctrl.current_index
                            else:
                                # End sequence
                                closure = self.detector.select_closure(
                                    misconception_id, quality["quality_score"],
                                    analysis.get("shows_frustration", False)
                                )
                                micro_q_override = closure[1]
                                state_updates["micro_q_active"] = False
                                state_updates["micro_q_index"] = 0
                        else:
                            # End sequence (understanding or frustration)
                            closure = self.detector.select_closure(
                                misconception_id, quality["quality_score"],
                                analysis.get("shows_frustration", False)
                            )
                            micro_q_override = closure[1]
                            state_updates["micro_q_active"] = False
                            state_updates["micro_q_index"] = 0
                else:
                    # Start new micro-question sequence
                    path = self.detector.get_path(misconception_id)
                    if path and path.micro_questions:
                        ctrl = MicroQController()
                        mq = ctrl.next_question(path.micro_questions)
                        if mq:
                            micro_q_override = mq.text
                            state_updates["micro_q_active"] = True
                            state_updates["micro_q_misconception_id"] = misconception_id
                            state_updates["micro_q_index"] = ctrl.current_index

        # Apply state updates
        merged_state = {**self.user_state, **state_updates}
        await asyncio.to_thread(update_user_state, self.session_id, self.node_id, state_updates)

        # 5. If micro-question override, send it directly (no GPT call needed)
        if micro_q_override:
            for char in micro_q_override:
                yield {"type": "token", "content": char}
            await asyncio.to_thread(save_conversation, self.session_id, self.node_id, "assistant", micro_q_override)
            yield {"type": "done", "intent": intent.value, "depth": merged_state.get("depth_level", 1)}
            return

        # 5b. Detect student energy for tone selection
        energy = detect_student_energy(user_message)

        # 6. Build system prompt (with intent + energy for tone adaptation)
        system_prompt = build_teaching_system_prompt(
            module_id=self.module_id,
            node_id=self.node_id,
            display_name=self._build_display_name(),
            user_state=merged_state,
            knowledge=self.knowledge,
            intent=intent.value,
            student_energy=energy,
        )

        # 7. Build messages for GPT
        messages = [{"role": "system", "content": system_prompt}]

        # Add conversation history (last 20 for context, trimmed)
        for msg in history[-20:]:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })

        # Add current message
        messages.append({"role": "user", "content": user_message})

        # 8. Stream from GPT-5.2-chat
        full_response = ""
        media_buffer = ""       # buffer for both [IMAGE:] and [VIDEO:] tags
        in_media_tag = False
        teaching_filter = StreamingDignityFilter()  # sentence-buffered filter

        try:
            # Use streaming endpoint
            stream_endpoint = _get_azure_endpoint()
            payload = {
                "messages": messages,
                "max_completion_tokens": 6000,
                "stream": True,
            }

            async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
                async with client.stream(
                    "POST",
                    stream_endpoint,
                    json=payload,
                    headers={
                        "api-key": _get_azure_key(),
                        "Content-Type": "application/json",
                    },
                ) as resp:
                    resp.raise_for_status()

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break

                        try:
                            chunk = json.loads(data_str)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            token = delta.get("content", "")
                            if not token:
                                continue
                        except Exception:
                            continue

                        full_response += token

                        # Check for [IMAGE: ...] or [VIDEO: ...] tags mid-stream
                        for char in token:
                            if char == "[" and not in_media_tag:
                                # Might be start of a media tag
                                media_buffer = "["
                                in_media_tag = True
                            elif in_media_tag:
                                media_buffer += char
                                if char == "]":
                                    # Check if it's a complete IMAGE or VIDEO tag
                                    image_tags = extract_image_tags(media_buffer)
                                    video_tags = extract_video_tags(media_buffer)

                                    if image_tags:
                                        # ── IMAGE TAG ──
                                        desc = image_tags[0]
                                        logger.info(f"IMAGE tag intercepted: {desc[:60]}")
                                        yield {"type": "image_generating", "description": desc}
                                        img = await generate_image(desc)
                                        if img:
                                            yield {"type": "image", **img}
                                        else:
                                            yield {"type": "image_failed", "description": desc}
                                    elif video_tags:
                                        # ── VIDEO TAG ──
                                        desc = video_tags[0]
                                        logger.info(f"VIDEO tag intercepted: {desc[:60]}")
                                        yield {"type": "video_generating", "description": desc}
                                        vid = await generate_video(desc)
                                        if vid:
                                            yield {"type": "video", **vid}
                                        else:
                                            yield {"type": "video_failed", "description": desc}
                                    else:
                                        # Not a media tag — emit buffered text
                                        yield {"type": "token", "content": media_buffer}

                                    media_buffer = ""
                                    in_media_tag = False
                                elif len(media_buffer) > 2000:
                                    # Too long — not a media tag, flush as text
                                    yield {"type": "token", "content": media_buffer}
                                    media_buffer = ""
                                    in_media_tag = False
                            else:
                                # Route through sentence-buffered dignity filter
                                filtered = teaching_filter.feed(char)
                                if filtered:
                                    yield {"type": "token", "content": filtered}

            # Flush remaining buffers
            if media_buffer:
                yield {"type": "token", "content": media_buffer}
            remaining = teaching_filter.flush()
            if remaining:
                yield {"type": "token", "content": remaining}

            # Save full response (strip media tags, normalize LaTeX, apply dignity filter)
            clean_response = strip_all_media_tags(full_response)
            clean_response = normalize_latex_delimiters(clean_response)

            # Score raw text BEFORE filtering (accurate dignity metrics)
            raw_d_score = dignity_scorer.score(clean_response)

            # Apply dignity filter
            clean_response = dignity_filter.filter_response(clean_response)

            await asyncio.to_thread(save_conversation, self.session_id, self.node_id, "assistant", clean_response)

            # Log dignity metric
            await asyncio.to_thread(
                log_dignity_score,
                self.session_id, "", clean_response,
                raw_d_score, depth_level=merged_state.get("depth_level", 1),
                intent=intent.value,
            )
            logger.info(f"Dignity score (raw): {raw_d_score:.2f}")

        except Exception as exc:
            logger.error(f"GPT streaming error: {exc}")
            # Save partial response if we have content
            if full_response:
                try:
                    partial = strip_all_media_tags(full_response)
                    partial = normalize_latex_delimiters(partial)
                    partial = dignity_filter.filter_response(partial)
                    await asyncio.to_thread(
                        save_conversation, self.session_id, self.node_id,
                        "assistant", partial + "\n\n*(Response interrupted due to an error.)*",
                    )
                except Exception:
                    pass
            yield {"type": "error", "content": f"Something went wrong: {str(exc)}"}

        # 9. Yield done event
        yield {
            "type": "done",
            "intent": intent.value,
            "depth": merged_state.get("depth_level", 1),
        }

        # 10. Yield dynamic suggestions based on context
        suggestions = self._generate_followup_suggestions(intent, merged_state)
        if suggestions:
            yield {"type": "suggestions", "items": suggestions}

    def _generate_followup_suggestions(self, intent: IntentType, state: Dict) -> List[str]:
        """Generate context-aware follow-up suggestions."""
        depth = state.get("depth_level", 1)
        base = []

        if depth <= 2:
            base = [
                "Can you give me an everyday example?",
                "Why is this important to understand?",
                "What's the intuition behind this?",
            ]
        elif depth <= 4:
            base = [
                "Can you show me the mathematics?",
                "How does this connect to other concepts?",
                "What are the edge cases?",
            ]
        else:
            base = [
                "How does this relate to modern physics?",
                "What are the open problems here?",
                "Can you derive this from first principles?",
            ]

        # Add intent-specific suggestion
        if intent == IntentType.CONFUSION:
            base.insert(0, "Let me try to explain it in my own words")
        elif intent == IntentType.APPLICATION:
            base.insert(0, "Can you go deeper into the theory?")

        return base[:4]
