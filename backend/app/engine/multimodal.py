"""
Multi-Modal Content Generator

Uses:
  - Google Imagen 4 Ultra  → physics visuals, concept art
  - Google Veo 3           → short conceptual animations (stubbed)
  - GPT-5.2-chat           → SVG diagrams, quiz JSON
"""

from __future__ import annotations

import os
import re
import json
import base64
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)


# ── Config ────────────────────────────────────────────────────────────────

def _get_google_ai_key() -> str:
    return os.getenv("GOOGLE_AI_KEY", "")

def _get_azure_endpoint() -> str:
    return os.getenv("AZURE_OPENAI_ENDPOINT", "")

def _get_azure_key() -> str:
    return os.getenv("AZURE_OPENAI_API_KEY", "")

IMAGEN_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "imagen-4.0-ultra-generate-001:predict"
)

# Veo model — auto-detected best available: veo-3.0-generate-001
# Uses predictLongRunning (async generation + polling)
VEO_MODEL = "veo-3.0-generate-001"
VEO_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    f"{VEO_MODEL}:predictLongRunning"
)

# Polling config
VEO_POLL_INTERVAL = 3      # seconds between polls
VEO_MAX_POLL_TIME = 120    # max seconds to wait


# ── Image generation (Imagen 4 Ultra) ────────────────────────────────────


async def generate_image(description: str) -> Optional[dict]:
    """
    Generate a physics educational image via Google Imagen 4 Ultra.

    Returns {"type": "image", "base64": "<data>", "mime": "image/png"}
    or None on failure.
    """
    google_key = _get_google_ai_key()
    if not google_key:
        logger.warning("GOOGLE_AI_KEY not configured — skipping image gen")
        return None

    prompt = (
        f"Educational physics illustration, clean scientific diagram style, "
        f"textbook quality, professional, labeled arrows and text annotations, "
        f"minimal colors, white background: {description}"
    )

    payload = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "sampleCount": 1,
            "aspectRatio": "16:9",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{IMAGEN_URL}?key={google_key}",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        logger.debug("Imagen response keys: %s", list(data.keys()))

        predictions = data.get("predictions", [])
        if not predictions:
            logger.warning("No predictions in response: %s", data)
            return None

        first = predictions[0]
        b64 = first.get("bytesBase64Encoded", "")
        mime = first.get("mimeType", "image/png")

        if not b64:
            logger.warning("No base64 in prediction: %s", list(first.keys()))
            return None

        logger.info("Image generated, size=%d chars", len(b64))
        return {
            "type": "image",
            "base64": b64,
            "mime": mime,
            "description": description,
        }

    except Exception as exc:
        logger.error("Imagen failed: %s", exc)
        return None


# ── Video generation (Veo 3 — predictLongRunning) ────────────────────────


