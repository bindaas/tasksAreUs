"""Board CRUD, seeding, and board-cap enforcement."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

_UNSET = object()  # sentinel: distinguishes "color not provided" from "color=None (clear)"

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import Board, Label, Task
from .label_service import seed_board_labels as _seed_board_labels

MAX_BOARDS_PER_USER = 10


def get_default_board_id(db: Session, user_id: str) -> str:
    board = db.query(Board).filter(
        Board.user_id == user_id,
        Board.is_default == True,
        Board.is_deleted == False,
    ).first()
    if not board:
        raise HTTPException(status_code=500, detail="No default board found for user")
    return board.id


def resolve_board_id(db: Session, user_id: str, board_id: Optional[str]) -> str:
    """Return board_id after validating ownership, or the default board if board_id is None.

    When board_id is None, calls ensure_board_seeded so new users are always initialised
    regardless of which endpoint they hit first.
    """
    if board_id is None:
        return ensure_board_seeded(db, user_id)
    board = db.query(Board).filter(
        Board.id == board_id,
        Board.user_id == user_id,
        Board.is_deleted == False,
    ).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board.id


def ensure_board_seeded(db: Session, user_id: str) -> str:
    """Ensure the user has a default board with seeded labels. Returns the default board ID.

    Happy path (existing user): single .first() query — no COUNT overhead.
    New-user path: COUNT confirms zero boards, then create + seed.
    Idempotent — concurrent races are swallowed via IntegrityError rollback.
    """
    existing = db.query(Board).filter(
        Board.user_id == user_id,
        Board.is_default == True,
        Board.is_deleted == False,
    ).first()
    if existing:
        return existing.id

    board_count = db.query(Board).filter(
        Board.user_id == user_id,
        Board.is_deleted == False,
    ).count()
    if board_count > 0:
        raise HTTPException(status_code=500, detail="No default board found for user")

    board = Board(
        user_id=user_id,
        name="General tasks",
        is_default=True,
        is_deleted=False,
    )
    db.add(board)
    try:
        db.commit()
        db.refresh(board)
    except IntegrityError:
        db.rollback()
        board = db.query(Board).filter(
            Board.user_id == user_id,
            Board.is_default == True,
            Board.is_deleted == False,
        ).first()
        if not board:
            raise HTTPException(status_code=500, detail="Failed to initialise user board")
    _seed_board_labels(db, board.id, user_id)
    return board.id


def get_board_or_404(db: Session, board_id: str, user_id: str) -> Board:
    board = db.query(Board).filter(
        Board.id == board_id,
        Board.user_id == user_id,
        Board.is_deleted == False,
    ).first()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


def create_board(db: Session, user_id: str, name: str) -> Board:
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Board name cannot be empty")

    count = db.query(Board).filter(
        Board.user_id == user_id,
        Board.is_deleted == False,
    ).count()
    if count >= MAX_BOARDS_PER_USER:
        raise HTTPException(
            status_code=422,
            detail=f"Board limit reached. Maximum {MAX_BOARDS_PER_USER} boards allowed.",
        )

    board = Board(user_id=user_id, name=name, is_default=False)
    db.add(board)
    db.commit()
    db.refresh(board)
    return board


def _recompute_default(db: Session, user_id: str) -> None:
    """Ensure is_default matches whichever board is topmost in sort_order.

    Must re-derive from the full ordered list rather than just the moved board:
    dragging the current default away from the top touches no other board's
    row, so "is the default still correct" can't be inferred from a single
    board's before/after state. Uses flush only — update_board() owns the
    single commit at the end of the request.
    """
    boards = db.query(Board).filter(
        Board.user_id == user_id,
        Board.is_deleted == False,
    ).order_by(Board.sort_order.asc(), Board.created_at.asc()).all()
    if not boards:
        return
    topmost = boards[0]
    if topmost.is_default:
        return

    old_default = next((b for b in boards if b.is_default), None)
    if old_default:
        old_default.is_default = False
        old_default.updated_at = datetime.now(timezone.utc)
        db.flush()  # clear old default before setting new one — avoids partial-index IntegrityError
    topmost.is_default = True
    topmost.updated_at = datetime.now(timezone.utc)
    db.flush()


def update_board(
    db: Session,
    board: Board,
    name: Optional[str],
    color: object = _UNSET,
    sort_order: Optional[float] = None,
) -> Board:
    if name is not None:
        name = name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Board name cannot be empty")
        board.name = name

    if color is not _UNSET:
        board.color = color  # None clears the color; a hex string sets it

    if sort_order is not None:
        board.sort_order = sort_order
        db.flush()
        _recompute_default(db, board.user_id)

    board.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(board)
    return board


def delete_board(db: Session, board: Board) -> None:
    total = db.query(Board).filter(
        Board.user_id == board.user_id,
        Board.is_deleted == False,
    ).count()
    if total <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only board")

    if board.is_default:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete the default board — drag another board to the top in Settings to make it default first",
        )

    has_tasks = db.query(Task).filter(
        Task.board_id == board.id,
        Task.is_deleted == False,
    ).first()
    if has_tasks:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a board that has tasks — delete the tasks first",
        )

    has_labels = db.query(Label).filter(Label.board_id == board.id).first()
    if has_labels:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete a board that has labels — delete the labels first",
        )

    board.is_deleted = True
    board.updated_at = datetime.now(timezone.utc)
    db.commit()
