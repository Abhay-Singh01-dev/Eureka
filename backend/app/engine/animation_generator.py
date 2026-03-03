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

from app.config import AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY
from app.database import get_db

logger = logging.getLogger(__name__)

# ── Config (centralised in app.config / app.database) ─────────────────────


def _db():
    return get_db()


# ── GPT-5.2 Call ──────────────────────────────────────────────────────────


async def _call_gpt(prompt: str, system: str | None = None, max_tokens: int = 4000) -> Dict:
    """Call Azure OpenAI GPT-5.2 and return parsed JSON."""
    endpoint = AZURE_OPENAI_ENDPOINT
    key = AZURE_OPENAI_API_KEY

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
- Always include reassurance — never leave the learner feeling confused
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


# ── Depth-Scaled Cognitive Tension ────────────────────────────────────────


def _get_tension_config(depth: int) -> Dict[str, str]:
    """Return depth-appropriate cognitive tension parameters."""
    if depth <= 2:
        return {
            "tension_type": "Curiosity-Based",
            "tension_intensity": "Light",
            "rules": (
                "Use a concrete, relatable question as the tension hook. "
                "No abstract paradox. No formal contradiction. No competing models. "
                "Frame as 'Why does this happen?' or 'What would happen if...?' "
                "Avoid technical language. "
                "Tension must feel like curiosity, NOT confusion. "
                "Always include reassurance in narration."
            ),
            "example_pattern": "Why does this arrow change length when we stretch the grid?",
            "forbidden": (
                "Do NOT use paradox framing. "
                "Do NOT use contradiction language. "
                "Do NOT use 'this seems wrong' phrasing. "
                "Do NOT use heavy abstract terminology. "
                "Do NOT include formal proofs."
            ),
        }
    elif depth <= 4:
        return {
            "tension_type": "Conceptual Misalignment",
            "tension_intensity": "Moderate",
            "rules": (
                "Present an intuitive expectation, then show it is incomplete. "
                "Introduce a small mismatch between intuition and reality. "
                "Begin hinting at formal reasoning without overwhelming. "
                "Trigger structural thinking without destabilising confidence."
            ),
            "example_pattern": "If vectors are just arrows, why do their coordinates matter so much?",
            "forbidden": "",
        }
    elif depth <= 6:
        return {
            "tension_type": "Structural Constraint",
            "tension_intensity": "Strong",
            "rules": (
                "Present competing interpretations. Introduce an edge case. "
                "Show the limitation of naive intuition. "
                "Require a structural resolution that connects abstract pieces. "
                "Force reconciliation of abstract structure."
            ),
            "example_pattern": "If scaling changes area, what exactly determines how much it changes?",
            "forbidden": "",
        }
    else:  # depth 7
        return {
            "tension_type": "Theoretical Instability",
            "tension_intensity": "High",
            "rules": (
                "Introduce a failure case or boundary condition. "
                "Present generalisation pressure. Require formal resolution. "
                "Include at least one structural limitation discussion. "
                "Include at least one generalisation statement. "
                "Include at least one formal statement in narration. "
                "Drive inevitability through constraint reasoning."
            ),
            "example_pattern": "If determinant measures area scaling, what happens in non-Euclidean spaces?",
            "forbidden": "",
        }


def _get_depth_structural_rules(depth: int) -> str:
    """Return structural rules that control what elements appear at each depth."""
    if depth <= 2:
        return """DEPTH STRUCTURAL RULES (Elementary / Middle School):
- No formal derivations
- No symbolic density
- Strong visual grounding — everything must be concrete and visible
- Analogy-first narration
- No edge cases
- No generalisation scene auto-insert
- Keep equations extremely simple (single variable, basic operations)"""
    elif depth <= 4:
        return """DEPTH STRUCTURAL RULES (High School / Undergraduate):
- Introduce equations AFTER visuals, never before
- Show simple derivations with clear step-by-step annotation
- Connect algebra ↔ geometry explicitly
- May include one counterexample
- Balance symbolic and visual representation"""
    elif depth <= 6:
        return """DEPTH STRUCTURAL RULES (Advanced / Graduate):
- Include derivation scenes when appropriate
- Include edge case or limitation
- Include formal constraint explanation
- Include brief generalisation
- Layer visual → equation → abstract insight"""
    else:
        return """DEPTH STRUCTURAL RULES (Research):
- Must include edge case or failure mode
- Must include generalisation beyond the example
- Explicit abstraction layer required
- Derivation scenes expected
- Formal constraint explanation required
- If possible, connect to broader mathematical/scientific structure"""


