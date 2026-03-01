"""
Animation Engine — GPT-5.2 powered Manim-style animation generation.

Generates scene content, narration, visual elements from teacher blueprints.
Uses the same Azure OpenAI endpoint as the rest of Eureka.

Depth gating:
  - depth ≤ 2: plain clarity, minimal text, simple narration
  - depth 3–4: standard narration with annotations
  - depth ≥ 5: conceptual elegance, layered annotation, mathematical beauty
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx
from pymongo import MongoClient

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "eureka")

_mongo: Optional[MongoClient] = None


def _db():
    global _mongo
    if _mongo is None:
        _mongo = MongoClient(MONGO_URI)
    return _mongo[MONGO_DB]


def _get_azure_endpoint():
    return os.getenv("AZURE_OPENAI_ENDPOINT", "")


def _get_azure_key():
    return os.getenv("AZURE_OPENAI_API_KEY", "")


# ── GPT-5.2 Call ──────────────────────────────────────────────────────────


async def _call_gpt(prompt: str, system: str | None = None, max_tokens: int = 4000) -> Dict:
    """Call Azure OpenAI GPT-5.2 and return parsed JSON."""
    endpoint = _get_azure_endpoint()
    key = _get_azure_key()

    if not endpoint or not key:
        raise ValueError("Azure OpenAI credentials not configured")

    url = endpoint
    headers = {"Content-Type": "application/json", "api-key": key}

    payload = {
        "messages": [
            {
                "role": "system",
                "content": system
                or "You are an expert educational animation designer inspired by 3Blue1Brown's Manim style. You create clean, mathematically beautiful visual narratives. Respond with valid JSON only. Do not include markdown code fences or any text outside the JSON object.",
            },
            {"role": "user", "content": prompt},
        ],
        "max_completion_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    content: str = data["choices"][0]["message"]["content"]
    content = content.strip()
    if content.startswith("```"):
        content = content.split("```", 2)[1]
        if content.lower().startswith("json"):
            content = content[4:]
        if content.endswith("```"):
            content = content[: content.rfind("```")]
        content = content.strip()
    return json.loads(content)


# ── Depth gating ──────────────────────────────────────────────────────────


def _get_narration_style(depth: int) -> str:
    """Return narration style constraints based on cognitive depth."""
    if depth <= 2:
        return """NARRATION STYLE: PLAIN CLARITY
- Use simple, direct language
- No poetic or metaphorical language
- Maximum 40 words per narration segment
- Focus on what is happening visually
- Example: "The ball moves to the right. Its speed increases as gravity pulls it down."
"""
    elif depth <= 4:
        return """NARRATION STYLE: STANDARD
- Clear explanations with some conceptual depth
- Can reference underlying principles
- Maximum 60 words per narration segment
- Use analogies sparingly
- Example: "Notice how the velocity vector grows as the ball falls — that's gravity constantly adding to its downward speed."
"""
    else:
        return """NARRATION STYLE: CONCEPTUAL ELEGANCE
- Rich conceptual language with mathematical beauty
- Can reference deeper connections and symmetries
- Maximum 80 words per narration segment
- Encourage mathematical intuition
- Example: "Watch how the gradient field reveals the topology of the energy landscape — each contour line traces a path of constant potential, and the steepest descent always cuts perpendicular to these contours."
"""


def _get_visual_type_instructions(visual_type: str) -> str:
    """Return specific rendering instructions per visual type."""
    instructions = {
        "2d_graph": """VISUAL TYPE: 2D GRAPH (Manim-style)
Elements to define:
- axes: {x_range: [min, max, step], y_range: [min, max, step], x_label, y_label}
- graphs: [{expression (mathjs-safe), color, label, draw_style: "smooth"|"dashed"|"dotted"}]
- points: [{x, y, color, label, size}] — key points to highlight
- annotations: [{text, position, arrow_to}] — labels with optional arrows
Animation sequence should include:
1. Draw axes (handwriting style)
2. Plot graph curve progressively
3. Highlight key features (intercepts, extrema, etc.)
4. Show annotations""",

        "vector_field": """VISUAL TYPE: VECTOR FIELD (Manim-style)
Elements to define:
- field: {fx: "mathjs expr using x,y", fy: "mathjs expr using x,y"}
- bounds: {x: [min, max], y: [min, max]}
- resolution: 12-20 arrows per dimension
- flow_lines: [{start: [x,y], color}] — optional streamlines
- key_points: [{position: [x,y], label, type: "source"|"sink"|"saddle"}]
Animation: arrows should appear in a wave pattern from center outward""",

        "grid_transformation": """VISUAL TYPE: GRID TRANSFORMATION (Manim-style)
