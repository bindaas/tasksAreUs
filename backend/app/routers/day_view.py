from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas import FocusedViewTasksOut
from ..services import focused_view_service as svc

router = APIRouter(prefix="/day-view", tags=["day-view"])


@router.get("/tasks", response_model=FocusedViewTasksOut)
def get_day_view_tasks(
    reference_date: date = Query(...),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    boards = svc.get_day_view_tasks(db, user_id, reference_date)
    return FocusedViewTasksOut(boards=boards)