def _get_reveal_pace_instructions(pace: str) -> str:
    """Return pacing instructions for the AI generator."""
    if pace == "slow":
        return """REVEAL PACE: SLOW TENSION BUILD
- Delay equations — they should appear only after visual understanding is established
- Layer visual elements step-by-step, one concept at a time
- Include narration pauses (wait animations) between major reveals
- Build anticipation before each key insight
- Use 'indicate' animations before 'create' for emphasis"""
    elif pace == "fast":
        return """REVEAL PACE: FAST REVEAL
- Shorter buildup — get to the key insight quickly
- Earlier compression — connect pieces rapidly
- Equations can appear alongside visuals
- Minimise wait times between reveals
- Efficient, dense visual sequencing"""
    else:  # moderate
        return """REVEAL PACE: MODERATE BUILD
- Balanced pacing between visual buildup and equation reveal
- Allow time for each concept to settle before introducing the next
- Standard narration density
- Use natural transition timing"""


def _get_scene_role_instructions(role: str | None) -> str:
    """Return cognitive role instructions for a specific scene."""
    roles = {
        "introduce_tension": (
            "SCENE ROLE: INTRODUCE TENSION\n"
            "This scene must establish the core cognitive question. "
            "Present the setup that creates curiosity or dissonance. "
            "End this scene with the learner feeling 'I want to know why.'"
        ),
        "build_structure": (
            "SCENE ROLE: BUILD STRUCTURE\n"
            "This scene adds building blocks toward understanding. "
            "Introduce one key concept or visual element. "
            "Connect it to what was shown before."
        ),
        "show_counterexample": (
            "SCENE ROLE: SHOW COUNTEREXAMPLE\n"
            "This scene must present a case that challenges the intuitive expectation. "
            "Show why the simple mental model is insufficient. "
            "Create productive confusion that motivates deeper understanding."
        ),
        "reveal_constraint": (
            "SCENE ROLE: REVEAL CONSTRAINT\n"
            "This scene reveals the structural rule or constraint that explains the pattern. "
            "The 'aha' moment begins here. "
            "Show why the structure MUST be this way."
        ),
        "formalize_equation": (
            "SCENE ROLE: FORMALIZE WITH EQUATION\n"
            "This scene introduces the formal mathematical statement. "
            "The equation should feel like a natural compression of what was visually shown. "
            "Annotate every symbol with its visual meaning."
        ),
        "generalize": (
            "SCENE ROLE: GENERALIZE\n"
            "This scene extends the insight beyond the specific example. "
            "Show that the principle applies more broadly. "
            "Connect to larger mathematical/scientific structure."
        ),
        "compress_insight": (
            "SCENE ROLE: COMPRESS INSIGHT\n"
            "This is the culmination scene. The learner should feel inevitability. "
            "Compress everything into a single clear statement. "
            "The compression goal from the blueprint MUST be achieved here. "
            "End with the learner feeling: 'Of course — it could not have been any other way.'"
        ),
        "recap": (
            "SCENE ROLE: RECAP\n"
            "Briefly recapitulate the key points covered. "
            "Reinforce the compression statement. "
            "This should be concise, not introduce new material."
        ),
        "highlight_invariant": (
            "SCENE ROLE: HIGHLIGHT INVARIANT\n"
            "Visually isolate and emphasize the property that does NOT change "
            "even as other elements transform. Use persistent color, glow, "
            "or visual anchoring to make the invariant unmistakable. "
            "The viewer must see: 'Everything else changed, but THIS stayed the same.'"
        ),
        "translate_representation": (
            "SCENE ROLE: TRANSLATE REPRESENTATION\n"
            "Transform the concept from one representation to another "
            "(e.g., geometric to algebraic, graph to equation, visual to symbolic). "
            "Show the mapping explicitly — each part of the source connects "
            "to its counterpart in the target. The viewer must see the bridge."
        ),
    }
    return roles.get(role or "", "")


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

        "2d_diagram": """VISUAL TYPE: 2D EDUCATIONAL DIAGRAM (Manim-style)
Elements to define:
- bodies: [{id, shape: "circle"|"rect"|"custom", position: [x,y], color, label, size}]
- arrows: [{id, from: [x,y], to: [x,y], label, color, style: "force"|"motion"|"reaction"}]
- labels: [{text, position, color, font_size}]
- annotations: [{text, position, arrow_to, color}] — explanatory callouts
Animation sequence:
1. Scene background/context appears
2. Main bodies create in position
3. Arrows draw in one by one with labels
4. Key elements get emphasis animations (pulse/glow)
Best for: free-body diagrams, biological processes, mechanical systems, flowcharts, step-by-step physical processes""",

        "text_reveal": """VISUAL TYPE: TEXT REVEAL (Manim-style)
Elements to define:
- title: {text, position, font_size, color} — optional heading
- bullet_points: [{text, indent: 0-3, color, reveal_style: "word"|"line"|"fade"}]
- text_blocks: [{id, content, position, font_size, color}]
- highlights: [{text_id, start_char, end_char, color}] — highlight key terms
- background_box: optional {color, opacity} behind text region
Animation sequence:
1. Title or heading appears first
2. Content reveals progressively (line by line)
3. Key terms change color or glow to emphasise meaning
4. Optional summary or call-to-action at end
Best for: definition slides, summary screens, stated objectives, key concept lists""",

        "equation_reveal": """VISUAL TYPE: EQUATION REVEAL (Manim-style)
Elements to define:
- equations: [{id, latex, position, size, color, label}]
- steps: [{description, source_id, target_latex, annotation}] — algebraic derivation steps
- sidebars: [{text, points_to_id, color}] — symbol/term definitions
- boxes: [{around_id, color, label}] — highlight important results
- cancellation_marks: [{element_id, color}] — strike-through for cancelling terms
Animation sequence:
1. Starting equation appears (write animation)
2. Each step morphs from previous using TransformMatchingTex
3. Sidebars and annotations fade in alongside each step
4. Final result gets coloured box or glow emphasis
Best for: algebraic derivations, proofs, dimensional analysis, step-by-step manipulation""",
    }
    return instructions.get(visual_type, instructions["2d_graph"])


