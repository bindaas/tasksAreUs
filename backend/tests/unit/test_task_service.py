"""Unit tests for task_service.py — no database required."""

from datetime import date, timedelta
from unittest.mock import MagicMock, call, patch

import pytest

from fastapi import HTTPException

from app.models import StateEnum, Task, _sort_order_default
from app.services.task_service import (
    HIGH_PRIORITY_DAILY_LIMIT,
    _count_high_priority_for_date,
    _effective_date,
    _get_high_priority_limit,
    _is_hp_eligible_date,
    complete_task,
    create_task,
    reopen_task,
    update_task,
)


# ── complete_task ─────────────────────────────────────────────────────────────

class TestCompleteTask:
    def _make_task(self, state=StateEnum.pending, labels=None):
        task = MagicMock()
        task.state = state
        task.labels = labels or []
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

    def test_raises_422_if_already_completed(self):
        task = self._make_task(state=StateEnum.done)
        db = self._make_db()
        with pytest.raises(HTTPException) as exc_info:
            complete_task(db, task, notes=None)
        assert exc_info.value.status_code == 422


# ── reopen_task ─────────────────────────────────────────────────────────────

class TestReopenTask:
    def _make_task(self, state=StateEnum.done, is_high_priority=False, sort_order=1.0):
        task = MagicMock()
        task.state = state
        task.completed_at = "2026-08-01T12:00:00Z"
        task.is_high_priority = is_high_priority
        task.sort_order = sort_order
        return task

    def _make_db(self):
        db = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()
        return db

    def test_resets_state_and_completed_at(self):
        task = self._make_task()
        db = self._make_db()
        result = reopen_task(db, task)
        assert result is task
        assert task.state == StateEnum.pending
        assert task.completed_at is None

    def test_resets_sort_order(self):
        task = self._make_task(sort_order=1.0)
        db = self._make_db()
        reopen_task(db, task)
        assert task.sort_order != 1.0
        assert task.sort_order == pytest.approx(_sort_order_default(), abs=5)

    def test_raises_422_if_not_completed(self):
        task = self._make_task(state=StateEnum.pending)
        db = self._make_db()
        with pytest.raises(HTTPException) as exc_info:
            reopen_task(db, task)
        assert exc_info.value.status_code == 422

    def test_is_high_priority_survives_unchanged_even_over_daily_cap(self):
        # No re-validation against the daily high-priority limit happens on reopen —
        # a task that was high-priority when completed stays high-priority when
        # reopened, even if that would now exceed HIGH_PRIORITY_DAILY_LIMIT for its
        # date. This is a deliberate choice (see task_service.reopen_task's comment),
        # not an oversight — pin it down so it doesn't regress silently.
        task = self._make_task(is_high_priority=True)
        db = self._make_db()
        reopen_task(db, task)
        assert task.is_high_priority is True

    def test_commits_and_refreshes(self):
        task = self._make_task()
        db = self._make_db()
        reopen_task(db, task)
        db.commit.assert_called_once()
        db.refresh.assert_called_once_with(task)


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

    def test_two_days_ahead_eligible(self):
        assert _is_hp_eligible_date(date.today() + timedelta(days=2)) is True

    @patch("app.services.task_service.date")
    def test_three_days_ahead_ineligible(self, mock_date):
        monday = date(2026, 5, 25)
        mock_date.today.return_value = monday
        assert _is_hp_eligible_date(monday + timedelta(days=3)) is False

    def test_none(self):
        assert _is_hp_eligible_date(None) is False

    @patch("app.services.task_service.date")
    def test_monday_eligible_on_friday(self, mock_date):
        friday = date(2026, 5, 29)
        mock_date.today.return_value = friday
        assert _is_hp_eligible_date(friday + timedelta(days=3)) is True

    @patch("app.services.task_service.date")
    def test_monday_ineligible_when_not_friday(self, mock_date):
        monday = date(2026, 5, 25)
        mock_date.today.return_value = monday
        assert _is_hp_eligible_date(monday + timedelta(days=3)) is False


# ── update_task high-priority auto-reset ──────────────────────────────────────

