"""Unit tests for task_service.py — no database required."""

from datetime import date, timedelta
from unittest.mock import MagicMock, call, patch

import pytest

from fastapi import HTTPException

from app.models import StateEnum
from app.services.task_service import (
    HIGH_PRIORITY_DAILY_LIMIT,
    _count_high_priority_for_date,
    _effective_date,
    _get_high_priority_limit,
    _is_hp_eligible_date,
    complete_task,
    update_task,
)


# ── complete_task ─────────────────────────────────────────────────────────────

class TestCompleteTask:
    def _make_task(self, state=StateEnum.pending, labels=None):
        task = MagicMock()
        task.state = state
        task.labels = labels or []
        task.recurrence_group_id = None
        task.must_do_by = None
        task.notes = None
        return task

    def _make_db(self):
        db = MagicMock()
        db.flush = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()
        return db

    def test_returns_none_next_task(self):
        task = self._make_task()
        db = self._make_db()
        completed, next_task = complete_task(db, task, notes=None)
        assert next_task is None
        assert completed is task

    def test_returns_none_next_task_even_with_legacy_frequency_label(self):
        label = MagicMock()
        label.category = "frequency"
        label.value = "weekly"
        task = self._make_task(labels=[label])
        db = self._make_db()
        _, next_task = complete_task(db, task, notes=None)
        assert next_task is None

    def test_raises_422_if_already_completed(self):
        task = self._make_task(state=StateEnum.done)
        db = self._make_db()
        with pytest.raises(Exception) as exc_info:
            complete_task(db, task, notes=None)
        assert exc_info.value.status_code == 422


# ── update_task date clearing ─────────────────────────────────────────────────

class TestUpdateTaskDateClearing:
    def _make_task(self, must_do_by=None, target_date=None):
        task = MagicMock()
        task.id = "task-1"
        task.must_do_by = must_do_by
        task.target_date = target_date
        task.labels = []
        return task

    def _make_db(self, task):
        db = MagicMock()
        db.query.return_value.filter.return_value.delete.return_value = None
        db.commit.return_value = None
        db.refresh.return_value = None
        # Make refresh update the task reference the caller holds
        db.refresh.side_effect = lambda t: None
        return db

    def test_clear_must_do_by_sets_none(self):
        task = self._make_task(must_do_by=date(2026, 6, 1))
        db = self._make_db(task)
        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, clear_must_do_by=True)
        assert task.must_do_by is None

    def test_clear_target_date_sets_none(self):
        task = self._make_task(target_date=date(2026, 6, 1))
        db = self._make_db(task)
        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, clear_target_date=True)
        assert task.target_date is None

    def test_clear_both_dates(self):
        task = self._make_task(must_do_by=date(2026, 6, 1), target_date=date(2026, 6, 5))
        db = self._make_db(task)
        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None,
                    clear_must_do_by=True, clear_target_date=True)
        assert task.must_do_by is None
        assert task.target_date is None

    def test_set_must_do_by_without_clear(self):
        task = self._make_task()
        db = self._make_db(task)
        new_date = date(2026, 7, 1)
        update_task(db, task, title=None, notes=None, must_do_by=new_date,
                    target_date=None, label_ids=None)
        assert task.must_do_by == new_date

    def test_none_must_do_by_without_clear_flag_is_noop(self):
        original = date(2026, 6, 1)
        task = self._make_task(must_do_by=original)
        db = self._make_db(task)
        # Sending must_do_by=None without clear_must_do_by=True should not clear
        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, clear_must_do_by=False)
        assert task.must_do_by == original

    def test_update_title(self):
        task = self._make_task()
        db = self._make_db(task)
        update_task(db, task, title="New title", notes=None, must_do_by=None,
                    target_date=None, label_ids=None)
        assert task.title == "New title"

    def test_title_none_is_noop(self):
        task = self._make_task()
        task.title = "Original"
        db = self._make_db(task)
        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None)
        assert task.title == "Original"


# ── _effective_date ───────────────────────────────────────────────────────────

class TestEffectiveDate:
    def test_both_set_returns_earlier(self):
        assert _effective_date(date(2026, 6, 1), date(2026, 6, 5)) == date(2026, 6, 1)

    def test_both_set_target_is_earlier(self):
        assert _effective_date(date(2026, 6, 5), date(2026, 6, 1)) == date(2026, 6, 1)

    def test_only_must_do_by(self):
        assert _effective_date(date(2026, 6, 1), None) == date(2026, 6, 1)

    def test_only_target_date(self):
        assert _effective_date(None, date(2026, 6, 1)) == date(2026, 6, 1)

    def test_both_none(self):
        assert _effective_date(None, None) is None


