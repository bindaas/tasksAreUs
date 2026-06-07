import json
import logging
import os
import subprocess
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import firebase_admin
from firebase_admin import credentials
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import settings as app_settings
from .database import SessionLocal, engine
from .models import Base, Label, User
from .routers import beliefs, conversations, labels, reports, settings, sync, tasks

logger = logging.getLogger(__name__)


_SYSTEM_UUID = "00000000-0000-0000-0000-000000000000"


def _init_firebase() -> None:
    json_str = app_settings.FIREBASE_SERVICE_ACCOUNT_JSON
    if not json_str:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_JSON env var is required but not set. "
            "Set it to the full JSON string of your Firebase service account key."
        )
    try:
        sa_dict = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: {e}")
    if not firebase_admin._apps:
        cred = credentials.Certificate(sa_dict)
        firebase_admin.initialize_app(cred)
        logger.info("Firebase Admin SDK initialized (project: %s)", sa_dict.get("project_id", "unknown"))
    else:
        logger.info("Firebase Admin SDK already initialized — skipping")


def _seed_system_user(db: Session) -> None:
    existing = db.query(User).filter(User.id == _SYSTEM_UUID).first()
    if existing is None:
        db.add(User(id=_SYSTEM_UUID))
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_firebase()
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "
            "is_high_priority BOOLEAN NOT NULL DEFAULT false"
        ))
        conn.execute(text(
            "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS "
            "high_priority_daily_limit INTEGER"
        ))
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR UNIQUE"
        ))
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE users DROP COLUMN IF EXISTS device_uuid"
        ))
        # Enforce per-user label model: user_id NOT NULL, unique per user+category+value
        conn.execute(text("ALTER TABLE labels ALTER COLUMN user_id SET NOT NULL"))
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS labels_user_id_category_value_key "
            "ON labels (user_id, category, value)"
        ))
        # Clean up old partial indexes replaced by the per-user unique constraint
        conn.execute(text("DROP INDEX IF EXISTS uq_global_label"))
        conn.execute(text("DROP INDEX IF EXISTS uq_user_label"))
        conn.commit()
    db = SessionLocal()
    try:
        _seed_system_user(db)
    finally:
        db.close()
    yield


app = FastAPI(title="tasksAreUs API", version="1.0.0", lifespan=lifespan)

PREFIX = "/api/v1"

app.include_router(labels.router, prefix=PREFIX)
app.include_router(tasks.router, prefix=PREFIX)
app.include_router(beliefs.router, prefix=PREFIX)
app.include_router(conversations.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(settings.router, prefix=PREFIX)
app.include_router(sync.router, prefix=PREFIX)


def _git_hash() -> str:
    v = os.getenv("RAILWAY_GIT_COMMIT_SHA")
    if v:
        return v[:7]
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL
        ).decode().strip()
    except Exception:
        return "unknown"


@app.get("/api/v1/health")
def health():
    db_status = "ok"
    db_error = None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        db_status = "error"
        db_error = str(e)

    overall = "ok" if db_status == "ok" else "degraded"
    check = {"status": db_status}
    if db_error:
        check["error"] = db_error
    return {
        "status": overall,
        "version": _git_hash(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": {"database": check},
    }


# Serve frontend SPA in prod (static/ dir is present in the Docker image)
_STATIC_DIR = Path(__file__).parent.parent / "static"
if _STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(_STATIC_DIR), html=True), name="static")
