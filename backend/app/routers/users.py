from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..schemas import UserCreate, UserOut

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
