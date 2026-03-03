"""
Animations API — CRUD + AI-powered Manim-style animation generation.

Endpoints:
  POST   /generate-scene/      — Generate scene content via GPT-5.2  POST   /generate-animation/  — Full ACE pipeline (all scenes, cognitive arc)
  POST   /preview-arc/         — Instant structural preview (no AI call)  POST   /refine-narration/    — Refine narration with depth gating
  POST   /                     — Save an animation document
  GET    /                     — List all animations for a user
  GET    /{anim_id}            — Get a single animation
  DELETE /{anim_id}            — Delete an animation
  PATCH  /{anim_id}/scenes     — Update scenes array
  PATCH  /{anim_id}/blueprint  — Update blueprint
  POST   /{anim_id}/publish/   — Publish (validates dignity score ≥ 0.7)
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.engine.animation_generator import (
    generate_scene_content,
    refine_narration,
    save_animation,
    get_animation,
    list_animations,
    delete_animation,
    update_animation_field,
    publish_animation,
    compute_dignity_score,
)
from app.engine.animation_cognitive_engine import (
    AnimationBlueprintInput,
    SceneInput as ACESceneInput,
    generate_animation as ace_generate_animation,
    preview_arc as ace_preview_arc,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Pydantic Models ───────────────────────────────────────────────────────


class BlueprintModel(BaseModel):
    title: str
    subject: str = "Physics"
    concept_description: str = ""
    target_depth: int = 3
    animation_type: str = "Process"
    scene_structure: str = "single"
    scene_count: int = 1
    core_tension: Optional[str] = None
    compression_goal: Optional[str] = None
    reveal_strategy: str = "gradual_constraint_build"


class SceneModel(BaseModel):
    id: str
    scene_number: int
    visual_type: str = "2d_graph"
    description: str = ""
    duration_seconds: float = 10
    highlight_focus: Optional[str] = None
    narration_type: str = "ai_narration"
    scene_role: Optional[str] = None
    reveal_pace: str = "moderate"
    generated_content: Optional[Dict[str, Any]] = None
    custom_narration: Optional[str] = None
    visual_elements: Optional[List[Dict[str, Any]]] = None


class GenerateSceneRequest(BaseModel):
    blueprint: BlueprintModel
    scene: SceneModel


class ACESceneModel(BaseModel):
    """Scene input for the ACE pipeline."""
    id: str = ""
    scene_number: int = 1
    role: Optional[str] = None
    description: str = ""
    highlight_focus: str = ""
    visual_type: str = "2d_graph"
    duration: int = 8
    reveal_pace: str = "moderate"
    narration_type: str = "ai_narration"
    custom_narration: Optional[str] = None


class GenerateAnimationRequest(BaseModel):
    """Full ACE pipeline request."""
    title: str
    subject: str = "Physics"
    concept: str = ""
    target_depth: int = 3
    animation_type: str = "Process"
    scene_structure: str = "multi_scene"
    core_tension: str = ""
    compression_goal: str = ""
    reveal_strategy: str = "gradual_constraint_build"
    scenes: List[ACESceneModel] = []


class RefineNarrationRequest(BaseModel):
    blueprint: BlueprintModel
    scene: SceneModel
    raw_narration: str


class SaveAnimationRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(None, alias="_id")
    created_by: str = "default"
    blueprint: Dict[str, Any]
    scenes: List[Dict[str, Any]] = []
    total_duration: float = 0
    status: str = "draft"


class PatchFieldRequest(BaseModel):
    data: Any


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.post("/generate-animation")
@router.post("/generate-animation/")
async def api_generate_animation(req: GenerateAnimationRequest):
    """Full ACE pipeline: cognitive arc → prompt construction → generation → safety."""
    try:
        ace_input = AnimationBlueprintInput(
            title=req.title,
            subject=req.subject,
            concept=req.concept,
            target_depth=req.target_depth,
            animation_type=req.animation_type,
            scene_structure=req.scene_structure,
            core_tension=req.core_tension,
            compression_goal=req.compression_goal,
            reveal_strategy=req.reveal_strategy,
            scenes=[
                ACESceneInput(
                    id=s.id,
                    scene_number=s.scene_number,
                    role=s.role,
                    description=s.description,
                    highlight_focus=s.highlight_focus,
                    visual_type=s.visual_type,
                    duration=s.duration,
                    reveal_pace=s.reveal_pace,
                    narration_type=s.narration_type,
                    custom_narration=s.custom_narration,
                )
                for s in req.scenes
            ],
        )
        result = await ace_generate_animation(ace_input)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error("ACE generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/preview-arc")
@router.post("/preview-arc/")
async def api_preview_arc(req: GenerateAnimationRequest):
    """Instant structural preview — no AI call. Returns cognitive skeleton + suggestions."""
    try:
        ace_input = AnimationBlueprintInput(
            title=req.title,
            subject=req.subject,
            concept=req.concept,
            target_depth=req.target_depth,
            animation_type=req.animation_type,
            scene_structure=req.scene_structure,
            core_tension=req.core_tension,
            compression_goal=req.compression_goal,
            reveal_strategy=req.reveal_strategy,
            scenes=[
                ACESceneInput(
                    id=s.id,
                    scene_number=s.scene_number,
                    role=s.role,
                    description=s.description,
                    highlight_focus=s.highlight_focus,
                    visual_type=s.visual_type,
                    duration=s.duration,
                    reveal_pace=s.reveal_pace,
                    narration_type=s.narration_type,
                    custom_narration=s.custom_narration,
                )
                for s in req.scenes
            ],
        )
        result = ace_preview_arc(ace_input)
        return {"success": True, "data": result}
    except Exception as e:
        logger.error("ACE preview-arc failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-scene")
@router.post("/generate-scene/")
async def api_generate_scene(req: GenerateSceneRequest):
    """Phase 3: Generate scene content (visual elements + animation sequence)."""
    try:
        result = await generate_scene_content(
            req.blueprint.model_dump(),
            req.scene.model_dump(),
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.error("Scene generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refine-narration")
@router.post("/refine-narration/")
async def api_refine_narration(req: RefineNarrationRequest):
    """Phase 6: Refine narration with depth gating + dignity filter."""
    try:
        result = await refine_narration(
            req.blueprint.model_dump(),
            req.scene.model_dump(),
            req.raw_narration,
        )
        return {"success": True, "data": result}
    except Exception as e:
        logger.error("Narration refinement failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("")
@router.post("/")
async def api_save_animation(req: SaveAnimationRequest):
    """Save or update an animation document."""
    try:
        doc = req.model_dump(by_alias=True, exclude_none=True)
        # Compute total duration
        doc["total_duration"] = sum(
            s.get("duration_seconds", 0) for s in doc.get("scenes", [])
        )
        anim_id = save_animation(doc)
        return {"success": True, "id": anim_id}
    except Exception as e:
        logger.error("Save animation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
@router.get("/")
async def api_list_animations(user_id: str = "default"):
    """List all animations for a user."""
    try:
        animations = list_animations(user_id)
        return {"success": True, "data": animations}
    except Exception as e:
        logger.error("List animations failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{anim_id}")
async def api_get_animation(anim_id: str):
    """Get a single animation by ID."""
    doc = get_animation(anim_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Animation not found")
    return {"success": True, "data": doc}


@router.delete("/{anim_id}")
async def api_delete_animation(anim_id: str):
    """Delete an animation."""
    ok = delete_animation(anim_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Animation not found")
    return {"success": True}


@router.patch("/{anim_id}/scenes")
async def api_update_scenes(anim_id: str, req: PatchFieldRequest):
    """Update the scenes array."""
    ok = update_animation_field(anim_id, "scenes", req.data)
    if not ok:
        raise HTTPException(status_code=404, detail="Animation not found")
    return {"success": True}


@router.patch("/{anim_id}/blueprint")
async def api_update_blueprint(anim_id: str, req: PatchFieldRequest):
    """Update the blueprint."""
    ok = update_animation_field(anim_id, "blueprint", req.data)
    if not ok:
        raise HTTPException(status_code=404, detail="Animation not found")
    return {"success": True}


@router.post("/{anim_id}/publish")
@router.post("/{anim_id}/publish/")
async def api_publish_animation(anim_id: str):
    """
    Publish an animation after validation:
    - At least 1 scene
    - All scenes have valid visual types
    - No duration overflow (max 90s total)
    - Dignity score ≥ 0.7
    """
    doc = get_animation(anim_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Animation not found")

    # Validation
    errors = []

    if not doc.get("blueprint", {}).get("title"):
        errors.append("Title is required")

    scenes = doc.get("scenes", [])
    if len(scenes) == 0:
        errors.append("At least 1 scene is required")

    valid_types = {
        "2d_graph", "vector_field", "grid_transformation",
        "particle_motion", "wave_propagation", "circuit_flow",
        "custom_drawing",
    }
    for s in scenes:
        if s.get("visual_type") not in valid_types:
            errors.append(f"Scene {s.get('scene_number', '?')}: invalid visual type '{s.get('visual_type')}'")
        if not (3 <= s.get("duration_seconds", 0) <= 20):
            errors.append(f"Scene {s.get('scene_number', '?')}: duration must be 3-20 seconds")

    total_dur = sum(s.get("duration_seconds", 0) for s in scenes)
    if total_dur > 90:
        errors.append(f"Total duration {total_dur:.1f}s exceeds 90s limit")

    # Dignity score
    dignity = compute_dignity_score(doc)
    if dignity < 0.7:
        errors.append(f"Dignity score {dignity:.2f} is below 0.7 threshold")

    if errors:
        raise HTTPException(status_code=422, detail={"errors": errors})

    # All checks passed — publish
    ok = publish_animation(anim_id)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to publish")

    return {"success": True, "dignity_score": dignity}
