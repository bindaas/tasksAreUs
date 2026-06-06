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
from .models import Base, CategoryEnum, Label, LABEL_SEED, User
from .routers import beliefs, conversations, labels, reports, settings, sync, tasks, users

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
    existing = db.query(User).filter(User.device_uuid == _SYSTEM_UUID).first()
    if existing is None:
        db.add(User(id=_SYSTEM_UUID, device_uuid=_SYSTEM_UUID))
        db.commit()
    elif existing.id != _SYSTEM_UUID:
        db.execute(text("DELETE FROM users WHERE id = :id"), {"id": existing.id})
        db.execute(text("INSERT INTO users (id, device_uuid) VALUES (:id, :id)"), {"id": _SYSTEM_UUID})
        db.commit()


def _seed_labels(db: Session) -> None:
    existing = {(l.category.value, l.value) for l in db.query(Label).filter(Label.user_id.is_(None)).all()}
    for category, value in LABEL_SEED:
        if (category, value) not in existing:
            db.add(Label(category=CategoryEnum(category), value=value, user_id=None))
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
        # Per-user configurable labels migration
        conn.execute(text(
            "ALTER TABLE labels ADD COLUMN IF NOT EXISTS "
            "user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE"
        ))
        conn.execute(text(
            "ALTER TABLE labels DROP CONSTRAINT IF EXISTS uq_label_category_value"
        ))
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_global_label "
            "ON labels(category, value) WHERE user_id IS NULL"
        ))
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_label "
            "ON labels(user_id, category, value) WHERE user_id IS NOT NULL"
        ))
        # Rename the old global "raghav" type label to "child"
        conn.execute(text(
            "UPDATE labels SET value = 'child' "
            "WHERE category = 'type' AND value = 'raghav' AND user_id IS NULL"
        ))
        conn.commit()
    db = SessionLocal()
    try:
        _seed_system_user(db)
        _seed_labels(db)
    finally:
        db.close()
    yield


app = FastAPI(title="tasksAreUs API", version="1.0.0", lifespan=lifespan)

PREFIX = "/api/v1"

app.include_router(users.router, prefix=PREFIX)
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
