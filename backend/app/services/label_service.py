"""Shared label seeding logic used by both the labels router and task/AI services."""
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import CategoryEnum, Label, LABEL_SEED


def seed_user_labels(db: Session, user_id: str) -> None:
    """Seed all label categories from LABEL_SEED for a user on first access."""
    existing = {
        (l.category.value, l.value)
        for l in db.query(Label).filter(Label.user_id == user_id).all()
    }
    for category, value in LABEL_SEED:
        if (category, value) not in existing:
            db.add(Label(category=CategoryEnum(category), value=value, user_id=user_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()


def ensure_seeded(db: Session, user_id: str) -> None:
    """Seed labels for the user if they have not been seeded yet.

    Uses total label count as the sentinel — zero labels means a brand-new
    user, so any_count == 0 reliably identifies new users.
    """
    any_count = db.query(Label).filter(
        Label.user_id == user_id,
    ).count()
    if any_count == 0:
        seed_user_labels(db, user_id)
