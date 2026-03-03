"""
Animation Cognitive Engine (ACE)
================================

Structured cognitive orchestration layer for animation generation.

Sits between the teacher's blueprint/scene JSON and the AI prompt engine.
Does NOT modify database schema, renderers, dignity filter, or tone engine.

Pipeline:
    Blueprint + Scenes (JSON)
        ↓
    ACE: build_tension_profile()
    ACE: validate_structural_integrity()
    ACE: build_structural_arc()
    ACE: apply_reveal_strategy()
    ACE: equation_permission()
    ACE: construct_cognitive_prompt()    ← per scene
    ACE: generate_with_safety()          ← per scene, calls _call_gpt
    ACE: post_generation_checks()        ← per scene
        ↓
    Structured JSON output (scenes + cognitive_summary)
        ↓
    Renderer (unchanged)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

from app.engine.animation_generator import _call_gpt

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# PART 2 — INPUT CONTRACT
# ═══════════════════════════════════════════════════════════════════════════


class SceneInput(BaseModel):
    """Per-scene input from the teacher's blueprint."""
    id: str = ""
    scene_number: int = 1
    role: Optional[str] = None                # SceneRole enum value
    description: str = ""
    highlight_focus: str = ""
    visual_type: str = "2d_graph"
    duration: int = 8                         # seconds
    reveal_pace: str = "moderate"
    narration_type: str = "ai_narration"
    custom_narration: Optional[str] = None


class AnimationBlueprintInput(BaseModel):
    """Full blueprint input to the cognitive engine."""
    title: str
    subject: str = "Physics"
    concept: str = ""                         # concept_description
    target_depth: int = 3                     # 1–7
    animation_type: str = "Process"
    scene_structure: str = "multi_scene"
    core_tension: str = ""
    compression_goal: str = ""
    reveal_strategy: str = "gradual_constraint_build"
    scenes: List[SceneInput] = Field(default_factory=list)


# ═══════════════════════════════════════════════════════════════════════════
# PART 3 — COGNITIVE ARC CONSTRUCTION
# ═══════════════════════════════════════════════════════════════════════════


# ── Step 1: Tension Profile ──────────────────────────────────────────────


def build_tension_profile(depth: int) -> Dict[str, Any]:
    """
    Build a depth-scaled tension profile.

    Returns:
        {
            tension_type: str,
            tension_intensity: str,
            abstraction_level: str,
            allowed_complexity: str,
            reassurance_required: bool,
        }
    """
    if depth <= 2:
        return {
            "tension_type": "Curiosity-Based",
            "tension_intensity": "Light",
            "abstraction_level": "Concrete",
            "allowed_complexity": "Single concept, numeric examples only",
            "reassurance_required": True,
        }
    elif depth <= 4:
        return {
            "tension_type": "Conceptual Misalignment",
            "tension_intensity": "Moderate",
            "abstraction_level": "Semi-abstract",
            "allowed_complexity": "Light symbolic, one main equation",
            "reassurance_required": False,
        }
    elif depth <= 6:
        return {
            "tension_type": "Structural Constraint",
            "tension_intensity": "Strong",
            "abstraction_level": "Abstract",
            "allowed_complexity": "Derivations allowed, multiple equations",
            "reassurance_required": False,
        }
    else:  # depth 7
        return {
            "tension_type": "Theoretical Instability",
            "tension_intensity": "High",
            "abstraction_level": "Fully formal",
            "allowed_complexity": "Formal structure required, edge-case discussion",
            "reassurance_required": False,
        }


# ── Step 2: Structural Integrity Validation ──────────────────────────────


_VALID_OPENING_ROLES = {"introduce_tension", "build_structure"}
_VALID_CLOSING_ROLES = {"compress_insight", "generalize", "formalize_equation"}


def validate_structural_integrity(
    scenes: List[SceneInput],
    depth: int,
) -> List[str]:
    """
    Validate the cognitive structure of the scene list.

    Returns a list of non-blocking suggestion strings.
    Never raises — suggestions only.
    """
    suggestions: List[str] = []

    if not scenes:
        suggestions.append("No scenes provided.")
        return suggestions

    first_role = scenes[0].role
    if first_role and first_role not in _VALID_OPENING_ROLES:
        suggestions.append(
            f"First scene role is '{first_role}'. "
            f"Consider starting with 'introduce_tension' or 'build_structure' "
            f"to establish cognitive entry."
        )

    last_role = scenes[-1].role
    if last_role and last_role not in _VALID_CLOSING_ROLES:
        suggestions.append(
            f"Final scene role is '{last_role}'. "
            f"Consider ending with 'compress_insight', 'generalize', or "
            f"'formalize_equation' for structural closure."
        )

    # Depth 7 needs generalisation or formalisation
    if depth >= 7:
        has_gen = any(
            s.role in ("generalize", "formalize_equation") for s in scenes
        )
        if not has_gen:
            suggestions.append(
                "Research-level depth (7) usually benefits from a "
                "'generalize' or 'formalize_equation' scene."
            )

    # Check for reveal_constraint referencing highlight_focus
    for s in scenes:
        if s.role == "reveal_constraint" and not s.highlight_focus.strip():
            suggestions.append(
                f"Scene {s.scene_number} has role 'reveal_constraint' but no "
                f"highlight_focus — the constraint reveal may lack specificity."
            )

    return suggestions


# ── Step 3: Structural Arc ───────────────────────────────────────────────


def build_structural_arc(
    core_tension: str,
    compression_goal: str,
    scenes: List[SceneInput],
    depth: int,
) -> Dict[str, Any]:
    """
    Construct the cognitive skeleton independent of visuals.

    This arc is injected into every scene prompt so the AI maintains
    narrative coherence across the entire animation.
    """
    # Extract midpoint constraints from scenes with explicit roles
    midpoint_constraints: List[str] = []
    for s in scenes:
        if s.role in ("build_structure", "reveal_constraint", "show_counterexample"):
            constraint = s.highlight_focus.strip() or s.description.strip()
            if constraint:
                midpoint_constraints.append(
                    f"[Scene {s.scene_number} — {(s.role or '').replace('_', ' ')}] {constraint}"
                )

    # Generalisation only at depth >= 5
    generalisation: Optional[str] = None
    if depth >= 5:
        gen_scenes = [s for s in scenes if s.role == "generalize"]
        if gen_scenes:
            generalisation = gen_scenes[0].description.strip() or (
                "Extend the specific insight to a broader structural principle."
            )
        else:
            generalisation = (
                "Implicitly connect the specific case to a broader pattern "
                "without a dedicated scene."
            )

    return {
        "opening": core_tension or "Infer the cognitive question from the concept.",
        "midpoint_constraints": midpoint_constraints,
        "climax_reveal": compression_goal or "Deliver the moment of inevitability.",
        "generalisation": generalisation,
    }


