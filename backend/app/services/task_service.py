from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from dateutil.relativedelta import relativedelta
from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import Label, StateEnum, Task, TaskLabel


FREQUENCY_VALUES = {"daily", "weekly", "monthly", "annual"}


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


def get_task_or_404(db: Session, task_id: str, user_id: str) -> Task:
    task = db.query(Task).filter(
        Task.id == task_id,
        Task.user_id == user_id,
        Task.is_deleted == False,
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def _resolve_labels(db: Session, label_ids: List[str]) -> List[Label]:
    if not label_ids:
        return []
    labels = db.query(Label).filter(Label.id.in_(label_ids)).all()
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
) -> Task:
    labels = _resolve_labels(db, label_ids)
    task = Task(
        user_id=user_id,
        title=title,
        notes=notes,
        must_do_by=must_do_by,
        target_date=target_date,
        recurrence_group_id=recurrence_group_id,
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
) -> Task:
    if title is not None:
        task.title = title
    if notes is not None:
        task.notes = notes
    if must_do_by is not None:
        task.must_do_by = must_do_by
    if target_date is not None:
        task.target_date = target_date

    if label_ids is not None:
        db.query(TaskLabel).filter(TaskLabel.task_id == task.id).delete()
        labels = _resolve_labels(db, label_ids)
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
