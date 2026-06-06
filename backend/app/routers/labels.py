from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import CategoryEnum, Label
from ..schemas import LabelCreate, LabelOut, LabelUpdate

router = APIRouter(prefix="/labels", tags=["labels"])

_CONFIGURABLE = {CategoryEnum.mode, CategoryEnum.type}


def _seed_user_labels(db: Session, user_id: str, category: CategoryEnum) -> None:
    """Copy global defaults into per-user labels on first access."""
    global_labels = (
        db.query(Label)
        .filter(Label.category == category, Label.user_id.is_(None))
        .all()
    )
    for gl in global_labels:
        db.add(Label(category=gl.category, value=gl.value, user_id=user_id))
    db.commit()


@router.get("", response_model=dict)
def list_labels(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    results: list[Label] = []

    if category:
        try:
            cat = CategoryEnum(category)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown category: {category}")
        if cat in _CONFIGURABLE:
            user_labels = (
                db.query(Label)
                .filter(Label.category == cat, Label.user_id == user_id)
                .all()
            )
            if not user_labels:
                _seed_user_labels(db, user_id, cat)
                user_labels = (
                    db.query(Label)
                    .filter(Label.category == cat, Label.user_id == user_id)
                    .all()
                )
            results = user_labels
        else:
            results = db.query(Label).filter(Label.category == cat, Label.user_id.is_(None)).all()
    else:
        # Frequency: global; mode/type: per-user (seed if needed)
        freq_labels = (
            db.query(Label)
            .filter(Label.category == CategoryEnum.frequency, Label.user_id.is_(None))
            .all()
        )
        configurable_labels: list[Label] = []
        for cat in _CONFIGURABLE:
            user_labels = (
                db.query(Label)
                .filter(Label.category == cat, Label.user_id == user_id)
                .all()
            )
            if not user_labels:
                _seed_user_labels(db, user_id, cat)
                user_labels = (
                    db.query(Label)
                    .filter(Label.category == cat, Label.user_id == user_id)
                    .all()
                )
            configurable_labels.extend(user_labels)
        results = freq_labels + configurable_labels

    return {"labels": [LabelOut.model_validate(l) for l in results]}


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

    existing = (
        db.query(Label)
        .filter(Label.category == cat, Label.user_id == user_id, Label.value == value)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Label already exists")

    label = Label(category=cat, value=value, user_id=user_id)
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
    if label.user_id != user_id:
        raise HTTPException(status_code=403, detail="Cannot modify this label")
    if label.category not in _CONFIGURABLE:
        raise HTTPException(status_code=400, detail="Frequency labels are not editable")

    value = body.value.strip()
    if not value:
        raise HTTPException(status_code=400, detail="Label value cannot be empty")

    duplicate = (
        db.query(Label)
        .filter(
            Label.category == label.category,
            Label.user_id == user_id,
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
    if label.user_id != user_id:
        raise HTTPException(status_code=403, detail="Cannot delete this label")
    if label.category not in _CONFIGURABLE:
        raise HTTPException(status_code=400, detail="Frequency labels cannot be deleted")

    db.delete(label)
    db.commit()
