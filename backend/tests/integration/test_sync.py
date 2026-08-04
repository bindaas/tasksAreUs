"""Sync: push/pull basics, board_id/recurrence_group_id backward-compat,
task links (PR #39), and sort_order auto-reset on the sync push path
(PR #61).

Reads ctx.test_user_id, ctx.default_board_id.
"""
import uuid
from datetime import date, datetime, timezone

from .asserts import assert_eq, assert_eq_xfail, assert_in, assert_true


def run(ctx):
    client = ctx.client
    H = ctx.H
    test_user_id = ctx.test_user_id
    default_board_id = ctx.default_board_id

    today_str = date.today().isoformat()

    # ── Sync ───────────────────────────────────────────────────────────────────
    print("\n── Sync ────────────────────────────────────────────────")
    last_synced = "2020-01-01T00:00:00Z"
    r = client.post("/sync", headers=H, json={
        "last_synced_at": last_synced,
        "changes": {"tasks": [], "task_labels": []},
    })
    assert_eq("POST /sync → 200", r.status_code, 200)
    sync_result = r.json()
    assert_in("sync has synced_at", "synced_at", sync_result)
    assert_in("sync has changes", "changes", sync_result)
    assert_true("sync returns tasks", isinstance(sync_result["changes"]["tasks"], list))
    assert_true("completed tasks in sync response", len(sync_result["changes"]["tasks"]) >= 2)
    # PR #67: SyncResponse no longer includes a "beliefs" key (Beliefs feature removed)
    assert_true("sync response no longer has beliefs key (PR #67: Beliefs removed)",
                "beliefs" not in sync_result["changes"])
    # Verify is_high_priority field is included in sync task objects (PR #6)
    # PR #31: recurrence_group_id column dropped — must not appear in sync task objects
    if sync_result["changes"]["tasks"]:
        first_sync_task = sync_result["changes"]["tasks"][0]
        assert_in("sync task object includes is_high_priority field", "is_high_priority", first_sync_task)
        assert_true("sync task object has no recurrence_group_id field (PR #31)",
                    "recurrence_group_id" not in first_sync_task)
        # PR #33: board_id must be present in sync task objects
        assert_in("sync task object includes board_id field (PR #33)", "board_id", first_sync_task)
        # PR #61: sort_order must be present in sync task objects
        assert_in("sync task object includes sort_order field (PR #61)", "sort_order", first_sync_task)
    # PR #33: sync response must include boards array
    assert_in("sync changes has boards array (PR #33)", "boards", sync_result["changes"])
    assert_true("sync boards is a list (PR #33)", isinstance(sync_result["changes"]["boards"], list))
    assert_true("sync boards array is non-empty (last_synced_at is old enough to include all boards)",
                len(sync_result["changes"]["boards"]) >= 1)
    if sync_result["changes"]["boards"]:
        first_sync_board = sync_result["changes"]["boards"][0]
        assert_in("sync board object includes is_default field (PR #33)", "is_default", first_sync_board)
        # PR #62: boards.sort_order now drives display order and is_default derivation,
        # but routers/sync.py's board_dicts (pull payload) was never updated to include
        # it — it hand-builds each dict with only id/name/is_default/is_deleted/
        # created_at/updated_at. `color` has had this same gap since PR #36/#37 (never
        # added here either). No current web/mobile client actually calls /sync (no
        # api/sync.ts exists on either platform), so this is latent rather than a live
        # bug today — but a future offline-sync consumer reading boards from this
        # endpoint would silently miss both fields. Tracked as a known gap, not fixed
        # here (out of this PR's stated scope) — see xfail below.
        assert_eq_xfail("sync board object includes sort_order field (PR #62 gap: not wired into sync.py board_dicts)",
                         "sort_order" in first_sync_board, True,
                         "routers/sync.py's board_dicts dict-literal was not updated for the new boards.sort_order column")
        assert_eq_xfail("sync board object includes color field (pre-existing gap since PR #36/#37)",
                         "color" in first_sync_board, True,
                         "routers/sync.py's board_dicts dict-literal has never included the color column")

    # Verify sync push: sending a task with is_high_priority=true round-trips correctly.
    # PR #31: recurrence_group_id is omitted from the push payload (column dropped).
    # Old mobile clients that still send recurrence_group_id should be handled gracefully —
    # the sync router silently ignores unknown fields (SyncChanges uses Dict[str, Any]).
    hp_sync_task_id = str(uuid.uuid4())
    r = client.post("/sync", headers=H, json={
        "last_synced_at": "2020-01-01T00:00:00Z",
        "changes": {
            "tasks": [{
                "id": hp_sync_task_id,
                "user_id": test_user_id,
                "title": "Sync HP test task",
                "state": "pending",
                "must_do_by": today_str,
                "target_date": None,
                "notes": None,
                "is_high_priority": True,
                "is_deleted": False,
                "completed_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }],
            "task_labels": [],
        },
    })
    assert_eq("POST /sync with is_high_priority task → 200", r.status_code, 200)
    # Read it back to confirm the field was stored and recurrence_group_id is absent
    r = client.get(f"/tasks/{hp_sync_task_id}", headers=H)
    assert_eq("GET synced HP task → 200", r.status_code, 200)
    assert_eq("synced task is_high_priority persisted", r.json()["is_high_priority"], True)
    assert_true("synced task response has no recurrence_group_id field (PR #31)",
                "recurrence_group_id" not in r.json())
    # PR #33: synced task must have board_id set to the default board (no board_id in payload)
    assert_in("synced task response has board_id field (PR #33)", "board_id", r.json())
    assert_eq("synced task board_id defaults to default board (PR #33)",
              r.json()["board_id"], default_board_id)
    # Clean up the sync test task
    client.delete(f"/tasks/{hp_sync_task_id}", headers=H)

    # PR #31: backward-compat check — old mobile clients may still send recurrence_group_id
    # in their sync payload. The server must accept (200) and silently discard the field.
    # PR #33: old clients also omit board_id; the sync router must default to the default board.
    # PR #67: a stale client built before the Beliefs removal may still send a top-level
    # "beliefs": [] key in changes (SyncChanges no longer declares that field) — Pydantic's
    # default extra="ignore" behavior means this must be silently dropped, not rejected.
    stale_sync_task_id = str(uuid.uuid4())
    r = client.post("/sync", headers=H, json={
        "last_synced_at": "2020-01-01T00:00:00Z",
        "changes": {
            "tasks": [{
                "id": stale_sync_task_id,
                "user_id": test_user_id,
                "title": "Stale client sync task (with legacy recurrence_group_id)",
                "state": "pending",
                "must_do_by": None,
                "target_date": None,
                "notes": None,
                "is_high_priority": False,
                "is_deleted": False,
                "recurrence_group_id": None,  # old clients still send this; must be ignored
                # board_id intentionally absent — must default to default board (PR #33)
                "completed_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }],
            "task_labels": [],
            "beliefs": [],  # stale client field (PR #67: removed from SyncChanges schema)
        },
    })
    assert_eq("POST /sync with stale recurrence_group_id + beliefs fields → 200 (PR #31/#67 backward compat)",
              r.status_code, 200)
    r = client.get(f"/tasks/{stale_sync_task_id}", headers=H)
    assert_eq("GET stale-sync task → 200", r.status_code, 200)
    assert_true("stale-sync task response has no recurrence_group_id (PR #31)",
                "recurrence_group_id" not in r.json())
    # PR #33: stale client omitting board_id must get task on default board
    assert_in("stale-sync task response has board_id (PR #33)", "board_id", r.json())
    assert_eq("stale-sync task board_id defaults to default board (PR #33)",
              r.json()["board_id"], default_board_id)
    # Clean up
    client.delete(f"/tasks/{stale_sync_task_id}", headers=H)

    # ── Sync: task links (PR #39) ─────────────────────────────────────────────
    # sync.py bypasses TaskCreate/TaskUpdate Pydantic validation for task fields
    # (SyncChanges.tasks is a list of raw dicts), so links must be explicitly
    # threaded through both the push-apply and pull-response code paths, and
    # re-validated manually on push (max-3 / scheme / length) since Pydantic
    # validation doesn't run automatically on that path.
    print("\n── Sync: task links (PR #39) ────────────────────────────")

    # Push a new task via sync with a valid link — must be stored and round-trip on GET
    sync_links_task_id = str(uuid.uuid4())
    sync_link = {"id": str(uuid.uuid4()), "url": "https://example.com/sync", "description": "Sync link"}
    r = client.post("/sync", headers=H, json={
        "last_synced_at": "2020-01-01T00:00:00Z",
        "changes": {
            "tasks": [{
                "id": sync_links_task_id,
                "user_id": test_user_id,
                "title": "Sync task with links",
                "state": "pending",
                "must_do_by": None,
                "target_date": None,
                "notes": None,
                "is_high_priority": False,
                "is_deleted": False,
                "links": [sync_link],
                "completed_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }],
            "task_labels": [],
        },
    })
    assert_eq("POST /sync push new task with links → 200", r.status_code, 200)
    r = client.get(f"/tasks/{sync_links_task_id}", headers=H)
    assert_eq("GET synced task with links → 200", r.status_code, 200)
    assert_eq("synced task links persisted", len(r.json()["links"]), 1)
    assert_eq("synced task link id matches", r.json()["links"][0]["id"], sync_link["id"])

    # Push a task with an invalid-scheme link — sync ingestion re-validates each item
    # independently (bypasses Pydantic on the raw-dict path); the invalid link must be
    # dropped but the push itself must still succeed (200), not be rejected outright.
    sync_bad_link_task_id = str(uuid.uuid4())
    r = client.post("/sync", headers=H, json={
        "last_synced_at": "2020-01-01T00:00:00Z",
        "changes": {
            "tasks": [{
                "id": sync_bad_link_task_id,
                "user_id": test_user_id,
                "title": "Sync task with bad-scheme link",
                "state": "pending",
                "must_do_by": None,
                "target_date": None,
                "notes": None,
                "is_high_priority": False,
                "is_deleted": False,
                "links": [{"id": str(uuid.uuid4()), "url": "javascript:alert(1)", "description": "Bad"}],
                "completed_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }],
            "task_labels": [],
        },
    })
    assert_eq("POST /sync push task with bad-scheme link → 200 (push succeeds)", r.status_code, 200)
    r = client.get(f"/tasks/{sync_bad_link_task_id}", headers=H)
    assert_eq("GET synced task with bad-scheme link → 200", r.status_code, 200)
    assert_eq("invalid-scheme link dropped, not persisted", r.json()["links"], [])

    # Push a task with more than MAX_TASK_LINKS (3) links — must be truncated to 3,
    # not rejected outright (sync has no per-field error channel back to the client).
    sync_overcap_task_id = str(uuid.uuid4())
    overcap_links = [
        {"id": str(uuid.uuid4()), "url": f"https://example.com/{i}", "description": f"Link {i}"}
        for i in range(5)
    ]
    r = client.post("/sync", headers=H, json={
        "last_synced_at": "2020-01-01T00:00:00Z",
        "changes": {
            "tasks": [{
                "id": sync_overcap_task_id,
                "user_id": test_user_id,
                "title": "Sync task with over-cap links",
                "state": "pending",
                "must_do_by": None,
                "target_date": None,
                "notes": None,
                "is_high_priority": False,
                "is_deleted": False,
                "links": overcap_links,
                "completed_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }],
            "task_labels": [],
        },
    })
    assert_eq("POST /sync push task with 5 links → 200 (truncates, doesn't reject)", r.status_code, 200)
    r = client.get(f"/tasks/{sync_overcap_task_id}", headers=H)
    assert_eq("GET synced task with over-cap links → 200", r.status_code, 200)
    assert_eq("over-cap links truncated to MAX_TASK_LINKS (3)", len(r.json()["links"]), 3)

    # Push an update to the first synced task (client wins via a newer updated_at)
    # that omits the links field entirely — existing links must be preserved, not cleared.
    r = client.post("/sync", headers=H, json={
        "last_synced_at": "2020-01-01T00:00:00Z",
        "changes": {
            "tasks": [{
                "id": sync_links_task_id,
                "user_id": test_user_id,
                "title": "Sync task with links (renamed, links field omitted)",
                "state": "pending",
                "must_do_by": None,
                "target_date": None,
                "notes": None,
                "is_high_priority": False,
                "is_deleted": False,
                "completed_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }],
            "task_labels": [],
        },
    })
    assert_eq("POST /sync push update omitting links field → 200", r.status_code, 200)
    r = client.get(f"/tasks/{sync_links_task_id}", headers=H)
    assert_eq("GET task after sync update omitting links → 200", r.status_code, 200)
    assert_eq("links preserved when sync push omits the field", len(r.json()["links"]), 1)
    assert_eq("preserved link id matches original sync link", r.json()["links"][0]["id"], sync_link["id"])

    # Pull: the sync response includes links for tasks updated since last_synced_at
    r = client.post("/sync", headers=H, json={
        "last_synced_at": "2020-01-01T00:00:00Z",
        "changes": {"tasks": [], "task_labels": []},
    })
    assert_eq("POST /sync pull after link pushes → 200", r.status_code, 200)
    pulled_tasks = {t["id"]: t for t in r.json()["changes"]["tasks"]}
    assert_true("sync pull includes the links task", sync_links_task_id in pulled_tasks)
    if sync_links_task_id in pulled_tasks:
        assert_in("pulled sync task has links field", "links", pulled_tasks[sync_links_task_id])
        assert_eq("pulled sync task links match", len(pulled_tasks[sync_links_task_id]["links"]), 1)

    # Clean up sync links test tasks
    for tid in [sync_links_task_id, sync_bad_link_task_id, sync_overcap_task_id]:
        client.delete(f"/tasks/{tid}", headers=H)

    # ── Sync: sort_order auto-reset (PR #61) ────────────────────────────────────
    # sync.py bypasses task_service.update_task() entirely (raw dicts, hand-rolled
    # field application), so it duplicates the "reset sort_order to bottom on an
    # effective-date change" rule independently — this proves that duplicate is
    # actually wired up against a real row, not just the mocked-session unit tests.
    print("\n── Sync: sort_order auto-reset (PR #61) ─────────────────")

    sync_so_task_id = str(uuid.uuid4())
    r = client.post("/sync", headers=H, json={
        "last_synced_at": "2020-01-01T00:00:00Z",
        "changes": {
            "tasks": [{
                "id": sync_so_task_id,
                "user_id": test_user_id,
                "title": "Sync sort_order reset test task",
                "state": "pending",
                "must_do_by": None,
                "target_date": None,
                "notes": None,
                "is_high_priority": False,
                "is_deleted": False,
                "completed_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }],
            "task_labels": [],
        },
    })
    assert_eq("POST /sync push new task (sort_order reset setup) → 200", r.status_code, 200)
    r = client.get(f"/tasks/{sync_so_task_id}", headers=H)
    assert_eq("GET synced sort_order test task → 200", r.status_code, 200)
    sync_so_initial = r.json()["sort_order"]

    # Push an update (client wins via a strictly newer updated_at) that changes
    # must_do_by — sort_order must auto-reset even though the push never mentions it.
    r = client.post("/sync", headers=H, json={
        "last_synced_at": "2020-01-01T00:00:00Z",
        "changes": {
            "tasks": [{
                "id": sync_so_task_id,
                "user_id": test_user_id,
                "title": "Sync sort_order reset test task",
                "state": "pending",
                "must_do_by": today_str,
                "target_date": None,
                "notes": None,
                "is_high_priority": False,
                "is_deleted": False,
                "completed_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }],
            "task_labels": [],
        },
    })
    assert_eq("POST /sync push date change (sort_order reset) → 200", r.status_code, 200)
    r = client.get(f"/tasks/{sync_so_task_id}", headers=H)
    assert_eq("GET after sync date-change push → 200", r.status_code, 200)
    assert_true("sync push auto-resets sort_order on effective-date change (PR #61)",
                r.json()["sort_order"] != sync_so_initial)

    client.delete(f"/tasks/{sync_so_task_id}", headers=H)
