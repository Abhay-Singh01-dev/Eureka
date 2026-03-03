"""
Dashboard Cognitive Orchestrator — full intelligence pipeline.

Pipeline per message:
  1.  Hybrid Classifier (rule-based → GPT fallback)
  2.  Cognitive Profile load + EMA preparation
  3.  Conversation State load + depth/tone derivation
  4.  Misconception gate (insert Socratic micro-question if detected)
  5.  Spontaneous challenge gate (controlled)
  6.  RAG retrieval
  7.  Dynamic system prompt assembly
  8.  GPT-5.2-chat streaming
  9.  Media tag interception (IMAGE / VIDEO)
  10. Post-response: save message, update conversation state, update profile EMA
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from typing import AsyncGenerator, Dict, List, Optional

logger = logging.getLogger(__name__)

import httpx

from app.config import AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY
from app.database import get_db
from app.engine.dashboard_prompt import build_dashboard_system_prompt
from app.engine.dashboard_classifier import classify_message
from app.engine.dashboard_cognitive import (
    get_or_create_profile,
    get_profile_dict,
    update_profile_ema,
    get_or_create_conv_state,
    get_conv_state_dict,
    update_conv_state,
    increment_challenge_count,
)
from app.engine.dashboard_challenge_engine import ChallengeEngine
from app.engine.dashboard_consistency_tracker import ConsistencyTracker
from app.engine.dashboard_rag import (
    retrieve_context,
    format_rag_context,
)
from app.engine.latex_formatter import normalize_latex_delimiters
from app.engine.multimodal import (
    generate_image,
    generate_video,
    extract_image_tags,
    extract_video_tags,
    strip_all_media_tags,
)
from app.engine.dignity_filter import dignity_filter, StreamingDignityFilter
from app.engine.dignity_scorer import dignity_scorer, log_dignity_score
from app.engine.confusion_handler import detect_confusion, build_confusion_system_injection


# ── Config (centralised in app.config / app.database) ─────────────────────


def _db():
    return get_db()


# ── Conversation Persistence ─────────────────────────────────────────────

def ensure_conversation(
    conversation_id: str,
    first_message: str = "",
    user_id: str = "",
):
    """Create conversation if it doesn't exist. Title from first message."""
    col = _db()["dashboard_chats"]
    existing = col.find_one({"conversation_id": conversation_id})
    if not existing:
        title = first_message[:60].strip() or "New Chat"
        col.insert_one({
            "conversation_id": conversation_id,
            "user_id": user_id,
            "title": title,
            "created_at": time.time(),
            "updated_at": time.time(),
        })
    else:
        col.update_one(
            {"conversation_id": conversation_id},
            {"$set": {"updated_at": time.time()}},
        )


def save_message(
    conversation_id: str,
    role: str,
    content: str,
    images: Optional[List[Dict]] = None,
    videos: Optional[List[Dict]] = None,
):
    """Save a single message, optionally with images/videos."""
    doc = {
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "timestamp": time.time(),
    }
    if images:
        doc["images"] = images
    if videos:
        doc["videos"] = videos
    _db()["dashboard_messages"].insert_one(doc)


def get_conversation_messages(conversation_id: str) -> List[Dict]:
    """Return all messages for a conversation, oldest first."""
    col = _db()["dashboard_messages"]
    return list(
        col.find(
            {"conversation_id": conversation_id},
            {"_id": 0, "role": 1, "content": 1, "timestamp": 1,
             "images": 1, "videos": 1},
        ).sort("timestamp", 1)
    )


def get_all_conversations(limit: int = 50) -> List[Dict]:
    """Return recent conversations, newest first."""
    col = _db()["dashboard_chats"]
    return list(
        col.find(
            {},
            {"_id": 0, "conversation_id": 1, "title": 1, "created_at": 1, "updated_at": 1},
        ).sort("updated_at", -1).limit(limit)
    )


