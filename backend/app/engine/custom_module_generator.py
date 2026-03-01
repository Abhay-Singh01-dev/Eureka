"""
Custom Module Graph Generator — GPT-5.2 powered node graph generation.

Generates structured DAG node graphs from teacher-defined blueprints.
Uses the same Azure OpenAI endpoint as the rest of Eureka.
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


# ── Graph Validation ─────────────────────────────────────────────────────


def _is_dag(nodes: List[Dict], edges: List[Dict]) -> bool:
    """Verify the graph is a valid DAG using Kahn's algorithm."""
    node_ids = {n["id"] for n in nodes}
    in_degree = {nid: 0 for nid in node_ids}
    adj: Dict[str, List[str]] = {nid: [] for nid in node_ids}

    for edge in edges:
        if edge["from"] in node_ids and edge["to"] in node_ids:
            adj[edge["from"]].append(edge["to"])
            in_degree[edge["to"]] = in_degree.get(edge["to"], 0) + 1

    queue = [nid for nid, deg in in_degree.items() if deg == 0]
    visited = 0

    while queue:
        current = queue.pop(0)
        visited += 1
        for neighbor in adj.get(current, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return visited == len(node_ids)


def _has_synthesis_node(nodes: List[Dict], edges: List[Dict]) -> bool:
    """Check that at least one node has no outgoing edges."""
    out_degree = {n["id"]: 0 for n in nodes}
    for edge in edges:
        if edge["from"] in out_degree:
            out_degree[edge["from"]] += 1
    return any(deg == 0 for deg in out_degree.values())


def _has_misconception_node(nodes: List[Dict]) -> bool:
    """Check that at least one node addresses a misconception."""
    return any(
        n.get("addresses_misconception") and len(n["addresses_misconception"]) > 0
        for n in nodes
    )


def _validate_depth_range(nodes: List[Dict], min_d: int, max_d: int) -> bool:
    """Check all node depth levels are within the allowed range."""
    return all(min_d <= n.get("depth_level", 1) <= max_d for n in nodes)


def validate_generated_graph(
    nodes: List[Dict],
    edges: List[Dict],
    min_depth: int = 1,
    max_depth: int = 7,
) -> List[str]:
    """Full validation — returns list of error strings (empty = valid)."""
    errors = []

    if len(nodes) < 5:
        errors.append(f"Too few nodes: {len(nodes)} (minimum 5)")
    if len(nodes) > 8:
        errors.append(f"Too many nodes: {len(nodes)} (maximum 8)")

    if not _is_dag(nodes, edges):
        errors.append("Graph contains circular dependencies")

    if not _has_synthesis_node(nodes, edges):
        errors.append("No synthesis (terminal) node found")

    if not _has_misconception_node(nodes):
        errors.append("No node explicitly addresses misconceptions")

    if not _validate_depth_range(nodes, min_depth, max_depth):
        errors.append(f"Node depth levels outside allowed range [{min_depth}-{max_depth}]")

    # Check for duplicate IDs
    ids = [n["id"] for n in nodes]
    if len(set(ids)) != len(ids):
        errors.append("Duplicate node IDs detected")

    # Check edge validity
    node_id_set = set(ids)
    for edge in edges:
        if edge["from"] not in node_id_set:
            errors.append(f"Edge references unknown source: {edge['from']}")
        if edge["to"] not in node_id_set:
            errors.append(f"Edge references unknown target: {edge['to']}")
        if edge["from"] == edge["to"]:
            errors.append(f"Self-loop on node: {edge['from']}")

    return errors


# ── Generation Prompt ────────────────────────────────────────────────────

NODE_TYPE_EMOJIS = {
    "foundation": "🌱",
    "exploration": "🔵",
    "connection": "🔗",
    "deepening": "⚡",
    "application": "🎯",
    "synthesis": "🌟",
    "challenge": "🚀",
}


def _build_generation_prompt(
    concept_scope: Dict,
    learning_objectives: Dict,
    cognitive_design: Dict,
) -> str:
    """Build the system + user prompt for GPT-5.2 node graph generation."""

    misconceptions = learning_objectives.get("common_misconceptions", [])
    misconception_text = (
        "\n".join(f"  - {m}" for m in misconceptions) if misconceptions else "None specified"
    )

    math_skills = learning_objectives.get("mathematical_skills", [])
    math_text = (
        "\n".join(f"  - {s}" for s in math_skills) if math_skills else "None specified"
    )

    applications = learning_objectives.get("real_world_applications", [])
    apps_text = (
        "\n".join(f"  - {a}" for a in applications) if applications else "None specified"
    )

    prereqs = concept_scope.get("assumed_prerequisites", [])
    prereqs_text = (
        "\n".join(f"  - {p}" for p in prereqs) if prereqs else "None"
    )

    return f"""You are an expert curriculum designer for Eureka, an intelligent educational platform.

Generate a learning node graph for the following module.

MODULE DETAILS:
- Title: {concept_scope.get("module_title", "Untitled")}
- Subject: {concept_scope.get("subject", "Custom")}
- Difficulty: {concept_scope.get("difficulty_level", "Intermediate")}
- Target Age: {concept_scope.get("target_age_group", "High School")}
- Duration: {concept_scope.get("estimated_duration_minutes", 60)} minutes
- Prerequisites: {prereqs_text}
- Regional Context: {concept_scope.get("regional_context", "General")}

LEARNING OBJECTIVES — Conceptual Understanding:
{chr(10).join(f"  - {o}" for o in learning_objectives.get("conceptual_understanding", []))}

Mathematical Skills:
{math_text}

Real-World Applications:
{apps_text}

Common Misconceptions to Address:
{misconception_text}

COGNITIVE DESIGN:
- Teaching Style: {cognitive_design.get("teaching_style", "Concept-first")}
- Socratic Intensity: {cognitive_design.get("socratic_intensity", "Moderate")}
- Depth Range: {cognitive_design.get("allowed_depth_range", {}).get("min", 1)} to {cognitive_design.get("allowed_depth_range", {}).get("max", 7)}
- Beauty Permission: {cognitive_design.get("beauty_permission", "Balanced")}

RULES:
1. Generate exactly 5-8 nodes
2. Order them cognitively (foundations first, synthesis last)
3. The LAST node must be a synthesis node (brings everything together)
4. At least 1 node must explicitly address listed misconceptions
5. Include prerequisite relationships forming a DAG (directed acyclic graph)
6. NO circular dependencies
7. Each node depth_level must be within the allowed range [{cognitive_design.get("allowed_depth_range", {}).get("min", 1)}-{cognitive_design.get("allowed_depth_range", {}).get("max", 7)}]
8. Match the difficulty level: {concept_scope.get("difficulty_level", "Intermediate")}
9. Use appropriate emoji for each node type

RESPOND WITH VALID JSON ONLY — no markdown, no explanation:
{{
  "nodes": [
    {{
      "id": "node-1",
      "title": "Node Title",
      "description": "2-3 sentence description of what students learn",
      "depth_level": 2,
      "addresses_misconception": ["misconception text if applicable"],
      "prerequisites": [],
      "emoji": "🌱",
      "estimated_time": "~5 min",
      "discover_points": ["What you'll discover 1", "What you'll discover 2", "What you'll discover 3"]
    }}
  ],
  "edges": [
    {{ "from": "node-1", "to": "node-2" }}
  ]
}}"""


# ── GPT-5.2 Call ──────────────────────────────────────────────────────────


async def _call_gpt(prompt: str) -> Dict:
    """Call Azure OpenAI GPT-5.2 for node graph generation."""
    endpoint = _get_azure_endpoint()
    key = _get_azure_key()

    if not endpoint or not key:
        raise ValueError("Azure OpenAI credentials not configured")

    # AZURE_OPENAI_ENDPOINT already contains the full URL
    # (including /openai/deployments/.../chat/completions?api-version=...)
    url = endpoint

    headers = {
        "Content-Type": "application/json",
        "api-key": key,
    }

    payload = {
        "messages": [
            {"role": "system", "content": "You are an expert curriculum designer. Respond with valid JSON only. Do not include markdown code fences or any text outside the JSON object."},
            {"role": "user", "content": prompt},
        ],
        "max_completion_tokens": 4000,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    content = data["choices"][0]["message"]["content"]
    # Strip markdown code fences if the model wraps the JSON anyway
    content = content.strip()
    if content.startswith("```"):
        content = content.split("```", 2)[1]          # drop opening fence
        if content.lower().startswith("json"):
            content = content[4:]                      # drop "json" language tag
        if content.endswith("```"):
            content = content[: content.rfind("```")] # drop closing fence
        content = content.strip()
    return json.loads(content)


# ── Main Generation Function ─────────────────────────────────────────────


async def generate_node_graph(
    concept_scope: Dict,
    learning_objectives: Dict,
    cognitive_design: Dict,
) -> Dict:
    """
    Generate a validated node graph using GPT-5.2.
    Retries once on validation failure.

    Returns:
        {"nodes": [...], "edges": [...]}

    Raises:
        ValueError: If generation fails after retry.
    """
    min_depth = cognitive_design.get("allowed_depth_range", {}).get("min", 1)
    max_depth = cognitive_design.get("allowed_depth_range", {}).get("max", 7)

    prompt = _build_generation_prompt(concept_scope, learning_objectives, cognitive_design)

    for attempt in range(2):  # max 2 attempts
        try:
            result = await _call_gpt(prompt)
            nodes = result.get("nodes", [])
            edges = result.get("edges", [])

            errors = validate_generated_graph(nodes, edges, min_depth, max_depth)

            if not errors:
                logger.info(
                    "Node graph generated successfully (attempt %d): %d nodes, %d edges",
                    attempt + 1,
                    len(nodes),
                    len(edges),
                )
                return {"nodes": nodes, "edges": edges}

            logger.warning(
                "Graph validation failed (attempt %d): %s",
                attempt + 1,
                "; ".join(errors),
            )

            if attempt == 0:
                # Add validation feedback to prompt for retry
                prompt += f"\n\nPREVIOUS ATTEMPT HAD ERRORS:\n" + "\n".join(f"- {e}" for e in errors)
                prompt += "\n\nPlease fix these issues and regenerate."

        except json.JSONDecodeError as e:
            logger.error("Failed to parse GPT response as JSON (attempt %d): %s", attempt + 1, e)
            if attempt == 1:
                raise ValueError(f"GPT returned invalid JSON after 2 attempts: {e}")
        except httpx.HTTPStatusError as e:
            logger.error("Azure OpenAI API error (attempt %d): %s", attempt + 1, e)
            raise ValueError(f"Azure OpenAI API error: {e.response.status_code}")
        except Exception as e:
            logger.error("Graph generation error (attempt %d): %s", attempt + 1, e)
            if attempt == 1:
                raise ValueError(f"Graph generation failed after 2 attempts: {e}")

    raise ValueError("Graph generation failed after 2 attempts")


# ── Persistence ──────────────────────────────────────────────────────────


def save_custom_module(module_data: Dict) -> str:
    """Persist a custom module to MongoDB. Returns the module ID."""
    col = _db()["custom_modules"]
    module_id = module_data.get("id") or f"cm-{uuid.uuid4().hex[:12]}"
    module_data["id"] = module_id
    module_data["created_at"] = module_data.get("created_at") or time.time()
    module_data["updated_at"] = time.time()

    col.update_one(
        {"id": module_id},
        {"$set": module_data},
        upsert=True,
    )

    logger.info("Custom module saved: %s (%s)", module_data.get("blueprint", {}).get("module_title"), module_id)
    return module_id


def get_custom_module(module_id: str) -> Optional[Dict]:
    """Get a single custom module by ID."""
    col = _db()["custom_modules"]
    doc = col.find_one({"id": module_id}, {"_id": 0})
    return doc


def list_custom_modules(user_id: str = "default") -> List[Dict]:
    """List all custom modules for a user."""
    col = _db()["custom_modules"]
    cursor = col.find(
        {"created_by": user_id},
        {"_id": 0},
    ).sort("created_at", -1)
    return list(cursor)


def delete_custom_module(module_id: str) -> bool:
    """Delete a custom module. Returns True if deleted."""
    col = _db()["custom_modules"]
    result = col.delete_one({"id": module_id})
    return result.deleted_count > 0


def update_custom_module_graph(module_id: str, node_graph: Dict) -> bool:
    """Update only the node graph of a custom module.
    Also cleans up orphaned node_contents for removed nodes."""
    col = _db()["custom_modules"]
    # Get existing module to find removed node IDs
    existing = col.find_one({"id": module_id}, {"node_graph.nodes": 1})
    if not existing:
        return False

    # Determine removed node IDs
    old_ids = {n["id"] for n in existing.get("node_graph", {}).get("nodes", [])}
    new_ids = {n["id"] for n in node_graph.get("nodes", [])}
    removed_ids = old_ids - new_ids

    update_ops: Dict = {
        "$set": {"node_graph": node_graph, "updated_at": time.time()}
    }
    # Remove orphaned node_contents entries
    if removed_ids:
        unset_fields = {f"node_contents.{nid}": "" for nid in removed_ids}
        update_ops["$unset"] = unset_fields

    result = col.update_one({"id": module_id}, update_ops)
    return result.modified_count > 0


# ── Phase C: Node Content Scaffold Generation ─────────────────────────


def _build_scaffold_prompt(
    node_metadata: Dict,
    entry_style: str,
    cognitive_design: Dict,
    module_scope: Dict,
    misconceptions: List[str],
    stage_number: Optional[int] = None,
    total_stages: Optional[int] = None,
) -> str:
    """Build the prompt for GPT-5.2 to generate a structured node scaffold."""

    entry_style_descriptions = {
        "short_explanation": "Start with a clear, concise explanation of the concept (under 120 words). Build immediate clarity.",
        "question_first": "Start with a thought-provoking Socratic question that challenges assumptions before explaining.",
        "simulation_first": "Start by describing an interactive simulation/experiment the student should explore first.",
        "real_world_example": "Start with a vivid real-world example that grounds the concept in lived experience.",
        "video_first": "Start by describing a visual narrative or animation that reveals the concept through motion and metaphor.",
    }

    depth_min = cognitive_design.get("allowed_depth_range", {}).get("min", 1)
    depth_max = cognitive_design.get("allowed_depth_range", {}).get("max", 7)
    socratic = cognitive_design.get("socratic_intensity", "Moderate")
    beauty = cognitive_design.get("beauty_permission", "Balanced")
    node_depth = node_metadata.get("depth_level", 3)

    node_misconceptions = node_metadata.get("addresses_misconception", [])
    misconception_text = ""
    if node_misconceptions:
        misconception_text = f"""
This node addresses these misconceptions:
{chr(10).join(f"  - {m}" for m in node_misconceptions)}
Include a misconception_probe question that gently tests whether the student holds this misconception."""

    beauty_rule = ""
    if node_depth <= 2 or beauty == "Minimal":
        beauty_rule = "Do NOT use cinematic or poetic language. Keep it clear and direct."
    elif beauty == "Depth-gated Cinematic":
        beauty_rule = "You may use vivid, cinematic language to inspire wonder — but only where it deepens understanding."

    socratic_rule = ""
    if socratic == "Deep":
        socratic_rule = "Include at least 2-3 micro-questions that challenge the student to think before revealing answers."
    elif socratic == "Moderate":
        socratic_rule = "Include 1-2 micro-questions that prompt reflection."
    else:
        socratic_rule = "Include at most 1 optional micro-question."

    # Stage context for multi-stage nodes
    stage_context = ""
    if stage_number is not None and total_stages is not None and total_stages > 1:
        stage_context = f"""
STAGE CONTEXT:
- This is Stage {stage_number} of {total_stages} in a multi-stage learning journey.
- Stage 1 introduces the concept. Later stages build progressively.
- Stage {stage_number} should {"introduce the foundational idea" if stage_number == 1 else "build on previous stages and deepen understanding" if stage_number < total_stages else "synthesize and consolidate all stages"}.
- Content should be self-contained within this stage but flow naturally from previous stages.
"""

    return f"""You are an expert educational content designer for Eureka, an adaptive learning platform.

Generate a STRUCTURED SCAFFOLD for one learning node. NOT a full essay — structured blocks.

NODE DETAILS:
- Title: {node_metadata.get("title", "Untitled")}
- Description: {node_metadata.get("description", "")}
- Depth Level: {node_depth} (range: {depth_min}-{depth_max})
- Module: {module_scope.get("module_title", "Custom Module")}
- Subject: {module_scope.get("subject", "Custom")}
- Target Age: {module_scope.get("target_age_group", "High School")}
{stage_context}
ENTRY STYLE: {entry_style}
{entry_style_descriptions.get(entry_style, "")}

RULES:
1. Entry block MUST be under 120 words
2. {beauty_rule}
3. {socratic_rule}
4. Node depth is {node_depth} — match complexity accordingly
5. Keep language respectful, never condescending
6. Do NOT include phrases like "simply", "obviously", "as you should know"
7. Be structured, not narrative
{misconception_text}

RESPOND WITH VALID JSON ONLY:
{{
  "entry_block": {{
    "type": "{entry_style}",
    "content": "The entry content (under 120 words)"
  }},
  "explanation_block": "Core explanation of the concept (2-4 paragraphs, educational)",
  "micro_questions": ["Thought-provoking question 1", "Question 2"],
  "misconception_probe": "A question that gently tests for common misconceptions (or null if no misconceptions)",
  "simulation_suggestion": "Brief description of an interactive element that could help (or null)",
  "quiz_prompt": "A check-for-understanding question with a clear correct direction (or null)",
  "depth_hint": {node_depth}
}}"""


async def generate_single_block_content(
    block_type: str,
    node_title: str,
    node_description: str,
    entry_style: str,
    depth_level: int,
    existing_blocks: Optional[List[Dict]] = None,
) -> str:
    """
    Generate content for a SINGLE block type using GPT-5.2.
    Much lighter than full scaffold generation.

    Returns:
        A string containing the generated content for the block.
    """
    existing_context = ""
    if existing_blocks:
        pieces = []
        for b in existing_blocks:
            if b.get("content"):
                pieces.append(f"[{b['type']}]: {b['content'][:200]}")
        if pieces:
            existing_context = f"\n\nEXISTING BLOCKS (for coherence):\n" + "\n".join(pieces)

    block_instructions = {
        "entry": f"Write an opening entry block (under 120 words) using the '{entry_style.replace('_', ' ')}' style. It should hook the student and introduce the concept.",
        "explanation": "Write a clear, educational explanation of the concept (2-4 paragraphs). Build understanding progressively.",
        "micro_question": "Write a thought-provoking Socratic question that challenges the student to think deeply. It should guide understanding, not just test recall.",
        "simulation": "Describe an interactive simulation or experiment that would help students explore this concept hands-on.",
        "quiz": "Write a check-for-understanding question with a clear correct direction. It should test comprehension of the core idea.",
        "video": "Describe a short video or animation that would visually explain this concept. Include what visuals to show and the narrative flow.",
    }

    instruction = block_instructions.get(block_type, "Write educational content for this block.")

    prompt = f"""You are an expert educational content designer for Eureka.

Generate content for a SINGLE learning block.

NODE: {node_title}
DESCRIPTION: {node_description}
DEPTH LEVEL: {depth_level} (1=introductory, 7=advanced)
BLOCK TYPE: {block_type}

TASK: {instruction}

RULES:
1. Match complexity to depth level {depth_level}
2. Keep language respectful, never condescending
3. Do NOT use phrases like "simply", "obviously", "as you should know"
4. Be clear and structured
{existing_context}

RESPOND WITH VALID JSON ONLY:
{{
  "content": "Your generated content here"
}}"""

    result = await _call_gpt(prompt)
    return result.get("content", "")


async def generate_node_scaffold(
    module_id: str,
    node_id: str,
    entry_style: str,
    cognitive_design: Dict,
    node_metadata: Dict,
    module_scope: Optional[Dict] = None,
    misconceptions: Optional[List[str]] = None,
    stage_number: Optional[int] = None,
    total_stages: Optional[int] = None,
) -> Dict:
    """
    Generate a structured content scaffold for a single node using GPT-5.2.
    Applies DignityFilter post-processing.
    Supports stage_number for multi-stage nodes.

    Returns:
        NodeScaffold dict with entry_block, explanation_block, micro_questions, etc.
    """
    from app.engine.dignity_filter import dignity_filter

    if module_scope is None:
        # Try to load from DB
        mod = get_custom_module(module_id)
        if mod:
            module_scope = mod.get("blueprint", {})
            if misconceptions is None:
                misconceptions = mod.get("objectives", {}).get("common_misconceptions", [])
        else:
            module_scope = {}

    if misconceptions is None:
        misconceptions = []

    prompt = _build_scaffold_prompt(
        node_metadata=node_metadata,
        entry_style=entry_style,
        cognitive_design=cognitive_design,
        module_scope=module_scope,
        misconceptions=misconceptions,
        stage_number=stage_number,
        total_stages=total_stages,
    )

    result = await _call_gpt(prompt)

    # Apply DignityFilter to all text content
    dignity_score = 1.0
    dignity_warning = None

    def filter_text(text: str) -> str:
        if not text:
            return text
        return dignity_filter.filter_response(text)

    # Compute dignity score by checking how much the filter changes
    all_text = []

    if result.get("entry_block", {}).get("content"):
        original = result["entry_block"]["content"]
        filtered = filter_text(original)
        result["entry_block"]["content"] = filtered
        all_text.append((original, filtered))

    if result.get("explanation_block"):
        original = result["explanation_block"]
        filtered = filter_text(original)
        result["explanation_block"] = filtered
        all_text.append((original, filtered))

    if result.get("misconception_probe"):
        original = result["misconception_probe"]
        filtered = filter_text(original)
        result["misconception_probe"] = filtered
        all_text.append((original, filtered))

    if result.get("quiz_prompt"):
        original = result["quiz_prompt"]
        filtered = filter_text(original)
        result["quiz_prompt"] = filtered
        all_text.append((original, filtered))

    if result.get("micro_questions"):
        for i, q in enumerate(result["micro_questions"]):
            original = q
            filtered = filter_text(q)
            result["micro_questions"][i] = filtered
            all_text.append((original, filtered))

    # Compute dignity score: ratio of unchanged text
    if all_text:
        total_chars = sum(len(orig) for orig, _ in all_text)
        changed_chars = sum(
            abs(len(orig) - len(filt)) + sum(1 for a, b in zip(orig, filt) if a != b)
            for orig, filt in all_text
        )
        if total_chars > 0:
            dignity_score = max(0, 1.0 - (changed_chars / total_chars))

    if dignity_score < 0.7:
        dignity_warning = (
            "Some language may feel unintentionally intimidating. Consider revising tone."
        )

    result["dignity_score"] = round(dignity_score, 2)
    result["dignity_warning"] = dignity_warning

    logger.info(
        "Node scaffold generated for %s/%s (entry_style=%s, dignity=%.2f)",
        module_id, node_id, entry_style, dignity_score,
    )

    return result


# ── Node Content Persistence ─────────────────────────────────────────────


def save_node_content(module_id: str, node_id: str, content: Dict) -> bool:
    """Save content for a single node within a custom module."""
    col = _db()["custom_modules"]
    content["last_modified"] = time.time()
    result = col.update_one(
        {"id": module_id},
        {
            "$set": {
                f"node_contents.{node_id}": content,
                "updated_at": time.time(),
            }
        },
    )
    return result.modified_count > 0


def get_node_content(module_id: str, node_id: str) -> Optional[Dict]:
    """Get content for a single node within a custom module."""
    mod = get_custom_module(module_id)
    if not mod:
        return None
    return (mod.get("node_contents") or {}).get(node_id)


def validate_module_for_publish(module_id: str) -> Dict:
    """
    Validate a custom module is ready for publishing.
    Returns {"valid": bool, "errors": [...], "warnings": [...]}.
    """
    mod = get_custom_module(module_id)
    if not mod:
        return {"valid": False, "errors": ["Module not found"], "warnings": []}

    errors = []
    warnings = []

    node_graph = mod.get("node_graph", {})
    nodes = node_graph.get("nodes", [])
    edges = node_graph.get("edges", [])
    node_contents = mod.get("node_contents", {}) or {}
    cognitive_design = mod.get("cognitive_design", {})
    objectives = mod.get("objectives", {})

    # Helper to extract all blocks from a node content (stage-aware + backward compat)
    def _get_all_blocks(nc: Dict) -> List[Dict]:
        """Extract all content blocks from node content, handling both stage-based and legacy formats."""
        blocks = []
        if nc.get("stages"):
            for stage in nc["stages"]:
                blocks.extend(stage.get("blocks", []))
        elif nc.get("blocks"):
            blocks.extend(nc["blocks"])
        return blocks

    # 1. Every node must have content
    for node in nodes:
        nid = node["id"]
        if nid not in node_contents:
            errors.append(f"Node \"{node.get('title', nid)}\" has no content")
        else:
            nc = node_contents[nid]
            all_blocks = _get_all_blocks(nc)
            if not all_blocks:
                errors.append(f"Node \"{node.get('title', nid)}\" has no content blocks")
            # For stage-based content, check all stages have blocks
            if nc.get("stages"):
                for stage in nc["stages"]:
                    if not stage.get("blocks"):
                        errors.append(
                            f"Node \"{node.get('title', nid)}\" stage {stage.get('stage_number', '?')} has no content"
                        )

    # 2. At least 1 synthesis node exists
    if not _has_synthesis_node(nodes, edges):
        errors.append("No synthesis (terminal) node found")

    # 3. All misconceptions addressed
    misconceptions = objectives.get("common_misconceptions", [])
    if misconceptions:
        addressed = set()
        for node in nodes:
            for m in (node.get("addresses_misconception") or []):
                addressed.add(m.lower().strip())
        for m in misconceptions:
            if m.lower().strip() not in addressed:
                # Check if any node content addresses it (stage-aware)
                found = False
                for nc in node_contents.values():
                    for block in _get_all_blocks(nc):
                        if m.lower() in block.get("content", "").lower():
                            found = True
                            break
                    if found:
                        break
                if not found:
                    warnings.append(f"Misconception may not be addressed: \"{m}\"")

    # 4. No circular graph
    if not _is_dag(nodes, edges):
        errors.append("Graph contains circular dependencies")

    # 5. Depth settings valid
    min_d = cognitive_design.get("allowed_depth_range", {}).get("min", 1)
    max_d = cognitive_design.get("allowed_depth_range", {}).get("max", 7)
    if not _validate_depth_range(nodes, min_d, max_d):
        errors.append(f"Node depths outside allowed range [{min_d}-{max_d}]")

    # 6. Dignity score acceptable (check all node contents, stage-aware)
    for nid, nc in node_contents.items():
        for block in _get_all_blocks(nc):
            text = block.get("content", "")
            if any(
                pattern.lower() in text.lower()
                for pattern in ["obviously", "simply put", "as you should know", "trivial"]
            ):
                warnings.append(
                    f"Node \"{nid}\" may contain dignity-violating language"
                )
                break

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


def publish_module(module_id: str) -> Dict:
    """Mark a module as published after validation passes."""
    validation = validate_module_for_publish(module_id)
    if not validation["valid"]:
        return validation

    col = _db()["custom_modules"]
    col.update_one(
        {"id": module_id},
        {"$set": {"published": True, "updated_at": time.time()}},
    )

    validation["published"] = True
    return validation
