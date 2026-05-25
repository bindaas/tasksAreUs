"""Unit tests for ai_service helpers — no API calls required."""

from datetime import date
from unittest.mock import MagicMock

import pytest

from app.services.ai_service import _format_task_line


def _make_task(title, must_do_by=None, target_date=None, labels=None):
    t = MagicMock()
    t.id = "task-abc"
    t.title = title
    t.must_do_by = must_do_by
    t.target_date = target_date
    t.labels = labels or []
    return t


class TestFormatTaskLine:
    def test_title_only(self):
        t = _make_task("Buy milk")
        line = _format_task_line(t)
        assert "[task-abc] Buy milk" in line
        assert "must-do" not in line
        assert "target" not in line
        assert "labels" not in line

    def test_must_do_by_included(self):
        t = _make_task("Pay rent", must_do_by=date(2026, 5, 31))
        line = _format_task_line(t)
        assert "(must-do: 2026-05-31)" in line
        assert "target" not in line

    def test_target_date_included(self):
        t = _make_task("Draft report", target_date=date(2026, 6, 5))
        line = _format_task_line(t)
        assert "(target: 2026-06-05)" in line
        assert "must-do" not in line

    def test_both_dates_included(self):
        t = _make_task("Tax return", must_do_by=date(2026, 5, 31), target_date=date(2026, 5, 25))
        line = _format_task_line(t)
        assert "(must-do: 2026-05-31)" in line
        assert "(target: 2026-05-25)" in line

    def test_labels_included(self):
        label = MagicMock()
        label.value = "weekly"
        t = _make_task("Exercise", labels=[label])
        line = _format_task_line(t)
        assert "[labels: weekly]" in line

    def test_notes_included(self):
        t = _make_task("Call doctor", must_do_by=date(2026, 6, 1))
        t.notes = "Call Dr Smith at 555-1234"
        line = _format_task_line(t)
        assert "(notes: Call Dr Smith at 555-1234)" in line

    def test_long_notes_truncated_at_120_chars(self):
        t = _make_task("Long task")
        t.notes = "x" * 130
        line = _format_task_line(t)
        assert "(notes: " + "x" * 120 + "…)" in line
        assert "x" * 121 not in line

    def test_both_dates_and_labels(self):
        label = MagicMock()
        label.value = "financial"
        t = _make_task(
            "File taxes",
            must_do_by=date(2026, 4, 15),
            target_date=date(2026, 4, 1),
            labels=[label],
        )
        line = _format_task_line(t)
        assert "(must-do: 2026-04-15)" in line
        assert "(target: 2026-04-01)" in line
        assert "[labels: financial]" in line