Elements to define:
- matrix: [[a, b], [c, d]] — the 2x2 transformation matrix
- basis_vectors: {e1_color, e2_color, show_labels: true}
- tracked_points: [[x,y], ...] — points to follow through transform
- eigendata: {show_eigenvectors: true, show_eigenvalues: true}
Animation: show original grid, then smoothly morph to transformed grid""",

        "particle_motion": """VISUAL TYPE: PARTICLE MOTION (Manim-style)
Elements to define:
- particles: [{id, position: [x,y], velocity: [vx,vy], color, size, trail: true}]
- forces: [{type: "gravity"|"spring"|"electric"|"custom", params: {...}}]
- bounds: {x: [min, max], y: [min, max]}
- show_vectors: true — show velocity/acceleration arrows
- show_energy_bar: true — optional energy diagram
Animation: particles move according to physics, with trails showing paths""",

        "wave_propagation": """VISUAL TYPE: WAVE PROPAGATION (Manim-style)
Elements to define:
- wave: {type: "transverse"|"longitudinal"|"circular", amplitude, frequency, wavelength, speed, color}
- medium: {show_particles: true, particle_density: 20}
- interference: [{wave2_config}] — optional second wave for superposition
- envelope: {show: true} — show wave envelope for standing waves
Animation: wave propagates through medium with particle displacement visible""",

        "circuit_flow": """VISUAL TYPE: CIRCUIT FLOW (Manim-style)
Elements to define:
- components: [{type: "resistor"|"capacitor"|"inductor"|"battery"|"switch"|"bulb", position, value, label}]
- wires: [{from, to, path_points}]
- current_flow: {animate: true, speed, color: "#FFFF00"}
- voltage_labels: [{across_component, show: true}]
Animation: circuit builds component by component, then current flows""",

        "custom_drawing": """VISUAL TYPE: CUSTOM DRAWING (Manim-style)
Elements to define:
- shapes: [{type: "path"|"circle"|"rect"|"polygon"|"arc"|"line", props: {...}}]
- text_elements: [{content, position, font_size, color}]
- latex_elements: [{expression, position, size, color}]
- groups: [{element_ids: [...], transform: {...}}]
Animation: elements appear in sequence with draw/fade animations""",
    }
    return instructions.get(visual_type, instructions["2d_graph"])


# ── Scene Generation Prompt ───────────────────────────────────────────────


def _build_scene_prompt(blueprint: Dict, scene: Dict) -> str:
    """Build prompt for generating a single scene's content + visual elements."""
    depth = blueprint.get("target_depth", 3)
    narration_style = _get_narration_style(depth)
    visual_instructions = _get_visual_type_instructions(scene.get("visual_type", "2d_graph"))

    return f"""You are an expert educational animator in the style of 3Blue1Brown (Manim).
You create precise, beautiful, mathematically clear animations.

ANIMATION BLUEPRINT:
- Title: {blueprint.get("title", "Untitled")}
- Subject: {blueprint.get("subject", "")}
- Concept: {blueprint.get("concept_description", "")}
- Animation Type: {blueprint.get("animation_type", "Process")}
- Cognitive Depth: {depth}/7

SCENE TO GENERATE:
- Scene Number: {scene.get("scene_number", 1)} of {blueprint.get("scene_count", 1)}
- Visual Type: {scene.get("visual_type", "2d_graph")}
- Description: {scene.get("description", "")}
- Duration: {scene.get("duration_seconds", 10)} seconds
- Focus: {scene.get("highlight_focus", "main concept")}
- Narration: {scene.get("narration_type", "ai_narration")}

{visual_instructions}

{narration_style}

MANIM STYLE RULES:
1. Dark background (#1C1C2E) with bright, clean colors
2. Animations should build understanding step-by-step
3. Use smooth easing (ease_in_out_cubic or ease_out_quint preferred)
4. Text/labels use clean sans-serif fonts
5. LaTeX for mathematical expressions
6. Arrows and vectors with proper heads
7. Grid lines should be very subtle (low opacity)
8. Key moments get "indicate" animations (pulse/glow)
9. Transitions between concepts use "transform" or "morph"
10. No cluttered visuals — add elements progressively

RESPOND WITH VALID JSON:
{{
  "animation_instructions": "Plain English description of what happens in this scene",
  "narration_text": "The narration text for this scene (or null if silent)",
  "key_visual_elements": ["element1", "element2", ...],
  "emphasis_points": ["concept1", "concept2", ...],
  "visual_elements": [
    {{
      "id": "unique_id",
      "type": "axes|graph|arrow|vector|dot|circle|rectangle|line|arc|polygon|text|latex|number_line|grid|particle_system|wave|path|group",
      "position": [x, y],
      "scale": 1.0,
      "rotation": 0,
      "stroke": {{"hex": "#58C4DD", "opacity": 1}},
      "fill": {{"hex": "#58C4DD", "opacity": 0.2}},
      "stroke_width": 2,
      "props": {{ ... type-specific properties ... }},
      "z_index": 0
    }}
  ],
  "manim_sequence": [
    {{
      "type": "create|fade_in|fade_out|transform|move_to|scale|rotate|draw|indicate|wait|camera_move|color_change|morph|trace_path|wave_effect|particles|group_anim",
      "targets": ["element_id"],
      "duration": 1.0,
      "start_time": 0.0,
      "easing": "ease_in_out_cubic",
      "params": {{ ... animation-specific params ... }}
    }}
  ]
}}"""


