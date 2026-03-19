from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from database import create_tables
from routers import auth, users

# ── App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="FinTrack API",
    description="מערכת ניהול פיננסי אישי",
    version="1.0.0",
)

# ── CORS (allow frontend to call API) ───────────────────────────────
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:8080").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ALLOWED_ORIGINS,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── Routers ──────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)

# ── Static files (serve frontend from /static) ───────────────────────
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.isdir(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")


# ── Startup ──────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    create_tables()
    print("✅ DB tables ready")


@app.get("/health")
def health():
    return {"status": "ok"}
