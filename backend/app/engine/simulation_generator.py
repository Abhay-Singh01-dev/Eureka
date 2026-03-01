"""
Simulation Engine — GPT-5.2 powered simulation generation.

Generates full simulation models (equations, renderer configs, cognitive
guidance) from teacher-defined blueprints.  Uses the same Azure OpenAI
endpoint as the rest of Eureka.
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
                or "You are an expert physics and mathematics simulation designer. Respond with valid JSON only. Do not include markdown code fences or any text outside the JSON object.",
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


# ── Phase 2: Engine Generation ────────────────────────────────────────────


def _build_engine_prompt(blueprint: Dict) -> str:
    """Build prompt for generating the simulation model + renderer config."""

    variables_text = ""
    for v in blueprint.get("variables", []):
        role = "INPUT (student-adjustable)" if v.get("is_input") else "COMPUTED"
        variables_text += (
            f"  - {v['name']} ({v['symbol']}): "
            f"range [{v['min']}, {v['max']}], default {v['default_value']}, "
            f"step {v['step']}, unit: {v['unit']}, role: {role}\n"
        )

    renderer_type = blueprint.get("renderer_type", "graph")

    renderer_instructions = _get_renderer_instructions(renderer_type)

    return f"""You are an expert simulation designer for Eureka, an educational platform.

Generate a complete simulation engine from the following blueprint.

SIMULATION BLUEPRINT:
- Title: {blueprint.get("title", "Untitled")}
- Subject: {blueprint.get("subject", "")}
- Topic: {blueprint.get("topic", "")}
- Description: {blueprint.get("description", "")}
- Category: {blueprint.get("category", "custom")}
- Renderer Type: {renderer_type}
- Difficulty: {blueprint.get("difficulty", "intermediate")}
- Learning Goal: {blueprint.get("learning_goal", "")}
- Target Audience: {blueprint.get("target_audience", "")}
- Constraints: {blueprint.get("constraints", "None")}

VARIABLES:
{variables_text}

RULES FOR EQUATIONS:
1. All expressions must be safe for mathjs library (JavaScript)
2. Use standard math notation: sin, cos, tan, sqrt, abs, exp, log, pi, e
3. Use variable symbols exactly as defined above
4. NO eval(), NO JavaScript code — pure mathematical expressions only
5. For time-dependent simulations, use "t" as the time variable
6. Avoid division by zero — add guards (e.g., use max(x, 0.001))

{renderer_instructions}

RESPOND WITH VALID JSON:
{{
  "model": {{
    "equations": [
      {{
        "label": "Human-readable name",
        "expression": "mathjs expression using variable symbols",
        "output_variable": "variable_symbol_being_computed",
        "latex": "LaTeX string for display"
      }}
    ],
    "initial_state": {{ "var1": 0, "var2": 1.5 }},
    "time_step": 0.016,
    "time_dependent": true,
    "max_time": 10,
    "update_rules": [
      {{ "variable": "x", "expression": "x + vx * dt" }}
    ]
  }},
  "renderer_config": {_get_renderer_config_schema(renderer_type)}
}}"""


def _get_renderer_instructions(renderer_type: str) -> str:
    """Return renderer-specific instructions for the prompt."""
    instructions = {
        "graph": """RENDERER CONFIG (Graph / 2D Plot):