# ── Narration Refinement Prompt ───────────────────────────────────────────


def _build_narration_prompt(blueprint: Dict, scene: Dict, raw_narration: str) -> str:
    """Build prompt for refining narration with depth gating."""
    depth = blueprint.get("target_depth", 3)
    narration_style = _get_narration_style(depth)

    return f"""You are refining narration for a 3Blue1Brown-style educational animation.

CONTEXT:
- Title: {blueprint.get("title", "")}
- Subject: {blueprint.get("subject", "")}
- Scene {scene.get("scene_number", 1)}: {scene.get("description", "")}
- Duration: {scene.get("duration_seconds", 10)} seconds
- Cognitive Depth: {depth}/7

CURRENT NARRATION:
{raw_narration}

{narration_style}

REFINEMENT RULES:
1. Match the cognitive depth level precisely
2. Keep narration synchronized with the visual duration
3. Use active voice
4. Reference visual elements being shown ("Notice...", "Watch how...")
5. NEVER use condescending language
6. No "obviously", "simply", "trivially", "as you should know"
7. Split into timed segments that align with animation moments

RESPOND WITH VALID JSON:
{{
  "refined_text": "The polished narration text",
  "segments": [
    {{
      "text": "Segment text",
      "start_time": 0.0,
      "end_time": 3.0,
      "position": "bottom",
      "style": "plain|standard|elegant"
    }}
  ],
  "dignity_safe": true
}}"""


# ── Main Generation Functions ─────────────────────────────────────────────


async def generate_scene_content(blueprint: Dict, scene: Dict) -> Dict:
    """
    Phase 3: Generate scene content (visual elements + animation sequence + narration).

    Returns full GeneratedSceneContent dict.
    """
    prompt = _build_scene_prompt(blueprint, scene)

    for attempt in range(2):
        try:
            result = await _call_gpt(prompt, max_tokens=4000)

            # Validate required fields
            if not result.get("animation_instructions"):
                raise ValueError("Missing animation_instructions")
            if not result.get("visual_elements"):
                raise ValueError("Missing visual_elements")
            if not result.get("manim_sequence"):
                raise ValueError("Missing manim_sequence")

            # Validate total animation duration doesn't exceed scene duration
            scene_dur = scene.get("duration_seconds", 10)
            max_end = 0
            for inst in result.get("manim_sequence", []):
                end = inst.get("start_time", 0) + inst.get("duration", 0)
                max_end = max(max_end, end)
            if max_end > scene_dur + 1:  # 1s tolerance
                logger.warning(
                    "Scene %d animations exceed duration: %.1fs > %.1fs",
                    scene.get("scene_number", 0), max_end, scene_dur,
                )

            # Apply dignity filter to narration
            try:
                from app.engine.dignity_filter import dignity_filter
                if result.get("narration_text"):
                    result["narration_text"] = dignity_filter.filter_response(
                        result["narration_text"]
                    )
                for elem in result.get("emphasis_points", []):
                    # emphasis_points are short strings, just filter them
                    pass  # usually too short to need filtering
            except ImportError:
                logger.warning("Dignity filter not available, skipping")

            logger.info(
                "Scene %d content generated: %d elements, %d animations (attempt %d)",
                scene.get("scene_number", 0),
                len(result.get("visual_elements", [])),
                len(result.get("manim_sequence", [])),
                attempt + 1,
            )
            return result

        except Exception as e:
            logger.warning("Scene generation attempt %d failed: %s", attempt + 1, e)
            if attempt == 0:
                prompt += f"\n\nPREVIOUS ATTEMPT FAILED: {e}\nPlease fix the issues and try again."
            else:
                raise ValueError(f"Scene generation failed after 2 attempts: {e}") from e

    raise ValueError("Scene generation failed")