class TestUpdateTaskHighPriority:
    def _make_task(self, must_do_by=None, target_date=None, is_high_priority=False, priority=None):
        task = MagicMock()
        task.id = "task-1"
        task.must_do_by = must_do_by
        task.target_date = target_date
        task.is_high_priority = is_high_priority
        task.priority = priority if priority is not None else ("high" if is_high_priority else "normal")
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
    def _make_task(self, task_id="task-1", must_do_by=None, is_high_priority=False, priority=None):
        task = MagicMock()
        task.id = task_id
        task.user_id = "user-1"
        task.must_do_by = must_do_by
        task.target_date = None
        task.is_high_priority = is_high_priority
        task.priority = priority if priority is not None else ("high" if is_high_priority else "normal")
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


# ── update_task priority tiers (High/Medium/Normal) ────────────────────────────
# See PLAN-feat-priority-tiers.md for the field-resolution rule and the documented
# pre-existing overdue+cap discrepancy this pins down rather than "fixes".

class TestUpdateTaskPriorityTiers:
    def _make_task(self, must_do_by=None, target_date=None, priority="normal"):
        task = MagicMock()
        task.id = "task-1"
        task.user_id = "user-1"
        task.must_do_by = must_do_by
        task.target_date = target_date
        task.priority = priority
        task.is_high_priority = (priority == "high")
        task.labels = []
        return task

    def _make_db(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.delete.return_value = None
        db.commit.return_value = None
        db.refresh.side_effect = lambda t: None
        return db

    @patch("app.services.task_service._count_high_priority_for_date", return_value=0)
    def test_set_medium_for_today(self, _count):
        today = date.today()
        task = self._make_task(must_do_by=today)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, priority="medium")
        assert task.priority == "medium"
        assert task.is_high_priority is False
        _count.assert_not_called()

    def test_medium_auto_resets_to_normal_when_date_moves_to_upcoming(self):
        today = date.today()
        future = today + timedelta(days=7)
        task = self._make_task(must_do_by=today, priority="medium")
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=future,
                    target_date=None, label_ids=None)
        assert task.priority == "normal"

    def test_high_auto_resets_to_normal_when_date_moves_to_upcoming(self):
        today = date.today()
        future = today + timedelta(days=7)
        task = self._make_task(must_do_by=today, priority="high")
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=future,
                    target_date=None, label_ids=None)
        assert task.priority == "normal"
        assert task.is_high_priority is False

    @patch("app.services.task_service._count_high_priority_for_date", return_value=HIGH_PRIORITY_DAILY_LIMIT)
    def test_cap_check_not_applied_when_setting_medium(self, mock_count):
        today = date.today()
        task = self._make_task(must_do_by=today)
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, priority="medium",
                    high_priority_limit=HIGH_PRIORITY_DAILY_LIMIT)
        mock_count.assert_not_called()
        assert task.priority == "medium"

    @patch("app.services.task_service._count_high_priority_for_date", return_value=HIGH_PRIORITY_DAILY_LIMIT)
    def test_cap_check_applies_when_priority_field_explicitly_set_to_high(self, mock_count):
        today = date.today()
        task = self._make_task(must_do_by=today)
        with pytest.raises(HTTPException) as exc:
            update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                        target_date=None, label_ids=None, priority="high",
                        high_priority_limit=HIGH_PRIORITY_DAILY_LIMIT)
        assert exc.value.status_code == 422

    def test_explicit_priority_field_takes_precedence_over_legacy_field(self):
        today = date.today()
        task = self._make_task(must_do_by=today, priority="medium")
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, priority="normal", is_high_priority=True)
        assert task.priority == "normal"

    # ── Sneezy Blocker fix: legacy is_high_priority writes must never clobber a medium ──

    def test_legacy_is_high_priority_true_does_not_overwrite_existing_medium(self):
        today = date.today()
        task = self._make_task(must_do_by=today, priority="medium")
        update_task(self._make_db(), task, title="Unrelated edit", notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=True)
        assert task.priority == "medium"
        assert task.is_high_priority is False

    def test_legacy_is_high_priority_false_does_not_overwrite_existing_medium(self):
        today = date.today()
        task = self._make_task(must_do_by=today, priority="medium")
        update_task(self._make_db(), task, title="Unrelated edit", notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=False)
        assert task.priority == "medium"
        assert task.is_high_priority is False

    @patch("app.services.task_service._count_high_priority_for_date", return_value=0)
    def test_legacy_is_high_priority_true_still_toggles_normal_to_high(self, _count):
        # Legacy on/off semantics are preserved for tasks that were NOT medium — this is
        # the exact behavior an un-updated mobile client relies on.
        today = date.today()
        task = self._make_task(must_do_by=today, priority="normal")
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=True)
        assert task.priority == "high"
        assert task.is_high_priority is True

    def test_legacy_is_high_priority_false_still_toggles_high_to_normal(self):
        today = date.today()
        task = self._make_task(must_do_by=today, priority="high")
        update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, is_high_priority=False)
        assert task.priority == "normal"
        assert task.is_high_priority is False

    # ── Sneezy Risk: overdue+cap discrepancy — pinned down as documented current behavior,
    # not silently "fixed" as part of this migration (see PLAN's Cap check section) ──

    @patch("app.services.task_service._count_high_priority_for_date", return_value=HIGH_PRIORITY_DAILY_LIMIT)
    def test_overdue_high_task_re_triggers_cap_check_on_resend(self, mock_count):
        # _is_hp_eligible_date() treats every past date as eligible, so an explicit resend
        # of is_high_priority=True (which web/mobile TaskForm screens do unconditionally on
        # every save) DOES re-run the cap check even though the task is overdue and its date
        # was never touched — this contradicts DATA_MODEL_AND_API.MD's documented "cap
        # doesn't re-engage until moved to a current/future date", but is today's actual,
        # pre-existing behavior, carried forward unchanged rather than fixed here.
        yesterday = date.today() - timedelta(days=1)
        task = self._make_task(must_do_by=yesterday, priority="high")
        with pytest.raises(HTTPException) as exc:
            update_task(self._make_db(), task, title=None, notes=None, must_do_by=None,
                        target_date=None, label_ids=None, is_high_priority=True,
                        high_priority_limit=HIGH_PRIORITY_DAILY_LIMIT)
        assert exc.value.status_code == 422
        mock_count.assert_called_once()

    @patch("app.services.task_service._count_high_priority_for_date")
    def test_overdue_high_task_untouched_save_does_not_recheck_cap(self, mock_count):
        # When neither priority field is sent at all, no cap re-check happens, regardless
        # of the task being overdue and already High — distinguishes "nothing sent" from
        # "explicitly resent" (Issue 1's exact mechanism).
        yesterday = date.today() - timedelta(days=1)
        task = self._make_task(must_do_by=yesterday, priority="high")
        update_task(self._make_db(), task, title="Unrelated edit", notes=None, must_do_by=None,
                    target_date=None, label_ids=None)
        mock_count.assert_not_called()
        assert task.priority == "high"


