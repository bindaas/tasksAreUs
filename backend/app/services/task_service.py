from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from dateutil.relativedelta import relativedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session

from sqlalchemy import or_

from ..models import Label, StateEnum, Task, TaskLabel, UserSettings


FREQUENCY_VALUES = {"daily", "weekly", "monthly", "annual"}
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
    """HP is valid for overdue, today, and tomorrow — anything with an effective date <= tomorrow."""
    if d is None:
        return False
    return d <= date.today() + relativedelta(days=1)


def _get_frequency_label(task: Task) -> Optional[str]:
    for label in task.labels:
        if label.category == "frequency" and label.value in FREQUENCY_VALUES:
            return label.value
    return None


def _next_due_date(base: date, frequency: str) -> date:
    if frequency == "daily":
        return base + relativedelta(days=1)
    if frequency == "weekly":
        return base + relativedelta(weeks=1)
    if frequency == "monthly":
        return base + relativedelta(months=1)
    if frequency == "annual":
        return base + relativedelta(years=1)
    return base


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


def _resolve_labels(db: Session, label_ids: List[str], user_id: str) -> List[Label]:
    if not label_ids:
        return []
    labels = db.query(Label).filter(
        Label.id.in_(label_ids),
        or_(Label.user_id == user_id, Label.user_id.is_(None)),
    ).all()
    found_ids = {l.id for l in labels}
    missing = set(label_ids) - found_ids
    if missing:
        raise HTTPException(status_code=422, detail=f"Unknown label IDs: {missing}")
    return labels


def create_task(
    db: Session,
    user_id: str,
    title: str,
    notes: Optional[str],
    must_do_by: Optional[date],
    target_date: Optional[date],
    label_ids: List[str],
    recurrence_group_id: Optional[str] = None,
    is_high_priority: bool = False,
    high_priority_limit: int = HIGH_PRIORITY_DAILY_LIMIT,
) -> Task:
    labels = _resolve_labels(db, label_ids, user_id)
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
        title=title,
        notes=notes,
        must_do_by=must_do_by,
        target_date=target_date,
        recurrence_group_id=recurrence_group_id,
        is_high_priority=final_priority,
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
) -> Task:
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

    # Auto-reset: high priority is only valid for overdue, today, and tomorrow
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
        labels = _resolve_labels(db, label_ids, task.user_id)
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

    next_task: Optional[Task] = None
    frequency = _get_frequency_label(task)
    if frequency:
        base = task.must_do_by or date.today()
        next_due = _next_due_date(base, frequency)
        label_ids = [l.id for l in task.labels]
        rg_id = task.recurrence_group_id or str(uuid.uuid4())
        if not task.recurrence_group_id:
            task.recurrence_group_id = rg_id

        # Only create next instance if none pending for this recurrence group
        existing_pending = db.query(Task).filter(
            Task.recurrence_group_id == rg_id,
            Task.state == StateEnum.pending,
            Task.is_deleted == False,
        ).first()

        if not existing_pending:
            next_task = create_task(
                db=db,
                user_id=task.user_id,
                title=task.title,
                notes=None,
                must_do_by=next_due,
                target_date=None,
                label_ids=label_ids,
                recurrence_group_id=rg_id,
            )

    db.commit()
    db.refresh(task)
    return task, next_task