- Define x_axis (which variable, label, unit)
- Define 1+ y_axes (variable, label, unit, color)
- sample_count: 200 for smooth curves
- show_grid: true, show_legend: true
- Use hex colors: #3b82f6 (blue), #ef4444 (red), #10b981 (green), #f59e0b (amber), #8b5cf6 (purple)""",
        "animated_object": """RENDERER CONFIG (Animated Object):
- dimension: "2d" or "3d" (based on simulation needs)
- objects: array of shapes with position expressions (mathjs using variable symbols + "t")
- shapes: circle, rect, arrow, spring, pendulum, custom_path
- bounds: appropriate world-space bounds
- show_axes: true for physics sims
- Use trail: true for projectile/orbital paths
- Colors: hex strings""",
        "numerical_display": """RENDERER CONFIG (Numerical Display):
- displays: array of variable readouts
- Each display: variable symbol, label, unit, precision (decimal places)
- display_style: "gauge" for bounded values, "counter" for integers, "number" for general
- Optional thresholds: [{value, color}] for color-coding
- layout: "grid" for 4+ displays, "row" for 2-3, "column" for vertical""",
        "vector_field": """RENDERER CONFIG (Vector Field):
- field.fx and field.fy: mathjs expressions for field components (use x, y as coordinates)
- resolution: 15-25 arrows per dimension
- bounds: appropriate spatial bounds
- color_mode: "magnitude" to show strength via color
- normalize: false to show magnitude via arrow length
- show_grid: true""",
        "circuit_diagram": """RENDERER CONFIG (Circuit Diagram):
- components: array of circuit elements (resistor, capacitor, inductor, battery, switch, wire, bulb, ammeter, voltmeter, ground)
- Each component: id, type, label (R1/C2/etc.), value with unit, position (row/col grid), rotation (0/90/180/270), connections (node IDs)
- grid: {rows, cols} for layout
- computed_values: voltage/current/power per component (as string expressions)
- animate_current: true for current flow visualization""",
        "grid_transform": """RENDERER CONFIG (Grid Transformation):
- matrix_expression: mathjs 2x2 matrix expression using variable symbols, e.g. "[[cos(theta), -sin(theta)], [sin(theta), cos(theta)]]"
- bounds: symmetric around origin, e.g. {x: [-5,5], y: [-5,5]}
- grid_lines: 10-20
- show_basis_vectors: true
- show_eigenvectors: true (when eigenvalues are real)
- tracked_points: key points to follow through transform
- original_color: "#94a3b8", transformed_color: "#3b82f6" """,
    }
    return instructions.get(renderer_type, instructions["graph"])


def _get_renderer_config_schema(renderer_type: str) -> str:
    """Return the expected JSON shape for each renderer type."""
    schemas = {
        "graph": '{"type":"graph","x_axis":{"variable":"...","label":"...","unit":"..."},"y_axes":[{"variable":"...","label":"...","unit":"...","color":"#3b82f6"}],"sample_count":200,"show_grid":true,"show_legend":true}',
        "animated_object": '{"type":"animated_object","dimension":"2d","objects":[{"id":"obj1","shape":"circle","position":{"x":"expr","y":"expr"},"size":12,"color":"#3b82f6","trail":false}],"bounds":{"x":[-10,10],"y":[-10,10]},"show_axes":true,"background":"#0f172a"}',
        "numerical_display": '{"type":"numerical_display","displays":[{"variable":"...","label":"...","unit":"...","precision":2,"display_style":"number"}],"layout":"grid"}',
        "vector_field": '{"type":"vector_field","field":{"fx":"expr","fy":"expr"},"resolution":20,"bounds":{"x":[-5,5],"y":[-5,5]},"color_mode":"magnitude","normalize":false,"show_grid":true}',
        "circuit_diagram": '{"type":"circuit_diagram","components":[{"id":"c1","type":"battery","label":"V1","value":"9V","position":{"row":0,"col":0},"rotation":0,"connections":["n1","n2"]}],"grid":{"rows":4,"cols":4},"computed_values":[{"component_id":"c1","voltage":"9","current":"I_total"}],"animate_current":true}',
        "grid_transform": '{"type":"grid_transform","matrix_expression":"[[a,b],[c,d]]","bounds":{"x":[-5,5],"y":[-5,5]},"grid_lines":15,"show_basis_vectors":true,"show_eigenvectors":true,"tracked_points":[],"original_color":"#94a3b8","transformed_color":"#3b82f6"}',
    }
    return schemas.get(renderer_type, schemas["graph"])