async def generate_video(description: str) -> Optional[dict]:
    """
    Generate a short conceptual animation via Google Veo 3.

    Flow:
      1. POST to predictLongRunning → get operation name
      2. Poll operation until done
      3. Extract video bytes (base64)

    Returns {"type": "video", "base64": "...", "mime": "video/mp4", "description": "..."}
    or None on failure.
    """
    import asyncio

    google_key = _get_google_ai_key()
    if not google_key:
        logger.warning("GOOGLE_AI_KEY not configured — skipping video gen")
        return None

    prompt = (
        f"Educational physics animation, clean scientific style, "
        f"smooth motion, labeled vectors and forces shown as animated arrows, "
        f"white or dark background, professional: {description}"
    )

    payload = {
        "instances": [{"prompt": prompt}],
        "parameters": {
            "aspectRatio": "16:9",
            "sampleCount": 1,
            "durationSeconds": 6,
        },
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Step 1: Start long-running generation
            logger.debug("Veo POST to %s", VEO_URL)
            resp = await client.post(
                f"{VEO_URL}?key={google_key}",
                json=payload,
            )
            if resp.status_code != 200:
                logger.error("Veo API error %d: %s", resp.status_code, resp.text[:500])
                return None
            op_data = resp.json()

        op_name = op_data.get("name", "")
        if not op_name:
            logger.warning("Veo returned no operation name: %s", op_data)
            return None

        logger.info("Veo operation started: %s", op_name)

        # Step 2: Poll for completion
        poll_url = f"https://generativelanguage.googleapis.com/v1beta/{op_name}?key={google_key}"
        elapsed = 0

        async with httpx.AsyncClient(timeout=30.0) as client:
            while elapsed < VEO_MAX_POLL_TIME:
                await asyncio.sleep(VEO_POLL_INTERVAL)
                elapsed += VEO_POLL_INTERVAL

                poll_resp = await client.get(poll_url)
                if poll_resp.status_code != 200:
                    logger.error("Veo poll error %d: %s", poll_resp.status_code, poll_resp.text[:300])
                    return None
                poll_data = poll_resp.json()

                if poll_data.get("done"):
                    logger.info("Veo operation done after %ds", elapsed)
                    break

                logger.debug("Veo polling... %ds elapsed", elapsed)
            else:
                logger.warning("Veo timed out after %ds", VEO_MAX_POLL_TIME)
                return None

        # Step 3: Extract video from response
        result = poll_data.get("response", poll_data.get("result", {}))

        # Veo returns videos in generateVideoResponse.generatedSamples
        gen_response = result.get("generateVideoResponse", result)
        samples = gen_response.get("generatedSamples", [])

        if not samples:
            # Fallback: check predictions format
            predictions = result.get("predictions", [])
            if predictions:
                first = predictions[0]
                b64 = first.get("bytesBase64Encoded", "")
                mime = first.get("mimeType", "video/mp4")
                if b64:
                    logger.info("Video generated (predictions), size=%d chars", len(b64))
                    return {
                        "type": "video",
                        "base64": b64,
                        "mime": mime,
                        "description": description,
                    }

            logger.warning("Veo no samples in response: %s", list(result.keys()))
            return None

        first_sample = samples[0]
        logger.debug("Veo sample keys: %s", list(first_sample.keys()))
        video_data = first_sample.get("video", {})
        logger.debug("Veo video_data keys: %s", list(video_data.keys()))
        b64 = video_data.get("bytesBase64Encoded", "")
        mime = video_data.get("mimeType", "video/mp4")
        uri = video_data.get("uri", "") or video_data.get("fileUri", "")

        if b64:
            logger.info("Video generated (base64), size=%d chars", len(b64))
            return {
                "type": "video",
                "base64": b64,
                "mime": mime,
                "description": description,
            }
        elif uri:
            # If Veo returns a URI instead of base64, download it
            # Append API key and follow redirects
            download_url = uri
            if "?" in download_url:
                download_url += f"&key={google_key}"
            else:
                download_url += f"?key={google_key}"
            logger.info("Downloading video from URI: %s...", download_url[:80])
            async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
                dl_resp = await client.get(download_url)
                dl_resp.raise_for_status()
                b64 = base64.b64encode(dl_resp.content).decode("utf-8")
                mime = dl_resp.headers.get("content-type", "video/mp4")
                logger.info("Video downloaded from URI, size=%d chars", len(b64))
                return {
                    "type": "video",
                    "base64": b64,
                    "mime": mime,
                    "description": description,
                }

        logger.warning("Veo sample has no video data: %s", list(first_sample.keys()))
        return None

    except Exception as exc:
        import traceback
        logger.error("Veo generation failed: %s", exc)
        traceback.print_exc()
        return None


# ── Quiz generation (GPT-5.2-chat) ───────────────────────────────────────


async def generate_quiz(
    concept: str,
    context: str,
    difficulty: int = 2,
) -> Optional[dict]:
    """Generate conceptual quiz questions using GPT-5.2-chat."""
    azure_endpoint = _get_azure_endpoint()
    azure_key = _get_azure_key()
    if not azure_endpoint or not azure_key:
        return None

    prompt = f"""Generate 3 conceptual physics questions about:

Concept: {concept}
Context: {context}
Difficulty: {difficulty}/5

Requirements:
- Test understanding, not memorization
- Include one misconception trap
- Multiple choice (4 options each)
- Provide explanations for each answer

Return ONLY valid JSON:
{{
  "questions": [
    {{
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct": "B",
      "explanations": {{
        "A": "...",
        "B": "...",
        "C": "...",
        "D": "..."
      }}
    }}
  ]
}}"""

    payload = {
        "messages": [
            {"role": "system", "content": "You are an expert physics educator. Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        "max_completion_tokens": 2000,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                azure_endpoint,
                json=payload,
                headers={
                    "api-key": azure_key,
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            result = resp.json()

        text = result["choices"][0]["message"]["content"].strip()
        # Strip markdown code fences if present
        text = re.sub(r"^```json?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        return json.loads(text)

    except Exception as exc:
        logger.error("Quiz generation failed: %s", exc)
        return None


# ── SVG diagram generation (GPT-5.2-chat) ────────────────────────────────


async def generate_svg_diagram(concept: str, context: str) -> Optional[str]:
    """Generate an SVG diagram using GPT-5.2-chat. Returns SVG string."""
    azure_endpoint = _get_azure_endpoint()
    azure_key = _get_azure_key()
    if not azure_endpoint or not azure_key:
        return None

    prompt = f"""Generate clean, educational SVG code for this physics concept:

Concept: {concept}
Context: {context}

Requirements:
- Simple, clear lines
- Labeled axes if coordinate system
- Arrows for vectors
- Text labels for components
- Professional physics textbook style
- Width: 600px, Height: 400px
- Use only black, blue (#3B82F6), red (#EF4444) for emphasis

Output ONLY the SVG code, no explanation."""

    payload = {
        "messages": [
            {"role": "system", "content": "You generate educational physics SVG diagrams. Return only SVG code."},
            {"role": "user", "content": prompt},
        ],
        "max_completion_tokens": 1700,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                azure_endpoint,
                json=payload,
                headers={
                    "api-key": azure_key,
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            result = resp.json()

        svg = result["choices"][0]["message"]["content"].strip()
        svg = re.sub(r"^```svg?\s*", "", svg)
        svg = re.sub(r"\s*```$", "", svg)
        return svg

    except Exception as exc:
        logger.error("SVG generation failed: %s", exc)
        return None


# ── Inline image extraction from GPT response ────────────────────────────


IMAGE_TAG_RE = re.compile(r"\[IMAGE:\s*(.+?)\]", re.IGNORECASE)
VIDEO_TAG_RE = re.compile(r"\[VIDEO:\s*(.+?)\]", re.IGNORECASE)
MEDIA_TAG_RE = re.compile(r"\[(IMAGE|VIDEO):\s*(.+?)\]", re.IGNORECASE)


def extract_image_tags(text: str) -> list[str]:
    """Extract [IMAGE: description] tags from GPT output."""
    return IMAGE_TAG_RE.findall(text)


def extract_video_tags(text: str) -> list[str]:
    """Extract [VIDEO: description] tags from GPT output."""
    return VIDEO_TAG_RE.findall(text)


def extract_media_tags(text: str) -> list[tuple[str, str]]:
    """Extract all [IMAGE: ...] and [VIDEO: ...] tags. Returns list of (type, description)."""
    return [(t.upper(), d) for t, d in MEDIA_TAG_RE.findall(text)]


def strip_image_tags(text: str) -> str:
    """Remove [IMAGE: ...] tags from text."""
    return IMAGE_TAG_RE.sub("", text).strip()


def strip_video_tags(text: str) -> str:
    """Remove [VIDEO: ...] tags from text."""
    return VIDEO_TAG_RE.sub("", text).strip()


def strip_all_media_tags(text: str) -> str:
    """Remove both [IMAGE: ...] and [VIDEO: ...] tags from text."""
    return MEDIA_TAG_RE.sub("", text).strip()
