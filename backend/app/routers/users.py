from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_firebase_claims
from ..models import User
from ..schemas import MigrateOut, MigrateRequest, UserCreate, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserOut, status_code=201)
def register_user(body: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.device_uuid == body.device_uuid).first()
    if not user:
        user = User(device_uuid=body.device_uuid)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@router.post("/migrate", response_model=MigrateOut)
def migrate_user(
    body: MigrateRequest,
    claims: dict = Depends(get_firebase_claims),
    db: Session = Depends(get_db),
):
    """One-time migration: stitch a Firebase UID onto an existing device_uuid row."""
    firebase_uid = claims["uid"]

    user = db.query(User).filter(User.device_uuid == body.device_uuid).first()
    if user is None:
        raise HTTPException(status_code=404, detail="device_uuid not found")

    if user.firebase_uid == firebase_uid:
        return MigrateOut(user_id=user.id)

    if user.firebase_uid is not None:
        raise HTTPException(
            status_code=409,
            detail="This device_uuid is already linked to a different Firebase account",
        )

    user.firebase_uid = firebase_uid
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="This Firebase UID is already linked to a different account",
        )
    return MigrateOut(user_id=user.id)
