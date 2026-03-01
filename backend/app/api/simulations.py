"""
Simulations API — CRUD + AI-powered simulation generation.

Endpoints:
  POST   /generate-engine/    — Generate sim model + renderer config via GPT-5.2
  POST   /generate-guidance/  — Generate cognitive overlay / guidance via GPT-5.2
  POST   /                    — Save a simulation document
  GET    /                    — List all simulations for a user
  GET    /{sim_id}            — Get a single simulation
  DELETE /{sim_id}            — Delete a simulation
  PATCH  /{sim_id}/model      — Update the model only
  PATCH  /{sim_id}/renderer   — Update the renderer config only
  PATCH  /{sim_id}/guidance   — Update the guidance only
  POST   /{sim_id}/publish/   — Publish a simulation
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.engine.simulation_generator import (
    generate_simulation_engine,
    generate_simulation_guidance,
    save_simulation,
    get_simulation,
    list_simulations,
    delete_simulation,
    update_simulation_field,
    publish_simulation,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Pydantic Models ───────────────────────────────────────────────────────


class VariableModel(BaseModel):
    name: str
    symbol: str
    unit: str = ""
    min: float = 0
    max: float = 100
    default_value: float = 50
    step: float = 1
    is_input: bool = True
    color: Optional[str] = None


class BlueprintModel(BaseModel):
    title: str
    subject: str = "Physics"
    topic: str = ""
    description: str = ""
    category: str = "mechanics"
    renderer_type: str = "graph"
    difficulty: str = "intermediate"
    variables: List[VariableModel] = []
    target_audience: str = ""
    learning_goal: str = ""
    constraints: Optional[str] = None


class GenerateEngineRequest(BaseModel):
    blueprint: BlueprintModel


class GenerateGuidanceRequest(BaseModel):
    blueprint: BlueprintModel
    model: Dict[str, Any]


class SaveSimulationRequest(BaseModel):
    _id: Optional[str] = None
    user_id: str = "default"
    blueprint: Dict[str, Any]
    model: Optional[Dict[str, Any]] = None
    renderer_config: Optional[Dict[str, Any]] = None
    guidance: Optional[Dict[str, Any]] = None
    status: str = "draft"
    embedded_in_module: Optional[str] = None
    embedded_in_node: Optional[str] = None


class PatchFieldRequest(BaseModel):
    data: Dict[str, Any]


# ── Endpoints ─────────────────────────────────────────────────────────────


@router.post("/generate-engine")
@router.post("/generate-engine/")
async def api_generate_engine(req: GenerateEngineRequest):
    """Phase 2: Generate simulation model + renderer config from blueprint."""
    try:
        blueprint_dict = req.blueprint.model_dump()
        result = await generate_simulation_engine(blueprint_dict)
        return {
            "success": True,
            "model": result["model"],
            "renderer_config": result["renderer_config"],
        }
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        logger.error("Engine generation error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/generate-guidance")
@router.post("/generate-guidance/")
async def api_generate_guidance(req: GenerateGuidanceRequest):
    """Phase 4: Generate cognitive overlay / educational guidance."""
    try:
        blueprint_dict = req.blueprint.model_dump()
        result = await generate_simulation_guidance(blueprint_dict, req.model)
        return {"success": True, "guidance": result}
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        logger.error("Guidance generation error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("")
@router.post("/")
async def api_save_simulation(req: SaveSimulationRequest):
    """Save or update a simulation document."""
    try:
        doc = req.model_dump()
        # Move underscore-prefixed ID to _id
        if doc.get("_id"):
            pass
        sim_id = save_simulation(doc)
        return {"success": True, "simulation_id": sim_id}
    except Exception as e:
        logger.error("Save simulation error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("")
@router.get("/")
async def api_list_simulations(user_id: str = "default"):
    """List all simulations for a user."""
    try:
        sims = list_simulations(user_id)
        return {"success": True, "simulations": sims}
    except Exception as e:
        logger.error("List simulations error: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/{sim_id}")
@router.get("/{sim_id}/")
async def api_get_simulation(sim_id: str):
    """Get a single simulation by ID."""
    doc = get_simulation(sim_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {"success": True, "simulation": doc}


@router.delete("/{sim_id}")
@router.delete("/{sim_id}/")
async def api_delete_simulation(sim_id: str):
    """Delete a simulation."""
    deleted = delete_simulation(sim_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {"success": True}


@router.patch("/{sim_id}/model")
@router.patch("/{sim_id}/model/")
async def api_update_model(sim_id: str, req: PatchFieldRequest):
    """Update only the model field of a simulation."""
    updated = update_simulation_field(sim_id, "model", req.data)
    if not updated:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {"success": True}


@router.patch("/{sim_id}/renderer")
@router.patch("/{sim_id}/renderer/")
async def api_update_renderer(sim_id: str, req: PatchFieldRequest):
    """Update only the renderer_config field of a simulation."""
    updated = update_simulation_field(sim_id, "renderer_config", req.data)
    if not updated:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {"success": True}


@router.patch("/{sim_id}/guidance")
@router.patch("/{sim_id}/guidance/")
async def api_update_guidance(sim_id: str, req: PatchFieldRequest):
    """Update only the guidance field of a simulation."""
    updated = update_simulation_field(sim_id, "guidance", req.data)
    if not updated:
        raise HTTPException(status_code=404, detail="Simulation not found")
    return {"success": True}


@router.post("/{sim_id}/publish")
@router.post("/{sim_id}/publish/")
async def api_publish_simulation(sim_id: str):
    """Publish a simulation (make it available to students)."""
    doc = get_simulation(sim_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Simulation not found")

    # Validate required fields for publishing
    errors = []
    if not doc.get("model"):
        errors.append("Simulation has no generated model")
    if not doc.get("renderer_config"):
        errors.append("Simulation has no renderer configuration")
    if not doc.get("guidance"):
        errors.append("Simulation has no cognitive guidance")

    if errors:
        raise HTTPException(
            status_code=422,
            detail={"message": "Simulation not ready for publishing", "errors": errors},
        )

    published = publish_simulation(sim_id)
    if not published:
        raise HTTPException(status_code=500, detail="Failed to publish")
    return {"success": True}
