"""Unit tests for board_service — no database required."""

from unittest.mock import MagicMock, patch
from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.models import Board, Label, Task
from app.services.board_service import (
    MAX_BOARDS_PER_USER,
    create_board,
    delete_board,
    ensure_board_seeded,
    get_board_or_404,
    get_default_board_id,
    resolve_board_id,
    update_board,
)


def _make_board(
    id: str,
    user_id: str,
    name: str = "General tasks",
    is_default: bool = False,
    is_deleted: bool = False,
) -> Board:
    b = Board(id=id, user_id=user_id, name=name, is_default=is_default, is_deleted=is_deleted)
    b.updated_at = datetime.now(timezone.utc)
    return b


# ── get_default_board_id ──────────────────────────────────────────────────────

class TestGetDefaultBoardId:
    def test_returns_default_board_id(self):
        db = MagicMock()
        board = _make_board("b1", "user-1", is_default=True)
        db.query.return_value.filter.return_value.first.return_value = board

        result = get_default_board_id(db, "user-1")
        assert result == "b1"

    def test_raises_500_when_no_default(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc:
            get_default_board_id(db, "user-1")
        assert exc.value.status_code == 500


# ── resolve_board_id ──────────────────────────────────────────────────────────

class TestResolveBoardId:
    def test_returns_default_when_none(self):
        db = MagicMock()
        board = _make_board("b1", "user-1", is_default=True)
        db.query.return_value.filter.return_value.first.return_value = board

        result = resolve_board_id(db, "user-1", None)
        assert result == "b1"

    def test_validates_provided_board_id(self):
        db = MagicMock()
        board = _make_board("b2", "user-1")
        db.query.return_value.filter.return_value.first.return_value = board

        result = resolve_board_id(db, "user-1", "b2")
        assert result == "b2"

    def test_raises_404_for_unknown_board(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc:
            resolve_board_id(db, "user-1", "missing")
        assert exc.value.status_code == 404


# ── ensure_board_seeded ───────────────────────────────────────────────────────

class TestEnsureBoardSeeded:
    def test_creates_board_and_seeds_for_new_user(self):
        db = MagicMock()
        # Happy-path first() finds no default board; COUNT confirms zero boards
        db.query.return_value.filter.return_value.first.return_value = None
        db.query.return_value.filter.return_value.count.return_value = 0
        db.refresh.side_effect = lambda obj: setattr(obj, "id", "b1")

        with patch("app.services.board_service._seed_board_labels") as mock_seed:
            result = ensure_board_seeded(db, "user-1")

        db.add.assert_called_once()
        added_board = db.add.call_args[0][0]
        assert added_board.name == "General tasks"
        assert added_board.is_default is True
        mock_seed.assert_called_once()

    def test_skips_creation_when_board_exists(self):
        db = MagicMock()
        # Happy-path first() finds the existing default board immediately — no COUNT needed
        board = _make_board("b1", "user-1", is_default=True)
        db.query.return_value.filter.return_value.first.return_value = board

        with patch("app.services.board_service._seed_board_labels") as mock_seed:
            result = ensure_board_seeded(db, "user-1")

        db.add.assert_not_called()
        mock_seed.assert_not_called()
        assert result == "b1"


# ── create_board ──────────────────────────────────────────────────────────────

class TestCreateBoard:
    def test_creates_board_successfully(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.count.return_value = 1
        db.refresh.side_effect = lambda b: setattr(b, "id", "new-board")

        result = create_board(db, "user-1", "Job search")

        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.name == "Job search"
        assert added.user_id == "user-1"
        assert added.is_default is False

    def test_rejects_empty_name(self):
        db = MagicMock()
        with pytest.raises(HTTPException) as exc:
            create_board(db, "user-1", "   ")
        assert exc.value.status_code == 400

    def test_enforces_board_cap(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.count.return_value = MAX_BOARDS_PER_USER

        with pytest.raises(HTTPException) as exc:
            create_board(db, "user-1", "One too many")
        assert exc.value.status_code == 422
        assert str(MAX_BOARDS_PER_USER) in exc.value.detail

    def test_allows_creation_at_one_below_cap(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.count.return_value = MAX_BOARDS_PER_USER - 1
        db.refresh.side_effect = lambda b: None

        result = create_board(db, "user-1", "Last allowed board")
        db.add.assert_called_once()


# ── update_board ──────────────────────────────────────────────────────────────

class TestUpdateBoard:
    def test_renames_board(self):
        db = MagicMock()
        board = _make_board("b1", "user-1", name="Old name")
        db.refresh.side_effect = lambda b: None

        update_board(db, board, name="New name")

        assert board.name == "New name"
        db.commit.assert_called_once()
        db.query.assert_not_called()  # no sort_order → no _recompute_default lookup

    def test_rejects_empty_name(self):
        db = MagicMock()
        board = _make_board("b1", "user-1")

        with pytest.raises(HTTPException) as exc:
            update_board(db, board, name="  ")
        assert exc.value.status_code == 400

    def test_sets_color_when_provided(self):
        db = MagicMock()
        board = _make_board("b1", "user-1")
        board.color = None
        db.refresh.side_effect = lambda b: None

        update_board(db, board, name=None, color="#aabbcc")

        assert board.color == "#aabbcc"
        db.commit.assert_called_once()

    def test_clears_color_when_none_passed_explicitly(self):
        db = MagicMock()
        board = _make_board("b1", "user-1")
        board.color = "#aabbcc"
        db.refresh.side_effect = lambda b: None

        update_board(db, board, name=None, color=None)

        assert board.color is None
        db.commit.assert_called_once()

    def test_color_unchanged_when_not_provided(self):
        db = MagicMock()
        board = _make_board("b1", "user-1")
        board.color = "#aabbcc"
        db.refresh.side_effect = lambda b: None

        update_board(db, board, name=None)  # no color kwarg

        assert board.color == "#aabbcc"

    def test_sort_order_promotes_new_topmost_to_default(self):
        db = MagicMock()
        board = _make_board("b2", "user-1", is_default=False)
        old_default = _make_board("b1", "user-1", is_default=True)
        db.refresh.side_effect = lambda b: None
        # board b2's new sort_order makes it topmost in the full ordered list
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [board, old_default]

        update_board(db, board, name=None, sort_order=0.5)

        assert board.sort_order == 0.5
        assert board.is_default is True
        assert old_default.is_default is False
        db.commit.assert_called_once()

    def test_sort_order_demotes_default_dragged_away_from_top(self):
        db = MagicMock()
        # board b1 is the current default, being dragged away from the top —
        # no other board's row is directly touched by this PUT, so
        # _recompute_default must re-derive the new default from the full list.
        board = _make_board("b1", "user-1", is_default=True)
        other = _make_board("b2", "user-1", is_default=False)
        db.refresh.side_effect = lambda b: None
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [other, board]

        update_board(db, board, name=None, sort_order=99.0)

        assert board.sort_order == 99.0
        assert board.is_default is False
        assert other.is_default is True

    def test_sort_order_noop_when_topmost_unchanged(self):
        db = MagicMock()
        topmost = _make_board("b1", "user-1", is_default=True)
        board = _make_board("b2", "user-1", is_default=False)
        db.refresh.side_effect = lambda b: None
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [topmost, board]

        update_board(db, board, name=None, sort_order=5.0)

        assert board.sort_order == 5.0
        assert board.is_default is False
        assert topmost.is_default is True


# ── delete_board ──────────────────────────────────────────────────────────────

class TestDeleteBoard:
    def _setup_db(self, board_count=2, is_default=False, has_tasks=False, has_labels=False):
        db = MagicMock()
        db.query.return_value.filter.return_value.count.return_value = board_count
        # first() calls: tasks check, then labels check
        db.query.return_value.filter.return_value.first.side_effect = [
            _make_board("task-mock", "user-1") if has_tasks else None,
            _make_board("label-mock", "user-1") if has_labels else None,
        ]
        return db

    def test_soft_deletes_empty_board(self):
        board = _make_board("b2", "user-1", is_default=False)
        db = self._setup_db(board_count=2, has_tasks=False, has_labels=False)

        delete_board(db, board)

        assert board.is_deleted is True
        db.commit.assert_called_once()

    def test_rejects_only_board(self):
        board = _make_board("b1", "user-1", is_default=True)
        db = MagicMock()
        db.query.return_value.filter.return_value.count.return_value = 1

        with pytest.raises(HTTPException) as exc:
            delete_board(db, board)
        assert exc.value.status_code == 400
        assert "only board" in exc.value.detail

    def test_rejects_default_board(self):
        board = _make_board("b1", "user-1", is_default=True)
        db = MagicMock()
        db.query.return_value.filter.return_value.count.return_value = 2

        with pytest.raises(HTTPException) as exc:
            delete_board(db, board)
        assert exc.value.status_code == 400
        assert "default board" in exc.value.detail

    def test_rejects_board_with_tasks(self):
        board = _make_board("b2", "user-1", is_default=False)
        db = MagicMock()
        db.query.return_value.filter.return_value.count.return_value = 2
        # tasks check returns a task
        db.query.return_value.filter.return_value.first.return_value = MagicMock()

        with pytest.raises(HTTPException) as exc:
            delete_board(db, board)
        assert exc.value.status_code == 400
        assert "tasks" in exc.value.detail

    def test_rejects_board_with_labels(self):
        board = _make_board("b2", "user-1", is_default=False)
        db = MagicMock()
        db.query.return_value.filter.return_value.count.return_value = 2
        # tasks check returns None, labels check returns a label
        db.query.return_value.filter.return_value.first.side_effect = [None, MagicMock()]

        with pytest.raises(HTTPException) as exc:
            delete_board(db, board)
        assert exc.value.status_code == 400
        assert "labels" in exc.value.detail
