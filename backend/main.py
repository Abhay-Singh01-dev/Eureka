"""
Eureka – FastAPI backend
Exposes:  POST /api/tts/generate
Serves:   /static/audio/<file>.mp3  (cached TTS output)

Start with:
  cd backend
  uvicorn main:app --reload --port 8000
"""

import os
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

from app.api.tts import router as tts_router
from app.api.analytics import router as analytics_router
from app.api.reflection import router as reflection_router
from app.api.chat import router as chat_router

# Ensure the audio cache directory exists on startup.
os.makedirs("app/static/audio", exist_ok=True)

app = FastAPI(title="Eureka API", version="1.0.0")


@app.get("/health")
async def health_check():
    """Lightweight health check — returns 200 if the server is up."""
    return JSONResponse({"status": "ok", "version": "1.0.0"})

# Allow the Vite dev server to call this API during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # vite default
        "http://localhost:4173",  # vite preview
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve cached audio files at /static/audio/<hash>.mp3
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# TTS routes at /api/tts/...
app.include_router(tts_router, prefix="/api/tts")

# Analytics routes at /api/analytics/...
app.include_router(analytics_router, prefix="/api/analytics")

# Reflection routes at /api/reflection/... (GPT-5.2-chat)
app.include_router(reflection_router, prefix="/api/reflection")

# Chat routes at /api/chat/... (GPT-5.2-chat curiosity conversations)
app.include_router(chat_router, prefix="/api/chat")

# Dashboard chat routes at /api/dashboard/... (global-scope adaptive chat)
from app.api.dashboard_chat import router as dashboard_chat_router
app.include_router(dashboard_chat_router, prefix="/api/dashboard")

# Custom modules routes at /api/custom-modules/...
from app.api.custom_modules import router as custom_modules_router
app.include_router(custom_modules_router, prefix="/api/custom-modules")

# Simulations routes at /api/simulations/...
from app.api.simulations import router as simulations_router
app.include_router(simulations_router, prefix="/api/simulations")

# Animations routes at /api/animations/...
from app.api.animations import router as animations_router
app.include_router(animations_router, prefix="/api/animations")
