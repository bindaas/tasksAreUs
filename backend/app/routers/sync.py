from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user_id
from ..models import Belief, Task, TaskLabel, UserSettings
from ..schemas import SyncChanges, SyncRequest, SyncResponse, TaskLabelSync

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
    user_id: str = Depends(get_current_user_id),
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
            # New task from client
            task = Task(
                id=task_id,
                user_id=user_id,
                title=t_data.get("title", ""),
                notes=t_data.get("notes"),
                state=t_data.get("state", "pending"),
                is_deleted=t_data.get("is_deleted", False),
                recurrence_group_id=t_data.get("recurrence_group_id"),
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
                server_task.updated_at = client_updated_at
                if "must_do_by" in t_data:
                    from datetime import date
                    server_task.must_do_by = date.fromisoformat(t_data["must_do_by"]) if t_data["must_do_by"] else None
                if "target_date" in t_data:
                    from datetime import date
                    server_task.target_date = date.fromisoformat(t_data["target_date"]) if t_data["target_date"] else None
                if "completed_at" in t_data:
                    server_task.completed_at = _parse_dt(t_data["completed_at"])
                label_updates[task_id] = t_data.get("label_ids", [])

    db.flush()

    # Apply label updates for tasks where client won
    for task_id, label_ids in label_updates.items():
        db.query(TaskLabel).filter(TaskLabel.task_id == task_id).delete()
        for lid in label_ids:
            db.add(TaskLabel(task_id=task_id, label_id=lid))

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

    # ── Apply incoming settings ────────────────────────────────────────────────
    if body.changes.settings:
        s_data = body.changes.settings
        client_updated_at = _parse_dt(s_data.get("updated_at"))
        server_settings = db.query(UserSettings).filter(
            UserSettings.user_id == user_id
        ).first()
        if not server_settings:
            server_settings = UserSettings(user_id=user_id)
            db.add(server_settings)
            db.flush()
        if client_updated_at:
            server_ts = server_settings.updated_at
            if server_ts.tzinfo is None:
                server_ts = server_ts.replace(tzinfo=timezone.utc)
            if client_updated_at > server_ts:
                server_settings.starter_questions = s_data.get("starter_questions", [])
                server_settings.updated_at = client_updated_at

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
            "title": t.title,
            "notes": t.notes,
            "state": t.state.value if hasattr(t.state, "value") else t.state,
            "must_do_by": t.must_do_by.isoformat() if t.must_do_by else None,
            "target_date": t.target_date.isoformat() if t.target_date else None,
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            "recurrence_group_id": t.recurrence_group_id,
            "is_deleted": t.is_deleted,
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

    settings_obj = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    settings_dict = None
    if settings_obj and settings_obj.updated_at > last_synced_at:
        settings_dict = {
            "starter_questions": settings_obj.starter_questions or [],
            "updated_at": settings_obj.updated_at.isoformat(),
        }

    return SyncResponse(
        synced_at=now,
        changes=SyncChanges(
            tasks=task_dicts,
            task_labels=task_label_list,
            beliefs=belief_dicts,
            settings=settings_dict,
        ),
    )