# ── Phase 4: Cognitive Guidance Generation ────────────────────────────────


def _build_guidance_prompt(blueprint: Dict, model: Dict) -> str:
    """Build prompt for generating cognitive overlay / educational guidance."""

    equations_text = ""
    for eq in model.get("equations", []):
        equations_text += f"  - {eq['label']}: {eq['expression']}\n"

    return f"""You are an expert science educator designing cognitive scaffolding for an interactive simulation.

SIMULATION:
- Title: {blueprint.get("title", "")}
- Topic: {blueprint.get("topic", "")}
- Learning Goal: {blueprint.get("learning_goal", "")}
- Difficulty: {blueprint.get("difficulty", "intermediate")}
- Target Audience: {blueprint.get("target_audience", "")}

EQUATIONS IN THE SIMULATION:
{equations_text}

Generate educational guidance that helps students learn through exploration.

RULES:
1. hypothesis_prompt: An engaging question BEFORE the student runs the sim (~25 words)
2. observation_prompts: 3-5 prompts triggered at specific moments:
   - Use "time" trigger for time-based events
   - Use "variable_threshold" when a variable crosses a value
   - Use "manual" for prompts shown on a button click
3. insight_summary: The key takeaway (~50 words) shown after exploration
4. misconception_alerts: 2-4 common misconceptions with corrections
5. exploration_challenges: 2-4 specific challenges ("Try setting X to Y…")
6. Write in an encouraging, curiosity-driven tone — NEVER condescending
7. Do NOT use phrases like "obviously", "simply", "trivially", "as you know"

RESPOND WITH VALID JSON:
{{
  "hypothesis_prompt": "...",
  "observation_prompts": [
    {{
      "trigger": "time",
      "condition": {{ "time": 2.0 }},
      "prompt": "..."
    }},
    {{
      "trigger": "variable_threshold",
      "condition": {{ "variable": "y", "operator": "<=", "value": 0 }},
      "prompt": "..."
    }}
  ],
  "insight_summary": "...",
  "misconception_alerts": [
    {{
      "misconception": "...",
      "correction": "...",
      "trigger_hint": "..."
    }}
  ],
  "exploration_challenges": [
    {{
      "challenge": "...",
      "hint": "...",
      "expected_behavior": "..."
    }}
  ]
}}"""


# ── Main Generation Functions ─────────────────────────────────────────────


async def generate_simulation_engine(blueprint: Dict) -> Dict:
    """
    Phase 2: Generate simulation model + renderer config from blueprint.

    Returns:
        {"model": {...}, "renderer_config": {...}}
    """
    prompt = _build_engine_prompt(blueprint)

    for attempt in range(2):
        try:
            result = await _call_gpt(prompt, max_tokens=4000)
            model = result.get("model")
            renderer_config = result.get("renderer_config")

            if not model or not renderer_config:
                raise ValueError("Missing model or renderer_config in GPT response")

            # Validate model has required fields
            if not model.get("equations"):
                raise ValueError("Model has no equations")
            if "initial_state" not in model:
                raise ValueError("Model has no initial_state")

            # Validate renderer config has correct type
            expected_type = blueprint.get("renderer_type", "graph")
            if renderer_config.get("type") != expected_type:
                renderer_config["type"] = expected_type

            logger.info(
                "Simulation engine generated: %d equations, renderer=%s (attempt %d)",
                len(model["equations"]),
                renderer_config.get("type"),
                attempt + 1,
            )
            return {"model": model, "renderer_config": renderer_config}

        except Exception as e:
            logger.warning("Engine generation attempt %d failed: %s", attempt + 1, e)
            if attempt == 0:
                prompt += f"\n\nPREVIOUS ATTEMPT FAILED: {e}\nPlease fix the issues and try again."
            else:
                raise ValueError(f"Engine generation failed after 2 attempts: {e}") from e

    raise ValueError("Engine generation failed")


