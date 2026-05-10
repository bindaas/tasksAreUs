from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user_id
from ..models import Belief
from ..schemas import BeliefOut, BeliefUpdate
from ..services import ai_service, task_service as svc

router = APIRouter(tags=["beliefs"])


@router.post("/tasks/{task_id}/beliefs/generate", response_model=dict)
def generate_beliefs(
    task_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    task = svc.get_task_or_404(db, task_id, user_id)
    beliefs = ai_service.generate_beliefs(db, task, user_id)
    return {"beliefs": [BeliefOut.model_validate(b) for b in beliefs]}


@router.get("/tasks/{task_id}/beliefs", response_model=dict)
def get_task_beliefs(
    task_id: str,
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    svc.get_task_or_404(db, task_id, user_id)
    q = db.query(Belief).filter(Belief.task_id == task_id, Belief.user_id == user_id)
    if status:
        q = q.filter(Belief.status == status)
    beliefs = q.all()
    return {"beliefs": [BeliefOut.model_validate(b) for b in beliefs]}


@router.put("/beliefs/{belief_id}", response_model=BeliefOut)
def update_belief(
    belief_id: str,
    body: BeliefUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    from datetime import datetime, timezone
    if body.status not in ("accepted", "rejected"):
        raise HTTPException(status_code=422, detail="status must be 'accepted' or 'rejected'")
    belief = db.query(Belief).filter(
        Belief.id == belief_id, Belief.user_id == user_id
    ).first()
    if not belief:
        raise HTTPException(status_code=404, detail="Belief not found")
    belief.status = body.status
    belief.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(belief)
    return BeliefOut.model_validate(belief)