def search_conversations(query: str, limit: int = 20) -> List[Dict]:
    """Search conversations by title and message content."""
    chats_col = _db()["dashboard_chats"]
    msgs_col = _db()["dashboard_messages"]

    title_hits = list(
        chats_col.find(
            {"title": {"$regex": query, "$options": "i"}},
            {"_id": 0, "conversation_id": 1, "title": 1, "created_at": 1, "updated_at": 1},
        ).sort("updated_at", -1).limit(limit)
    )

    msg_hits = list(
        msgs_col.find(
            {"content": {"$regex": query, "$options": "i"}},
            {"_id": 0, "conversation_id": 1},
        ).limit(limit * 2)
    )

    title_ids = {c["conversation_id"] for c in title_hits}
    extra_ids = {m["conversation_id"] for m in msg_hits} - title_ids

    if extra_ids:
        extras = list(
            chats_col.find(
                {"conversation_id": {"$in": list(extra_ids)}},
                {"_id": 0, "conversation_id": 1, "title": 1, "created_at": 1, "updated_at": 1},
            ).sort("updated_at", -1)
        )
        title_hits.extend(extras)

    title_hits.sort(key=lambda x: x.get("updated_at", 0), reverse=True)
    return title_hits[:limit]


def delete_conversation(conversation_id: str):
    """Delete a conversation and all its messages + state."""
    _db()["dashboard_chats"].delete_one({"conversation_id": conversation_id})
    _db()["dashboard_messages"].delete_many({"conversation_id": conversation_id})
    _db()["dashboard_conv_state"].delete_one({"conversation_id": conversation_id})


def rename_conversation(conversation_id: str, new_title: str) -> bool:
    """Rename a conversation. Returns True if found and updated."""
    import time
    result = _db()["dashboard_chats"].update_one(
        {"conversation_id": conversation_id},
        {"$set": {"title": new_title.strip(), "updated_at": time.time()}},
    )
    return result.matched_count > 0


# ── Topic Detection (lightweight) ────────────────────────────────────────

_TOPIC_KEYWORDS = {
    "physics": [
        "force", "velocity", "acceleration", "momentum", "gravity", "mass",
        "energy", "thermodynamic", "entropy", "quantum", "wave", "particle",
        "electron", "photon", "relativity", "optics", "magnetic",
        "electromagnetic", "circuit", "resistance", "friction", "torque",
    ],
    "mathematics": [
        "derivative", "integral", "equation", "proof", "theorem", "matrix",
        "vector", "eigenvalue", "topology", "algebra", "calculus", "geometry",
        "polynomial", "function", "limit", "convergence", "probability",
        "statistics", "set theory", "number theory", "logarithm",
    ],
    "computer_science": [
        "algorithm", "data structure", "recursion", "complexity", "binary",
        "sorting", "graph", "tree", "hash", "programming", "machine learning",
        "neural network", "compiler", "operating system", "database",
        "encryption", "api", "oop", "functional programming",
    ],
    "chemistry": [
        "molecule", "atom", "bond", "reaction", "acid", "base", "ion",
        "oxidation", "reduction", "organic", "inorganic", "periodic table",
        "mole", "stoichiometry", "catalyst", "polymer", "solution",
    ],
    "biology": [
        "cell", "dna", "rna", "protein", "gene", "evolution", "mitosis",
        "meiosis", "photosynthesis", "respiration", "ecosystem", "neuron",
        "enzyme", "hormone", "immune", "bacteria", "virus",
    ],
    "artificial_intelligence": [
        "ai", "machine learning", "deep learning", "neural net", "transformer",
        "gpt", "llm", "reinforcement learning", "nlp", "computer vision",
        "attention mechanism", "embedding", "fine-tuning", "training",
        "backpropagation", "gradient descent",
    ],
}


def _detect_topic(message: str) -> Optional[str]:
    """Detect the primary subject area from the message."""
    msg_lower = message.lower()
    scores: Dict[str, int] = {}
    for topic, keywords in _TOPIC_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in msg_lower)
        if count > 0:
            scores[topic] = count

    if not scores:
        return None

    return max(scores, key=scores.get)


