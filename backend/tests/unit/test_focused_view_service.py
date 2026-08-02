"""Unit tests for focused_view_service — no database required."""

from datetime import date, timedelta
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.models import Board, FocusedViewConfig, StateEnum, Task
from app.services.focused_view_service import (
    _query_board_grouped_tasks,
    date_window,
    get_day_view_tasks,
    get_focused_tasks,
    get_or_create_config,
    update_config,
)


def _make_config(
    user_id: str = "user-1",
    board_selection: str = "all",
    selected_board_ids: list = None,
    day_range: str = "today_tomorrow",
) -> FocusedViewConfig:
    c = FocusedViewConfig(
        id="cfg-1",
        user_id=user_id,
        board_selection=board_selection,
        selected_board_ids=selected_board_ids or [],
        day_range=day_range,
    )
    return c


def _make_board(id: str, user_id: str = "user-1", name: str = "Board", color: str = None) -> Board:
    b = Board(id=id, user_id=user_id, name=name, is_default=False, is_deleted=False)
    b.color = color
    return b


def _make_task(
    id: str,
    board_id: str,
    user_id: str = "user-1",
    is_high_priority: bool = True,
    state: StateEnum = StateEnum.pending,
    must_do_by: date = None,
    target_date: date = None,
) -> Task:
    t = Task(
        id=id,
        user_id=user_id,
        board_id=board_id,
        title=f"Task {id}",
        state=state,
        is_high_priority=is_high_priority,
        is_deleted=False,
    )
    t.must_do_by = must_do_by
    t.target_date = target_date
    return t


# ── date_window ───────────────────────────────────────────────────────────────

class TestDateWindow:
    TODAY = date(2026, 6, 28)

    def test_today_only(self):
        assert date_window("today", self.TODAY) == [self.TODAY]

    def test_today_tomorrow(self):
        result = date_window("today_tomorrow", self.TODAY)
        assert result == [self.TODAY, self.TODAY + timedelta(days=1)]

    def test_today_plus_two(self):
        result = date_window("today_plus_two", self.TODAY)
        assert result == [
            self.TODAY,
            self.TODAY + timedelta(days=1),
            self.TODAY + timedelta(days=2),
        ]

    def test_today_window_excludes_tomorrow(self):
        window = date_window("today", self.TODAY)
        assert (self.TODAY + timedelta(days=1)) not in window

    def test_today_tomorrow_excludes_day_after(self):
        window = date_window("today_tomorrow", self.TODAY)
        assert (self.TODAY + timedelta(days=2)) not in window


# ── get_or_create_config ──────────────────────────────────────────────────────

