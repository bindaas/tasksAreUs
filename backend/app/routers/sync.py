from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from pydantic import ValidationError

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Belief, Board, Label, Task, TaskLabel
from ..schemas import MAX_TASK_LINKS, SyncChanges, SyncRequest, SyncResponse, TaskLabelSync, TaskLink
from ..services import board_service as board_svc


def _validate_sync_links(raw_links: Any) -> List[Dict[str, Any]]:
    """Validate a sync client's raw links payload, keeping whatever is valid.

    Sync push payloads are raw dicts (SyncChanges.tasks bypasses TaskCreate/TaskUpdate
    Pydantic validation), so the max-3/scheme/length checks that POST/PUT /tasks get
    for free via Pydantic must be re-applied here explicitly. Unlike POST/PUT (where an
    invalid link fails the whole request), a sync push has no way to surface a per-field
    error back to the client, so an item-level failure here (or being out of sync with a
    validation rule change) shouldn't silently discard every other valid link — each item
    is validated independently, invalid ones are dropped, and the result is capped at
    MAX_TASK_LINKS.
    """
    if not raw_links or not isinstance(raw_links, list):
        return []
    valid: List[Dict[str, Any]] = []
    for item in raw_links:
        try:
            valid.append(TaskLink.model_validate(item).model_dump())
        except ValidationError:
            continue
        if len(valid) == MAX_TASK_LINKS:
            break
    return valid

def _owned_board_id(db: Session, board_id: Any, user_id: str) -> str | None:
    """Return board_id if it's a real, non-deleted board owned by user_id, else None.

    Sync push payloads bypass get_board_or_404 (raising mid-batch would fail every
    other change in the push), so board_id needs the same ownership/existence check
    applied item-by-item, same as links and labels elsewhere in this router.
    """
    if not board_id:
        return None
    exists = db.query(Board.id).filter(
        Board.id == board_id,
        Board.user_id == user_id,
        Board.is_deleted == False,
    ).first()
    return board_id if exists else None


router = APIRouter(prefix="/sync", tags=["sync"])


def _parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value
    except (ValueError, TypeError):
        return None


