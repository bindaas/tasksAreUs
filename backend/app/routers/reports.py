from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Label, StateEnum, Task, TaskLabel
from ..schemas import CompletionItem, CompletionsReport, LabelOut
from ..services import board_service as board_svc

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/completions", response_model=CompletionsReport)
def get_completions(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    label_ids: Optional[str] = Query(None),
    board_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    effective_board_id = board_svc.resolve_board_id(db, user_id, board_id)
    q = db.query(Task).filter(
        Task.user_id == user_id,
        Task.board_id == effective_board_id,
        Task.state == StateEnum.done,
        Task.is_deleted == False,
        Task.completed_at >= from_date,
        Task.completed_at < to_date + timedelta(days=1),
    )

    if label_ids:
        ids = [lid.strip() for lid in label_ids.split(",") if lid.strip()]
        for lid in ids:
            q = q.filter(Task.labels.any(Label.id == lid))

    tasks = q.order_by(Task.completed_at.asc()).all()

    completions = [
        CompletionItem(
            task_id=t.id,
            title=t.title,
            completed_at=t.completed_at,
            labels=[LabelOut.model_validate(l) for l in t.labels],
        )
        for t in tasks
    ]
    return CompletionsReport(completions=completions, total=len(completions))
