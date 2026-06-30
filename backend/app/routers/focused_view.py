from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas import FocusedViewConfigOut, FocusedViewConfigUpdate, FocusedViewTasksOut
from ..services import focused_view_service as svc

router = APIRouter(prefix="/focused-view", tags=["focused-view"])


@router.get("/config", response_model=FocusedViewConfigOut)
def get_config(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    config = svc.get_or_create_config(db, user_id)
    return FocusedViewConfigOut.model_validate(config)


@router.put("/config", response_model=FocusedViewConfigOut)
def update_config(
    body: FocusedViewConfigUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    config = svc.get_or_create_config(db, user_id)
    config = svc.update_config(
        db, config, body.board_selection, body.selected_board_ids, body.day_range, user_id
    )
    return FocusedViewConfigOut.model_validate(config)


@router.get("/tasks", response_model=FocusedViewTasksOut)
def get_focused_tasks(
    reference_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    if reference_date is None:
        reference_date = date.today()
    config = svc.get_or_create_config(db, user_id)
    boards = svc.get_focused_tasks(db, user_id, config, reference_date)
    return FocusedViewTasksOut(boards=boards)
