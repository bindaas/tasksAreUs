from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas import CompletionsReport
from ..services import reports_service

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/completions", response_model=CompletionsReport)
def get_completions(
    from_date: date = Query(..., alias="from"),
    to_date: date = Query(..., alias="to"),
    label_ids: Optional[str] = Query(None),
    board_id: Optional[str] = Query(None),
    all_boards: bool = Query(False),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    return reports_service.get_completions(
        db, user_id, from_date, to_date, label_ids, board_id, all_boards
    )
