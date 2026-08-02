"""Unit tests for tasks router — no database required.

These specifically guard against a class of bug where a field validates via
Pydantic (TaskCreate/TaskUpdate) but is never threaded into the explicit
kwargs passed to task_service, and is silently discarded.
"""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from app.models import StateEnum, Task
from app.routers.tasks import create_task, update_task
from app.schemas import TaskCreate, TaskLink, TaskUpdate


def _make_task(**overrides) -> Task:
    now = datetime.now(timezone.utc)
    defaults = dict(
        id="task-1", user_id="user-1", board_id="board-1", title="Test", notes=None,
        state=StateEnum.pending, must_do_by=None, target_date=None,
        completed_at=None, is_high_priority=False, is_deleted=False,
        links=[], sort_order=100.0, created_at=now, updated_at=now,
    )
    defaults.update(overrides)
    return Task(**defaults)


def _link(id="l1", url="https://example.com", description="Example"):
    return TaskLink(id=id, url=url, description=description)


# ── create_task ──────────────────────────────────────────────────────────────

class TestCreateTaskLinksWiring:
    @patch("app.routers.tasks._get_high_priority_limit", return_value=3)
    @patch("app.routers.tasks.board_svc")
    @patch("app.routers.tasks.svc")
    def test_links_reach_task_service(self, mock_svc, mock_board_svc, _limit):
        mock_board_svc.resolve_board_id.return_value = "board-1"
        mock_svc.create_task.return_value = _make_task()
        body = TaskCreate(title="Test", links=[_link()])

        create_task(body=body, db=MagicMock(), user_id="user-1")

        _, kwargs = mock_svc.create_task.call_args
        assert kwargs["links"] == [{"id": "l1", "url": "https://example.com", "description": "Example"}]

    @patch("app.routers.tasks._get_high_priority_limit", return_value=3)
    @patch("app.routers.tasks.board_svc")
    @patch("app.routers.tasks.svc")
    def test_no_links_passes_empty_list(self, mock_svc, mock_board_svc, _limit):
        mock_board_svc.resolve_board_id.return_value = "board-1"
        mock_svc.create_task.return_value = _make_task()
        body = TaskCreate(title="Test")

        create_task(body=body, db=MagicMock(), user_id="user-1")

        _, kwargs = mock_svc.create_task.call_args
        assert kwargs["links"] == []


# ── update_task ──────────────────────────────────────────────────────────────

class TestUpdateTaskLinksWiring:
    @patch("app.routers.tasks._get_high_priority_limit", return_value=3)
    @patch("app.routers.tasks.svc")
    def test_provided_links_reach_task_service(self, mock_svc, _limit):
        mock_svc.get_task_or_404.return_value = _make_task()
        mock_svc.update_task.return_value = _make_task()
        body = TaskUpdate(links=[_link(id="l2", url="https://new.example.com", description="New")])

        update_task(task_id="task-1", body=body, db=MagicMock(), user_id="user-1")

        _, kwargs = mock_svc.update_task.call_args
        assert kwargs["links"] == [{"id": "l2", "url": "https://new.example.com", "description": "New"}]

    @patch("app.routers.tasks._get_high_priority_limit", return_value=3)
    @patch("app.routers.tasks.svc")
    def test_explicit_empty_list_reaches_task_service(self, mock_svc, _limit):
        mock_svc.get_task_or_404.return_value = _make_task()
        mock_svc.update_task.return_value = _make_task()
        body = TaskUpdate(links=[])

        update_task(task_id="task-1", body=body, db=MagicMock(), user_id="user-1")

        _, kwargs = mock_svc.update_task.call_args
        assert kwargs["links"] == []

    @patch("app.routers.tasks._get_high_priority_limit", return_value=3)
    @patch("app.routers.tasks.svc")
    def test_omitted_links_passes_none(self, mock_svc, _limit):
        mock_svc.get_task_or_404.return_value = _make_task()
        mock_svc.update_task.return_value = _make_task()
        body = TaskUpdate(title="New title")

        update_task(task_id="task-1", body=body, db=MagicMock(), user_id="user-1")

        _, kwargs = mock_svc.update_task.call_args
        assert kwargs["links"] is None


class TestUpdateTaskBoardIdWiring:
    @patch("app.routers.tasks._get_high_priority_limit", return_value=3)
    @patch("app.routers.tasks.svc")
    def test_provided_board_id_reaches_task_service(self, mock_svc, _limit):
        mock_svc.get_task_or_404.return_value = _make_task()
        mock_svc.update_task.return_value = _make_task()
        body = TaskUpdate(board_id="board-2")

        update_task(task_id="task-1", body=body, db=MagicMock(), user_id="user-1")

        _, kwargs = mock_svc.update_task.call_args
        assert kwargs["board_id"] == "board-2"

    @patch("app.routers.tasks._get_high_priority_limit", return_value=3)
    @patch("app.routers.tasks.svc")
    def test_omitted_board_id_passes_none(self, mock_svc, _limit):
        mock_svc.get_task_or_404.return_value = _make_task()
        mock_svc.update_task.return_value = _make_task()
        body = TaskUpdate(title="New title")

        update_task(task_id="task-1", body=body, db=MagicMock(), user_id="user-1")

        _, kwargs = mock_svc.update_task.call_args
        assert kwargs["board_id"] is None


class TestUpdateTaskSortOrderWiring:
    @patch("app.routers.tasks._get_high_priority_limit", return_value=3)
    @patch("app.routers.tasks.svc")
    def test_provided_sort_order_reaches_task_service(self, mock_svc, _limit):
        mock_svc.get_task_or_404.return_value = _make_task()
        mock_svc.update_task.return_value = _make_task()
        body = TaskUpdate(sort_order=42.5)

        update_task(task_id="task-1", body=body, db=MagicMock(), user_id="user-1")

        _, kwargs = mock_svc.update_task.call_args
        assert kwargs["sort_order"] == 42.5

    @patch("app.routers.tasks._get_high_priority_limit", return_value=3)
    @patch("app.routers.tasks.svc")
    def test_omitted_sort_order_passes_none(self, mock_svc, _limit):
        mock_svc.get_task_or_404.return_value = _make_task()
        mock_svc.update_task.return_value = _make_task()
        body = TaskUpdate(title="New title")

        update_task(task_id="task-1", body=body, db=MagicMock(), user_id="user-1")

        _, kwargs = mock_svc.update_task.call_args
        assert kwargs["sort_order"] is None
