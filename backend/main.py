"""
Eureka – FastAPI backend
Exposes:  POST /api/tts/generate
Serves:   /static/audio/<file>.mp3  (cached TTS output)

Start with:
  cd backend
  uvicorn main:app --reload --port 8000
"""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv

# Load .env BEFORE importing app modules so their module-level
# os.getenv() calls pick up the values.
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import ALLOWED_ORIGINS
from app.database import close_client
from app.api.tts import router as tts_router
from app.api.analytics import router as analytics_router
from app.api.reflection import router as reflection_router
from app.api.chat import router as chat_router
from app.api.dashboard_chat import router as dashboard_chat_router
from app.api.custom_modules import router as custom_modules_router
from app.api.simulations import router as simulations_router
from app.api.animations import router as animations_router

logger = logging.getLogger(__name__)

# ── Configure root logger ────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)


# ── Lifespan (startup / shutdown) ────────────────────────────────────────

@asynccontextmanager
async def lifespan(application: FastAPI):
    # Startup
    os.makedirs("app/static/audio", exist_ok=True)
    logger.info("Eureka backend started")
    yield
    # Shutdown — release the shared MongoDB connection pool
    close_client()
    logger.info("Eureka backend shut down — MongoDB client closed")


app = FastAPI(title="Eureka API", version="1.0.0", lifespan=lifespan)


@app.get("/health")
async def health_check():
    """Lightweight health check — returns 200 if the server is up."""
    return JSONResponse({"status": "ok", "version": "1.0.0"})


# ── CORS ──────────────────────────────────────────────────────────────────
# Origins are configurable via ALLOWED_ORIGINS env var (comma-separated).

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files ──────────────────────────────────────────────────────────

app.mount("/static", StaticFiles(directory="app/static"), name="static")

# ── Route registration ───────────────────────────────────────────────────

app.include_router(tts_router, prefix="/api/tts")
app.include_router(analytics_router, prefix="/api/analytics")
app.include_router(reflection_router, prefix="/api/reflection")
app.include_router(chat_router, prefix="/api/chat")
app.include_router(dashboard_chat_router, prefix="/api/dashboard")
app.include_router(custom_modules_router, prefix="/api/custom-modules")
app.include_router(simulations_router, prefix="/api/simulations")
app.include_router(animations_router, prefix="/api/animations")