async def refine_narration(blueprint: Dict, scene: Dict, raw_narration: str) -> Dict:
    """
    Phase 6: Refine narration with depth-gating + dignity filter.

    Returns:
        {"refined_text": str, "segments": [...], "dignity_safe": bool}
    """
    prompt = _build_narration_prompt(blueprint, scene, raw_narration)

    for attempt in range(2):
        try:
            result = await _call_gpt(prompt, max_tokens=2000)

            if not result.get("refined_text"):
                raise ValueError("Missing refined_text")

            # Apply dignity filter
            try:
                from app.engine.dignity_filter import dignity_filter
                result["refined_text"] = dignity_filter.filter_response(
                    result["refined_text"]
                )
                for seg in result.get("segments", []):
                    seg["text"] = dignity_filter.filter_response(seg["text"])
                result["dignity_safe"] = True
            except ImportError:
                logger.warning("Dignity filter not available")

            logger.info("Narration refined for scene %d", scene.get("scene_number", 0))
            return result

        except Exception as e:
            logger.warning("Narration refinement attempt %d failed: %s", attempt + 1, e)
            if attempt == 0:
                prompt += f"\n\nPREVIOUS ATTEMPT FAILED: {e}\nPlease fix."
            else:
                raise ValueError(f"Narration refinement failed: {e}") from e

    raise ValueError("Narration refinement failed")


# ── CRUD Operations ──────────────────────────────────────────────────────


def save_animation(animation: Dict) -> str:
    """Save or update an animation document. Returns the animation ID."""
    col = _db()["animations"]
    anim_id = animation.get("_id") or str(uuid.uuid4())
    animation["_id"] = anim_id
    animation["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    if "created_at" not in animation:
        animation["created_at"] = animation["updated_at"]

    col.update_one({"_id": anim_id}, {"$set": animation}, upsert=True)
    logger.info("Saved animation %s", anim_id)
    return anim_id


def get_animation(anim_id: str) -> Optional[Dict]:
    """Get a single animation by ID."""
    col = _db()["animations"]
    doc = col.find_one({"_id": anim_id})
    return dict(doc) if doc else None


def list_animations(user_id: str) -> List[Dict]:
    """List all animations for a user, sorted by updated_at desc."""
    col = _db()["animations"]
    docs = col.find({"created_by": user_id}).sort("updated_at", -1)
    return [dict(d) for d in docs]


def delete_animation(anim_id: str) -> bool:
    """Delete an animation. Returns True if deleted."""
    col = _db()["animations"]
    result = col.delete_one({"_id": anim_id})
    return result.deleted_count > 0


def update_animation_field(anim_id: str, field: str, value: Any) -> bool:
    """Update a single top-level field on an animation document."""
    col = _db()["animations"]
    result = col.update_one(
        {"_id": anim_id},
        {
            "$set": {
                field: value,
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        },
    )
    return result.modified_count > 0


def publish_animation(anim_id: str) -> bool:
    """Mark an animation as published."""
    return update_animation_field(anim_id, "status", "published")


def compute_dignity_score(animation: Dict) -> float:
    """
    Compute overall dignity score for an animation.
    Checks all narration text through the dignity filter.
    Returns 0.0–1.0 (1.0 = fully clean).
    """
    try:
        from app.engine.dignity_filter import dignity_filter
    except ImportError:
        return 1.0  # Assume clean if filter unavailable

    total_chars = 0
    changed_chars = 0

    for scene in animation.get("scenes", []):
        narration = ""
        if scene.get("custom_narration"):
            narration = scene["custom_narration"]
        elif scene.get("generated_content", {}).get("narration_text"):
            narration = scene["generated_content"]["narration_text"]

        if narration:
            filtered = dignity_filter.filter_response(narration)
            total_chars += len(narration)
            changed_chars += abs(len(narration) - len(filtered))
            # Count character-level differences
            for a, b in zip(narration, filtered):
                if a != b:
                    changed_chars += 1

    if total_chars == 0:
        return 1.0

    return max(0.0, min(1.0, 1.0 - (changed_chars / total_chars)))
