"""
Custom Modules API — CRUD + AI-powered graph generation.

Endpoints:
  POST   /generate-map       — Generate node graph via GPT-5.2
  POST   /                   — Save a complete custom module
  GET    /                   — List all custom modules
  GET    /{module_id}        — Get a single custom module
  DELETE /{module_id}        — Delete a custom module
  PATCH  /{module_id}/graph  — Update the node graph only
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.engine.custom_module_generator import (
    generate_node_graph,
    save_custom_module,
    get_custom_module,
    list_custom_modules,
    delete_custom_module,
    update_custom_module_graph,
    generate_node_scaffold,
    generate_single_block_content,
    save_node_content,
    get_node_content,
    validate_module_for_publish,
    publish_module,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request / Response Models ─────────────────────────────────────────────


class DepthRange(BaseModel):
    min: int = Field(ge=1, le=7, default=1)
    max: int = Field(ge=1, le=7, default=7)


class ConceptScopeModel(BaseModel):
    module_title: str
    subject: str = "Custom"
    difficulty_level: str = "Intermediate"
    assumed_prerequisites: List[str] = []
    estimated_duration_minutes: int = Field(ge=15, le=180, default=60)
    regional_context: Optional[str] = None
    target_age_group: Optional[str] = None


class LearningObjectivesModel(BaseModel):
    conceptual_understanding: List[str] = Field(min_length=2)
    mathematical_skills: Optional[List[str]] = None
    real_world_applications: Optional[List[str]] = None
    common_misconceptions: Optional[List[str]] = None


class CognitiveDesignModel(BaseModel):
    teaching_style: str = "Concept-first"
    socratic_intensity: str = "Moderate"
    allowed_depth_range: DepthRange = DepthRange()
    beauty_permission: str = "Balanced"


class GenerateMapRequest(BaseModel):
    concept_scope: ConceptScopeModel
    learning_objectives: LearningObjectivesModel
    cognitive_design: CognitiveDesignModel


class NodeModel(BaseModel):
    id: str
    title: str
    description: str
    depth_level: int = Field(ge=1, le=7)
    addresses_misconception: Optional[List[str]] = None
    prerequisites: List[str] = []
    emoji: Optional[str] = None
    estimated_time: Optional[str] = None
    discover_points: Optional[List[str]] = None


class EdgeModel(BaseModel):
    from_id: str = Field(alias="from")
    to_id: str = Field(alias="to")

    class Config:
        populate_by_name = True


class NodeGraphModel(BaseModel):
    nodes: List[NodeModel]
    edges: List[EdgeModel]


class SaveModuleRequest(BaseModel):
    id: Optional[str] = None
    blueprint: ConceptScopeModel
    objectives: LearningObjectivesModel
    cognitive_design: CognitiveDesignModel
    node_graph: Dict[str, Any]
    created_by: str = "default"


class UpdateGraphRequest(BaseModel):
    node_graph: Dict[str, Any]


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.post("/generate-map", name="generate_map")
@router.post("/generate-map/", include_in_schema=False)
async def generate_map(request: GenerateMapRequest):
    """Generate a node graph from teacher-defined blueprint using GPT-5.2."""
    try:
        # Validate depth range
        if request.cognitive_design.allowed_depth_range.min > request.cognitive_design.allowed_depth_range.max:
            raise HTTPException(
                status_code=400,
                detail="min depth must be ≤ max depth",
            )

        graph = await generate_node_graph(
            concept_scope=request.concept_scope.model_dump(),
            learning_objectives=request.learning_objectives.model_dump(),
            cognitive_design=request.cognitive_design.model_dump(),
        )

        return {"status": "ok", "node_graph": graph}

    except ValueError as e:
        logger.error("Graph generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error in generate-map: %s", e)
        raise HTTPException(status_code=500, detail="Graph generation failed")


@router.post("/")
async def create_module(request: SaveModuleRequest):
    """Save a completed custom module to MongoDB."""
    try:
        module_data = request.model_dump()
        module_id = save_custom_module(module_data)
        return {"status": "ok", "module_id": module_id}
    except Exception as e:
        logger.error("Failed to save custom module: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save module")


@router.get("/")
async def list_modules(user_id: str = "default"):
    """List all custom modules for a user."""
    try:
        modules = list_custom_modules(user_id)
        return {"status": "ok", "modules": modules}
    except Exception as e:
        logger.error("Failed to list custom modules: %s", e)
        raise HTTPException(status_code=500, detail="Failed to list modules")


@router.get("/{module_id}")
async def get_module(module_id: str):
    """Get a single custom module by ID."""
    try:
        module = get_custom_module(module_id)
        if not module:
            raise HTTPException(status_code=404, detail="Module not found")
        return {"status": "ok", "module": module}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get module %s: %s", module_id, e)
        raise HTTPException(status_code=500, detail="Failed to get module")


@router.delete("/{module_id}")
async def remove_module(module_id: str):
    """Delete a custom module."""
    try:
        deleted = delete_custom_module(module_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Module not found")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete module %s: %s", module_id, e)
        raise HTTPException(status_code=500, detail="Failed to delete module")


@router.patch("/{module_id}/graph")
async def update_graph(module_id: str, request: UpdateGraphRequest):
    """Update only the node graph of an existing custom module."""
    try:
        updated = update_custom_module_graph(module_id, request.node_graph)
        if not updated:
            raise HTTPException(status_code=404, detail="Module not found")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update graph for %s: %s", module_id, e)
        raise HTTPException(status_code=500, detail="Failed to update graph")


# ── Phase C: Node Content Builder Endpoints ───────────────────────────


class NodeMetadataModel(BaseModel):
    id: str
    title: str
    description: str = ""
    depth_level: int = Field(ge=1, le=7, default=3)
    addresses_misconception: Optional[List[str]] = None
    prerequisites: Optional[List[str]] = None
    emoji: Optional[str] = None
    estimated_time: Optional[str] = None
    discover_points: Optional[List[str]] = None


class GenerateScaffoldRequest(BaseModel):
    module_id: str
    node_id: str
    entry_style: str = "short_explanation"
    cognitive_design: CognitiveDesignModel = CognitiveDesignModel()
    node_metadata: NodeMetadataModel
    stage_number: Optional[int] = None
    total_stages: Optional[int] = None


class ContentBlockModel(BaseModel):
    id: str
    type: str
    content: str
    locked: Optional[bool] = None


class StageContentModel(BaseModel):
    stage_number: int = Field(ge=1, le=10)
    entry_style: str = "short_explanation"
    blocks: List[ContentBlockModel]


class SaveNodeContentRequest(BaseModel):
    experience_type: str = "focused_concept"
    stages: List[StageContentModel]


@router.post("/generate-node-scaffold")
@router.post("/generate-node-scaffold/", include_in_schema=False)
async def generate_scaffold(request: GenerateScaffoldRequest):
    """Generate a structured content scaffold for a single node using GPT-5.2."""
    try:
        scaffold = await generate_node_scaffold(
            module_id=request.module_id,
            node_id=request.node_id,
            entry_style=request.entry_style,
            cognitive_design=request.cognitive_design.model_dump(),
            node_metadata=request.node_metadata.model_dump(),
            stage_number=request.stage_number,
            total_stages=request.total_stages,
        )
        return {"status": "ok", "scaffold": scaffold}
    except ValueError as e:
        logger.error("Scaffold generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error in generate-node-scaffold: %s", e)
        raise HTTPException(status_code=500, detail="Scaffold generation failed")


class GenerateBlockContentRequest(BaseModel):
    block_type: str  # "entry", "explanation", "micro_question", "simulation", "quiz", "video"
    node_title: str
    node_description: str = ""
    entry_style: str = "short_explanation"
    depth_level: int = Field(ge=1, le=7, default=3)
    existing_blocks: Optional[List[Dict[str, Any]]] = None


@router.post("/generate-block-content")
@router.post("/generate-block-content/", include_in_schema=False)
async def generate_block_content(request: GenerateBlockContentRequest):
    """Generate AI content for a single block type within a node."""
    try:
        content = await generate_single_block_content(
            block_type=request.block_type,
            node_title=request.node_title,
            node_description=request.node_description,
            entry_style=request.entry_style,
            depth_level=request.depth_level,
            existing_blocks=request.existing_blocks,
        )
        return {"status": "ok", "content": content}
    except ValueError as e:
        logger.error("Block content generation failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error in generate-block-content: %s", e)
        raise HTTPException(status_code=500, detail="Block content generation failed")


@router.put("/{module_id}/nodes/{node_id}/content")
@router.put("/{module_id}/nodes/{node_id}/content/", include_in_schema=False)
async def save_content(
    module_id: str,
    node_id: str,
    request: SaveNodeContentRequest,
):
    """Save content for a single node within a custom module (stage-based)."""
    try:
        content_data = {
            "experience_type": request.experience_type,
            "stages": [
                {
                    "stage_number": s.stage_number,
                    "entry_style": s.entry_style,
                    "blocks": [b.model_dump() for b in s.blocks],
                }
                for s in request.stages
            ],
        }
        saved = save_node_content(module_id, node_id, content_data)
        if not saved:
            raise HTTPException(status_code=404, detail="Module not found")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to save node content: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save content")


@router.get("/{module_id}/nodes/{node_id}/content")
async def load_content(module_id: str, node_id: str):
    """Get content for a single node within a custom module."""
    content = get_node_content(module_id, node_id)
    if content is None:
        return {"status": "ok", "content": None}
    return {"status": "ok", "content": content}


@router.post("/{module_id}/validate")
@router.post("/{module_id}/validate/", include_in_schema=False)
async def validate_for_publish(module_id: str):
    """Validate a custom module is ready for publishing."""
    result = validate_module_for_publish(module_id)
    return {"status": "ok", **result}


@router.post("/{module_id}/publish")
@router.post("/{module_id}/publish/", include_in_schema=False)
async def do_publish(module_id: str):
    """Publish a custom module after validation passes."""
    result = publish_module(module_id)
    if not result.get("valid", False) and not result.get("published", False):
        errors = result.get("errors", ["Validation failed"])
        raise HTTPException(status_code=400, detail="; ".join(errors))
    return {"status": "ok", **result}
