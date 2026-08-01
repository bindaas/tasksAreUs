from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from dateutil.relativedelta import relativedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session


from ..models import Label, StateEnum, Task, TaskLabel, UserSettings
from . import board_service as board_svc


HIGH_PRIORITY_DAILY_LIMIT = 3  # fallback when user has no setting


def _get_high_priority_limit(db: Session, user_id: str) -> int:
    s = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if s and s.high_priority_daily_limit is not None:
        return s.high_priority_daily_limit
    return HIGH_PRIORITY_DAILY_LIMIT


def _effective_date(must_do_by: Optional[date], target_date: Optional[date]) -> Optional[date]:
    if must_do_by and target_date:
        return must_do_by if must_do_by <= target_date else target_date
    return must_do_by or target_date


def _is_hp_eligible_date(d: Optional[date]) -> bool:
    """HP is valid for overdue, today, tomorrow, the day after tomorrow, and — on Fridays
    only — the following Monday. Mirrors the frontend board's high-priority-eligible columns."""
    if d is None:
        return False
    today = date.today()
    if d <= today + relativedelta(days=1):
        return True
    if d == today + relativedelta(days=2):
        return True
    if today.weekday() == 4 and d == today + relativedelta(days=3):
        return True
    return False


def _count_high_priority_for_date(
    db: Session, user_id: str, d: Optional[date], exclude_task_id: Optional[str] = None
) -> int:
    if d is None:
        return 0
    q = db.query(Task).filter(
        Task.user_id == user_id,
        Task.is_high_priority == True,
        Task.is_deleted == False,
        Task.state == StateEnum.pending,
    )
    return sum(
        1 for t in q.all()
        if _effective_date(t.must_do_by, t.target_date) == d
        and (exclude_task_id is None or t.id != exclude_task_id)
    )


def get_task_or_404(db: Session, task_id: str, user_id: str) -> Task:
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == user_id,
        Task.is_deleted == False,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _resolve_labels(db: Session, label_ids: List[str], user_id: str, board_id: str) -> List[Label]:
    if not label_ids:
        return []
    labels = db.query(Label).filter(
        Label.id.in_(label_ids),
        Label.user_id == user_id,
        Label.board_id == board_id,
    ).all()
    found_ids = {l.id for l in labels}
    missing = set(label_ids) - found_ids
    if missing:
        raise HTTPException(status_code=422, detail=f"Unknown label IDs: {missing}")
    return labels


def create_task(
    db: Session,
    user_id: str,
    board_id: str,
    title: str,
    notes: Optional[str],
    must_do_by: Optional[date],
    target_date: Optional[date],
    label_ids: List[str],
    is_high_priority: bool = False,
    high_priority_limit: int = HIGH_PRIORITY_DAILY_LIMIT,
    links: Optional[List[Dict[str, Any]]] = None,
) -> Task:
    labels = _resolve_labels(db, label_ids, user_id, board_id)
    effective = _effective_date(must_do_by, target_date)
    final_priority = is_high_priority and _is_hp_eligible_date(effective)
    if final_priority:
        count = _count_high_priority_for_date(db, user_id, effective)
        if count >= high_priority_limit:
            raise HTTPException(
                status_code=422,
                detail=f"High-priority tasks are limited to {high_priority_limit} per day. "
                       "Remove one before adding another.",
            )
    task = Task(
        user_id=user_id,
        board_id=board_id,
        title=title,
        notes=notes,
        must_do_by=must_do_by,
        target_date=target_date,
        is_high_priority=final_priority,
        links=links or [],
    )
    db.add(task)
    db.flush()
    for label in labels:
        db.add(TaskLabel(task_id=task.id, label_id=label.id))
    db.commit()
    db.refresh(task)
    return task


def update_task(
    db: Session,
    task: Task,
    title: Optional[str],
    notes: Optional[str],
    must_do_by: Optional[date],
    target_date: Optional[date],
    label_ids: Optional[List[str]],
    clear_must_do_by: bool = False,
    clear_target_date: bool = False,
    is_high_priority: Optional[bool] = None,
    high_priority_limit: int = HIGH_PRIORITY_DAILY_LIMIT,
    links: Optional[List[Dict[str, Any]]] = None,
    board_id: Optional[str] = None,
) -> Task:
    if board_id is not None and board_id != task.board_id:
        board_svc.get_board_or_404(db, board_id, task.user_id)
        task.board_id = board_id
        if label_ids is None:
            # Labels are board-scoped, so a move always invalidates the old ones.
            # If label_ids was also sent, the block below already replaces them.
            db.query(TaskLabel).filter(TaskLabel.task_id == task.id).delete()
    if links is not None:
        task.links = links
    if title is not None:
        task.title = title
    if notes is not None:
        task.notes = notes
    if clear_must_do_by:
        task.must_do_by = None
    elif must_do_by is not None:
        task.must_do_by = must_do_by
    if clear_target_date:
        task.target_date = None
    elif target_date is not None:
        task.target_date = target_date

    if is_high_priority is not None:
        task.is_high_priority = is_high_priority

    # Auto-reset: high priority is only valid for dates within _is_hp_eligible_date's window
    if not _is_hp_eligible_date(_effective_date(task.must_do_by, task.target_date)):
        task.is_high_priority = False

    # Enforce per-day high-priority limit only when priority is being explicitly set to True
    if is_high_priority is True:
        effective = _effective_date(task.must_do_by, task.target_date)
        if _is_hp_eligible_date(effective):
            count = _count_high_priority_for_date(db, task.user_id, effective, exclude_task_id=task.id)
            if count >= high_priority_limit:
                raise HTTPException(
                    status_code=422,
                    detail=f"High-priority tasks are limited to {high_priority_limit} per day. "
                           "Remove one before adding another.",
                )

    if label_ids is not None:
        db.query(TaskLabel).filter(TaskLabel.task_id == task.id).delete()
        labels = _resolve_labels(db, label_ids, task.user_id, task.board_id)
        for label in labels:
            db.add(TaskLabel(task_id=task.id, label_id=label.id))

    task.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)
    return task


def complete_task(db: Session, task: Task, notes: Optional[str]) -> tuple[Task, Optional[Task]]:
    if task.state == StateEnum.done:
        raise HTTPException(status_code=422, detail="Task is already completed")

    task.state = StateEnum.done
    task.completed_at = datetime.now(timezone.utc)
    if notes is not None:
        task.notes = notes
    task.updated_at = datetime.now(timezone.utc)
    db.flush()

    db.commit()
    db.refresh(task)
    return task, None
