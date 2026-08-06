"""Unit tests for sync router — task links passthrough and validation.

No database required. SyncChanges.tasks is a list of raw dicts (bypasses
TaskCreate/TaskUpdate Pydantic validation), so these tests specifically
guard against links being silently dropped on push/pull, or a client
bypassing max-3/scheme/length validation via the sync path.
"""

from datetime import date, datetime, timedelta, timezone
from unittest.mock import MagicMock

from app.models import Board, StateEnum, Task, TaskLabel, UserSettings
from app.routers.sync import sync
from app.schemas import SyncChanges, SyncRequest


def _make_db(task_first=None, task_all=None, board_exists=True):
    """A db mock that no-ops for every model except Task, which is configurable.

    board_exists controls whether a pushed board_id passes the sync router's
    ownership/existence check (`db.query(Board.id).filter(...).first()`).
    """
    db = MagicMock()

    def _query(model):
        q = MagicMock()
        q.filter.return_value = q
        q.delete.return_value = None
        if model is Task:
            q.first.return_value = task_first
            q.all.return_value = task_all or []
        elif model is UserSettings:
            q.first.return_value = None
        elif model is Board:
            q.all.return_value = []
        elif model is Board.id:
            q.first.return_value = "board-owned" if board_exists else None
        else:
            q.first.return_value = None
            q.all.return_value = []
        return q

    db.query.side_effect = _query
    return db


def _sync_request(tasks):
    return SyncRequest(
        last_synced_at=datetime.now(timezone.utc) - timedelta(days=1),
        changes=SyncChanges(tasks=tasks),
    )


def _make_task(**overrides) -> Task:
    now = datetime.now(timezone.utc)
    defaults = dict(
        id="task-1", user_id="user-1", board_id="board-1", title="Existing",
        notes=None, state=StateEnum.pending, must_do_by=None, target_date=None,
        completed_at=None, is_high_priority=False, priority="normal", is_deleted=False,
        links=[{"id": "old", "url": "https://old.example.com", "description": "Old"}],
        sort_order=100.0, created_at=now, updated_at=now,
    )
    defaults.update(overrides)
    return Task(**defaults)