@router.post("", response_model=SyncResponse)
def sync(
    body: SyncRequest,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    last_synced_at = body.last_synced_at
    now = datetime.now(timezone.utc)

    # ── Apply incoming task changes (last-write-wins) ──────────────────────────
    label_updates: Dict[str, List[str]] = {}  # task_id → label_ids if client wins

    for t_data in body.changes.tasks:
        task_id = t_data.get("id")
        client_updated_at = _parse_dt(t_data.get("updated_at"))
        if not task_id or not client_updated_at:
            continue

        server_task = db.query(Task).filter(
            Task.id == task_id, Task.user_id == user_id
        ).first()

        if server_task is None:
            # New task from client — resolve board_id (missing/invalid = default board)
            task_board_id = _owned_board_id(db, t_data.get("board_id"), user_id) or (
                board_svc.get_default_board_id(db, user_id)
            )
            task = Task(
                id=task_id,
                user_id=user_id,
                board_id=task_board_id,
                title=t_data.get("title", ""),
                notes=t_data.get("notes"),
                state=t_data.get("state", "pending"),
                is_deleted=t_data.get("is_deleted", False),
                is_high_priority=t_data.get("is_high_priority", False),
                links=_validate_sync_links(t_data.get("links")),
                updated_at=client_updated_at,
                created_at=_parse_dt(t_data.get("created_at")) or now,
            )
            if t_data.get("must_do_by"):
                from datetime import date
                task.must_do_by = date.fromisoformat(t_data["must_do_by"])
            if t_data.get("target_date"):
                from datetime import date
                task.target_date = date.fromisoformat(t_data["target_date"])
            if t_data.get("completed_at"):
                task.completed_at = _parse_dt(t_data["completed_at"])
            db.add(task)
            label_updates[task_id] = t_data.get("label_ids", [])

        else:
            server_ts = server_task.updated_at
            if server_ts.tzinfo is None:
                server_ts = server_ts.replace(tzinfo=timezone.utc)
            if client_updated_at > server_ts:
                # Client wins
                server_task.title = t_data.get("title", server_task.title)
                server_task.notes = t_data.get("notes", server_task.notes)
                server_task.state = t_data.get("state", server_task.state)
                server_task.is_deleted = t_data.get("is_deleted", server_task.is_deleted)
                server_task.is_high_priority = t_data.get("is_high_priority", server_task.is_high_priority)
                if "links" in t_data:
                    server_task.links = _validate_sync_links(t_data.get("links"))
                server_task.updated_at = client_updated_at
                if "must_do_by" in t_data:
                    from datetime import date
                    server_task.must_do_by = date.fromisoformat(t_data["must_do_by"]) if t_data["must_do_by"] else None
                if "target_date" in t_data:
                    from datetime import date
                    server_task.target_date = date.fromisoformat(t_data["target_date"]) if t_data["target_date"] else None
                if "completed_at" in t_data:
                    server_task.completed_at = _parse_dt(t_data["completed_at"])
                if t_data.get("board_id"):
                    new_board_id = _owned_board_id(db, t_data["board_id"], user_id)
                    if new_board_id:
                        server_task.board_id = new_board_id
                label_updates[task_id] = t_data.get("label_ids", [])

    db.flush()

    # Apply label updates for tasks where client won — only labels in the same board
    for task_id, label_ids in label_updates.items():
        db.query(TaskLabel).filter(TaskLabel.task_id == task_id).delete()
        if label_ids:
            task_obj = db.query(Task).filter(Task.id == task_id).first()
            if task_obj and task_obj.board_id:
                valid_labels = db.query(Label).filter(
                    Label.id.in_(label_ids),
                    Label.board_id == task_obj.board_id,
                ).all()
                for label in valid_labels:
                    db.add(TaskLabel(task_id=task_id, label_id=label.id))

    # ── Apply incoming belief changes ──────────────────────────────────────────
    for b_data in body.changes.beliefs:
        belief_id = b_data.get("id")
        client_updated_at = _parse_dt(b_data.get("updated_at"))
        if not belief_id or not client_updated_at:
            continue
        server_belief = db.query(Belief).filter(
            Belief.id == belief_id, Belief.user_id == user_id
        ).first()
        if server_belief:
            server_ts = server_belief.updated_at
            if server_ts.tzinfo is None:
                server_ts = server_ts.replace(tzinfo=timezone.utc)
            if client_updated_at > server_ts:
                server_belief.status = b_data.get("status", server_belief.status)
                server_belief.updated_at = client_updated_at

    db.commit()

    # ── Build server-side changes since last_synced_at ─────────────────────────
    if last_synced_at.tzinfo is None:
        last_synced_at = last_synced_at.replace(tzinfo=timezone.utc)

    server_tasks = db.query(Task).filter(
        Task.user_id == user_id,
        Task.updated_at > last_synced_at,
    ).all()

    task_dicts = []
    task_label_list: List[TaskLabelSync] = []
    for t in server_tasks:
        task_dicts.append({
            "id": t.id,
            "board_id": t.board_id,
            "title": t.title,
            "notes": t.notes,
            "state": t.state.value if hasattr(t.state, "value") else t.state,
            "must_do_by": t.must_do_by.isoformat() if t.must_do_by else None,
            "target_date": t.target_date.isoformat() if t.target_date else None,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            "is_high_priority": t.is_high_priority,
            "is_deleted": t.is_deleted,
            "links": t.links or [],
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat(),
            "label_ids": [l.id for l in t.labels],
        })
        for l in t.labels:
            task_label_list.append(TaskLabelSync(task_id=t.id, label_id=l.id))

    server_beliefs = db.query(Belief).filter(
        Belief.user_id == user_id,
        Belief.updated_at > last_synced_at,
    ).all()
    belief_dicts = [
        {
            "id": b.id,
            "task_id": b.task_id,
            "belief_type": b.belief_type.value if hasattr(b.belief_type, "value") else b.belief_type,
            "label_id": b.label_id,
            "estimated_minutes": b.estimated_minutes,
            "status": b.status.value if hasattr(b.status, "value") else b.status,
            "updated_at": b.updated_at.isoformat(),
        }
        for b in server_beliefs
    ]

    server_boards = db.query(Board).filter(
        Board.user_id == user_id,
        Board.updated_at > last_synced_at,
    ).all()
    board_dicts = [
        {
            "id": b.id,
            "name": b.name,
            "is_default": b.is_default,
            "is_deleted": b.is_deleted,
            "created_at": b.created_at.isoformat(),
            "updated_at": b.updated_at.isoformat(),
        }
        for b in server_boards
    ]

    return SyncResponse(
        synced_at=now,
        changes=SyncChanges(
            tasks=task_dicts,
            task_labels=task_label_list,
            beliefs=belief_dicts,
            boards=board_dicts,
        ),
    )
