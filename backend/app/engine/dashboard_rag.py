"""
Dashboard RAG — Knowledge Graph infrastructure.

Provides the schema and retrieval stubs for topic-based
Retrieval-Augmented Generation.  No content is seeded — the
infrastructure is ready for future population.

MongoDB collection: `topic_graph`

Schema:
{
  "topic":       str,            # e.g. "electromagnetism"
  "subtopic":    str,            # e.g. "Maxwell's equations"
  "concept":     str,            # e.g. "Faraday's law"
  "content":     str,            # the actual knowledge chunk
  "difficulty":  int 1–7,        # aligned with depth levels
  "tags":        [str],          # searchable tags
  "connections": [str],          # related concept IDs
  "created_at":  datetime,
}
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from pymongo import ASCENDING

from app.database import get_db

# ── MongoDB setup (uses the centralised client from app.database) ───────

_topic_graph = None


def _get_topic_graph():
    """Lazy-load topic_graph collection and ensure indexes exist."""
    global _topic_graph
    if _topic_graph is None:
        _topic_graph = get_db()["topic_graph"]
        # Ensure indexes (idempotent)
        _topic_graph.create_index([("topic", ASCENDING)])
        _topic_graph.create_index([("subtopic", ASCENDING)])
        _topic_graph.create_index([("tags", ASCENDING)])
        _topic_graph.create_index([("difficulty", ASCENDING)])
    return _topic_graph


# ══════════════════════════════════════════════════════════════════════════
#  Schema helpers
# ══════════════════════════════════════════════════════════════════════════

def create_concept(
    topic: str,
    subtopic: str,
    concept: str,
    content: str,
    difficulty: int = 3,
    tags: Optional[List[str]] = None,
    connections: Optional[List[str]] = None,
) -> str:
    """
    Insert a knowledge concept into the topic graph.
    Returns the inserted document ID as a string.
    """
    doc = {
        "topic": topic.lower(),
        "subtopic": subtopic.lower(),
        "concept": concept,
        "content": content,
        "difficulty": max(1, min(7, difficulty)),
        "tags": [t.lower() for t in (tags or [])],
        "connections": connections or [],
        "created_at": datetime.now(timezone.utc),
    }
    result = _get_topic_graph().insert_one(doc)
    return str(result.inserted_id)


# ══════════════════════════════════════════════════════════════════════════
#  Retrieval functions (stubs — return None when graph is empty)
# ══════════════════════════════════════════════════════════════════════════

def retrieve_context(
    query: str,
    depth_level: int = 3,
    max_results: int = 3,
) -> Optional[List[Dict]]:
    """
    Retrieve relevant knowledge chunks for the given query
    at the appropriate depth level.

    Returns a list of concept dicts, or None if nothing relevant found.

    TODO: Replace keyword matching with embedding-based similarity
    once vectors are populated.
    """
    if not query:
        return None

    # Simple keyword-based retrieval (placeholder for embeddings)
    words = query.lower().split()
    # Search by tags or topic match
    relevant = []
    for word in words:
        if len(word) < 3:
            continue
        docs = _get_topic_graph().find({
            "$or": [
                {"tags": {"$regex": word, "$options": "i"}},
                {"topic": {"$regex": word, "$options": "i"}},
                {"subtopic": {"$regex": word, "$options": "i"}},
                {"concept": {"$regex": word, "$options": "i"}},
            ],
            "difficulty": {"$lte": depth_level + 1},
        }).limit(max_results * 2)

        for doc in docs:
            doc["_id"] = str(doc["_id"])
            if doc not in relevant:
                relevant.append(doc)

    if not relevant:
        return None

    # Sort by difficulty proximity to current depth
    relevant.sort(key=lambda d: abs(d.get("difficulty", 3) - depth_level))
    return relevant[:max_results]


def retrieve_by_topic(
    topic: str,
    depth_level: int = 3,
    max_results: int = 5,
) -> Optional[List[Dict]]:
    """
    Retrieve all concepts under a specific topic,
    filtered by difficulty.
    """
    docs = list(_get_topic_graph().find({
        "topic": topic.lower(),
        "difficulty": {"$lte": depth_level + 1},
    }).sort("difficulty", ASCENDING).limit(max_results))

    if not docs:
        return None

    for doc in docs:
        doc["_id"] = str(doc["_id"])
    return docs


def format_rag_context(concepts: Optional[List[Dict]]) -> Optional[str]:
    """
    Format retrieved concepts into a string suitable for prompt injection.
    Returns None if no concepts.
    """
    if not concepts:
        return None

    lines = ["Relevant knowledge from your knowledge base:"]
    for i, c in enumerate(concepts, 1):
        lines.append(
            f"\n[{i}] {c.get('concept', 'Unknown')} "
            f"(Topic: {c.get('topic', '?')}, "
            f"Subtopic: {c.get('subtopic', '?')}, "
            f"Difficulty: {c.get('difficulty', '?')}/7)"
        )
        content = c.get("content", "")
        if content:
            lines.append(f"   {content[:500]}")

    return "\n".join(lines)


def get_graph_stats() -> Dict:
    """Return basic statistics about the knowledge graph."""
    coll = _get_topic_graph()
    total = coll.count_documents({})
    topics = coll.distinct("topic")
    return {
        "total_concepts": total,
        "topics": topics,
        "topic_count": len(topics),
    }