async def generate_simulation_guidance(blueprint: Dict, model: Dict) -> Dict:
    """
    Phase 4: Generate cognitive overlay / guidance from blueprint + model.

    Returns:
        SimulationGuidance dict
    """
    prompt = _build_guidance_prompt(blueprint, model)

    for attempt in range(2):
        try:
            result = await _call_gpt(prompt, max_tokens=3000)

            # Validate required fields
            required = ["hypothesis_prompt", "observation_prompts", "insight_summary",
                        "misconception_alerts", "exploration_challenges"]
            missing = [f for f in required if f not in result]
            if missing:
                raise ValueError(f"Missing guidance fields: {missing}")

            # Apply dignity filter
            try:
                from app.engine.dignity_filter import dignity_filter
                result["hypothesis_prompt"] = dignity_filter.filter_response(result["hypothesis_prompt"])
                result["insight_summary"] = dignity_filter.filter_response(result["insight_summary"])
                for prompt_item in result.get("observation_prompts", []):
                    prompt_item["prompt"] = dignity_filter.filter_response(prompt_item["prompt"])
                for mc in result.get("misconception_alerts", []):
                    mc["correction"] = dignity_filter.filter_response(mc["correction"])
                for ch in result.get("exploration_challenges", []):
                    ch["challenge"] = dignity_filter.filter_response(ch["challenge"])
            except ImportError:
                logger.warning("Dignity filter not available, skipping")

            logger.info(
                "Guidance generated: %d observation prompts, %d misconceptions, %d challenges",
                len(result.get("observation_prompts", [])),
                len(result.get("misconception_alerts", [])),
                len(result.get("exploration_challenges", [])),
            )
            return result

        except Exception as e:
            logger.warning("Guidance generation attempt %d failed: %s", attempt + 1, e)
            if attempt == 0:
                prompt += f"\n\nPREVIOUS ATTEMPT FAILED: {e}\nPlease fix and respond again."
            else:
                raise ValueError(f"Guidance generation failed after 2 attempts: {e}") from e

    raise ValueError("Guidance generation failed")


# ── CRUD Operations ──────────────────────────────────────────────────────


def save_simulation(simulation: Dict) -> str:
    """Save or update a simulation document. Returns the simulation ID."""
    col = _db()["simulations"]
    sim_id = simulation.get("_id") or str(uuid.uuid4())
    simulation["_id"] = sim_id
    simulation["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    if "created_at" not in simulation:
        simulation["created_at"] = simulation["updated_at"]

    col.update_one({"_id": sim_id}, {"$set": simulation}, upsert=True)
    logger.info("Saved simulation %s", sim_id)
    return sim_id


def get_simulation(sim_id: str) -> Optional[Dict]:
    """Get a single simulation by ID."""
    col = _db()["simulations"]
    doc = col.find_one({"_id": sim_id})
    return dict(doc) if doc else None


def list_simulations(user_id: str) -> List[Dict]:
    """List all simulations for a user, sorted by updated_at desc."""
    col = _db()["simulations"]
    docs = col.find({"user_id": user_id}).sort("updated_at", -1)
    return [dict(d) for d in docs]


def delete_simulation(sim_id: str) -> bool:
    """Delete a simulation. Returns True if deleted."""
    col = _db()["simulations"]
    result = col.delete_one({"_id": sim_id})
    return result.deleted_count > 0


def update_simulation_field(sim_id: str, field: str, value: Any) -> bool:
    """Update a single top-level field on a simulation document."""
    col = _db()["simulations"]
    result = col.update_one(
        {"_id": sim_id},
        {
            "$set": {
                field: value,
                "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        },
    )
    return result.modified_count > 0


def publish_simulation(sim_id: str) -> bool:
    """Mark a simulation as published."""
    return update_simulation_field(sim_id, "status", "published")