# ═══════════════════════════════════════════════════════════════════════════
# PART 5 — REVEAL STRATEGY ENGINE
# ═══════════════════════════════════════════════════════════════════════════


def apply_reveal_strategy(
    strategy: str,
    scenes: List[SceneInput],
    depth: int,
) -> List[Dict[str, Any]]:
    """
    Apply reveal strategy rules to each scene, producing per-scene
    strategy instructions that get injected into the AI prompt.

    Does NOT reorder scenes. Returns a list parallel to `scenes`.
    """
    total = len(scenes)
    result: List[Dict[str, Any]] = []

    for i, scene in enumerate(scenes):
        position_pct = (i / max(total - 1, 1)) * 100  # 0–100
        instructions: Dict[str, Any] = {
            "scene_index": i,
            "strategy": strategy,
            "equation_allowed": True,
            "visual_first": False,
            "equation_first": False,
            "counterexample_before_constraint": False,
            "constraint_text": "",
        }

        if strategy == "gradual_constraint_build":
            # Delay equation reveal; layer constraints sequentially
            instructions["equation_allowed"] = position_pct >= 50
            instructions["constraint_text"] = (
                "Introduce constraints one at a time. "
                "Each scene should add exactly one new constraint "
                "that narrows the space of possibilities. "
                "Equations appear only after visual constraints are established."
            )
            if i == 0:
                instructions["constraint_text"] += (
                    " This scene opens with the broadest question — "
                    "no constraints yet, only curiosity."
                )

        elif strategy == "counterexample_resolution":
            # Insert counterexample before constraint
            instructions["counterexample_before_constraint"] = True
            if scene.role == "show_counterexample":
                instructions["constraint_text"] = (
                    "Present a concrete case that breaks the naive expectation. "
                    "The viewer should feel 'wait, that's wrong' — "
                    "then the next scene resolves it."
                )
            elif scene.role == "reveal_constraint":
                instructions["constraint_text"] = (
                    "Collapse the counterexample into a general rule. "
                    "Show why the correct structure resolves the failure."
                )
            else:
                instructions["constraint_text"] = (
                    "Build toward the counterexample if before it, "
                    "or reinforce the resolution if after."
                )

        elif strategy == "intuition_formalization":
            # Visual first, then symbolic
            instructions["visual_first"] = True
            instructions["equation_allowed"] = position_pct >= 60
            instructions["constraint_text"] = (
                "Start with pure visual intuition. "
                "The viewer should understand the pattern visually "
                "BEFORE any symbolic representation appears. "
                "Later scenes translate the visual into formal language."
            )

        elif strategy == "visual_first_equation_later":
            # Equations only in final 40% of scenes
            instructions["visual_first"] = True
            instructions["equation_allowed"] = position_pct >= 60
            instructions["constraint_text"] = (
                "Geometry and diagrams dominate. "
                "No equations until the final 40% of the animation. "
                "The equation should feel like a natural compression "
                "of what the viewer already understands visually."
            )

        elif strategy == "equation_first_geometric":
            # Show formula first, then demonstrate visually
            instructions["equation_first"] = True
            instructions["equation_allowed"] = True
            if i == 0:
                instructions["constraint_text"] = (
                    "Present the equation immediately. "
                    "The viewer sees the formula first and wonders: "
                    "'What does this actually mean geometrically?'"
                )
            else:
                instructions["constraint_text"] = (
                    "Visually demonstrate what part of the equation "
                    "this scene reveals. Each scene unpacks one piece "
                    "of the formula's geometric meaning."
                )

        elif strategy == "direct_demonstration":
            # Show the transformation immediately, then unpack why
            instructions["visual_first"] = True
            if i == 0:
                instructions["equation_allowed"] = False
                instructions["constraint_text"] = (
                    "Show the transformation directly — no setup, no pre-explanation. "
                    "The viewer sees the change happen and asks: 'Why did that happen?'"
                )
            elif position_pct >= 75:
                instructions["equation_allowed"] = True
                instructions["constraint_text"] = (
                    "Now formalize what was shown visually. "
                    "The equation should feel like it was always inevitable."
                )
            else:
                instructions["equation_allowed"] = depth >= 4
                instructions["constraint_text"] = (
                    "Unpack the mechanism behind the transformation. "
                    "Reveal one layer of 'why' at a time."
                )

        elif strategy == "comparative_contrast":
            # Show two cases, contrast them, extract the invariant
            if i == 0:
                instructions["equation_allowed"] = False
                instructions["constraint_text"] = (
                    "Present Case A — the first scenario/example. "
                    "Make it concrete and memorable so it serves as "
                    "the reference baseline for comparison."
                )
            elif i == 1 and total >= 3:
                instructions["equation_allowed"] = False
                instructions["counterexample_before_constraint"] = True
                instructions["constraint_text"] = (
                    "Present Case B — a contrasting scenario that differs in "
                    "at least one key aspect. The viewer should start noticing "
                    "'what changed and what stayed the same.'"
                )
            elif position_pct >= 80:
                instructions["equation_allowed"] = True
                instructions["constraint_text"] = (
                    "Extract the invariant. Compress the contrast into a single "
                    "structural insight: what was preserved across both cases?"
                )
            else:
                instructions["constraint_text"] = (
                    "Highlight the contrast. What differs? What is preserved? "
                    "Build toward the invariant extraction."
                )

        # Override equation permission with depth gating
        eq_perm = equation_permission(depth)
        if not eq_perm["symbolic_allowed"]:
            instructions["equation_allowed"] = False
        instructions["equation_rules"] = eq_perm

        result.append(instructions)

    return result


# ═══════════════════════════════════════════════════════════════════════════
# PART 6 — DEPTH-GATED EQUATION TIMING
# ═══════════════════════════════════════════════════════════════════════════


def equation_permission(depth: int) -> Dict[str, Any]:
    """
    Determine what level of symbolic / equation content is permitted
    at a given cognitive depth.
    """
    if depth <= 2:
        return {
            "symbolic_allowed": False,
            "max_equations": 0,
            "symbolic_density": "none",
            "allowed_content": "Numeric examples only. No variables, no symbols.",
            "derivation_allowed": False,
            "edge_case_required": False,
        }
    elif depth <= 4:
        return {
            "symbolic_allowed": True,
            "max_equations": 1,
            "symbolic_density": "light",
            "allowed_content": (
                "Light symbolic introduction. One main equation. "
                "All symbols must be annotated with plain-language meaning."
            ),
            "derivation_allowed": False,
            "edge_case_required": False,
        }
    elif depth <= 6:
        return {
            "symbolic_allowed": True,
            "max_equations": 5,
            "symbolic_density": "moderate",
            "allowed_content": (
                "Derivation allowed. Multiple equations permitted. "
                "Each step of derivation must be annotated."
            ),
            "derivation_allowed": True,
            "edge_case_required": False,
        }
    else:  # depth 7
        return {
            "symbolic_allowed": True,
            "max_equations": 10,
            "symbolic_density": "high",
            "allowed_content": (
                "Formal structure required. Edge-case discussion required. "
                "Include at least one limitation or boundary condition. "
                "Derivation and multi-step proofs expected."
            ),
            "derivation_allowed": True,
            "edge_case_required": True,
        }