class TestGetOrCreateConfig:
    def test_returns_existing_config(self):
        db = MagicMock()
        existing = _make_config()
        db.query.return_value.filter.return_value.first.return_value = existing

        result = get_or_create_config(db, "user-1")

        assert result is existing
        db.add.assert_not_called()

    def test_creates_default_config_when_none_exists(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = [None, _make_config()]

        result = get_or_create_config(db, "user-1")

        db.add.assert_called_once()
        db.commit.assert_called_once()
        assert result.board_selection == "all"
        assert result.day_range == "today"
        assert result.selected_board_ids == []

    def test_handles_race_condition_via_integrity_error(self):
        from sqlalchemy.exc import IntegrityError

        db = MagicMock()
        existing_after_race = _make_config()
        db.query.return_value.filter.return_value.first.side_effect = [None, existing_after_race]
        db.commit.side_effect = IntegrityError("", {}, Exception())

        result = get_or_create_config(db, "user-1")

        db.rollback.assert_called_once()
        assert result is existing_after_race


# ── update_config ─────────────────────────────────────────────────────────────

class TestUpdateConfig:
    def test_updates_all_boards_config(self):
        db = MagicMock()
        config = _make_config()
        db.refresh.side_effect = lambda c: None

        result = update_config(db, config, "all", [], "today", "user-1")

        assert result.board_selection == "all"
        assert result.day_range == "today"
        assert result.selected_board_ids == []
        db.commit.assert_called_once()

    def test_updates_selected_boards_config(self):
        db = MagicMock()
        config = _make_config()
        board = _make_board("b1")
        db.query.return_value.filter.return_value.all.return_value = [board]
        db.refresh.side_effect = lambda c: None

        result = update_config(db, config, "selected", ["b1"], "today_tomorrow", "user-1")

        assert result.board_selection == "selected"
        assert result.selected_board_ids == ["b1"]

    def test_clears_selected_board_ids_when_switching_to_all(self):
        db = MagicMock()
        config = _make_config(board_selection="selected", selected_board_ids=["b1", "b2"])
        db.refresh.side_effect = lambda c: None

        update_config(db, config, "all", ["b1", "b2"], "today", "user-1")

        assert config.selected_board_ids == []

    def test_rejects_invalid_board_selection(self):
        db = MagicMock()
        config = _make_config()

        with pytest.raises(HTTPException) as exc:
            update_config(db, config, "weekly", [], "today", "user-1")
        assert exc.value.status_code == 400

    def test_rejects_invalid_day_range(self):
        db = MagicMock()
        config = _make_config()

        with pytest.raises(HTTPException) as exc:
            update_config(db, config, "all", [], "this_week", "user-1")
        assert exc.value.status_code == 400

    def test_rejects_selected_with_empty_board_ids(self):
        db = MagicMock()
        config = _make_config()

        with pytest.raises(HTTPException) as exc:
            update_config(db, config, "selected", [], "today", "user-1")
        assert exc.value.status_code == 400

    def test_rejects_board_ids_not_owned_by_user(self):
        db = MagicMock()
        config = _make_config()
        db.query.return_value.filter.return_value.all.return_value = []  # no owned boards found

        with pytest.raises(HTTPException) as exc:
            update_config(db, config, "selected", ["b-other"], "today", "user-1")
        assert exc.value.status_code == 400


# ── get_focused_tasks ─────────────────────────────────────────────────────────

class TestGetFocusedTasks:
    TODAY = date(2026, 6, 28)

    def _setup_db(self, boards, tasks):
        db = MagicMock()
        # boards query
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = boards
        # tasks query — chained filter().order_by().all()
        db.query.return_value.filter.return_value.order_by.return_value.all.side_effect = None
        # We need to handle two sequential query chains: boards then tasks
        # Use side_effect on the top-level query to return different mocks per call
        board_mock = MagicMock()
        board_mock.filter.return_value.order_by.return_value.all.return_value = boards
        task_mock = MagicMock()
        task_mock.filter.return_value.order_by.return_value.all.return_value = tasks
        db.query.side_effect = [board_mock, task_mock]
        return db

    def test_returns_empty_when_no_boards(self):
        db = MagicMock()
        board_mock = MagicMock()
        board_mock.filter.return_value.order_by.return_value.all.return_value = []
        db.query.return_value = board_mock
        config = _make_config()

        result = get_focused_tasks(db, "user-1", config, self.TODAY)

        assert result == []

    def test_omits_board_with_no_qualifying_tasks(self):
        board = _make_board("b1", name="Alpha")
        db = self._setup_db(boards=[board], tasks=[])

        config = _make_config()
        result = get_focused_tasks(db, "user-1", config, self.TODAY)

        assert result == []

    def test_returns_board_with_qualifying_tasks(self):
        board = _make_board("b1", name="Alpha")
        task = _make_task("t1", "b1", target_date=self.TODAY)
        db = self._setup_db(boards=[board], tasks=[task])

        config = _make_config()
        result = get_focused_tasks(db, "user-1", config, self.TODAY)

        assert len(result) == 1
        assert result[0]["board_id"] == "b1"
        assert result[0]["board_name"] == "Alpha"
        assert result[0]["tasks"] == [task]

    def test_boards_ordered_alphabetically(self):
        board_z = _make_board("bz", name="Zebra")
        board_a = _make_board("ba", name="Alpha")
        task_z = _make_task("t1", "bz", target_date=self.TODAY)
        task_a = _make_task("t2", "ba", target_date=self.TODAY)
        db = self._setup_db(boards=[board_a, board_z], tasks=[task_z, task_a])

        config = _make_config()
        result = get_focused_tasks(db, "user-1", config, self.TODAY)

        assert [r["board_name"] for r in result] == ["Alpha", "Zebra"]

    def test_board_color_included_in_result(self):
        board = _make_board("b1", name="Alpha", color="#ff0000")
        task = _make_task("t1", "b1", target_date=self.TODAY)
        db = self._setup_db(boards=[board], tasks=[task])

        config = _make_config()
        result = get_focused_tasks(db, "user-1", config, self.TODAY)

        assert result[0]["board_color"] == "#ff0000"

    def test_board_color_null_when_not_set(self):
        board = _make_board("b1", name="Alpha", color=None)
        task = _make_task("t1", "b1", target_date=self.TODAY)
        db = self._setup_db(boards=[board], tasks=[task])

        config = _make_config()
        result = get_focused_tasks(db, "user-1", config, self.TODAY)

        assert result[0]["board_color"] is None

    def test_selected_board_selection_filters_to_given_boards(self):
        board_a = _make_board("ba", name="Alpha")
        board_b = _make_board("bb", name="Beta")
        task_a = _make_task("t1", "ba", target_date=self.TODAY)
        # board_b has no tasks — should be omitted
        db = self._setup_db(boards=[board_a], tasks=[task_a])

        config = _make_config(board_selection="selected", selected_board_ids=["ba"])
        result = get_focused_tasks(db, "user-1", config, self.TODAY)

        assert len(result) == 1
        assert result[0]["board_id"] == "ba"

    def test_selected_board_selection_with_empty_list_returns_nothing(self):
        db = MagicMock()
        board_mock = MagicMock()
        board_mock.filter.return_value.order_by.return_value.all.return_value = []
        db.query.return_value = board_mock

        config = _make_config(board_selection="selected", selected_board_ids=[])
        result = get_focused_tasks(db, "user-1", config, self.TODAY)

        assert result == []


# ── get_day_view_tasks ────────────────────────────────────────────────────────

class TestGetDayViewTasks:
    TODAY = date(2026, 6, 28)

    def _setup_db(self, boards, tasks):
        db = MagicMock()
        board_mock = MagicMock()
        board_mock.filter.return_value.order_by.return_value.all.return_value = boards
        task_mock = MagicMock()
        task_mock.filter.return_value.order_by.return_value.all.return_value = tasks
        db.query.side_effect = [board_mock, task_mock]
        return db

    def test_returns_empty_when_no_boards(self):
        db = MagicMock()
        board_mock = MagicMock()
        board_mock.filter.return_value.order_by.return_value.all.return_value = []
        db.query.return_value = board_mock

        result = get_day_view_tasks(db, "user-1", self.TODAY)

        assert result == []

    def test_includes_any_priority_tasks(self):
        board = _make_board("b1", name="Alpha")
        hp_task = _make_task("t1", "b1", is_high_priority=True, target_date=self.TODAY)
        normal_task = _make_task("t2", "b1", is_high_priority=False, target_date=self.TODAY)
        db = self._setup_db(boards=[board], tasks=[hp_task, normal_task])

        result = get_day_view_tasks(db, "user-1", self.TODAY)

        assert len(result) == 1
        assert result[0]["tasks"] == [hp_task, normal_task]

    def test_all_boards_included_regardless_of_config(self):
        board_a = _make_board("ba", name="Alpha")
        board_b = _make_board("bb", name="Beta")
        task_a = _make_task("t1", "ba", target_date=self.TODAY)
        task_b = _make_task("t2", "bb", target_date=self.TODAY)
        db = self._setup_db(boards=[board_a, board_b], tasks=[task_a, task_b])

        result = get_day_view_tasks(db, "user-1", self.TODAY)

        assert {r["board_id"] for r in result} == {"ba", "bb"}

    def test_omits_board_with_no_qualifying_tasks(self):
        board = _make_board("b1", name="Alpha")
        db = self._setup_db(boards=[board], tasks=[])

        result = get_day_view_tasks(db, "user-1", self.TODAY)

        assert result == []

    def test_boards_ordered_alphabetically(self):
        board_z = _make_board("bz", name="Zebra")
        board_a = _make_board("ba", name="Alpha")
        task_z = _make_task("t1", "bz", target_date=self.TODAY)
        task_a = _make_task("t2", "ba", target_date=self.TODAY)
        db = self._setup_db(boards=[board_a, board_z], tasks=[task_z, task_a])

        result = get_day_view_tasks(db, "user-1", self.TODAY)

        assert [r["board_name"] for r in result] == ["Alpha", "Zebra"]

    def test_overdue_true_still_groups_and_orders_boards(self):
        board = _make_board("b1", name="Alpha")
        task = _make_task("t1", "b1", must_do_by=self.TODAY - timedelta(days=1))
        db = self._setup_db(boards=[board], tasks=[task])

        result = get_day_view_tasks(db, "user-1", self.TODAY, overdue=True)

        assert len(result) == 1
        assert result[0]["board_id"] == "b1"
        assert result[0]["tasks"] == [task]


# ── get_day_view_tasks date filter clause ────────────────────────────────────
#
# Unit tests mock the SQLAlchemy session, so they can't exercise real WHERE-clause
# evaluation against row data (no DB). Instead these capture the actual filter clause
# passed to `.filter(...)` and inspect its structure directly, to guard against a future
# edit silently inverting the "earliest of must_do_by/target_date" comparison (`<` vs `==`)
# or dropping a field from the OR — the class of bug a canned-return-value mock would never
# catch. Real end-to-end date-boundary behavior (including NULL handling) is covered by the
# integration suite in backend/tests/test_api.py.

class TestGetDayViewTasksDateFilterClause:
    TODAY = date(2026, 6, 28)

    def _capture_date_filter(self, overdue: bool) -> str:
        db = MagicMock()
        board_mock = MagicMock()
        board_mock.filter.return_value.order_by.return_value.all.return_value = [_make_board("b1")]
        task_mock = MagicMock()
        task_mock.filter.return_value.order_by.return_value.all.return_value = []
        db.query.side_effect = [board_mock, task_mock]

        get_day_view_tasks(db, "user-1", self.TODAY, overdue=overdue)

        args, _ = task_mock.filter.call_args
        return str(args[-1])

    def test_overdue_true_uses_less_than_on_both_fields(self):
        clause = self._capture_date_filter(overdue=True)
        assert "must_do_by <" in clause
        assert "target_date <" in clause
        assert " OR " in clause

    def test_overdue_false_uses_equality_on_both_fields(self):
        clause = self._capture_date_filter(overdue=False)
        assert "must_do_by =" in clause
        assert "target_date =" in clause
        assert " OR " in clause

    def test_overdue_defaults_to_false(self):
        db = MagicMock()
        board_mock = MagicMock()
        board_mock.filter.return_value.order_by.return_value.all.return_value = [_make_board("b1")]
        task_mock = MagicMock()
        task_mock.filter.return_value.order_by.return_value.all.return_value = []
        db.query.side_effect = [board_mock, task_mock]

        get_day_view_tasks(db, "user-1", self.TODAY)

        args, _ = task_mock.filter.call_args
        clause = str(args[-1])
        assert "must_do_by =" in clause
        assert "must_do_by <" not in clause


# ── order_by_sort_order tiebreak ────────────────────────────────────────────────

class TestQueryBoardGroupedTasksOrdering:
    TODAY = date(2026, 6, 28)

    def _capture_order_by(self, order_by_sort_order: bool) -> str:
        db = MagicMock()
        task_query = MagicMock()
        task_query.filter.return_value.order_by.return_value.all.return_value = []
        db.query.return_value = task_query

        _query_board_grouped_tasks(
            db, "user-1", [_make_board("b1")], Task.target_date == self.TODAY,
            high_priority_only=False, order_by_sort_order=order_by_sort_order,
        )

        args, _ = task_query.filter.return_value.order_by.call_args
        return " ".join(str(a) for a in args)

    def test_order_by_sort_order_true_uses_sort_order(self):
        clause = self._capture_order_by(True)
        assert "sort_order" in clause

    def test_order_by_sort_order_false_uses_updated_at(self):
        clause = self._capture_order_by(False)
        assert "updated_at" in clause
        assert "sort_order" not in clause

    def test_order_by_sort_order_defaults_to_false(self):
        db = MagicMock()
        task_query = MagicMock()
        task_query.filter.return_value.order_by.return_value.all.return_value = []
        db.query.return_value = task_query

        _query_board_grouped_tasks(
            db, "user-1", [_make_board("b1")], Task.target_date == self.TODAY,
            high_priority_only=False,
        )

        args, _ = task_query.filter.return_value.order_by.call_args
        clause = " ".join(str(a) for a in args)
        assert "updated_at" in clause
        assert "sort_order" not in clause

    def _setup_two_query_db(self, board, task):
        db = MagicMock()
        board_mock = MagicMock()
        board_mock.filter.return_value.order_by.return_value.all.return_value = [board]
        task_mock = MagicMock()
        task_mock.filter.return_value.order_by.return_value.all.return_value = [task]
        db.query.side_effect = [board_mock, task_mock]
        return db, task_mock

    def test_get_focused_tasks_orders_by_sort_order(self):
        board = _make_board("b1", name="Alpha")
        task = _make_task("t1", "b1", target_date=self.TODAY)
        db, task_mock = self._setup_two_query_db(board, task)

        get_focused_tasks(db, "user-1", _make_config(), self.TODAY)

        args, _ = task_mock.filter.return_value.order_by.call_args
        assert "sort_order" in " ".join(str(a) for a in args)

    def test_get_day_view_tasks_overdue_false_orders_by_sort_order(self):
        board = _make_board("b1", name="Alpha")
        task = _make_task("t1", "b1", target_date=self.TODAY)
        db, task_mock = self._setup_two_query_db(board, task)

        get_day_view_tasks(db, "user-1", self.TODAY, overdue=False)

        args, _ = task_mock.filter.return_value.order_by.call_args
        assert "sort_order" in " ".join(str(a) for a in args)

    def test_get_day_view_tasks_overdue_true_orders_by_updated_at(self):
        board = _make_board("b1", name="Alpha")
        task = _make_task("t1", "b1", must_do_by=self.TODAY - timedelta(days=1))
        db, task_mock = self._setup_two_query_db(board, task)

        get_day_view_tasks(db, "user-1", self.TODAY, overdue=True)

        args, _ = task_mock.filter.return_value.order_by.call_args
        clause = " ".join(str(a) for a in args)
        assert "updated_at" in clause
        assert "sort_order" not in clause
