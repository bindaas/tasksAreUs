"""Unit tests for the day-view router — no database required.

Guards against a field validating via FastAPI/Pydantic but never reaching
the service, mirroring TestUpdateTaskLinksWiring / TestUpdateTaskBoardIdWiring
in test_tasks_router.py.
"""

from datetime import date
from unittest.mock import MagicMock, patch

from app.routers.day_view import get_day_view_tasks


class TestGetDayViewTasksWiring:
    @patch("app.routers.day_view.svc")
    def test_reference_date_reaches_service(self, mock_svc):
        mock_svc.get_day_view_tasks.return_value = []
        reference_date = date(2026, 6, 28)

        get_day_view_tasks(reference_date=reference_date, db=MagicMock(), user_id="user-1")

        args, _ = mock_svc.get_day_view_tasks.call_args
        assert args[2] == reference_date

    @patch("app.routers.day_view.svc")
    def test_user_id_reaches_service(self, mock_svc):
        mock_svc.get_day_view_tasks.return_value = []

        get_day_view_tasks(reference_date=date(2026, 6, 28), db=MagicMock(), user_id="user-42")

        args, _ = mock_svc.get_day_view_tasks.call_args
        assert args[1] == "user-42"

    @patch("app.routers.day_view.svc")
    def test_boards_from_service_reach_response(self, mock_svc):
        mock_svc.get_day_view_tasks.return_value = [
            {"board_id": "b1", "board_name": "Alpha", "board_color": None, "tasks": []}
        ]

        result = get_day_view_tasks(reference_date=date(2026, 6, 28), db=MagicMock(), user_id="user-1")

        assert len(result.boards) == 1
        assert result.boards[0].board_id == "b1"

    @patch("app.routers.day_view.svc")
    def test_overdue_true_reaches_service(self, mock_svc):
        mock_svc.get_day_view_tasks.return_value = []

        get_day_view_tasks(
            reference_date=date(2026, 6, 28), overdue=True, db=MagicMock(), user_id="user-1"
        )

        assert mock_svc.get_day_view_tasks.call_args.kwargs["overdue"] is True

    @patch("app.routers.day_view.svc")
    def test_overdue_false_reaches_service(self, mock_svc):
        # Calling the route function directly bypasses FastAPI's Query-default
        # resolution, so `overdue` is passed explicitly here to simulate what
        # FastAPI injects for an omitted `?overdue=` param (its declared default
        # is `Query(default=False)`).
        mock_svc.get_day_view_tasks.return_value = []

        get_day_view_tasks(
            reference_date=date(2026, 6, 28), overdue=False, db=MagicMock(), user_id="user-1"
        )

        assert mock_svc.get_day_view_tasks.call_args.kwargs["overdue"] is False
