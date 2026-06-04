from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Label
from ..schemas import LabelOut

router = APIRouter(prefix="/labels", tags=["labels"])


@router.get("", response_model=dict)
def list_labels(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: str = Depends(get_current_user),
):
    q = db.query(Label)
    if category:
        q = q.filter(Label.category == category)
    labels = q.all()
    return {"labels": [LabelOut.model_validate(l) for l in labels]}
