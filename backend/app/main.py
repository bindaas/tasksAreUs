from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import SessionLocal, engine
from .models import Base, CategoryEnum, Label, LABEL_SEED
from .routers import beliefs, conversations, labels, reports, settings, sync, tasks, users


def _seed_labels(db: Session) -> None:
    existing = {(l.category.value, l.value) for l in db.query(Label).all()}
    for category, value in LABEL_SEED:
        if (category, value) not in existing:
            db.add(Label(category=CategoryEnum(category), value=value))
    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        from sqlalchemy import text
        conn.execute(text(
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "
            "is_high_priority BOOLEAN NOT NULL DEFAULT false"
        ))
        conn.commit()
    db = SessionLocal()
    try:
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


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


# Serve frontend SPA in prod (static/ dir is present in the Docker image)
_STATIC_DIR = Path(__file__).parent.parent / "static"
if _STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(_STATIC_DIR), html=True), name="static")