# ═══════════════════════════════════════════════════════════════════════════
# PART 6A — COGNITIVE METADATA EXTRACTORS
# ═══════════════════════════════════════════════════════════════════════════


def extract_core_invariant(concept: str, core_tension: str, depth: int) -> str:
    """
    Generate a prompt instruction for the AI to identify the core invariant.
    The invariant is what must remain true regardless of transformation.
    """
    base = (
        "CORE INVARIANT INSTRUCTION: Identify the single structural truth "
        "that remains invariant across all transformations in this concept. "
    )
    if concept:
        base += f'The concept is "{concept}". '
    if core_tension:
        base += f'The core tension is "{core_tension}". '

    if depth <= 3:
        base += (
            "State the invariant in simple, concrete language. "
            "Use a physical or visual analogy."
        )
    elif depth <= 5:
        base += (
            "State the invariant as a general principle. "
            "Connect it to the broader conceptual framework."
        )
    else:
        base += (
            "State the invariant formally. "
            "Express it as a conservation law, symmetry, or structural constraint."
        )

    return base


def identify_misconception_target(concept: str, core_tension: str) -> str:
    """
    Generate a prompt instruction for the AI to address the most common misconception.
    """
    base = (
        "MISCONCEPTION TARGET: Identify the most common naive expectation "
        "or incorrect mental model that learners typically have about this concept. "
    )
    if concept:
        base += f'For "{concept}", '
    if core_tension:
        base += (
            f'given the tension "{core_tension}", identify what students '
            "wrongly assume and ensure the animation explicitly corrects it. "
        )
    base += (
        "The animation should make the misconception visible (and feel wrong) "
        "before resolving it with the correct structure."
    )
    return base


def compute_transformation_mapping(
    scenes: List[SceneInput],
) -> List[str]:
    """
    Analyze scene descriptions and roles to map cognitive transformations.
    Returns a list of transition descriptions.
    """
    mapping: List[str] = []
    for i in range(len(scenes) - 1):
        curr = scenes[i]
        nxt = scenes[i + 1]
        curr_role = (curr.role or "build_structure").replace("_", " ")
        nxt_role = (nxt.role or "build_structure").replace("_", " ")
        curr_desc = curr.description.strip() or curr_role
        nxt_desc = nxt.description.strip() or nxt_role
        mapping.append(
            f"Scene {curr.scene_number}→{nxt.scene_number}: "
            f"[{curr_role}] {curr_desc[:60]} ⟶ [{nxt_role}] {nxt_desc[:60]}"
        )
    return mapping


def compute_visual_density_rules(
    depth: int,
    scene_count: int,
) -> Dict[str, Any]:
    """
    Compute visual density limits based on cognitive depth.
    Lower depths get simpler, cleaner visuals.
    """
    if depth <= 2:
        return {
            "max_elements_per_scene": 5,
            "max_text_labels": 2,
            "max_simultaneous_animations": 2,
            "instruction": (
                "VISUAL DENSITY: Beginner level. Maximum 5 visual elements per scene. "
                "No more than 2 text labels visible at once. "
                "Only 2 animations can run simultaneously. "
                "Keep the screen clean and uncluttered."
            ),
        }
    elif depth <= 4:
        return {
            "max_elements_per_scene": 8,
            "max_text_labels": 4,
            "max_simultaneous_animations": 3,
            "instruction": (
                "VISUAL DENSITY: Intermediate level. Maximum 8 visual elements per scene. "
                "No more than 4 text labels visible at once. "
                "Up to 3 animations can run simultaneously. "
                "Add elements progressively — never dump everything at once."
            ),
        }
    elif depth <= 6:
        return {
            "max_elements_per_scene": 12,
            "max_text_labels": 6,
            "max_simultaneous_animations": 4,
            "instruction": (
                "VISUAL DENSITY: Advanced level. Maximum 12 visual elements per scene. "
                "Up to 6 text labels. Up to 4 simultaneous animations. "
                "Complex diagrams are OK but must build progressively."
            ),
        }
    else:
        return {
            "max_elements_per_scene": 16,
            "max_text_labels": 8,
            "max_simultaneous_animations": 5,
            "instruction": (
                "VISUAL DENSITY: Research level. Up to 16 elements per scene. "
                "Dense diagrams allowed with up to 8 labels. "
                "Multiple simultaneous animations (up to 5). "
                "Formal notation density is expected."
            ),
        }


def build_minimalism_rules(depth: int) -> Dict[str, Any]:
    """
    Build narration brevity constraints based on depth.
    Higher depths allow longer narration; lower depths enforce simplicity.
    """
    if depth <= 2:
        return {
            "max_sentences_per_scene": 3,
            "max_words_per_sentence": 15,
            "tone": "warm, simple, encouraging",
            "instruction": (
                "MINIMALISM: Maximum 3 sentences per scene, 15 words each. "
                "Every sentence must earn its place — if a visual can say it, "
                "the narration should stay silent. Use warm, simple language."
            ),
        }
    elif depth <= 4:
        return {
            "max_sentences_per_scene": 5,
            "max_words_per_sentence": 20,
            "tone": "clear, building",
            "instruction": (
                "MINIMALISM: Maximum 5 sentences per scene, 20 words each. "
                "Each sentence must either build tension, reveal structure, "
                "or compress insight. No filler narration."
            ),
        }
    elif depth <= 6:
        return {
            "max_sentences_per_scene": 7,
            "max_words_per_sentence": 25,
            "tone": "precise, structured",
            "instruction": (
                "MINIMALISM: Maximum 7 sentences per scene. "
                "Narration should be precise — each sentence advances the argument. "
                "Technical language is permitted when necessary."
            ),
        }
    else:
        return {
            "max_sentences_per_scene": 10,
            "max_words_per_sentence": 30,
            "tone": "formal, rigorous",
            "instruction": (
                "MINIMALISM: Up to 10 sentences per scene for research-level depth. "
                "Formal language expected. Derivation steps should be narrated. "
                "But remove redundancy — every sentence must add information."
            ),
        }


