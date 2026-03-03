"""
Centralised MongoDB connection — single ``MongoClient`` for the process.

Usage:
    from app.database import get_db

    db = get_db()              # → pymongo.database.Database  (eureka)
    db["conversations"].find_one(...)

The client is lazily created on first call and reused thereafter.
Call ``close_client()`` on shutdown to release the connection pool
(handled automatically by the FastAPI lifespan hook in ``main.py``).
"""

from __future__ import annotations

from typing import Optional

from pymongo import MongoClient
from pymongo.database import Database

from app.config import MONGO_URI, MONGO_DB

_client: Optional[MongoClient] = None


def get_db() -> Database:
    """Return the shared MongoDB database handle (lazy-init)."""
    global _client
    if _client is None:
        _client = MongoClient(MONGO_URI)
    return _client[MONGO_DB]


def close_client() -> None:
    """Close the MongoDB client — call on app shutdown."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
