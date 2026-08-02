"""Completions report query logic for the Archive view."""
from __future__ import annotations

from datetime import date, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from ..models import Board, Label, StateEnum, Task
from ..schemas import BoardCompletions, CompletionItem, CompletionsReport, LabelOut
from . import board_service as board_svc


def _completions_query(
    db: Session,
    user_id: str,
    board_ids: List[str],
    from_date: date,
    to_date: date,
    label_ids: Optional[str],
):
    q = db.query(Task).filter(
        Task.user_id == user_id,
        Task.board_id.in_(board_ids),
        Task.state == StateEnum.done,
        Task.is_deleted == False,
        Task.completed_at >= from_date,
        Task.completed_at < to_date + timedelta(days=1),
    )

    if label_ids:
        ids = [lid.strip() for lid in label_ids.split(",") if lid.strip()]
        for lid in ids:
            q = q.filter(Task.labels.any(Label.id == lid))

    return q.order_by(Task.completed_at.asc()).all()


def _to_completion_item(task: Task) -> CompletionItem:
    return CompletionItem(
        task_id=task.id,
        title=task.title,
        completed_at=task.completed_at,
        labels=[LabelOut.model_validate(l) for l in task.labels],
    )


def get_completions(
    db: Session,
    user_id: str,
    from_date: date,
    to_date: date,
    label_ids: Optional[str],
    board_id: Optional[str],
    all_boards: bool,
) -> CompletionsReport:
    if not all_boards:
        effective_board_id = board_svc.resolve_board_id(db, user_id, board_id)
        tasks = _completions_query(db, user_id, [effective_board_id], from_date, to_date, label_ids)
        completions = [_to_completion_item(t) for t in tasks]
        return CompletionsReport(completions=completions, total=len(completions))

    board_svc.ensure_board_seeded(db, user_id)
    boards = db.query(Board).filter(
        Board.user_id == user_id,
        Board.is_deleted == False,
    ).order_by(Board.sort_order.asc(), Board.created_at.asc()).all()

    if not boards:
        return CompletionsReport(completions=[], total=0, boards=[])

    board_ids = [b.id for b in boards]
    tasks = _completions_query(db, user_id, board_ids, from_date, to_date, label_ids)

    tasks_by_board: dict[str, list] = {b.id: [] for b in boards}
    for task in tasks:
        tasks_by_board[task.board_id].append(task)

    board_groups = []
    for board in boards:
        board_tasks = tasks_by_board.get(board.id, [])
        if not board_tasks:
            continue
        board_groups.append(BoardCompletions(
            board_id=board.id,
            board_name=board.name,
            board_color=board.color,
            completions=[_to_completion_item(t) for t in board_tasks],
        ))

    completions = [_to_completion_item(t) for t in tasks]
    return CompletionsReport(completions=completions, total=len(completions), boards=board_groups)
