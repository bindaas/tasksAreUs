from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Label, StateEnum, Task
from ..schemas import (
    CompleteTaskRequest, CompleteTaskResponse,
    TaskCreate, TaskOut, TaskUpdate,
)
from ..services import board_service as board_svc
from ..services import task_service as svc
from ..services.task_service import _get_high_priority_limit

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", response_model=dict)
def list_tasks(
    state: Optional[str] = Query(None),
    label_ids: Optional[str] = Query(None),
    due_before: Optional[date] = Query(None),
    due_after: Optional[date] = Query(None),
    include_deleted: bool = Query(False),
    updated_after: Optional[str] = Query(None),
    board_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    effective_board_id = board_svc.resolve_board_id(db, user_id, board_id)
    q = db.query(Task).filter(Task.user_id == user_id, Task.board_id == effective_board_id)

    if not include_deleted:
        q = q.filter(Task.is_deleted == False)
    if state:
        q = q.filter(Task.state == state)
    if due_before:
        q = q.filter(Task.must_do_by <= due_before)
    if due_after:
        q = q.filter(Task.must_do_by >= due_after)
    if updated_after:
        from datetime import datetime, timezone
        dt = datetime.fromisoformat(updated_after.replace("Z", "+00:00"))
        q = q.filter(Task.updated_at > dt)
    if label_ids:
        ids = [lid.strip() for lid in label_ids.split(",") if lid.strip()]
        for lid in ids:
            q = q.filter(Task.labels.any(Label.id == lid))

    tasks = q.order_by(Task.created_at.desc()).all()
    return {"tasks": [TaskOut.model_validate(t) for t in tasks]}


@router.post("", response_model=TaskOut, status_code=201)
def create_task(
    body: TaskCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    effective_board_id = board_svc.resolve_board_id(db, user_id, body.board_id)
    task = svc.create_task(
        db=db,
        user_id=user_id,
        board_id=effective_board_id,
        title=body.title,
        notes=body.notes,
        must_do_by=body.must_do_by,
        target_date=body.target_date,
        label_ids=body.label_ids,
        is_high_priority=body.is_high_priority,
        high_priority_limit=_get_high_priority_limit(db, user_id),
        links=[l.model_dump() for l in body.links],
    )
    return TaskOut.model_validate(task)


@router.get("/{task_id}", response_model=TaskOut)
def get_task(
    task_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    task = svc.get_task_or_404(db, task_id, user_id)
    return TaskOut.model_validate(task)


@router.put("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: str,
    body: TaskUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    task = svc.get_task_or_404(db, task_id, user_id)
    task = svc.update_task(
        db=db,
        task=task,
        title=body.title,
        notes=body.notes,
        must_do_by=body.must_do_by,
        target_date=body.target_date,
        label_ids=body.label_ids,
        clear_must_do_by='must_do_by' in body.model_fields_set and body.must_do_by is None,
        clear_target_date='target_date' in body.model_fields_set and body.target_date is None,
        is_high_priority=body.is_high_priority,
        high_priority_limit=_get_high_priority_limit(db, user_id),
        links=[l.model_dump() for l in body.links] if body.links is not None else None,
        board_id=body.board_id,
    )
    return TaskOut.model_validate(task)


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    from datetime import datetime, timezone
    task = svc.get_task_or_404(db, task_id, user_id)
    task.is_deleted = True
    task.updated_at = datetime.now(timezone.utc)
    db.commit()


@router.post("/{task_id}/complete", response_model=CompleteTaskResponse)
def complete_task(
    task_id: str,
    body: CompleteTaskRequest = CompleteTaskRequest(),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    task = svc.get_task_or_404(db, task_id, user_id)
    completed, next_task = svc.complete_task(db, task, body.notes)
    return CompleteTaskResponse(
        completed_task=TaskOut.model_validate(completed),
        next_task=TaskOut.model_validate(next_task) if next_task else None,
    )