# ── create_task priority tiers (High/Medium/Normal) ────────────────────────────

class TestCreateTaskPriorityTiers:
    def _make_db(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []
        db.flush.return_value = None
        db.commit.return_value = None
        db.refresh.side_effect = lambda t: None
        return db

    @patch("app.services.task_service._count_high_priority_for_date", return_value=0)
    def test_create_with_priority_medium_for_today(self, _count):
        today = date.today()
        task = create_task(self._make_db(), "user-1", "board-1", "Test", None,
                            must_do_by=today, target_date=None, label_ids=[],
                            priority="medium")
        assert task.priority == "medium"
        assert task.is_high_priority is False
        _count.assert_not_called()

    def test_create_with_priority_medium_auto_resets_for_upcoming(self):
        future = date.today() + timedelta(days=7)
        task = create_task(self._make_db(), "user-1", "board-1", "Test", None,
                            must_do_by=future, target_date=None, label_ids=[],
                            priority="medium")
        assert task.priority == "normal"

    @patch("app.services.task_service._count_high_priority_for_date", return_value=0)
    def test_create_priority_field_takes_precedence_over_legacy_field(self, _count):
        today = date.today()
        task = create_task(self._make_db(), "user-1", "board-1", "Test", None,
                            must_do_by=today, target_date=None, label_ids=[],
                            priority="normal", is_high_priority=True)
        assert task.priority == "normal"
        assert task.is_high_priority is False
        _count.assert_not_called()

    @patch("app.services.task_service._count_high_priority_for_date", return_value=0)
    def test_create_legacy_is_high_priority_true_maps_to_high(self, _count):
        today = date.today()
        task = create_task(self._make_db(), "user-1", "board-1", "Test", None,
                            must_do_by=today, target_date=None, label_ids=[],
                            is_high_priority=True)
        assert task.priority == "high"
        assert task.is_high_priority is True

    @patch("app.services.task_service._count_high_priority_for_date", return_value=HIGH_PRIORITY_DAILY_LIMIT)
    def test_create_raises_422_when_cap_reached_for_high(self, _count):
        today = date.today()
        with pytest.raises(HTTPException) as exc:
            create_task(self._make_db(), "user-1", "board-1", "Test", None,
                        must_do_by=today, target_date=None, label_ids=[],
                        priority="high", high_priority_limit=HIGH_PRIORITY_DAILY_LIMIT)
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


# ── create_task links ──────────────────────────────────────────────────────────

class TestCreateTaskLinks:
    def _make_db(self):
        db = MagicMock()
        db.add = MagicMock()
        db.flush = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock()
        return db

    def test_defaults_to_empty_list_when_omitted(self):
        db = self._make_db()
        task = create_task(
            db, user_id="user-1", board_id="board-1", title="Test",
            notes=None, must_do_by=None, target_date=None, label_ids=[],
        )
        assert task.links == []

    def test_defaults_to_empty_list_when_none(self):
        db = self._make_db()
        task = create_task(
            db, user_id="user-1", board_id="board-1", title="Test",
            notes=None, must_do_by=None, target_date=None, label_ids=[], links=None,
        )
        assert task.links == []

    def test_stores_provided_links(self):
        db = self._make_db()
        links = [{"id": "l1", "url": "https://example.com", "description": "Example"}]
        task = create_task(
            db, user_id="user-1", board_id="board-1", title="Test",
            notes=None, must_do_by=None, target_date=None, label_ids=[], links=links,
        )
        assert task.links == links


# ── update_task links (full-replace semantics, matching label_ids) ─────────────

class TestUpdateTaskLinks:
    def _make_task(self):
        task = MagicMock()
        task.id = "task-1"
        task.must_do_by = None
        task.target_date = None
        task.labels = []
        task.links = [{"id": "l1", "url": "https://example.com", "description": "Existing"}]
        return task

    def _make_db(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.delete.return_value = None
        db.commit.return_value = None
        db.refresh.side_effect = lambda t: None
        return db

    def test_replaces_links_when_provided(self):
        task = self._make_task()
        db = self._make_db()
        new_links = [{"id": "l2", "url": "https://new.example.com", "description": "New"}]
        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, links=new_links)
        assert task.links == new_links

    def test_empty_list_clears_all_links(self):
        task = self._make_task()
        db = self._make_db()
        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, links=[])
        assert task.links == []

    def test_omitted_links_preserves_existing(self):
        task = self._make_task()
        original = task.links
        db = self._make_db()
        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None)
        assert task.links == original