class TestSyncPushLinks:
    def test_new_task_stores_valid_links(self):
        db = _make_db(task_first=None)
        payload = [{
            "id": "task-new",
            "title": "New task",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "links": [{"id": "l1", "url": "https://example.com", "description": "Example"}],
        }]
        sync(_sync_request(payload), db, "user-1")

        added_task = next(c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], Task))
        assert added_task.links == [{"id": "l1", "url": "https://example.com", "description": "Example"}]

    def test_new_task_with_invalid_scheme_drops_links(self):
        db = _make_db(task_first=None)
        payload = [{
            "id": "task-new",
            "title": "New task",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "links": [{"id": "l1", "url": "javascript:alert(1)", "description": "Bad"}],
        }]
        sync(_sync_request(payload), db, "user-1")

        added_task = next(c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], Task))
        assert added_task.links == []

    def test_new_task_over_cap_truncates_to_max(self):
        db = _make_db(task_first=None)
        links = [{"id": f"l{i}", "url": "https://example.com", "description": "x"} for i in range(4)]
        payload = [{
            "id": "task-new",
            "title": "New task",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "links": links,
        }]
        sync(_sync_request(payload), db, "user-1")

        added_task = next(c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], Task))
        assert added_task.links == links[:3]

    def test_new_task_drops_only_invalid_items(self):
        db = _make_db(task_first=None)
        links = [
            {"id": "l1", "url": "https://example.com", "description": "Good"},
            {"id": "l2", "url": "javascript:alert(1)", "description": "Bad"},
            {"id": "l3", "url": "https://example.org", "description": "Also good"},
        ]
        payload = [{
            "id": "task-new",
            "title": "New task",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "links": links,
        }]
        sync(_sync_request(payload), db, "user-1")

        added_task = next(c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], Task))
        assert added_task.links == [links[0], links[2]]

    def test_existing_task_replaces_links_when_client_wins(self):
        existing = _make_task(updated_at=datetime.now(timezone.utc) - timedelta(days=2))
        db = _make_db(task_first=existing)
        new_links = [{"id": "l2", "url": "https://new.example.com", "description": "New"}]
        payload = [{
            "id": "task-1",
            "title": "Existing",
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "links": new_links,
        }]
        sync(_sync_request(payload), db, "user-1")

        assert existing.links == new_links

    def test_existing_task_omitted_links_preserves_existing(self):
        existing = _make_task(updated_at=datetime.now(timezone.utc) - timedelta(days=2))
        original_links = existing.links
        db = _make_db(task_first=existing)
        payload = [{
            "id": "task-1",
            "title": "Existing task, retitled",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        assert existing.links == original_links


class TestSyncPushBoardId:
    def test_existing_task_moves_board_when_client_wins(self):
        existing = _make_task(board_id="board-1", updated_at=datetime.now(timezone.utc) - timedelta(days=2))
        db = _make_db(task_first=existing)
        payload = [{
            "id": "task-1",
            "title": "Existing",
            "board_id": "board-2",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        assert existing.board_id == "board-2"

    def test_omitted_board_id_preserves_existing_board(self):
        existing = _make_task(board_id="board-1", updated_at=datetime.now(timezone.utc) - timedelta(days=2))
        db = _make_db(task_first=existing)
        payload = [{
            "id": "task-1",
            "title": "Existing, retitled",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        assert existing.board_id == "board-1"

    def test_moving_board_drops_labels_not_valid_for_new_board(self):
        existing = _make_task(board_id="board-1", updated_at=datetime.now(timezone.utc) - timedelta(days=2))
        db = _make_db(task_first=existing)
        payload = [{
            "id": "task-1",
            "title": "Existing",
            "board_id": "board-2",
            "label_ids": ["label-from-old-board"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        # Mocked Label query returns no matches — simulates the label being invalid
        # for the new board. Verify no TaskLabel row is (re)added for it.
        assert not any(
            isinstance(c.args[0], TaskLabel) for c in db.add.call_args_list
        )

    def test_board_id_not_owned_by_user_is_rejected(self):
        existing = _make_task(board_id="board-1", updated_at=datetime.now(timezone.utc) - timedelta(days=2))
        db = _make_db(task_first=existing, board_exists=False)
        payload = [{
            "id": "task-1",
            "title": "Existing",
            "board_id": "someone-elses-board",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        assert existing.board_id == "board-1"

    def test_new_task_with_unowned_board_id_falls_back_to_default_board(self):
        db = _make_db(task_first=None, board_exists=False)
        payload = [{
            "id": "task-new",
            "title": "New task",
            "board_id": "someone-elses-board",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        added_task = next(c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], Task))
        assert added_task.board_id != "someone-elses-board"


class TestSyncPullLinks:
    def test_pull_response_includes_links(self):
        task = _make_task()
        db = _make_db(task_all=[task])
        response = sync(_sync_request([]), db, "user-1")

        assert response.changes.tasks[0]["links"] == task.links

    def test_pull_response_defaults_to_empty_list_when_null(self):
        task = _make_task(links=None)
        db = _make_db(task_all=[task])
        response = sync(_sync_request([]), db, "user-1")

        assert response.changes.tasks[0]["links"] == []


class TestSyncPullSortOrder:
    def test_pull_response_includes_sort_order(self):
        task = _make_task(sort_order=55.5)
        db = _make_db(task_all=[task])
        response = sync(_sync_request([]), db, "user-1")

        assert response.changes.tasks[0]["sort_order"] == 55.5


class TestSyncPushSortOrder:
    def test_date_change_resets_sort_order_to_bottom(self):
        existing = _make_task(
            must_do_by=None, target_date=None, sort_order=100.0,
            updated_at=datetime.now(timezone.utc) - timedelta(days=2),
        )
        db = _make_db(task_first=existing)
        payload = [{
            "id": "task-1",
            "title": "Existing",
            "target_date": (date.today() + timedelta(days=1)).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        assert existing.sort_order != 100.0

    def test_no_date_or_board_change_preserves_sort_order(self):
        existing = _make_task(
            sort_order=100.0, updated_at=datetime.now(timezone.utc) - timedelta(days=2)
        )
        db = _make_db(task_first=existing)
        payload = [{
            "id": "task-1",
            "title": "Existing, retitled",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        assert existing.sort_order == 100.0

    def test_board_change_resets_sort_order_to_bottom(self):
        existing = _make_task(
            board_id="board-1", sort_order=100.0,
            updated_at=datetime.now(timezone.utc) - timedelta(days=2),
        )
        db = _make_db(task_first=existing)
        payload = [{
            "id": "task-1",
            "title": "Existing",
            "board_id": "board-2",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        assert existing.sort_order != 100.0


class TestSyncPushPriority:
    """Field-resolution rule for the tri-state `priority` field, exercised via the actual
    /sync push path — see PLAN-feat-priority-tiers.md's Sneezy Blocker fix. This path has
    the identical unconditional-if-present shape as an old mobile client's REST update, so
    it needs the same medium-preserving guard, verified here independently of
    test_task_service.py's REST-path coverage.
    """

    def test_legacy_is_high_priority_does_not_overwrite_existing_medium(self):
        existing = _make_task(priority="medium", updated_at=datetime.now(timezone.utc) - timedelta(days=2))
        db = _make_db(task_first=existing)
        payload = [{
            "id": "task-1",
            "title": "Unrelated edit",
            "is_high_priority": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        assert existing.priority == "medium"
        assert existing.is_high_priority is False

    def test_explicit_priority_field_takes_precedence_over_legacy_field(self):
        existing = _make_task(priority="medium", updated_at=datetime.now(timezone.utc) - timedelta(days=2))
        db = _make_db(task_first=existing)
        payload = [{
            "id": "task-1",
            "title": "Existing",
            "priority": "normal",
            "is_high_priority": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        assert existing.priority == "normal"

    def test_legacy_is_high_priority_true_still_toggles_normal_to_high(self):
        existing = _make_task(priority="normal", updated_at=datetime.now(timezone.utc) - timedelta(days=2))
        db = _make_db(task_first=existing)
        payload = [{
            "id": "task-1",
            "title": "Existing",
            "is_high_priority": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        assert existing.priority == "high"
        assert existing.is_high_priority is True

    def test_new_task_from_legacy_client_maps_is_high_priority_to_priority(self):
        db = _make_db(task_first=None)
        payload = [{
            "id": "task-new",
            "title": "New task",
            "is_high_priority": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        added_task = next(c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], Task))
        assert added_task.priority == "high"
        assert added_task.is_high_priority is True

    def test_new_task_from_new_client_uses_priority_field_directly(self):
        db = _make_db(task_first=None)
        payload = [{
            "id": "task-new",
            "title": "New task",
            "priority": "medium",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        added_task = next(c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], Task))
        assert added_task.priority == "medium"
        assert added_task.is_high_priority is False

    def test_new_task_with_invalid_priority_string_falls_back_to_legacy_field(self):
        # Dopey's Must Fix on PR #72: an untrusted sync payload's raw `priority` must be
        # validated before being persisted — TaskOut.priority is a strict Pydantic Literal,
        # so an unvalidated garbage string would 500 every subsequent read of that task.
        db = _make_db(task_first=None)
        payload = [{
            "id": "task-new",
            "title": "New task",
            "priority": "urgent-garbage",
            "is_high_priority": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        added_task = next(c.args[0] for c in db.add.call_args_list if isinstance(c.args[0], Task))
        assert added_task.priority == "high"  # falls through to the legacy is_high_priority mapping
        assert added_task.is_high_priority is True

    def test_existing_task_with_invalid_priority_string_falls_back_to_legacy_field(self):
        existing = _make_task(priority="normal", updated_at=datetime.now(timezone.utc) - timedelta(days=2))
        db = _make_db(task_first=existing)
        payload = [{
            "id": "task-1",
            "title": "Existing",
            "priority": "urgent-garbage",
            "is_high_priority": True,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        assert existing.priority == "high"  # falls through to the legacy is_high_priority mapping

    def test_existing_task_with_invalid_priority_string_does_not_overwrite_medium(self):
        # The invalid priority is dropped (treated as "not sent"), so the medium-preserving
        # legacy rule still applies underneath it.
        existing = _make_task(priority="medium", updated_at=datetime.now(timezone.utc) - timedelta(days=2))
        db = _make_db(task_first=existing)
        payload = [{
            "id": "task-1",
            "title": "Existing",
            "priority": "urgent-garbage",
            "is_high_priority": False,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }]
        sync(_sync_request(payload), db, "user-1")

        assert existing.priority == "medium"

    def test_outbound_serialization_includes_both_fields(self):
        existing = _make_task(priority="high", is_high_priority=True)
        db = _make_db(task_all=[existing])
        result = sync(_sync_request([]), db, "user-1")

        synced_task = result.changes.tasks[0]
        assert synced_task["priority"] == "high"
        assert synced_task["is_high_priority"] is True
