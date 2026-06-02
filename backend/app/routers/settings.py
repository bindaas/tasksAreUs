from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user_id
from ..models import UserSettings
from ..schemas import SettingsOut, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create_settings(db: Session, user_id: str) -> UserSettings:
    s = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if not s:
        s = UserSettings(user_id=user_id, starter_questions=[])
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.get("", response_model=SettingsOut)
def get_settings(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    s = _get_or_create_settings(db, user_id)
    return SettingsOut(
        starter_questions=s.starter_questions or [],
        high_priority_daily_limit=s.high_priority_daily_limit if s.high_priority_daily_limit is not None else 3,
    )


@router.put("", response_model=SettingsOut)
def update_settings(
    body: SettingsUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    s = _get_or_create_settings(db, user_id)
    s.starter_questions = body.starter_questions[:5]
    s.high_priority_daily_limit = max(1, body.high_priority_daily_limit)
    s.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(s)
    return SettingsOut(
        starter_questions=s.starter_questions or [],
        high_priority_daily_limit=s.high_priority_daily_limit,
    )