def compute_inevitability_score(
    generated_scenes: List[Dict[str, Any]],
    compression_goal: str,
) -> int:
    """
    Heuristic inevitability score (0–100) based on structural markers.
    Checks whether the animation achieves cognitive compression.
    """
    score = 0
    if not generated_scenes:
        return 0

    # ── Factor 1: Tension established in first scene (+15) ──
    first = generated_scenes[0]
    if first.get("tension_statement"):
        score += 15
    elif any(
        m in (first.get("narration") or "").lower()
        for m in ["?", "why", "what if", "notice", "wonder", "how"]
    ):
        score += 10

    # ── Factor 2: Final scene compression (+25) ──
    last = generated_scenes[-1]
    if last.get("compression_achieved"):
        score += 25
    narration = (last.get("narration") or "").lower()
    resolution_markers = [
        "therefore", "so we see", "this means", "inevitabl",
        "must be", "could not", "turns out", "that's why",
        "of course", "it follows", "we arrive at",
    ]
    if any(m in narration for m in resolution_markers):
        score += 10

    # ── Factor 3: Compression goal referenced (+15) ──
    if compression_goal:
        goal_words = set(compression_goal.lower().split())
        if len(goal_words) >= 2:
            matches = sum(1 for w in goal_words if w in narration)
            if matches >= len(goal_words) * 0.4:
                score += 15
            elif matches >= 1:
                score += 8

    # ── Factor 4: Progressive structure (+15) ──
    roles_seen = [s.get("role", "") for s in generated_scenes]
    if roles_seen and roles_seen[0] in ("introduce_tension", "build_structure"):
        score += 5
    if roles_seen and roles_seen[-1] in (
        "compress_insight", "generalize", "formalize_equation"
    ):
        score += 10

    # ── Factor 5: All scenes have narration (+10) ──
    scenes_with_narration = sum(
        1 for s in generated_scenes if s.get("narration")
    )
    if scenes_with_narration == len(generated_scenes):
        score += 10
    elif scenes_with_narration >= len(generated_scenes) * 0.7:
        score += 5

    # ── Factor 6: Visual elements present in all scenes (+10) ──
    scenes_with_visuals = sum(
        1 for s in generated_scenes if s.get("visual_elements")
    )
    if scenes_with_visuals == len(generated_scenes):
        score += 10

    return min(score, 100)


# ═══════════════════════════════════════════════════════════════════════════
# PART 4 — SCENE TRANSFORMATION LOGIC (Cognitive Plans)
# ═══════════════════════════════════════════════════════════════════════════


def build_scene_cognitive_plan(
    scene: SceneInput,
    tension_profile: Dict[str, Any],
    structural_arc: Dict[str, Any],
    strategy_instructions: Dict[str, Any],
    core_tension: str,
    compression_goal: str,
    depth: int,
    total_scenes: int,
) -> Dict[str, Any]:
    """
    Transform a single SceneInput into a SceneCognitivePlan.

    This plan is what gets injected into the AI prompt — it tells the
    AI exactly what cognitive job this scene must accomplish.
    """
    role = scene.role or "build_structure"
    eq_rules = strategy_instructions.get("equation_rules", {})

    # ── Visual instruction ──
    visual_instruction = _build_visual_instruction(
        role, scene, strategy_instructions, depth
    )

    # ── Narration instruction ──
    narration_instruction = _build_narration_instruction(
        role, scene, tension_profile, core_tension, compression_goal, depth
    )

    # ── Equation timing ──
    equation_timing = _build_equation_timing(
        role, scene, strategy_instructions, eq_rules, depth
    )

    # ── Highlight sequence ──
    highlight_sequence = _build_highlight_sequence(role, scene, structural_arc)

    # ── Transition logic ──
    transition_logic = _build_transition_logic(
        role, scene, total_scenes, structural_arc
    )

    return {
        "scene_number": scene.scene_number,
        "role": role,
        "visual_instruction": visual_instruction,
        "narration_instruction": narration_instruction,
        "equation_timing": equation_timing,
        "highlight_sequence": highlight_sequence,
        "transition_logic": transition_logic,
    }


def _build_visual_instruction(
    role: str,
    scene: SceneInput,
    strategy: Dict[str, Any],
    depth: int,
) -> str:
    """Build visual rendering instructions based on role + strategy."""
    parts: List[str] = []

    parts.append(f"Visual type: {scene.visual_type}.")
    parts.append(f"Duration: {scene.duration} seconds.")

    if strategy.get("visual_first"):
        parts.append(
            "VISUAL-FIRST: Let the geometry/diagram speak before any text or equations."
        )
    if strategy.get("equation_first"):
        parts.append(
            "EQUATION-FIRST: Show the formula immediately, then unpack it visually."
        )
    if not strategy.get("equation_allowed"):
        parts.append(
            "NO EQUATIONS in this scene. Use only visual elements and narration."
        )

    # Role-specific visual rules
    if role == "introduce_tension":
        parts.append(
            "Open with a visually striking setup. "
            "Create visual curiosity — something the viewer wants to understand."
        )
        if depth <= 3:
            parts.append("No equations. Only concrete visual elements.")
    elif role == "show_counterexample":
        parts.append(
            "Show the failure case clearly. The visual should make the viewer feel "
            "'that's not right' before any narration explains why."
        )
    elif role == "reveal_constraint":
        parts.append(
            f"Visually highlight: {scene.highlight_focus or 'the key constraint'}. "
            "This must connect back to the tension from the opening scene."
        )
    elif role == "formalize_equation":
        parts.append(
            "The equation must feel like a natural compression of what was shown visually. "
            "Annotate every symbol with its visual counterpart."
        )
    elif role == "compress_insight":
        parts.append(
            "Visually compress everything into clarity. "
            "The viewer should see the whole picture come together."
        )
    elif role == "generalize":
        parts.append(
            "Show how the specific case extends to a broader pattern. "
            "Use visual transformation or side-by-side comparison."
        )
    elif role == "highlight_invariant":
        parts.append(
            "Visually isolate and emphasize the invariant property. "
            "Use color, glow, or persistent highlighting to show what "
            "DOES NOT CHANGE even as other elements transform. "
            "The invariant must be visually distinct from everything else."
        )
    elif role == "translate_representation":
        parts.append(
            "Transform the concept from one representation to another "
            "(e.g., geometric → algebraic, visual → symbolic, graph → equation). "
            "Show the mapping explicitly — each part of the source must "
            "visually connect to its counterpart in the target representation."
        )

    if strategy.get("constraint_text"):
        parts.append(f"STRATEGY RULE: {strategy['constraint_text']}")

    return " ".join(parts)


