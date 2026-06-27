"""Label seeding helper — called by board_service during board initialisation."""
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import CategoryEnum, Label, LABEL_SEED


def seed_board_labels(db: Session, board_id: str, user_id: str) -> None:
    """Seed all LABEL_SEED entries into a specific board. Idempotent."""
    existing = {
        (l.category.value, l.value)
        for l in db.query(Label).filter(Label.board_id == board_id).all()
    }
    for category, value in LABEL_SEED:
        if (category, value) not in existing:
            db.add(Label(
                category=CategoryEnum(category),
                value=value,
                user_id=user_id,
                board_id=board_id,
            ))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
