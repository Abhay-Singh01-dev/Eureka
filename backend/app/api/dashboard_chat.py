"""
Dashboard Chat API — Cognitive Engine with SSE streaming.

Endpoints:
  GET     /stream                              SSE streaming (+ userId)
  GET     /conversations                       List recent conversations
  GET     /conversations/{conversation_id}/messages   Get messages
  GET     /search                              Search conversations
  DELETE  /conversations/{conversation_id}     Delete a conversation
  GET     /profile                             Get cognitive profile
"""

import json
import uuid
from typing import List, Optional

from fastapi import APIRouter, Query, Path
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.engine.dashboard_orchestrator import (
    DashboardOrchestrator,
    get_all_conversations,
    get_conversation_messages,
    search_conversations,
    delete_conversation,
    rename_conversation,
)
from app.engine.dashboard_cognitive import (
    get_or_create_profile,
    get_profile_dict,
)
from app.engine.dignity_scorer import get_dignity_metrics


class AttachedImage(BaseModel):
    base64: str
    mime: str = "image/png"
    name: str = ""


class DashboardStreamRequest(BaseModel):
    message: str
    conversationId: str = ""
    history: str = "[]"
    userId: str = ""
    images: List[AttachedImage] = []

router = APIRouter()


def _sse_event(data: dict) -> str:
    """Format a dict as an SSE data line."""
    return f"data: {json.dumps(data)}\n\n"


# ── SSE Streaming ─────────────────────────────────────────────────────────

@router.get("/stream")
async def stream_dashboard_chat(
    message: str = Query(..., description="User message"),
    conversationId: str = Query("", description="Conversation ID"),
    history: str = Query("[]", description="JSON-encoded conversation history"),
    userId: str = Query("", description="Persistent user ID from localStorage"),
):
    """
    SSE streaming endpoint for cognitive dashboard chat (text only, legacy).
    """
    return _build_stream_response(message, conversationId, history, userId, images=[])


@router.post("/stream")
async def stream_dashboard_chat_post(body: DashboardStreamRequest):
    """
    SSE streaming endpoint with image attachment support (POST).
    Images are passed as base64 in the JSON body.
    """
    images = [{"base64": img.base64, "mime": img.mime, "name": img.name} for img in body.images]
    return _build_stream_response(body.message, body.conversationId, body.history, body.userId, images=images)


def _build_stream_response(
    message: str,
    conversationId: str,
    history: str,
    userId: str,
    images: list,
):
    """Shared logic for both GET and POST stream endpoints."""
    try:
        hist = json.loads(history)
    except Exception:
        hist = []

    conversation_id = conversationId or str(uuid.uuid4())
    user_id = userId or ""

    async def event_generator():
        yield _sse_event({"type": "conversation_id", "id": conversation_id})

        orchestrator = DashboardOrchestrator(
            conversation_id=conversation_id,
            user_id=user_id,
        )

        try:
            async for event in orchestrator.process_message(message, hist, images=images):
                yield _sse_event(event)
        except Exception as exc:
            print(f"[dashboard/stream] Error: {exc}")
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


# ── Conversations CRUD ────────────────────────────────────────────────────

@router.get("/conversations")
async def list_conversations(
    limit: int = Query(50, ge=1, le=200),
):
    """List recent conversations, newest first."""
    convs = get_all_conversations(limit)
    return {"conversations": convs}


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: str = Path(..., description="Conversation ID"),
):
    """Get all messages for a conversation."""
    msgs = get_conversation_messages(conversation_id)
    return {"messages": msgs}


@router.get("/search")
async def search(
    q: str = Query("", description="Search query"),
    limit: int = Query(20, ge=1, le=100),
):
    """Search conversations by title and message content."""
    if not q.strip():
        results = get_all_conversations(limit)
    else:
        results = search_conversations(q, limit)
    return {"conversations": results}


@router.delete("/conversations/{conversation_id}")
async def remove_conversation(
    conversation_id: str = Path(..., description="Conversation ID"),
):
    """Delete a conversation and all its messages."""
    delete_conversation(conversation_id)
    return {"ok": True}


@router.patch("/conversations/{conversation_id}/rename")
async def rename_conv(
    conversation_id: str = Path(..., description="Conversation ID"),
    title: str = Query(..., description="New conversation title"),
):
    """Rename a conversation."""
    if not title.strip():
        return {"ok": False, "error": "Title cannot be empty"}
    found = rename_conversation(conversation_id, title.strip())
    return {"ok": found}


# ── Cognitive Profile ─────────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(
    userId: str = Query("", description="User ID from localStorage"),
):
    """Get the cognitive profile for a user."""
    if not userId:
        return {"profile": None}
    profile = get_profile_dict(userId)
    return {"profile": profile}


# ── Admin: Dignity Metrics ────────────────────────────────────────────────

@router.get("/admin/dignity-metrics")
async def dignity_metrics(
    userId: str = Query("", description="Optional user ID filter"),
):
    """
    Admin endpoint: aggregate dignity metrics.
    Returns median_dignity_score, below_threshold_percent,
    confusion_fastpath_trigger_rate, total_responses.
    """
    uid = userId if userId.strip() else None
    metrics = get_dignity_metrics(uid)
    return metrics