# ── Orchestrator ──────────────────────────────────────────────────────────

class DashboardOrchestrator:
    """
    Full cognitive engine pipeline:

      User Message
        → Hybrid Classifier
        → Topic Detection
        → Cognitive Profile Load
        → Conversation State Update
        → Depth + Tone Computation
        → Misconception Gate
        → Spontaneous Challenge Gate
        → RAG Retrieval
        → Dynamic System Prompt Assembly
        → GPT-5.2-chat Streaming
        → Media Tag Interception
        → Post-Response Updates (state + profile EMA)
    """

    def __init__(self, conversation_id: str, user_id: str = ""):
        self.conversation_id = conversation_id
        self.user_id = user_id

    async def process_message(
        self,
        user_message: str,
        history: List[Dict],
        images: Optional[List[Dict]] = None,
    ) -> AsyncGenerator[dict, None]:
        """
        Process a user message and yield SSE events.

        Args:
            user_message: The user's text message.
            history: Previous messages [{role, content}].
            images: Optional list of attached images [{base64, mime, name}].

        Event types:
          {"type": "token",            "content": "..."}
          {"type": "image_generating", "description": "..."}
          {"type": "image",            "base64": "...", "mime": "...", "description": "..."}
          {"type": "image_failed",     "description": "..."}
          {"type": "video_generating", "description": "..."}
          {"type": "video",            "base64": "...", "mime": "...", "description": "..."}
          {"type": "video_failed",     "description": "..."}
          {"type": "done"}
          {"type": "error",            "content": "..."}
        """
        attached_images = images or []
        logger.info("=" * 60)
        logger.info("Processing message for user=%s...", self.user_id[:8])
        logger.info("Message: %s...", user_message[:80])

        # ── 0. Persist ──
        await asyncio.to_thread(ensure_conversation, self.conversation_id, user_message, self.user_id)
        # Save user message (with attached images if any)
        user_images_for_db = None
        if attached_images:
            user_images_for_db = [
                {"base64": img["base64"], "mime": img.get("mime", "image/png"), "description": img.get("name", "user attachment")}
                for img in attached_images
            ]
        await asyncio.to_thread(save_message, self.conversation_id, "user", user_message, user_images_for_db)

        # ── 1. Hybrid Classification ──
        classification = await classify_message(user_message, history)
        intent = classification.get("intent", "exploration")
        logger.info("Intent: %s | RQ: %.2f | Curiosity: %.2f | Misconception: %s",
                    intent, classification.get('reasoning_quality', 0),
                    classification.get('curiosity_level', 0),
                    classification.get('misconception_detected', False))

        # ── 1.25 CONFUSION DETECTION ──
        is_confused = detect_confusion(user_message)
        if is_confused:
            logger.info("CONFUSION FAST-PATH — student expressed confusion")

        # ── 1.5 UTILITY FAST-PATH ──
        # Non-academic queries (weather, time, shopping, news, etc.)
        # Skip heavy cognitive engines — no depth, RAG, misconception, challenge
        if intent == "utility_non_academic":
            logger.info("UTILITY MODE — skipping cognitive engines")

            profile = await asyncio.to_thread(get_profile_dict, self.user_id)
            system_prompt = build_dashboard_system_prompt(
                cognitive_profile=profile,
                conversation_state={"depth_level": 1},
                rag_context=None,
                intent=intent,
                classification=classification,
            )

            gpt_messages = [{"role": "system", "content": system_prompt}]
            # Only include last 6 messages for utility (lighter context)
            for msg in history[-6:]:
                gpt_messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })

            # Multimodal user message if images attached
            if attached_images:
                user_content_util: list = [{"type": "text", "text": user_message}]
                for img in attached_images:
                    data_url = f"data:{img.get('mime', 'image/png')};base64,{img['base64']}"
                    user_content_util.append({
                        "type": "image_url",
                        "image_url": {"url": data_url, "detail": "auto"},
                    })
                gpt_messages.append({"role": "user", "content": user_content_util})
            else:
                gpt_messages.append({"role": "user", "content": user_message})

            full_response = ""
            util_filter = StreamingDignityFilter()
            try:
                endpoint = AZURE_OPENAI_ENDPOINT
                payload = {
                    "messages": gpt_messages,
                    "max_completion_tokens": 1000,
                    "stream": True,
                }

                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(60.0, connect=15.0),
                ) as client:
                    async with client.stream(
                        "POST",
                        endpoint,
                        json=payload,
                        headers={
                            "api-key": AZURE_OPENAI_API_KEY,
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
                                token = (
                                    chunk.get("choices", [{}])[0]
                                    .get("delta", {})
                                    .get("content", "")
                                )
                                if not token:
                                    continue
                            except Exception:
                                continue
                            full_response += token
                            filtered = util_filter.feed(token)
                            if filtered:
                                yield {"type": "token", "content": filtered}

                # Flush remaining filter buffer
                remaining = util_filter.flush()
                if remaining:
                    yield {"type": "token", "content": remaining}

                # Score raw text, then full-pass filter for DB storage
                d_score = dignity_scorer.score(full_response)
                full_response = dignity_filter.filter_response(full_response)
                await asyncio.to_thread(save_message, self.conversation_id, "assistant", full_response)
                await asyncio.to_thread(
                    log_dignity_score,
                    self.conversation_id, self.user_id, full_response,
                    d_score, depth_level=1, intent=intent,
                )
                logger.info("UTILITY done. Response: %d chars | dignity=%.2f", len(full_response), d_score)

            except Exception as exc:
                logger.error("UTILITY streaming error: %s", exc)
                yield {"type": "error", "content": f"Something went wrong: {str(exc)}"}

            yield {"type": "done"}
            return  # Exit early — skip the full cognitive pipeline

        # ── 2. Topic Detection ──
        detected_topic = _detect_topic(user_message)
        if detected_topic:
            logger.info("Topic: %s", detected_topic)

        # ── 3. Cognitive Profile ──
        profile = await asyncio.to_thread(get_profile_dict, self.user_id)
        logger.info("Profile: style=%s | precision=%.2f | msgs=%d",
                    profile.get('reasoning_style'),
                    profile.get('precision_score', 0),
                    profile.get('message_count', 0))

        # ── 4. Conversation State ──
        # Ensure state exists (initial depth derived from profile)
        full_profile = await asyncio.to_thread(get_or_create_profile, self.user_id)
        conv_state_obj = await asyncio.to_thread(
            get_or_create_conv_state,
            self.conversation_id,
            self.user_id,
            profile=full_profile,
        )

        # Extract claims for consistency tracking (context-aware)
        user_claim = ConsistencyTracker.extract_claim(user_message, detected_topic)
        turn_number = len(history) + 1

        # Update state based on classification
        conv_state_obj = await asyncio.to_thread(
            update_conv_state,
            self.conversation_id,
            classification,
            detected_topic=detected_topic,
            user_claim=user_claim,
            turn_number=turn_number,
        )

        conv_state = await asyncio.to_thread(get_conv_state_dict, self.conversation_id)
        depth = conv_state.get("depth_level", 3)
        logger.info("Depth: %d/7 | RQ_avg: %.2f | Misconceptions: %d",
                    depth, conv_state.get('reasoning_score_avg', 0),
                    conv_state.get('misconception_count', 0))

        # ── 5. Misconception Gate (skipped during confusion fast-path) ──
        misconception_injection = ""
        if not is_confused and classification.get("misconception_detected", False):
            misconception_injection = (
                "\n\n[SYSTEM DIRECTIVE — MISCONCEPTION DETECTED]\n"
                "The student's last message contains a likely misconception. "
                "Do NOT correct it outright. Instead:\n"
                "1. Acknowledge what the student said\n"
                "2. Ask a targeted Socratic question that gently exposes the flaw\n"
                "3. Let them discover the error through their own reasoning\n"
                "4. Only after they engage, provide the correct understanding\n"
                "Keep your tone warm and non-judgmental.\n"
            )
            logger.info("Misconception gate: ACTIVE — Socratic micro-question injected")

        # ── 6. Spontaneous Challenge Gate (skipped during confusion fast-path) ──
        challenge_injection = ""
        if not is_confused and ChallengeEngine.should_challenge(profile, conv_state, classification, turn_number):
            challenge_injection = ChallengeEngine.build_challenge_injection()
            await asyncio.to_thread(increment_challenge_count, self.conversation_id, turn_number)
            logger.info("Challenge gate: ACTIVE — spontaneous challenge injected")

        # ── 7. RAG Retrieval ──
        rag_context = None
        if detected_topic:
            rag_concepts = await asyncio.to_thread(
                retrieve_context,
                user_message,
                depth_level=depth,
                max_results=3,
            )
            rag_context = format_rag_context(rag_concepts)
            if rag_context:
                logger.info("RAG: Retrieved context (%d chars)", len(rag_context))

        # ── 8. Dynamic System Prompt ──
        system_prompt = build_dashboard_system_prompt(
            cognitive_profile=profile,
            conversation_state=conv_state,
            rag_context=rag_context,
            intent=intent,
            classification=classification,
        )
        # Append misconception + challenge injections
        if misconception_injection:
            system_prompt += misconception_injection
        if challenge_injection:
            system_prompt += challenge_injection

        # ── 8.5 Confusion Fast-Path Injection ──
        if is_confused:
            system_prompt += build_confusion_system_injection()
            logger.info("Confusion injection: ACTIVE — simplest mode forced")

        # ── 9. Intellectual Consistency Context (via ConsistencyTracker) ──
        statement_log = conv_state.get("statement_log", [])
        if statement_log:
            contradictions = []
            if user_claim:
                contradictions = ConsistencyTracker.check_contradictions(
                    user_claim, statement_log
                )
                if contradictions:
                    logger.info("Contradiction detected: %d earlier claims", len(contradictions))

            consistency_text = ConsistencyTracker.format_consistency_context(
                statement_log, contradictions
            )
            if consistency_text:
                system_prompt += f"\n\n{consistency_text}\n"

        # ── 10. Build GPT messages ──
        gpt_messages = [{"role": "system", "content": system_prompt}]
        for msg in history[-20:]:
            gpt_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", ""),
            })

        # Build user message — multimodal if images attached, plain text otherwise
        if attached_images:
            user_content: list = [{"type": "text", "text": user_message}]
            for img in attached_images:
                data_url = f"data:{img.get('mime', 'image/png')};base64,{img['base64']}"
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": data_url, "detail": "auto"},
                })
            gpt_messages.append({"role": "user", "content": user_content})
        else:
            gpt_messages.append({"role": "user", "content": user_message})

        # ── 11. Stream from GPT-5.2-chat ──
        full_response = ""
        media_buffer = ""
        in_media_tag = False
        collected_images: List[Dict] = []
        collected_videos: List[Dict] = []
        char_count = 0  # track text position for insertAfterChar
        streaming_filter = StreamingDignityFilter()  # sentence-buffered filter

        try:
            endpoint = AZURE_OPENAI_ENDPOINT
            payload = {
                "messages": gpt_messages,
                "max_completion_tokens": 10000,
                "stream": True,
            }

            async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
                async with client.stream(
                    "POST",
                    endpoint,
                    json=payload,
                    headers={
                        "api-key": AZURE_OPENAI_API_KEY,
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
                            delta = (
                                chunk.get("choices", [{}])[0]
                                .get("delta", {})
                            )
                            token = delta.get("content", "")
                            if not token:
                                continue
                        except Exception:
                            continue

                        full_response += token

                        # Intercept [IMAGE: ...] and [VIDEO: ...] tags
                        for char in token:
                            if char == "[" and not in_media_tag:
                                media_buffer = "["
                                in_media_tag = True
                            elif in_media_tag:
                                media_buffer += char
                                if char == "]":
                                    image_tags = extract_image_tags(media_buffer)
                                    video_tags = extract_video_tags(media_buffer)

                                    if image_tags:
                                        desc = image_tags[0]
                                        logger.info("IMAGE: %s", desc[:60])
                                        yield {
                                            "type": "image_generating",
                                            "description": desc,
                                        }
                                        img = await generate_image(desc)
                                        if img:
                                            yield {"type": "image", **img}
                                            collected_images.append({
                                                "base64": img["base64"],
                                                "mime": img.get("mime", "image/png"),
                                                "description": desc,
                                                "insertAfterChar": char_count,
                                            })
                                        else:
                                            yield {
                                                "type": "image_failed",
                                                "description": desc,
                                            }
                                    elif video_tags:
                                        desc = video_tags[0]
                                        logger.info("VIDEO: %s", desc[:60])
                                        yield {
                                            "type": "video_generating",
                                            "description": desc,
                                        }
                                        vid = await generate_video(desc)
                                        if vid:
                                            yield {"type": "video", **vid}
                                            collected_videos.append({
                                                "base64": vid["base64"],
                                                "mime": vid.get("mime", "video/mp4"),
                                                "description": desc,
                                                "insertAfterChar": char_count,
                                            })
                                        else:
                                            yield {
                                                "type": "video_failed",
                                                "description": desc,
                                            }
                                    else:
                                        yield {
                                            "type": "token",
                                            "content": media_buffer,
                                        }

                                    media_buffer = ""
                                    in_media_tag = False
                                elif len(media_buffer) > 2000:
                                    yield {
                                        "type": "token",
                                        "content": media_buffer,
                                    }
                                    media_buffer = ""
                                    in_media_tag = False
                            else:
                                char_count += 1
                                # Route through sentence-buffered dignity filter
                                filtered = streaming_filter.feed(char)
                                if filtered:
                                    yield {"type": "token", "content": filtered}

            # Flush remaining buffers
            if media_buffer:
                yield {"type": "token", "content": media_buffer}
            remaining = streaming_filter.flush()
            if remaining:
                yield {"type": "token", "content": remaining}

            # ── 12. Post-response: Save + Update ──

            # Save assistant response (stripped of media tags, LaTeX normalized)
            clean_response = strip_all_media_tags(full_response)
            clean_response = normalize_latex_delimiters(clean_response)

            # Score raw text BEFORE filtering (accurate dignity metrics)
            raw_d_score = dignity_scorer.score(clean_response)

            # Apply dignity filter (full-pass cleanup for DB storage)
            clean_response = dignity_filter.filter_response(clean_response)

            await asyncio.to_thread(
                save_message,
                self.conversation_id, "assistant", clean_response,
                collected_images if collected_images else None,
                collected_videos if collected_videos else None,
            )

            # Log dignity metric (scored on raw text)
            await asyncio.to_thread(
                log_dignity_score,
                self.conversation_id, self.user_id, clean_response,
                raw_d_score, depth_level=depth, intent=intent,
                confusion_fastpath=is_confused,
            )

            # Update cognitive profile with EMA
            await asyncio.to_thread(
                update_profile_ema,
                self.user_id,
                classification,
                detected_topic,
            )

            logger.info("Done. Response: %d chars | dignity=%.2f | confused=%s",
                        len(clean_response), raw_d_score, is_confused)
            logger.info("=" * 60)

        except Exception as exc:
            logger.error("GPT streaming error: %s", exc)
            # Save partial response to DB if we have content
            if full_response:
                try:
                    partial = strip_all_media_tags(full_response)
                    partial = normalize_latex_delimiters(partial)
                    partial = dignity_filter.filter_response(partial)
                    await asyncio.to_thread(
                        save_message,
                        self.conversation_id, "assistant",
                        partial + "\n\n*(Response interrupted due to an error.)*",
                    )
                except Exception:
                    pass
            yield {
                "type": "error",
                "content": f"Something went wrong: {str(exc)}",
            }

        yield {"type": "done"}