# ── update_task board_id (move task between boards) ─────────────────────────────

class TestUpdateTaskBoardId:
    def _make_task(self, board_id="board-1"):
        task = MagicMock()
        task.id = "task-1"
        task.user_id = "user-1"
        task.board_id = board_id
        task.must_do_by = None
        task.target_date = None
        task.labels = []
        return task

    def _make_db(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.delete.return_value = None
        db.commit.return_value = None
        db.refresh.side_effect = lambda t: None
        return db

    @patch("app.services.task_service.board_svc")
    def test_moving_board_clears_labels_even_without_label_ids(self, mock_board_svc):
        task = self._make_task(board_id="board-1")
        db = self._make_db()

        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, board_id="board-2")

        assert task.board_id == "board-2"
        mock_board_svc.get_board_or_404.assert_called_once_with(db, "board-2", "user-1")
        db.query.return_value.filter.return_value.delete.assert_called()

    @patch("app.services.task_service.board_svc")
    def test_moving_to_board_not_owned_raises_404(self, mock_board_svc):
        mock_board_svc.get_board_or_404.side_effect = HTTPException(status_code=404, detail="Board not found")
        task = self._make_task(board_id="board-1")
        db = self._make_db()

        with pytest.raises(HTTPException) as exc:
            update_task(db, task, title=None, notes=None, must_do_by=None,
                        target_date=None, label_ids=None, board_id="board-other-user")
        assert exc.value.status_code == 404

    @patch("app.services.task_service._resolve_labels", return_value=[])
    @patch("app.services.task_service.board_svc")
    def test_moving_board_with_new_label_ids_resolves_against_new_board(self, mock_board_svc, mock_resolve):
        task = self._make_task(board_id="board-1")
        db = self._make_db()

        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=["l1"], board_id="board-2")

        mock_resolve.assert_called_once_with(db, ["l1"], "user-1", "board-2")

    @patch("app.services.task_service.board_svc")
    def test_board_id_unchanged_when_omitted(self, mock_board_svc):
        task = self._make_task(board_id="board-1")
        db = self._make_db()

        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, board_id=None)

        assert task.board_id == "board-1"
        mock_board_svc.get_board_or_404.assert_not_called()

    @patch("app.services.task_service.board_svc")
    def test_board_id_same_as_current_is_noop(self, mock_board_svc):
        task = self._make_task(board_id="board-1")
        db = self._make_db()

        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, board_id="board-1")

        assert task.board_id == "board-1"
        mock_board_svc.get_board_or_404.assert_not_called()