def _build_narration_instruction(
    role: str,
    scene: SceneInput,
    tension_profile: Dict[str, Any],
    core_tension: str,
    compression_goal: str,
    depth: int,
) -> str:
    """Build narration constraints for a scene based on its cognitive role."""
    parts: List[str] = []

    parts.append(f"Tension type: {tension_profile['tension_type']}.")
    parts.append(f"Intensity: {tension_profile['tension_intensity']}.")

    if tension_profile.get("reassurance_required"):
        parts.append(
            "REASSURANCE REQUIRED: Always include encouraging language. "
            "Never leave the learner confused without comfort."
        )

    if role == "introduce_tension":
        parts.append(
            "The narration MUST pose the core question. "
            f"Core tension: \"{core_tension}\". "
            "End this scene with the viewer wanting to know 'why'."
        )
        if depth <= 3:
            parts.append("No resolution language. Only open curiosity.")
    elif role == "reveal_constraint":
        parts.append(
            f"Must explicitly reference: \"{scene.highlight_focus}\". "
            "Must connect back to the tension from the opening."
        )
    elif role == "compress_insight":
        parts.append(
            f"Must reference compression goal: \"{compression_goal}\". "
            "The narration must feel inevitable — as if the conclusion "
            "could not have been any other way. Remove all ambiguity."
        )
    elif role == "show_counterexample":
        parts.append(
            "Narrate the surprise. Let the viewer feel the expectation break."
        )
    elif role == "formalize_equation":
        parts.append(
            "Walk through the equation step by step. "
            "Every symbol must be explained in context."
        )
    elif role == "generalize":
        parts.append(
            "Expand the scope. Show that this principle reaches further."
        )
    elif role == "highlight_invariant":
        parts.append(
            "Narrate what stays the same. "
            "Explicitly state the invariant: 'No matter how we change X, "
            "Y remains constant.' "
            "This is the structural anchor of the entire animation."
        )
    elif role == "translate_representation":
        parts.append(
            "Narrate the translation between representations. "
            "Explain what each symbol/element means in the other representation. "
            "'This curve becomes this equation' — make the mapping explicit."
        )

    return " ".join(parts)


def _build_equation_timing(
    role: str,
    scene: SceneInput,
    strategy: Dict[str, Any],
    eq_rules: Dict[str, Any],
    depth: int,
) -> Dict[str, Any]:
    """Determine equation timing constraints for a scene."""
    if not strategy.get("equation_allowed") or not eq_rules.get("symbolic_allowed"):
        return {
            "equations_permitted": False,
            "max_equations": 0,
            "timing_rule": "No equations in this scene.",
            "density": "none",
        }

    timing_rule = "Standard equation pacing."

    if role == "formalize_equation":
        timing_rule = (
            "Equations are the focus. Introduce step by step with annotations. "
            "Each equation line appears after the previous is understood."
        )
    elif role == "compress_insight":
        timing_rule = (
            "If an equation is used, it should appear as the final compression — "
            "the 'of course' formula that captures everything."
        )
    elif role == "introduce_tension":
        timing_rule = (
            "Equations should be minimal or absent. "
            "Only show a formula if it IS the source of tension."
        )
    elif role == "highlight_invariant":
        timing_rule = (
            "Equations should be minimal. "
            "The invariant is best shown visually. "
            "Only use an equation if the invariant IS an equation."
        )
    elif role == "translate_representation":
        timing_rule = (
            "Equations appear as the target representation. "
            "Show visual first, then translate to symbolic form. "
            "Each equation must map explicitly to a visual element."
        )

    return {
        "equations_permitted": True,
        "max_equations": eq_rules.get("max_equations", 1),
        "timing_rule": timing_rule,
        "density": eq_rules.get("symbolic_density", "light"),
        "derivation_allowed": eq_rules.get("derivation_allowed", False),
    }


def _build_highlight_sequence(
    role: str,
    scene: SceneInput,
    structural_arc: Dict[str, Any],
) -> List[str]:
    """Build the ordered highlight sequence for a scene."""
    highlights: List[str] = []

    if scene.highlight_focus.strip():
        highlights.append(scene.highlight_focus.strip())

    if role == "reveal_constraint":
        highlights.append("constraint-reveal-moment")
        # Also connect to arc midpoint constraints
        for mc in structural_arc.get("midpoint_constraints", []):
            if str(scene.scene_number) in mc:
                highlights.append(mc)

    if role == "compress_insight":
        highlights.append("compression-moment")
        highlights.append(structural_arc.get("climax_reveal", ""))

    if role == "introduce_tension":
        highlights.append("tension-hook")

    if role == "highlight_invariant":
        highlights.append("invariant-anchor")
        highlights.append(structural_arc.get("climax_reveal", ""))

    if role == "translate_representation":
        highlights.append("representation-bridge")

    return [h for h in highlights if h]  # filter empty


def _build_transition_logic(
    role: str,
    scene: SceneInput,
    total_scenes: int,
    structural_arc: Dict[str, Any],
) -> str:
    """Build the transition sentence/logic for connecting to the next scene."""
    if scene.scene_number >= total_scenes:
        return "Final scene — no transition needed. End with compression."

    if role == "introduce_tension":
        return (
            "Transition: leave the question open. "
            "The viewer should carry curiosity into the next scene."
        )
    elif role == "show_counterexample":
        return (
            "Transition: the failure is established. "
            "Next scene should begin resolving it."
        )
    elif role == "reveal_constraint":
        return (
            "Transition: the constraint is revealed. "
            "Next scene builds on this foundation."
        )
    elif role == "build_structure":
        return (
            "Transition: one piece is in place. "
            "Smoothly introduce the next building block."
        )
    elif role == "formalize_equation":
        return (
            "Transition: the formal statement is established. "
            "Move toward application or compression."
        )
    elif role == "highlight_invariant":
        return (
            "Transition: the invariant is established. "
            "Next scene builds on this structural anchor."
        )
    elif role == "translate_representation":
        return (
            "Transition: the representation shift is complete. "
            "Next scene uses the new representation to deepen understanding."
        )
    else:
        return "Transition: continue the narrative thread naturally."


# ═══════════════════════════════════════════════════════════════════════════
# PART 7 — AI PROMPT CONSTRUCTION
# ═══════════════════════════════════════════════════════════════════════════