# ── _is_hp_eligible_date ──────────────────────────────────────────────────────

class TestIsHpEligibleDate:
    def test_today(self):
        assert _is_hp_eligible_date(date.today()) is True

    def test_tomorrow(self):
        assert _is_hp_eligible_date(date.today() + timedelta(days=1)) is True

    def test_yesterday_is_eligible(self):
        assert _is_hp_eligible_date(date.today() - timedelta(days=1)) is True

    def test_far_past_is_eligible(self):
        assert _is_hp_eligible_date(date.today() - timedelta(days=30)) is True

    def test_two_days_ahead_ineligible(self):
        assert _is_hp_eligible_date(date.today() + timedelta(days=2)) is False

    def test_none(self):
        assert _is_hp_eligible_date(None) is False


# ── update_task high-priority auto-reset ──────────────────────────────────────

class TestUpdateTaskHighPriority:
    def _make_task(self, must_do_by=None, target_date=None, is_high_priority=False):
        task = MagicMock()
        task.id = "task-1"
        task.must_do_by = must_do_by
        task.target_date = target_date
        task.is_high_priority = is_high_priority
        task.labels = []
        return task

    def _make_db(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.delete.return_value = None
        db.commit.return_value = None
        db.refresh.side_effect = lambda t: None
        return db

    @patch("app.services.task_service._count_high_priority_for_date", return_value=0)
    def test_set_high_priority_for_today(self, _count):
        today = date.today()
        task = self._make_task(must_do_by=today)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=True,
                    high_priority_limit=HIGH_PRIORITY_DAILY_LIMIT)
        assert task.is_high_priority is True

    @patch("app.services.task_service._count_high_priority_for_date", return_value=0)
    def test_set_high_priority_for_tomorrow(self, _count):
        tomorrow = date.today() + timedelta(days=1)
        task = self._make_task(target_date=tomorrow)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=True,
                    high_priority_limit=HIGH_PRIORITY_DAILY_LIMIT)
        assert task.is_high_priority is True

    def test_auto_reset_when_date_moves_to_upcoming(self):
        today = date.today()
        future = today + timedelta(days=7)
        task = self._make_task(must_do_by=today, is_high_priority=True)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=future,
                    target_date=None, label_ids=None)
        assert task.is_high_priority is False

    def test_auto_reset_when_date_cleared(self):
        today = date.today()
        task = self._make_task(must_do_by=today, is_high_priority=True)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, clear_must_do_by=True)
        assert task.is_high_priority is False

    def test_explicit_false_clears_priority(self):
        today = date.today()
        task = self._make_task(must_do_by=today, is_high_priority=True)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=False)
        assert task.is_high_priority is False

    def test_none_is_high_priority_preserves_existing_for_today(self):
        today = date.today()
        task = self._make_task(must_do_by=today, is_high_priority=True)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=None)
        assert task.is_high_priority is True

    def test_cannot_set_high_priority_for_upcoming(self):
        future = date.today() + timedelta(days=5)
        task = self._make_task(must_do_by=future)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=True)
        assert task.is_high_priority is False

    @patch("app.services.task_service._count_high_priority_for_date", return_value=0)
    def test_set_high_priority_for_overdue(self, _count):
        yesterday = date.today() - timedelta(days=1)
        task = self._make_task(must_do_by=yesterday)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=True,
                    high_priority_limit=HIGH_PRIORITY_DAILY_LIMIT)
        assert task.is_high_priority is True

    def test_preserves_high_priority_for_overdue(self):
        yesterday = date.today() - timedelta(days=1)
        task = self._make_task(must_do_by=yesterday, is_high_priority=True)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=None)
        assert task.is_high_priority is True


# ── high-priority daily limit ──────────────────────────────────────────────────

