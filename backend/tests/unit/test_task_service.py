"""Unit tests for task_service.py — no database required."""

from datetime import date
from unittest.mock import MagicMock, call, patch

import pytest

from app.services.task_service import (
    _get_frequency_label,
    _next_due_date,
    update_task,
)


# ── _next_due_date ────────────────────────────────────────────────────────────

class TestNextDueDate:
    def test_daily(self):
        assert _next_due_date(date(2026, 5, 25), "daily") == date(2026, 5, 26)

    def test_weekly(self):
        assert _next_due_date(date(2026, 5, 25), "weekly") == date(2026, 6, 1)

    def test_monthly(self):
        assert _next_due_date(date(2026, 5, 25), "monthly") == date(2026, 6, 25)

    def test_annual(self):
        assert _next_due_date(date(2026, 5, 25), "annual") == date(2027, 5, 25)

    def test_monthly_end_of_month(self):
        # dateutil clamps Jan 31 + 1 month to Feb 28
        result = _next_due_date(date(2026, 1, 31), "monthly")
        assert result == date(2026, 2, 28)

    def test_unknown_frequency_returns_base(self):
        base = date(2026, 5, 25)
        assert _next_due_date(base, "quarterly") == base


# ── _get_frequency_label ──────────────────────────────────────────────────────

class TestGetFrequencyLabel:
    def _make_label(self, category: str, value: str):
        label = MagicMock()
        label.category = category
        label.value = value
        return label

    def test_returns_frequency_label(self):
        task = MagicMock()
        task.labels = [
            self._make_label("mode", "online"),
            self._make_label("frequency", "weekly"),
        ]
        assert _get_frequency_label(task) == "weekly"

    def test_returns_none_when_no_frequency_label(self):
        task = MagicMock()
        task.labels = [self._make_label("mode", "online")]
        assert _get_frequency_label(task) is None

    def test_ignores_unknown_frequency_value(self):
        task = MagicMock()
        task.labels = [self._make_label("frequency", "quarterly")]
        assert _get_frequency_label(task) is None

    def test_returns_none_for_empty_labels(self):
        task = MagicMock()
        task.labels = []
        assert _get_frequency_label(task) is None


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
