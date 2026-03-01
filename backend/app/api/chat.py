"""
Chat API — Adaptive Teaching Intelligence with SSE Streaming.

Endpoints:
  GET  /stream         SSE streaming endpoint (Teaching Orchestrator)
  GET  /suggestions    Context-aware suggestions for a node
  GET  /history        Conversation history for a session/node
"""

import json
import uuid

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.engine.teaching_orchestrator import (
    TeachingOrchestrator,
    get_suggestions_for_node,
    get_user_state,
)

router = APIRouter()


# ── Models ───────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


# ── SSE helper ───────────────────────────────────────────────────────────

def _sse_event(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


# ── Streaming endpoint ───────────────────────────────────────────────────

@router.get("/stream")
async def stream_chat(
    message: str = Query(..., description="User message"),
    nodeId: str = Query("what_is_motion", description="Node identifier"),
    sessionId: str = Query("", description="Session ID (auto-generated if empty)"),
    history: str = Query("[]", description="JSON-encoded conversation history"),
):
    """
    SSE streaming endpoint for the adaptive teaching system.
    
    Events:
      data: {"type": "token",  "content": "..."}
      data: {"type": "image_generating", "description": "..."}
      data: {"type": "image",  "base64": "...", "mime": "image/png", "description": "..."}
      data: {"type": "image_failed", "description": "..."}
      data: {"type": "video_generating", "description": "..."}
      data: {"type": "video",  "base64": "...", "mime": "video/mp4", "description": "..."}
      data: {"type": "video_failed", "description": "..."}
      data: {"type": "suggestions", "items": [...]}
      data: {"type": "done",   "intent": "...", "depth": 1}
      data: {"type": "error",  "content": "..."}
    """
    # Parse history
    try:
        hist = json.loads(history)
    except Exception:
        hist = []

    # Normalise node ID (frontend sends "what-is-motion", backend uses "what_is_motion")
    node_id = nodeId.replace("-", "_")

    # Auto-generate session ID if not provided
    session_id = sessionId or str(uuid.uuid4())

    async def event_generator():
        orchestrator = TeachingOrchestrator(
            session_id=session_id,
            node_id=node_id,
            module_id="motion_forces",
        )

        try:
            async for event in orchestrator.process_message(message, hist):
                yield _sse_event(event)
        except Exception as exc:
            print(f"[chat/stream] Error: {exc}")
            yield _sse_event({"type": "error", "content": str(exc)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ── Legacy POST endpoint (backwards compatibility) ───────────────────────

class ChatRequest(BaseModel):
    message: str
    nodeId: str = "what-is-motion"
    history: list[ChatMessage] = []


class ChatResponse(BaseModel):
    reply: str
    source: str


@router.post("/send", response_model=ChatResponse)
async def send_chat(data: ChatRequest) -> ChatResponse:
    """Legacy non-streaming endpoint. Collects full response from orchestrator."""
    node_id = data.nodeId.replace("-", "_")
    session_id = str(uuid.uuid4())

    orchestrator = TeachingOrchestrator(
        session_id=session_id,
        node_id=node_id,
        module_id="motion_forces",
    )

    hist = [{"role": m.role, "content": m.content} for m in data.history]
    full_reply = ""

    try:
        async for event in orchestrator.process_message(data.message, hist):
            if event["type"] == "token":
                full_reply += event["content"]
            elif event["type"] == "error":
                return ChatResponse(reply=event["content"], source="error")
    except Exception as exc:
        return ChatResponse(reply=f"Error: {exc}", source="error")

    return ChatResponse(reply=full_reply or "I'm thinking...", source="gpt")


# ── Suggestions endpoint ─────────────────────────────────────────────────

@router.get("/suggestions")
async def get_suggestions(
    nodeId: str = Query("what_is_motion", description="Node identifier"),
):
    """Get context-aware suggested prompts for a node."""
    node_id = nodeId.replace("-", "_")
    return {"suggestions": get_suggestions_for_node(node_id)}


# ── History endpoint ─────────────────────────────────────────────────────

@router.get("/history")
async def get_history(
    sessionId: str = Query(..., description="Session ID"),
    nodeId: str = Query("what_is_motion", description="Node identifier"),
):
    """Get conversation history for a session/node from MongoDB."""
    from app.engine.teaching_orchestrator import _db
    node_id = nodeId.replace("-", "_")
    col = _db()["curious_conversations"]
    docs = list(
        col.find(
            {"session_id": sessionId, "node_id": node_id},
            {"_id": 0},
        ).sort("timestamp", 1).limit(100)
    )
    return {"history": docs}
