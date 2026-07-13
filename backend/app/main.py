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
from .models import Base, Board, Label, Task, User
from .routers import beliefs, boards, day_view, focused_view, labels, reports, settings, sync, tasks

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


def _migrate_boards(db: Session) -> None:
    """Create 'General tasks' board for all existing users who have none.

    Runs after DDL adds board_id columns as nullable. Assigns all existing
    labels/tasks to the new board, then seeds any missing LABEL_SEED entries.
    Idempotent — skips users who already have a board.
    """
    from .services.board_service import _seed_board_labels
    users_without_boards = (
        db.query(User)
        .filter(
            User.id != _SYSTEM_UUID,
            ~db.query(Board).filter(Board.user_id == User.id).exists(),
        )
        .all()
    )
    for user in users_without_boards:
        board = Board(
            user_id=user.id,
            name="General tasks",
            is_default=True,
            is_deleted=False,
        )
        db.add(board)
        db.flush()
        db.query(Label).filter(
            Label.user_id == user.id, Label.board_id == None
        ).update({"board_id": board.id})
        db.query(Task).filter(
            Task.user_id == user.id, Task.board_id == None
        ).update({"board_id": board.id})
        db.commit()
        _seed_board_labels(db, board.id, user.id)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_firebase()
    # Step 1: create new tables (boards) from ORM models; existing tables are untouched
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        # ── Legacy migrations ──────────────────────────────────────────────────
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
        conn.execute(text(
            "ALTER TABLE tasks DROP COLUMN IF EXISTS recurrence_group_id"
        ))
        conn.execute(text(
            "ALTER TABLE boards ADD COLUMN IF NOT EXISTS color VARCHAR(7)"
        ))
        conn.execute(text(
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb"
        ))
        conn.execute(text("ALTER TABLE labels ALTER COLUMN user_id SET NOT NULL"))
        conn.execute(text("DROP INDEX IF EXISTS uq_global_label"))
        conn.execute(text("DROP INDEX IF EXISTS uq_user_label"))

        # ── Board migration — Step A: add board_id columns as nullable ─────────
        conn.execute(text(
            "ALTER TABLE labels ADD COLUMN IF NOT EXISTS board_id VARCHAR"
        ))
        conn.execute(text(
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS board_id VARCHAR"
        ))

        # ── Board migration — Step B: indexes ─────────────────────────────────
        # Partial unique index for default board — not expressible via SQLAlchemy create_all
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS boards_user_id_default_key "
            "ON boards (user_id) WHERE is_default = true AND is_deleted = false"
        ))
        # Swap label uniqueness from (user_id, category, value) to (board_id, category, value)
        # Production DB has this as a UNIQUE CONSTRAINT (not a plain index) — must drop constraint first
        conn.execute(text("ALTER TABLE labels DROP CONSTRAINT IF EXISTS labels_user_id_category_value_key"))
        conn.execute(text("DROP INDEX IF EXISTS labels_user_id_category_value_key"))
        conn.execute(text(
            "CREATE UNIQUE INDEX IF NOT EXISTS labels_board_id_category_value_key "
            "ON labels (board_id, category, value)"
        ))

        # ── Chat removal — drop conversations/messages tables and starter_questions ──
        conn.execute(text("DROP TABLE IF EXISTS messages"))
        conn.execute(text("DROP TABLE IF EXISTS conversations"))
        conn.execute(text("ALTER TABLE user_settings DROP COLUMN IF EXISTS starter_questions"))
        conn.commit()

    # ── Board migration — Step C: DML — create boards for existing users ───────
    db = SessionLocal()
    try:
        _seed_system_user(db)
        _migrate_boards(db)
    finally:
        db.close()

    # ── Board migration — Step C.5: safety cleanup for any nulls Step C missed ──
    # Handles orphaned rows (user_id with no entry in users table, etc.).
    # First: assign via default board for rows whose user still has one.
    # Then: delete any rows that genuinely have no board (truly orphaned).
    with engine.connect() as conn:
        conn.execute(text("""
            UPDATE labels l SET board_id = b.id
            FROM boards b
            WHERE l.board_id IS NULL
              AND b.user_id = l.user_id
              AND b.is_default = true
              AND b.is_deleted = false
        """))
        conn.execute(text("DELETE FROM labels WHERE board_id IS NULL"))
        conn.execute(text("""
            UPDATE tasks t SET board_id = b.id
            FROM boards b
            WHERE t.board_id IS NULL
              AND b.user_id = t.user_id
              AND b.is_default = true
              AND b.is_deleted = false
        """))
        conn.execute(text("DELETE FROM tasks WHERE board_id IS NULL"))
        conn.commit()

    # ── Board migration — Step D: tighten board_id columns to NOT NULL ─────────
    with engine.connect() as conn:
        conn.execute(text(
            "ALTER TABLE labels ALTER COLUMN board_id SET NOT NULL"
        ))
        conn.execute(text(
            "ALTER TABLE tasks ALTER COLUMN board_id SET NOT NULL"
        ))
        conn.commit()

    # ── Mode label removal migration ────────────────────────────────────────────
    # Delete all Mode labels (replaced by type labels); update ENUM type.
    # Safe to run before code removes Mode from CategoryEnum, and safe to deploy
    # independently — after this runs, ORM will no longer encounter Mode values.
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM labels WHERE category = 'mode'"))
        conn.execute(text(
            "ALTER TYPE category_enum RENAME TO category_enum_old"
        ))
        conn.execute(text(
            "CREATE TYPE category_enum AS ENUM ('type')"
        ))
        conn.execute(text(
            "ALTER TABLE labels ALTER COLUMN category TYPE category_enum USING category::text::category_enum"
        ))
        conn.execute(text("DROP TYPE category_enum_old"))
        conn.commit()
        logger.info("Mode label migration completed: deleted all Mode labels and updated ENUM type")

    yield


app = FastAPI(title="tasksAreUs API", version="1.0.0", lifespan=lifespan)

PREFIX = "/api/v1"

app.include_router(boards.router, prefix=PREFIX)
app.include_router(labels.router, prefix=PREFIX)
app.include_router(tasks.router, prefix=PREFIX)
app.include_router(beliefs.router, prefix=PREFIX)
app.include_router(reports.router, prefix=PREFIX)
app.include_router(settings.router, prefix=PREFIX)
app.include_router(sync.router, prefix=PREFIX)
app.include_router(focused_view.router, prefix=PREFIX)
app.include_router(day_view.router, prefix=PREFIX)


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