class TestHighPriorityDailyLimit:
    def _make_task(self, task_id="task-1", must_do_by=None, is_high_priority=False):
        task = MagicMock()
        task.id = task_id
        task.user_id = "user-1"
        task.must_do_by = must_do_by
        task.target_date = None
        task.is_high_priority = is_high_priority
        task.labels = []
        return task

    def _make_db(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.delete.return_value = None
        db.commit.return_value = None
        db.refresh.side_effect = lambda t: None
        return db

    @patch("app.services.task_service._count_high_priority_for_date", return_value=HIGH_PRIORITY_DAILY_LIMIT)
    def test_update_raises_422_when_daily_limit_reached(self, _count):
        today = date.today()
        task = self._make_task(must_do_by=today, is_high_priority=False)
        with pytest.raises(HTTPException) as exc:
            update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                        target_date=None, label_ids=None, is_high_priority=True,
                        high_priority_limit=HIGH_PRIORITY_DAILY_LIMIT)
        assert exc.value.status_code == 422

    @patch("app.services.task_service._count_high_priority_for_date", return_value=HIGH_PRIORITY_DAILY_LIMIT - 1)
    def test_update_succeeds_when_below_limit(self, _count):
        today = date.today()
        task = self._make_task(must_do_by=today, is_high_priority=False)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=True,
                    high_priority_limit=HIGH_PRIORITY_DAILY_LIMIT)
        assert task.is_high_priority is True

    @patch("app.services.task_service._count_high_priority_for_date", return_value=HIGH_PRIORITY_DAILY_LIMIT)
    def test_update_no_check_when_priority_not_explicitly_set(self, mock_count):
        today = date.today()
        task = self._make_task(must_do_by=today, is_high_priority=True)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=None,
                    high_priority_limit=HIGH_PRIORITY_DAILY_LIMIT)
        mock_count.assert_not_called()

    @patch("app.services.task_service._count_high_priority_for_date", return_value=HIGH_PRIORITY_DAILY_LIMIT)
    def test_update_no_check_when_priority_explicitly_false(self, mock_count):
        today = date.today()
        task = self._make_task(must_do_by=today, is_high_priority=True)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=False,
                    high_priority_limit=HIGH_PRIORITY_DAILY_LIMIT)
        mock_count.assert_not_called()
        assert task.is_high_priority is False

    @patch("app.services.task_service._count_high_priority_for_date", return_value=4)
    def test_update_respects_custom_limit(self, _count):
        today = date.today()
        task = self._make_task(must_do_by=today, is_high_priority=False)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=True,
                    high_priority_limit=5)
        assert task.is_high_priority is True

    @patch("app.services.task_service._count_high_priority_for_date", return_value=5)
    def test_update_raises_422_when_custom_limit_reached(self, _count):
        today = date.today()
        task = self._make_task(must_do_by=today, is_high_priority=False)
        with pytest.raises(HTTPException) as exc:
            update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                        target_date=None, label_ids=None, is_high_priority=True,
                        high_priority_limit=5)
        assert exc.value.status_code == 422


# ── _get_high_priority_limit ──────────────────────────────────────────────────

class TestGetHighPriorityLimit:
    def _make_settings(self, limit):
        s = MagicMock()
        s.high_priority_daily_limit = limit
        return s

    def _make_db(self, settings_row):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = settings_row
        return db

    def test_returns_configured_limit(self):
        db = self._make_db(self._make_settings(5))
        assert _get_high_priority_limit(db, "user-1") == 5

    def test_returns_default_when_no_row(self):
        db = self._make_db(None)
        assert _get_high_priority_limit(db, "user-1") == HIGH_PRIORITY_DAILY_LIMIT

    def test_returns_default_when_limit_is_none(self):
        db = self._make_db(self._make_settings(None))
        assert _get_high_priority_limit(db, "user-1") == HIGH_PRIORITY_DAILY_LIMIT


# ── _count_high_priority_for_date ─────────────────────────────────────────────

class TestCountHighPriorityForDate:
    def _make_hp_task(self, task_id, must_do_by):
        t = MagicMock()
        t.id = task_id
        t.must_do_by = must_do_by
        t.target_date = None
        return t

    def _make_db(self, tasks):
        db = MagicMock()
        q = MagicMock()
        q.filter.return_value = q
        q.all.return_value = tasks
        db.query.return_value = q
        return db

    def test_counts_tasks_for_matching_date(self):
        today = date.today()
        tasks = [
            self._make_hp_task("t1", today),
            self._make_hp_task("t2", today),
        ]
        db = self._make_db(tasks)
        count = _count_high_priority_for_date(db, "user-1", today)
        assert count == 2

    def test_excludes_task_id(self):
        today = date.today()
        tasks = [
            self._make_hp_task("t1", today),
            self._make_hp_task("t2", today),
        ]
        db = self._make_db(tasks)
        count = _count_high_priority_for_date(db, "user-1", today, exclude_task_id="t1")
        assert count == 1

    def test_returns_zero_for_none_date(self):
        db = MagicMock()
        count = _count_high_priority_for_date(db, "user-1", None)
        assert count == 0
        db.query.assert_not_called()