def construct_cognitive_prompt(
    blueprint_input: AnimationBlueprintInput,
    scene: SceneInput,
    cognitive_plan: Dict[str, Any],
    tension_profile: Dict[str, Any],
    structural_arc: Dict[str, Any],
    eq_timing: Dict[str, Any],
    enrichments: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Construct a fully structured AI prompt for a single scene.

    This replaces free-form prompting with a cognitive plan document.
    Enrichments include: core invariant, misconception target,
    transformation mapping, visual density, minimalism rules.
    """
    depth = blueprint_input.target_depth
    enrichments = enrichments or {}

    # ── Visual type rendering instructions (reuse from animation_generator) ──
    from app.engine.animation_generator import (
        _get_visual_type_instructions,
        _get_narration_style,
        _get_reveal_pace_instructions,
    )

    visual_type_instructions = _get_visual_type_instructions(scene.visual_type)
    narration_style = _get_narration_style(depth)
    pace_instructions = _get_reveal_pace_instructions(scene.reveal_pace)

    # ── Build the structured prompt ──
    arc_opening = structural_arc.get("opening", "")
    arc_midpoints = "\n".join(
        f"  - {mc}" for mc in structural_arc.get("midpoint_constraints", [])
    ) or "  (none specified)"
    arc_climax = structural_arc.get("climax_reveal", "")
    arc_gen = structural_arc.get("generalisation") or "(not applicable at this depth)"

    eq_section = ""
    if eq_timing.get("equations_permitted"):
        eq_section = f"""EQUATION RULES:
- Max equations: {eq_timing['max_equations']}
- Density: {eq_timing['density']}
- Derivation allowed: {eq_timing.get('derivation_allowed', False)}
- Timing: {eq_timing['timing_rule']}"""
    else:
        eq_section = """EQUATION RULES:
- NO equations permitted in this scene.
- Use only visual elements, narration, and numeric examples."""

    highlight_list = "\n".join(
        f"  {i+1}. {h}" for i, h in enumerate(cognitive_plan.get("highlight_sequence", []))
    ) or "  (none specified)"

    return f"""You are an expert educational animator in the style of 3Blue1Brown (Manim).
You are generating a SINGLE scene as part of a cognitively structured animation.

═══ ANIMATION CONTEXT ═══
Title: {blueprint_input.title}
Subject: {blueprint_input.subject}
Concept: {blueprint_input.concept}
Cognitive Depth: {depth}/7
Animation Type: {blueprint_input.animation_type}

═══ COGNITIVE ARC (full animation skeleton) ═══
Opening Tension: {arc_opening}
Midpoint Constraints:
{arc_midpoints}
Climax (Compression Goal): {arc_climax}
Generalisation: {arc_gen}

═══ TENSION PROFILE ═══
Tension Type: {tension_profile['tension_type']}
Intensity: {tension_profile['tension_intensity']}
Abstraction Level: {tension_profile['abstraction_level']}
Complexity Budget: {tension_profile['allowed_complexity']}
Reassurance Required: {tension_profile['reassurance_required']}

═══ COGNITIVE ENRICHMENTS ═══
{enrichments.get("core_invariant_instruction", "Identify the structural invariant for this concept.")}
{enrichments.get("misconception_instruction", "Identify the most common naive expectation about this concept.")}
Transformation Map:
{enrichments.get("transformation_map_text", "  (auto-inferred from scene structure)")}

═══ VISUAL DENSITY LIMITS ═══
{enrichments.get("visual_density_text", "Standard density limits apply.")}

═══ MINIMALISM RULES ═══
{enrichments.get("minimalism_text", "Standard narration density.")}

═══ VISUAL GRAMMAR ═══
Every visual motion must justify a structural meaning.
No decorative flourishes — if an element moves, it must reveal structure.
If something glows, it must mark an invariant or a transformation point.
Static decoration is forbidden — every element earns its presence.

═══ THIS SCENE ═══
Scene {scene.scene_number} of {len(blueprint_input.scenes)}
Role: {cognitive_plan['role']}
Visual Type: {scene.visual_type}
Duration: {scene.duration} seconds
Description: {scene.description}
Key Constraint / Insight: {scene.highlight_focus}
Reveal Pace: {scene.reveal_pace}

═══ COGNITIVE PLAN FOR THIS SCENE ═══

VISUAL INSTRUCTION:
{cognitive_plan['visual_instruction']}

NARRATION INSTRUCTION:
{cognitive_plan['narration_instruction']}

{eq_section}

HIGHLIGHT SEQUENCE:
{highlight_list}

TRANSITION:
{cognitive_plan['transition_logic']}

═══ REVEAL STRATEGY: {blueprint_input.reveal_strategy.replace('_', ' ').title()} ═══
(Applied automatically — follow the visual/equation/narration instructions above.)

{visual_type_instructions}

{narration_style}

{pace_instructions}

MANIM STYLE RULES:
1. Dark background (#1C1C2E) with bright, clean colors
2. Build understanding step-by-step
3. Smooth easing (ease_in_out_cubic or ease_out_quint)
4. Clean sans-serif fonts for text
5. LaTeX for mathematical expressions
6. Arrows and vectors with proper heads
7. Subtle grid lines (low opacity)
8. Key moments get "indicate" animations (pulse/glow)
9. Transitions use "transform" or "morph"
10. No cluttered visuals — add elements progressively

RESPOND WITH VALID JSON:
{{
  "animation_instructions": "Plain English description of what happens",
  "narration_text": "The narration for this scene (or null if silent)",
  "key_visual_elements": ["element1", "element2"],
  "emphasis_points": ["concept1", "concept2"],
  "tension_statement": "The tension/question this scene carries (or null)",
  "compression_achieved": true/false,
  "core_invariant": "The structural truth preserved/revealed in this scene (or null if not applicable)",
  "misconception_addressed": "The naive expectation being corrected in this scene (or null)",
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
      "props": {{ ... }},
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
      "params": {{ ... }}
    }}
  ]
}}"""


# ═══════════════════════════════════════════════════════════════════════════
# PART 8 — POST-GENERATION SAFETY CHECKS
# ═══════════════════════════════════════════════════════════════════════════


_BEGINNER_FORBIDDEN = [
    "formal proof", "contradiction", "paradox",
    "non-trivial", "rigorous", "axiom", "theorem states",
    "by induction", "without loss of generality",
    "Q.E.D.", "necessarily follows", "absurd",
]


def post_generation_check(
    result: Dict[str, Any],
    scene: SceneInput,
    depth: int,
    is_first_scene: bool,
    is_last_scene: bool,
    core_tension: str,
    compression_goal: str,
    total_scenes: int = 1,
    max_visual_elements: int = 12,
) -> Tuple[bool, str]:
    """
    Run post-generation safety checks on a single scene result.

    Returns:
        (needs_regeneration: bool, override_instruction: str)

    Only one regeneration is allowed per scene — the caller tracks this.
    """
    narration = (result.get("narration_text") or "").lower()

    # Check 1: Beginner safety
    if depth <= 2:
        violations = [m for m in _BEGINNER_FORBIDDEN if m in narration]
        if violations:
            return True, (
                f"SAFETY OVERRIDE: This is depth {depth} (beginner). "
                f"Your narration contained advanced language: {', '.join(violations)}. "
                "Rewrite ALL narration using simple, encouraging language. "
                "No formal proof terms. Use analogies and visual references."
            )

    # Check 2: First scene must contain tension
    if is_first_scene:
        tension_stmt = result.get("tension_statement")
        has_question = any(
            marker in narration
            for marker in ["?", "why", "how come", "what if", "notice", "wonder"]
        )
        if not tension_stmt and not has_question:
            return True, (
                "TENSION INJECTION: The opening scene must establish cognitive tension. "
                f"The core tension is: \"{core_tension}\". "
                "Rewrite the narration to pose this question clearly. "
                "The viewer must feel curiosity or productive dissonance."
            )

    # Check 3: Final scene must achieve compression
    if is_last_scene:
        compression_flag = result.get("compression_achieved", False)
        has_resolution = any(
            marker in narration
            for marker in [
                "therefore", "so we see", "this means",
                "inevitabl", "must be", "could not",
                "turns out", "that's why", "of course",
            ]
        )
        if not compression_flag and not has_resolution:
            return True, (
                "COMPRESSION OVERRIDE: The final scene must deliver inevitability. "
                f"The compression goal is: \"{compression_goal}\". "
                "Rewrite the narration so the conclusion feels inevitable. "
                "The viewer must feel: 'Of course — it could not have been any other way.'"
            )

    # Check 4: Transformation must be meaningful (not static)
    manim_seq = result.get("manim_sequence", [])
    if len(manim_seq) < 2 and not is_first_scene and not is_last_scene:
        return True, (
            "TRANSFORMATION OVERRIDE: This scene has fewer than 2 animation steps. "
            "Every scene must show meaningful visual transformation — "
            "static slides are not animations. Add movement, morphing, or reveals."
        )

    # Check 5: Formalism must be delayed (not in first 40% of scenes)
    if total_scenes > 1:
        scene_position_pct = (scene.scene_number - 1) / max(1, total_scenes - 1) * 100
        visual_elements = result.get("visual_elements", [])
        if scene_position_pct < 40 and depth <= 4:
            equation_elements = [
                e for e in visual_elements if e.get("type") == "latex"
            ]
            if len(equation_elements) >= 2:
                return True, (
                    "FORMALISM DELAY OVERRIDE: Equations appeared too early "
                    f"(scene {scene.scene_number}, position {scene_position_pct:.0f}%). "
                    "At depth ≤ 4, formal expressions should not dominate the first 40% "
                    "of the animation. Replace equations with visual representations."
                )

    # Check 6: Visual density compliance
    all_visual_elements = result.get("visual_elements", [])
    if len(all_visual_elements) > max_visual_elements:
        return True, (
            f"VISUAL DENSITY OVERRIDE: Scene has {len(all_visual_elements)} elements "
            f"but maximum is {max_visual_elements} at depth {depth}. "
            "Remove decorative elements. Keep only structurally meaningful visuals."
        )

    return False, ""


# ═══════════════════════════════════════════════════════════════════════════
# PART 9 — MAIN ORCHESTRATOR
# ═══════════════════════════════════════════════════════════════════════════


async def generate_animation(
    blueprint_input: AnimationBlueprintInput,
) -> Dict[str, Any]:
    """
    Full ACE pipeline.

    Accepts an AnimationBlueprintInput and returns the complete
    structured animation output with cognitive summary.
    """
    depth = blueprint_input.target_depth
    scenes = blueprint_input.scenes

    logger.info(
        "ACE: Starting generation for '%s' (depth=%d, %d scenes, strategy=%s)",
        blueprint_input.title,
        depth,
        len(scenes),
        blueprint_input.reveal_strategy,
    )

    # ── Step 1: Build tension profile ──
    tension_profile = build_tension_profile(depth)
    logger.info("ACE: Tension profile — %s (%s)", tension_profile["tension_type"], tension_profile["tension_intensity"])

    # ── Step 2: Validate structural integrity ──
    suggestions = validate_structural_integrity(scenes, depth)
    if suggestions:
        logger.info("ACE: Structural suggestions — %s", suggestions)

    # ── Step 3: Build structural arc ──
    structural_arc = build_structural_arc(
        blueprint_input.core_tension,
        blueprint_input.compression_goal,
        scenes,
        depth,
    )
    logger.info("ACE: Structural arc built — %d midpoint constraints", len(structural_arc["midpoint_constraints"]))

    # ── Step 4: Apply reveal strategy ──
    strategy_instructions = apply_reveal_strategy(
        blueprint_input.reveal_strategy, scenes, depth
    )

    # ── Step 4A: Compute cognitive enrichments ──
    core_invariant_text = extract_core_invariant(
        blueprint_input.concept, blueprint_input.core_tension, depth
    )
    misconception_text = identify_misconception_target(
        blueprint_input.concept, blueprint_input.core_tension
    )
    transformation_map = compute_transformation_mapping(scenes)
    visual_density = compute_visual_density_rules(depth, len(scenes))
    minimalism = build_minimalism_rules(depth)

    enrichments = {
        "core_invariant_instruction": core_invariant_text,
        "misconception_instruction": misconception_text,
        "transformation_map": transformation_map,
        "transformation_map_text": "\n  ".join(transformation_map) if transformation_map else "(auto-inferred)",
        "visual_density": visual_density,
        "visual_density_text": visual_density["instruction"],
        "minimalism": minimalism,
        "minimalism_text": minimalism["instruction"],
    }
    logger.info(
        "ACE: Cognitive enrichments computed — %d transformations mapped",
        len(transformation_map),
    )

    # ── Step 5: Generate each scene ──
    generated_scenes: List[Dict[str, Any]] = []
    inevitability_achieved = False
    tension_established = False

    for i, scene in enumerate(scenes):
        is_first = i == 0
        is_last = i == len(scenes) - 1

        # Build cognitive plan for this scene
        eq_timing = _build_equation_timing(
            scene.role or "build_structure",
            scene,
            strategy_instructions[i],
            strategy_instructions[i].get("equation_rules", {}),
            depth,
        )

        cognitive_plan = build_scene_cognitive_plan(
            scene=scene,
            tension_profile=tension_profile,
            structural_arc=structural_arc,
            strategy_instructions=strategy_instructions[i],
            core_tension=blueprint_input.core_tension,
            compression_goal=blueprint_input.compression_goal,
            depth=depth,
            total_scenes=len(scenes),
        )

        # Construct prompt
        prompt = construct_cognitive_prompt(
            blueprint_input=blueprint_input,
            scene=scene,
            cognitive_plan=cognitive_plan,
            tension_profile=tension_profile,
            structural_arc=structural_arc,
            eq_timing=eq_timing,
            enrichments=enrichments,
        )

        # Generate with retry budget (1 normal + 1 safety regen)
        result = None
        for attempt in range(2):
            try:
                result = await _call_gpt(prompt, max_tokens=4000)

                # Validate required fields
                if not result.get("visual_elements"):
                    raise ValueError("Missing visual_elements")
                if not result.get("manim_sequence"):
                    raise ValueError("Missing manim_sequence")

                # Duration validation
                scene_dur = scene.duration
                max_end = 0
                for inst in result.get("manim_sequence", []):
                    end = inst.get("start_time", 0) + inst.get("duration", 0)
                    max_end = max(max_end, end)
                if max_end > scene_dur + 1:
                    logger.warning(
                        "ACE: Scene %d animations exceed duration: %.1fs > %ds",
                        scene.scene_number, max_end, scene_dur,
                    )

                # Apply dignity filter
                try:
                    from app.engine.dignity_filter import dignity_filter
                    if result.get("narration_text"):
                        result["narration_text"] = dignity_filter.filter_response(
                            result["narration_text"]
                        )
                except ImportError:
                    pass

                # Post-generation safety check (only on first attempt)
                if attempt == 0:
                    needs_regen, override = post_generation_check(
                        result, scene, depth,
                        is_first, is_last,
                        blueprint_input.core_tension,
                        blueprint_input.compression_goal,
                        total_scenes=len(scenes),
                        max_visual_elements=visual_density["max_elements_per_scene"],
                    )
                    if needs_regen:
                        logger.warning(
                            "ACE: Scene %d failed safety check — regenerating. Override: %s",
                            scene.scene_number, override[:100],
                        )
                        prompt += f"\n\n{override}"
                        continue

                # Track cognitive markers
                if result.get("tension_statement"):
                    tension_established = True
                if result.get("compression_achieved"):
                    inevitability_achieved = True

                logger.info(
                    "ACE: Scene %d generated — %d elements, %d animations (attempt %d)",
                    scene.scene_number,
                    len(result.get("visual_elements", [])),
                    len(result.get("manim_sequence", [])),
                    attempt + 1,
                )
                break

            except Exception as e:
                logger.warning(
                    "ACE: Scene %d generation attempt %d failed: %s",
                    scene.scene_number, attempt + 1, e,
                )
                if attempt == 0:
                    prompt += f"\n\nPREVIOUS ATTEMPT FAILED: {e}\nPlease fix and try again."
                else:
                    # Exhausted retries — use empty fallback
                    result = {
                        "animation_instructions": f"Scene {scene.scene_number} generation failed: {e}",
                        "narration_text": None,
                        "key_visual_elements": [],
                        "emphasis_points": [],
                        "visual_elements": [],
                        "manim_sequence": [],
                        "tension_statement": None,
                        "compression_achieved": False,
                    }
                    logger.error(
                        "ACE: Scene %d generation exhausted — using empty fallback",
                        scene.scene_number,
                    )

        # Assemble output scene
        generated_scenes.append({
            "scene_number": scene.scene_number,
            "role": scene.role or "build_structure",
            "visual_script": result.get("animation_instructions", ""),
            "narration": result.get("narration_text"),
            "equations": [
                e for e in result.get("visual_elements", [])
                if e.get("type") == "latex"
            ],
            "highlights": result.get("emphasis_points", []),
            "transitions": cognitive_plan.get("transition_logic", ""),
            # Full renderer payload (passed directly to frontend)
            "visual_elements": result.get("visual_elements", []),
            "manim_sequence": result.get("manim_sequence", []),
            "key_visual_elements": result.get("key_visual_elements", []),
            "tension_statement": result.get("tension_statement"),
            "compression_achieved": result.get("compression_achieved", False),
            "core_invariant": result.get("core_invariant"),
            "misconception_addressed": result.get("misconception_addressed"),
        })

    # ── Step 6: Compute inevitability score ──
    inevitability_score = compute_inevitability_score(
        generated_scenes, blueprint_input.compression_goal
    )

    # Collect cognitive metadata from generated scenes
    core_invariants = [
        s.get("core_invariant") for s in generated_scenes
        if s.get("core_invariant")
    ]
    misconceptions = [
        s.get("misconception_addressed") for s in generated_scenes
        if s.get("misconception_addressed")
    ]

    # ── Build cognitive summary ──
    cognitive_summary = {
        "tension_type": tension_profile["tension_type"],
        "tension_intensity": tension_profile["tension_intensity"],
        "abstraction_level": tension_profile["abstraction_level"],
        "tension_established": tension_established,
        "inevitability_achieved": inevitability_achieved,
        "inevitability_score": inevitability_score,
        "structural_arc": structural_arc,
        "suggestions": suggestions,
        "reveal_strategy": blueprint_input.reveal_strategy,
        "depth": depth,
        "enrichments": {
            "core_invariant": core_invariants[0] if core_invariants else None,
            "misconception_target": misconceptions[0] if misconceptions else None,
            "transformation_map": transformation_map,
            "visual_density_rules": visual_density,
            "minimalism_rules": minimalism,
        },
    }

    logger.info(
        "ACE: Generation complete — %d scenes, tension=%s, inevitability=%s",
        len(generated_scenes),
        tension_established,
        inevitability_achieved,
    )

    return {
        "scenes": generated_scenes,
        "cognitive_summary": cognitive_summary,
    }


# ═══════════════════════════════════════════════════════════════════════════
# PREVIEW ARC (no AI call — instant structural preview)
# ═══════════════════════════════════════════════════════════════════════════


def preview_arc(
    blueprint_input: AnimationBlueprintInput,
) -> Dict[str, Any]:
    """
    Return the cognitive skeleton + validation suggestions WITHOUT
    calling the AI. Useful for instant teacher review before generation.
    """
    depth = blueprint_input.target_depth
    scenes = blueprint_input.scenes

    tension_profile = build_tension_profile(depth)
    suggestions = validate_structural_integrity(scenes, depth)
    structural_arc = build_structural_arc(
        blueprint_input.core_tension,
        blueprint_input.compression_goal,
        scenes,
        depth,
    )
    strategy_instructions = apply_reveal_strategy(
        blueprint_input.reveal_strategy, scenes, depth
    )
    eq_perm = equation_permission(depth)

    # Build per-scene cognitive plans (no AI call)
    scene_plans: List[Dict[str, Any]] = []
    for i, scene in enumerate(scenes):
        eq_timing = _build_equation_timing(
            scene.role or "build_structure",
            scene,
            strategy_instructions[i],
            strategy_instructions[i].get("equation_rules", {}),
            depth,
        )
        plan = build_scene_cognitive_plan(
            scene=scene,
            tension_profile=tension_profile,
            structural_arc=structural_arc,
            strategy_instructions=strategy_instructions[i],
            core_tension=blueprint_input.core_tension,
            compression_goal=blueprint_input.compression_goal,
            depth=depth,
            total_scenes=len(scenes),
        )
        scene_plans.append(plan)

    # Compute cognitive enrichments (no AI call)
    core_invariant_text = extract_core_invariant(
        blueprint_input.concept, blueprint_input.core_tension, depth
    )
    misconception_text = identify_misconception_target(
        blueprint_input.concept, blueprint_input.core_tension
    )
    transformation_map = compute_transformation_mapping(scenes)
    visual_density = compute_visual_density_rules(depth, len(scenes))
    minimalism = build_minimalism_rules(depth)

    return {
        "tension_profile": tension_profile,
        "structural_arc": structural_arc,
        "suggestions": suggestions,
        "equation_permission": eq_perm,
        "scene_plans": scene_plans,
        "enrichments": {
            "core_invariant_instruction": core_invariant_text,
            "misconception_instruction": misconception_text,
            "transformation_map": transformation_map,
            "visual_density_rules": visual_density,
            "minimalism_rules": minimalism,
        },
    }
