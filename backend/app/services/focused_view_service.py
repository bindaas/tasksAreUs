"""Focused view config management and task filtering."""
from __future__ import annotations

from datetime import date, timedelta
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..models import Board, FocusedViewConfig, StateEnum, Task

_VALID_BOARD_SELECTIONS = {"all", "selected"}
_VALID_DAY_RANGES = {"today", "today_tomorrow", "today_plus_two"}


def get_or_create_config(db: Session, user_id: str) -> FocusedViewConfig:
    config = db.query(FocusedViewConfig).filter(
        FocusedViewConfig.user_id == user_id
    ).first()
    if config:
        return config
    config = FocusedViewConfig(
        user_id=user_id,
        board_selection="all",
        selected_board_ids=[],
        day_range="today",
    )
    db.add(config)
    try:
        db.commit()
        db.refresh(config)
    except IntegrityError:
        db.rollback()
        config = db.query(FocusedViewConfig).filter(
            FocusedViewConfig.user_id == user_id
        ).first()
        if not config:
            raise HTTPException(status_code=500, detail="Failed to initialise focused view config")
    return config


def update_config(
    db: Session,
    config: FocusedViewConfig,
    board_selection: str,
    selected_board_ids: List[str],
    day_range: str,
    user_id: str,
) -> FocusedViewConfig:
    if board_selection not in _VALID_BOARD_SELECTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid board_selection — must be one of: {sorted(_VALID_BOARD_SELECTIONS)}",
        )
    if day_range not in _VALID_DAY_RANGES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid day_range — must be one of: {sorted(_VALID_DAY_RANGES)}",
        )

    if board_selection == "selected":
        if not selected_board_ids:
            raise HTTPException(
                status_code=400,
                detail="selected_board_ids must be non-empty when board_selection is 'selected'",
            )
        owned = db.query(Board).filter(
            Board.id.in_(selected_board_ids),
            Board.user_id == user_id,
            Board.is_deleted == False,
        ).all()
        owned_ids = {b.id for b in owned}
        invalid = [bid for bid in selected_board_ids if bid not in owned_ids]
        if invalid:
            raise HTTPException(
                status_code=400,
                detail=f"Board(s) not found or not owned by caller: {invalid}",
            )
        config.selected_board_ids = selected_board_ids
    else:
        config.selected_board_ids = []

    config.board_selection = board_selection
    config.day_range = day_range
    db.commit()
    db.refresh(config)
    return config


def date_window(day_range: str, reference_date: date) -> List[date]:
    tomorrow = reference_date + timedelta(days=1)
    day_after = reference_date + timedelta(days=2)
    if day_range == "today":
        return [reference_date]
    elif day_range == "today_tomorrow":
        return [reference_date, tomorrow]
    else:  # today_plus_two
        return [reference_date, tomorrow, day_after]


def _query_board_grouped_tasks(
    db: Session,
    user_id: str,
    boards: List[Board],
    window: List[date],
    high_priority_only: bool,
) -> List[dict]:
    """Query pending tasks due within `window`, grouped by the given (already-ordered) boards.

    Callers are responsible for resolving and ordering `boards` before calling this —
    ordering here follows whatever order `boards` was passed in.
    """
    if not boards:
        return []

    board_ids = [b.id for b in boards]

    filters = [
        Task.user_id == user_id,
        Task.board_id.in_(board_ids),
        Task.is_deleted == False,
        Task.state == StateEnum.pending,
        or_(
            Task.must_do_by.in_(window),
            Task.target_date.in_(window),
        ),
    ]
    if high_priority_only:
        filters.append(Task.is_high_priority == True)

    tasks = db.query(Task).filter(*filters).order_by(Task.updated_at.desc()).all()

    tasks_by_board: dict[str, list] = {b.id: [] for b in boards}
    for task in tasks:
        tasks_by_board[task.board_id].append(task)

    result = []
    for board in boards:
        board_tasks = tasks_by_board.get(board.id, [])
        if not board_tasks:
            continue
        result.append({
            "board_id": board.id,
            "board_name": board.name,
            "board_color": board.color,
            "tasks": board_tasks,
        })

    return result


def get_focused_tasks(
    db: Session,
    user_id: str,
    config: FocusedViewConfig,
    reference_date: date,
) -> List[dict]:
    if config.board_selection == "all":
        boards = db.query(Board).filter(
            Board.user_id == user_id,
            Board.is_deleted == False,
        ).order_by(Board.name.asc()).all()
    else:
        boards = db.query(Board).filter(
            Board.id.in_(config.selected_board_ids or []),
            Board.user_id == user_id,
            Board.is_deleted == False,
        ).order_by(Board.name.asc()).all()

    window = date_window(config.day_range, reference_date)
    return _query_board_grouped_tasks(db, user_id, boards, window, high_priority_only=True)


def get_day_view_tasks(
    db: Session,
    user_id: str,
    reference_date: date,
) -> List[dict]:
    boards = db.query(Board).filter(
        Board.user_id == user_id,
        Board.is_deleted == False,
    ).order_by(Board.name.asc()).all()

    return _query_board_grouped_tasks(db, user_id, boards, [reference_date], high_priority_only=False)