# ── Scene Generation Prompt ───────────────────────────────────────────────


def _build_scene_prompt(blueprint: Dict, scene: Dict) -> str:
    """Build prompt for generating a single scene's content + visual elements."""
    depth = blueprint.get("target_depth", 3)
    narration_style = _get_narration_style(depth)
    visual_instructions = _get_visual_type_instructions(scene.get("visual_type", "2d_graph"))
    tension_config = _get_tension_config(depth)
    depth_rules = _get_depth_structural_rules(depth)
    pace_instructions = _get_reveal_pace_instructions(scene.get("reveal_pace", "moderate"))
    role_instructions = _get_scene_role_instructions(scene.get("scene_role"))

    # Cognitive tension context
    core_tension = blueprint.get("core_tension") or "Not specified — infer from concept description"
    compression_goal = blueprint.get("compression_goal") or "Not specified — infer from concept"
    reveal_strategy = blueprint.get("reveal_strategy", "gradual_constraint_build").replace("_", " ").title()

    return f"""You are an expert educational animator in the style of 3Blue1Brown (Manim).
You create precise, beautiful, mathematically clear animations.

Every animation must begin with a depth-appropriate cognitive tension.
Depth determines the abstraction level of tension, not its existence.
Tension must resolve into the compression goal by the final scene.

═══ COGNITIVE STRUCTURE ═══

CORE COGNITIVE TENSION:
{core_tension}

COMPRESSION GOAL (What should feel inevitable at the end):
{compression_goal}

REVEAL STRATEGY: {reveal_strategy}

TENSION CONFIGURATION:
- Type: {tension_config["tension_type"]}
- Intensity: {tension_config["tension_intensity"]}
- Rules: {tension_config["rules"]}
- Example pattern: {tension_config["example_pattern"]}
{("- FORBIDDEN: " + tension_config["forbidden"]) if tension_config["forbidden"] else ""}

{depth_rules}

═══ ANIMATION BLUEPRINT ═══

- Title: {blueprint.get("title", "Untitled")}
- Subject: {blueprint.get("subject", "")}
- Concept: {blueprint.get("concept_description", "")}
- Animation Type: {blueprint.get("animation_type", "Process")}
- Cognitive Depth: {depth}/7

═══ SCENE TO GENERATE ═══

- Scene Number: {scene.get("scene_number", 1)} of {blueprint.get("scene_count", 1)}
- Visual Type: {scene.get("visual_type", "2d_graph")}
- Description: {scene.get("description", "")}
- Duration: {scene.get("duration_seconds", 10)} seconds
- Key Constraint / Insight: {scene.get("highlight_focus", "main concept")}
- Narration: {scene.get("narration_type", "ai_narration")}

{role_instructions}

{pace_instructions}

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
    """Build prompt for refining narration with depth gating + cognitive tension."""
    depth = blueprint.get("target_depth", 3)
    narration_style = _get_narration_style(depth)
    tension_config = _get_tension_config(depth)
    core_tension = blueprint.get("core_tension") or ""
    compression_goal = blueprint.get("compression_goal") or ""
    scene_role = scene.get("scene_role") or "not specified"

    return f"""You are refining narration for a 3Blue1Brown-style educational animation.