# ── update_task sort_order (explicit set vs. auto-reset-to-bottom) ─────────────

class TestUpdateTaskSortOrder:
    def _make_task(self, must_do_by=None, target_date=None, board_id="board-1", sort_order=100.0):
        task = MagicMock()
        task.id = "task-1"
        task.user_id = "user-1"
        task.board_id = board_id
        task.must_do_by = must_do_by
        task.target_date = target_date
        task.sort_order = sort_order
        task.labels = []
        return task

    def _make_db(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.delete.return_value = None
        db.commit.return_value = None
        db.refresh.side_effect = lambda t: None
        return db

    def test_explicit_sort_order_is_set(self):
        task = self._make_task()
        db = self._make_db()
        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, sort_order=42.5)
        assert task.sort_order == 42.5

    def test_explicit_sort_order_wins_even_with_date_change(self):
        today = date.today()
        future = today + timedelta(days=7)
        task = self._make_task(must_do_by=today)
        db = self._make_db()
        update_task(db, task, title=None, notes=None, must_do_by=future,
                    target_date=None, label_ids=None, sort_order=42.5)
        assert task.sort_order == 42.5

    def test_auto_reset_when_effective_date_changes(self):
        today = date.today()
        future = today + timedelta(days=7)
        task = self._make_task(must_do_by=today, sort_order=100.0)
        db = self._make_db()
        update_task(db, task, title=None, notes=None, must_do_by=future,
                    target_date=None, label_ids=None)
        assert task.sort_order != 100.0
        assert isinstance(task.sort_order, float)

    def test_no_reset_when_effective_date_unchanged(self):
        today = date.today()
        task = self._make_task(must_do_by=today, sort_order=100.0)
        db = self._make_db()
        update_task(db, task, title="New title", notes=None, must_do_by=None,
                    target_date=None, label_ids=None)
        assert task.sort_order == 100.0

    @patch("app.services.task_service.board_svc")
    def test_auto_reset_when_board_changes(self, mock_board_svc):
        task = self._make_task(board_id="board-1", sort_order=100.0)
        db = self._make_db()
        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, board_id="board-2")
        assert task.sort_order != 100.0
        assert isinstance(task.sort_order, float)

    @patch("app.services.task_service.board_svc")
    def test_no_reset_when_board_id_same_as_current(self, mock_board_svc):
        task = self._make_task(board_id="board-1", sort_order=100.0)
        db = self._make_db()
        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, board_id="board-1")
        assert task.sort_order == 100.0

    @patch("app.services.task_service.board_svc")
    def test_no_reset_when_board_id_omitted(self, mock_board_svc):
        task = self._make_task(board_id="board-1", sort_order=100.0)
        db = self._make_db()
        update_task(db, task, title=None, notes=None, must_do_by=None,
                    target_date=None, label_ids=None, board_id=None)
        assert task.sort_order == 100.0


# ── Task.sort_order column default ──────────────────────────────────────────────

class TestSortOrderDefault:
    def test_column_default_is_sort_order_default(self):
        default_fn = Task.__table__.c.sort_order.default.arg
        assert default_fn.__name__ == "_sort_order_default"
        assert Task.__table__.c.sort_order.nullable is False

    def test_sort_order_default_returns_a_float(self):
        assert isinstance(_sort_order_default(), float)
