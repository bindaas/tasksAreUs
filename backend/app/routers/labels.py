from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import CategoryEnum, Label
from ..schemas import LabelCreate, LabelOut, LabelUpdate
from ..services import board_service as board_svc

router = APIRouter(prefix="/labels", tags=["labels"])

_CONFIGURABLE = {CategoryEnum.mode, CategoryEnum.type}


@router.get("", response_model=dict)
def list_labels(
    category: Optional[str] = Query(None),
    board_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    effective_board_id = board_svc.ensure_board_seeded(db, user_id)
    if board_id is not None:
        effective_board_id = board_svc.resolve_board_id(db, user_id, board_id)

    q = db.query(Label).filter(Label.board_id == effective_board_id)
    if category:
        try:
            cat = CategoryEnum(category)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown category: {category}")
        q = q.filter(Label.category == cat)

    return {"labels": [LabelOut.model_validate(l) for l in q.all()]}


@router.post("", response_model=LabelOut, status_code=201)
def create_label(
    body: LabelCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    try:
        cat = CategoryEnum(body.category)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Unknown category: {body.category}")
    if cat not in _CONFIGURABLE:
        raise HTTPException(status_code=400, detail="Only mode and type labels are configurable")

    value = body.value.strip()
    if not value:
        raise HTTPException(status_code=400, detail="Label value cannot be empty")

    effective_board_id = board_svc.resolve_board_id(db, user_id, body.board_id)

    existing = (
        db.query(Label)
        .filter(Label.category == cat, Label.board_id == effective_board_id, Label.value == value)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Label already exists")

    label = Label(category=cat, value=value, user_id=user_id, board_id=effective_board_id)
    db.add(label)
    db.commit()
    db.refresh(label)
    return LabelOut.model_validate(label)


@router.put("/{label_id}", response_model=LabelOut)
def update_label(
    label_id: str,
    body: LabelUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    label = db.query(Label).filter(Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    if label.category not in _CONFIGURABLE:
        raise HTTPException(status_code=400, detail="Only mode and type labels are editable")
    if label.user_id != user_id:
        raise HTTPException(status_code=403, detail="Cannot modify this label")

    value = body.value.strip()
    if not value:
        raise HTTPException(status_code=400, detail="Label value cannot be empty")

    duplicate = (
        db.query(Label)
        .filter(
            Label.category == label.category,
            Label.board_id == label.board_id,
            Label.value == value,
            Label.id != label_id,
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Label with this name already exists")

    label.value = value
    db.commit()
    db.refresh(label)
    return LabelOut.model_validate(label)


@router.delete("/{label_id}", status_code=204)
def delete_label(
    label_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    label = db.query(Label).filter(Label.id == label_id).first()
    if not label:
        raise HTTPException(status_code=404, detail="Label not found")
    if label.category not in _CONFIGURABLE:
        raise HTTPException(status_code=400, detail="Only mode and type labels can be deleted")
    if label.user_id != user_id:
        raise HTTPException(status_code=403, detail="Cannot delete this label")

    db.delete(label)
    db.commit()
