"""Unit tests for reports_service — no database required."""

from datetime import date, datetime, timezone
from unittest.mock import MagicMock, patch

from app.models import Board, Task
from app.services.reports_service import get_completions


def _make_board(id: str, user_id: str = "user-1", name: str = "Board", color: str = None) -> Board:
    b = Board(id=id, user_id=user_id, name=name, is_default=False, is_deleted=False)
    b.color = color
    return b


def _make_task(id: str, board_id: str, title: str = None, user_id: str = "user-1") -> Task:
    t = Task(id=id, user_id=user_id, board_id=board_id, title=title or f"Task {id}")
    t.completed_at = datetime(2026, 6, 15, 12, 0, tzinfo=timezone.utc)
    t.labels = []
    return t


FROM = date(2026, 6, 1)
TO = date(2026, 6, 30)


class TestSingleBoardPath:
    def test_uses_explicit_board_id(self):
        db = MagicMock()
        ownership_mock = MagicMock()
        ownership_mock.filter.return_value.first.return_value = _make_board("b1")
        task_mock = MagicMock()
        task_mock.filter.return_value.order_by.return_value.all.return_value = [_make_task("t1", "b1")]
        db.query.side_effect = [ownership_mock, task_mock]

        result = get_completions(db, "user-1", FROM, TO, None, "b1", False)

        assert result.total == 1
        assert result.completions[0].task_id == "t1"
        assert result.boards is None

    def test_falls_back_to_default_board_when_board_id_none(self):
        db = MagicMock()
        seed_check_mock = MagicMock()
        seed_check_mock.filter.return_value.first.return_value = _make_board("default-b")
        task_mock = MagicMock()
        task_mock.filter.return_value.order_by.return_value.all.return_value = []
        db.query.side_effect = [seed_check_mock, task_mock]

        result = get_completions(db, "user-1", FROM, TO, None, None, False)

        assert result.total == 0
        assert result.boards is None

    def test_applies_label_filter(self):
        db = MagicMock()
        ownership_mock = MagicMock()
        ownership_mock.filter.return_value.first.return_value = _make_board("b1")
        task_mock = MagicMock()
        task_mock.filter.return_value.order_by.return_value.all.return_value = []
        db.query.side_effect = [ownership_mock, task_mock]

        get_completions(db, "user-1", FROM, TO, "l1,l2", "b1", False)

        # base filter() call, then one chained .filter() per label id
        assert task_mock.filter.call_count == 1
        assert task_mock.filter.return_value.filter.call_count == 1
        assert task_mock.filter.return_value.filter.return_value.filter.call_count == 1


@patch("app.services.reports_service.board_svc.ensure_board_seeded")
class TestAllBoardsPath:
    def _setup_db(self, boards, tasks):
        db = MagicMock()
        boards_mock = MagicMock()
        boards_mock.filter.return_value.order_by.return_value.all.return_value = boards
        task_mock = MagicMock()
        task_mock.filter.return_value.order_by.return_value.all.return_value = tasks
        db.query.side_effect = [boards_mock, task_mock]
        return db

    def test_returns_empty_boards_when_user_has_no_boards(self, mock_seed):
        db = self._setup_db(boards=[], tasks=[])

        result = get_completions(db, "user-1", FROM, TO, None, None, True)

        assert result.completions == []
        assert result.total == 0
        assert result.boards == []

    def test_groups_by_board_preserving_order(self, mock_seed):
        board_a = _make_board("ba", name="Alpha")
        board_z = _make_board("bz", name="Zebra")
        task_a = _make_task("t1", "ba")
        task_z = _make_task("t2", "bz")
        db = self._setup_db(boards=[board_a, board_z], tasks=[task_a, task_z])

        result = get_completions(db, "user-1", FROM, TO, None, None, True)

        assert [g.board_name for g in result.boards] == ["Alpha", "Zebra"]
        assert result.boards[0].completions[0].task_id == "t1"
        assert result.boards[1].completions[0].task_id == "t2"

    def test_omits_board_with_no_matching_completions(self, mock_seed):
        board_a = _make_board("ba", name="Alpha")
        board_b = _make_board("bb", name="Beta")
        task_a = _make_task("t1", "ba")
        db = self._setup_db(boards=[board_a, board_b], tasks=[task_a])

        result = get_completions(db, "user-1", FROM, TO, None, None, True)

        assert len(result.boards) == 1
        assert result.boards[0].board_id == "ba"

    def test_flat_completions_stay_in_completed_at_order_across_boards(self, mock_seed):
        board_a = _make_board("ba", name="Alpha")
        board_z = _make_board("bz", name="Zebra")
        # tasks pre-ordered by completed_at ascending, as the real query would return
        task_z = _make_task("t1", "bz")
        task_a = _make_task("t2", "ba")
        db = self._setup_db(boards=[board_a, board_z], tasks=[task_z, task_a])

        result = get_completions(db, "user-1", FROM, TO, None, None, True)

        assert [c.task_id for c in result.completions] == ["t1", "t2"]

    def test_board_color_included(self, mock_seed):
        board = _make_board("b1", name="Alpha", color="#ff0000")
        task = _make_task("t1", "b1")
        db = self._setup_db(boards=[board], tasks=[task])

        result = get_completions(db, "user-1", FROM, TO, None, None, True)

        assert result.boards[0].board_color == "#ff0000"

    def test_seeds_board_before_querying(self, mock_seed):
        db = self._setup_db(boards=[], tasks=[])

        get_completions(db, "user-1", FROM, TO, None, None, True)

        mock_seed.assert_called_once_with(db, "user-1")