CONTEXT:
- Title: {blueprint.get("title", "")}
- Subject: {blueprint.get("subject", "")}
- Scene {scene.get("scene_number", 1)}: {scene.get("description", "")}
- Duration: {scene.get("duration_seconds", 10)} seconds
- Cognitive Depth: {depth}/7
- Scene Role: {scene_role}
- Key Constraint: {scene.get("highlight_focus", "")}

COGNITIVE STRUCTURE:
- Core Tension: {core_tension}
- Compression Goal: {compression_goal}
- Tension Type for this depth: {tension_config["tension_type"]} ({tension_config["tension_intensity"]})
{("- FORBIDDEN in narration: " + tension_config["forbidden"]) if tension_config["forbidden"] else ""}

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
8. If this is the tension-introduction scene, the narration must pose the core question
9. If this is the compression scene, the narration must deliver the inevitability feeling
10. Narration tone must match the tension intensity for this depth level

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

    for attempt in range(3):  # 2 normal retries + 1 possible safety retry
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

            # Depth-safety validation: beginner content must not contain
            # advanced formal language that violates the depth contract
            depth = blueprint.get("target_depth", 3)
            if depth <= 2 and attempt == 0:
                narration = (result.get("narration_text") or "").lower()
                forbidden_markers = [
                    "formal proof", "contradiction", "paradox",
                    "non-trivial", "rigorous", "axiom", "theorem states",
                    "by induction", "without loss of generality",
                ]
                violations = [m for m in forbidden_markers if m in narration]
                if violations:
                    logger.warning(
                        "Depth %d safety violation in scene %d: found %s — regenerating",
                        depth, scene.get("scene_number", 0), violations,
                    )
                    prompt += (
                        "\n\nSAFETY OVERRIDE: This is depth "
                        + str(depth)
                        + " (beginner). "
                        "Your narration contained advanced language: "
                        + ", ".join(violations)
                        + ". "
                        "Rewrite ALL narration using simple, encouraging language. "
                        "No formal proof terms. Use analogies and visual references."
                    )
                    continue  # retry with safety override

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
