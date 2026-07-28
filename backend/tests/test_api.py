"""
Standalone API test script.
- Creates its own test data
- Exercises all major endpoints
- Cleans up everything at the end via direct DB connection

Usage:
    pip install httpx psycopg2-binary
    DATABASE_URL=postgresql://... BASE_URL=http://localhost:8000 python tests/test_api.py
"""
import atexit
import os
import sys
import uuid
from datetime import date, timedelta

import httpx
import psycopg2

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000/api/v1")
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/tasksareus")

SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"

_failures = []


def assert_eq(label: str, actual, expected):
    if actual == expected:
        print(f"  {PASS} {label}")
    else:
        _failures.append(label)
        print(f"  {FAIL} {label}: expected {expected!r}, got {actual!r}")


def assert_in(label: str, key, collection):
    if key in collection:
        print(f"  {PASS} {label}")
    else:
        _failures.append(label)
        print(f"  {FAIL} {label}: {key!r} not in {collection!r}")


def assert_true(label: str, condition: bool):
    if condition:
        print(f"  {PASS} {label}")
    else:
        _failures.append(label)
        print(f"  {FAIL} {label}: condition is False")


def cleanup(user_id: str):
    print("\n── Cleanup ────────────────────────────────────────────")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    # task_labels has no user_id — delete via tasks FK
    cur.execute(
        "DELETE FROM task_labels WHERE task_id IN (SELECT id FROM tasks WHERE user_id = %s)",
        (user_id,),
    )
    # PR #50: conversations/messages tables were dropped entirely (chat removal) —
    # deleting from them here would fail with "relation does not exist" against a
    # DB that has run this PR's startup migration.
    for table in ["ai_cost_log", "beliefs", "tasks", "user_settings", "focused_view_configs"]:
        cur.execute(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))
    # Per-user labels created by PR #15 (mode/type labels with user_id set)
    cur.execute("DELETE FROM labels WHERE user_id = %s", (user_id,))
    # PR #33: boards table; labels must be deleted before boards (FK constraint)
    cur.execute("DELETE FROM boards WHERE user_id = %s", (user_id,))
    # System user is permanent — only delete data, not the user row itself
    if user_id != SYSTEM_USER_ID:
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
    cur.close()
    conn.close()
    print(f"  {PASS} Deleted all records for test user {user_id}")


def main():
    client = httpx.Client(base_url=BASE_URL, timeout=30)
    test_user_id = None

    # ── Health ─────────────────────────────────────────────────────────────────
    # GET /health is intentionally unauthenticated — the Settings Connection widget
    # calls it without a Bearer token to test backend reachability (PR #25).
    print("\n── Health ─────────────────────────────────────────────")
    r = client.get("/health")
    assert_eq("GET /health → 200", r.status_code, 200)
    health_body = r.json()
    assert_in("health has status", "status", health_body)
    assert_eq("health status is ok", health_body.get("status"), "ok")
    # PR #25: Settings connection widget reads the response — verify full shape
    assert_in("health has timestamp", "timestamp", health_body)
    assert_in("health has version", "version", health_body)
    assert_in("health has checks", "checks", health_body)
    assert_in("health checks has database", "database", health_body.get("checks", {}))
    assert_eq("health checks.database.status is ok",
              health_body.get("checks", {}).get("database", {}).get("status"), "ok")
    # Must be accessible without any auth header (no X-User-ID, no Bearer)
    r_noauth = httpx.get(f"{BASE_URL}/health", timeout=10)
    assert_eq("GET /health with no auth header → 200 (unauthenticated endpoint)", r_noauth.status_code, 200)

    # Use the system user for test data (it is seeded at startup and never deleted)
    test_user_id = SYSTEM_USER_ID
    # Clean up any leftover data from a previous run before starting
    cleanup(test_user_id)
    atexit.register(cleanup, test_user_id)

    H = {"X-User-ID": test_user_id}

    # ── Auth ───────────────────────────────────────────────────────────────────
    # Bearer token is the ONLY accepted auth path. Integration tests cannot
    # obtain a real Firebase token, so all subsequent tests use X-User-ID which
    # returns 401 on the backend. All failures after this point are caused by
    # this structural limitation, not by the feature under test.
    print("\n── Auth (Bearer-only) ─────────────────────────────────")

    # Protected endpoint with no auth at all must return 401
    r = client.get("/labels")
    assert_eq("GET /labels with no auth → 401", r.status_code, 401)


    # ── Boards (PR #33, PR #37) ────────────────────────────────────────────────
    print("\n── Boards (PR #33, PR #37) ─────────────────────────────────────")

    # GET /boards — PR #37: svc.ensure_board_seeded() is now called at the top of
    # list_boards(), making GET /boards a board-creation entry point.  A brand-new
    # user (or a user whose boards were cleaned up) gets their "General tasks" board
    # and 9 default labels created on the very first GET /boards call — not only on
    # task/label endpoints that go through resolve_board_id().  This is important
    # for the web frontend's BoardContext, which calls GET /boards on mount before
    # any task or label endpoint is touched.
    r = client.get("/boards", headers=H)
    assert_eq("GET /boards → 200", r.status_code, 200)
    boards_body = r.json()
    assert_in("GET /boards response has boards key", "boards", boards_body)
    boards_list = boards_body["boards"]
    # After cleanup all boards are deleted.  GET /boards must still return the seeded
    # default board because PR #37 added ensure_board_seeded() to list_boards().
    assert_true("GET /boards returns at least 1 board after cleanup (PR #37: seed-on-GET)", len(boards_list) >= 1)

    # The default board must be first in the list (ordered is_default DESC, created_at ASC)
    default_board = boards_list[0]
    assert_eq("first board is_default=true", default_board["is_default"], True)
    assert_eq("default board name is 'General tasks'", default_board["name"], "General tasks")
    assert_in("board has id field", "id", default_board)
    assert_in("board has is_deleted field", "is_deleted", default_board)
    assert_in("board has created_at field", "created_at", default_board)
    assert_in("board has updated_at field", "updated_at", default_board)
    assert_eq("default board is_deleted=false", default_board["is_deleted"], False)
    default_board_id = default_board["id"]

    # No auth → 401
    r = client.get("/boards")
    assert_eq("GET /boards with no auth → 401", r.status_code, 401)

    # POST /boards — create a new board
    r = client.post("/boards", headers=H, json={"name": "Job search"})
    assert_eq("POST /boards → 201", r.status_code, 201)
    new_board = r.json()
    assert_eq("new board name", new_board["name"], "Job search")
    assert_eq("new board is_default=false", new_board["is_default"], False)
    assert_eq("new board is_deleted=false", new_board["is_deleted"], False)
    assert_in("new board has id", "id", new_board)
    new_board_id = new_board["id"]

    # POST /boards — empty name → 400
    r = client.post("/boards", headers=H, json={"name": "   "})
    assert_eq("POST /boards empty name → 400", r.status_code, 400)

    # POST /boards — enforce cap of 10 (MAX_BOARDS_PER_USER); already have 2 (default + new_board_id),
    # create 8 more to reach the cap of 10 total.
    extra_board_ids = [new_board_id]
    for i in range(8):
        r = client.post("/boards", headers=H, json={"name": f"Extra board {i + 1}"})
        assert_eq(f"POST /boards extra board {i + 1} → 201", r.status_code, 201)
        extra_board_ids.append(r.json()["id"])
    # Now at 10 boards — 11th must be rejected
    r = client.post("/boards", headers=H, json={"name": "One too many"})
    assert_eq("POST /boards at cap → 422", r.status_code, 422)
    assert_true("422 detail mentions board limit",
                "10" in r.json().get("detail", "") or "limit" in r.json().get("detail", "").lower())

    # PUT /boards/{id} — rename a board
    r = client.put(f"/boards/{new_board_id}", headers=H, json={"name": "Career search"})
    assert_eq("PUT /boards/:id rename → 200", r.status_code, 200)
    renamed_board = r.json()
    assert_eq("board renamed", renamed_board["name"], "Career search")
    assert_eq("board still not default after rename", renamed_board["is_default"], False)

    # PUT /boards/{id} — empty name → 400
    r = client.put(f"/boards/{new_board_id}", headers=H, json={"name": "  "})
    assert_eq("PUT /boards/:id empty name → 400", r.status_code, 400)

    # PUT /boards/{id} — is_default: true promotes a non-default board
    r = client.put(f"/boards/{new_board_id}", headers=H, json={"is_default": True})
    assert_eq("PUT /boards/:id set is_default=true → 200", r.status_code, 200)
    promoted = r.json()
    assert_eq("promoted board is_default=true", promoted["is_default"], True)
    # Original default board must no longer be default
    r = client.get("/boards", headers=H)
    all_boards = r.json()["boards"]
    old_default_in_list = next((b for b in all_boards if b["id"] == default_board_id), None)
    assert_true("old default board found in list", old_default_in_list is not None)
    if old_default_in_list:
        assert_eq("old default board demoted", old_default_in_list["is_default"], False)

    # PUT /boards/{id} — is_default: false on current default → 400
    r = client.put(f"/boards/{new_board_id}", headers=H, json={"is_default": False})
    assert_eq("PUT /boards/:id is_default=false on current default → 400", r.status_code, 400)
    assert_true("400 detail mentions demote restriction",
                "demote" in r.json().get("detail", "").lower() or "default" in r.json().get("detail", "").lower())

    # PUT /boards/{id} — 404 for non-existent board
    r = client.put(f"/boards/{str(uuid.uuid4())}", headers=H, json={"name": "Ghost board"})
    assert_eq("PUT /boards/:id non-existent → 404", r.status_code, 404)

    # Restore default_board_id as the default so later tests use the original board
    r = client.put(f"/boards/{default_board_id}", headers=H, json={"is_default": True})
    assert_eq("Restore original default board → 200", r.status_code, 200)
    assert_eq("original board is_default=true again", r.json()["is_default"], True)

    # ── Boards: color field (PR #36) ──────────────────────────────────────────
    print("\n── Boards: color field (PR #36) ────────────────────────────────")
    # BoardOut must include a color field; null for boards that have never had a color set
    assert_true("GET /boards board response includes color field", "color" in default_board)
    assert_eq("default board color is null initially", default_board.get("color"), None)

    # PUT /boards/:id — set a valid hex color
    r = client.put(f"/boards/{default_board_id}", headers=H, json={"color": "#6366f1"})
    assert_eq("PUT /boards/:id set color → 200", r.status_code, 200)
    assert_eq("board color set to #6366f1", r.json().get("color"), "#6366f1")

    # GET /boards reflects the saved color
    r = client.get("/boards", headers=H)
    color_test_board = next((b for b in r.json()["boards"] if b["id"] == default_board_id), None)
    assert_true("board found in GET /boards for color check", color_test_board is not None)
    if color_test_board:
        assert_eq("GET /boards reflects updated color", color_test_board.get("color"), "#6366f1")

    # PUT /boards/:id — invalid color formats → 422 (Pydantic field_validator)
    r = client.put(f"/boards/{default_board_id}", headers=H, json={"color": "6366f1"})
    assert_eq("PUT /boards/:id invalid color (missing #) → 422", r.status_code, 422)
    r = client.put(f"/boards/{default_board_id}", headers=H, json={"color": "#GGGGGG"})
    assert_eq("PUT /boards/:id invalid color (bad hex chars) → 422", r.status_code, 422)
    r = client.put(f"/boards/{default_board_id}", headers=H, json={"color": "#6366f"})
    assert_eq("PUT /boards/:id invalid color (5 hex chars) → 422", r.status_code, 422)

    # PUT /boards/:id — omitting color must NOT clear existing color (sentinel behavior)
    r = client.put(f"/boards/{default_board_id}", headers=H, json={"name": "General tasks"})
    assert_eq("PUT /boards/:id without color field → 200", r.status_code, 200)
    assert_eq("existing color preserved when color omitted from PUT body", r.json().get("color"), "#6366f1")

    # PUT /boards/:id — explicit color=null clears the color
    r = client.put(f"/boards/{default_board_id}", headers=H, json={"color": None})
    assert_eq("PUT /boards/:id color=null → 200", r.status_code, 200)
    assert_eq("color cleared to null", r.json().get("color"), None)

    # DELETE /boards/{id} — cannot delete the only board (but we have multiple, so this guards differently)
    # First verify: cannot delete the default board
    r = client.delete(f"/boards/{default_board_id}", headers=H)
    assert_eq("DELETE /boards/:id on default board → 400", r.status_code, 400)
    assert_true("400 detail mentions default board",
                "default" in r.json().get("detail", "").lower())

    # Cannot delete a board that has tasks — put a task on new_board_id first
    r = client.post("/tasks", headers=H, json={
        "title": "Board isolation task",
        "label_ids": [],
        "board_id": new_board_id,
    })
    assert_eq("POST /tasks with board_id → 201", r.status_code, 201)
    board_task = r.json()
    board_task_id = board_task["id"]
    assert_eq("task board_id matches requested board", board_task["board_id"], new_board_id)

    r = client.delete(f"/boards/{new_board_id}", headers=H)
    assert_eq("DELETE /boards/:id with tasks → 400", r.status_code, 400)
    assert_true("400 detail mentions tasks",
                "task" in r.json().get("detail", "").lower())

    # Remove the task so we can test label guard
    client.delete(f"/tasks/{board_task_id}", headers=H)

    # Cannot delete a board that has labels — add a label to new_board_id
    r = client.post("/labels", headers=H, json={"category": "type", "value": "test-type", "board_id": new_board_id})
    assert_eq("POST /labels with board_id → 201", r.status_code, 201)
    board_label = r.json()
    board_label_id = board_label["id"]

    r = client.delete(f"/boards/{new_board_id}", headers=H)
    assert_eq("DELETE /boards/:id with labels → 400", r.status_code, 400)
    assert_true("400 detail mentions labels",
                "label" in r.json().get("detail", "").lower())

    # Remove the label
    client.delete(f"/labels/{board_label_id}", headers=H)

    # Now the board is empty and non-default — delete should succeed
    r = client.delete(f"/boards/{new_board_id}", headers=H)
    assert_eq("DELETE /boards/:id empty non-default board → 204", r.status_code, 204)

    # Verify the deleted board no longer appears in GET /boards
    r = client.get("/boards", headers=H)
    remaining_board_ids = [b["id"] for b in r.json()["boards"]]
    assert_true("deleted board no longer in GET /boards", new_board_id not in remaining_board_ids)

    # DELETE /boards/{id} — 404 for non-existent board
    r = client.delete(f"/boards/{str(uuid.uuid4())}", headers=H)
    assert_eq("DELETE /boards/:id non-existent → 404", r.status_code, 404)

    # Cannot delete the only remaining board (when user is down to 1)
    # Delete all extra boards down to only 1 remaining (the default)
    for extra_id in extra_board_ids[1:]:  # skip new_board_id (already deleted)
        client.delete(f"/boards/{extra_id}", headers=H)
    r = client.delete(f"/boards/{default_board_id}", headers=H)
    assert_eq("DELETE /boards/:id when only one board exists → 400", r.status_code, 400)
    assert_true("400 detail mentions only board",
                "only" in r.json().get("detail", "").lower())

    # ── Boards: cross-board label isolation (PR #33 core invariant) ─────────────
    print("\n── Boards: cross-board label isolation ──────────────────")
    # Create a second board to test scoping
    r = client.post("/boards", headers=H, json={"name": "Isolation test board"})
    assert_eq("POST /boards for isolation test → 201", r.status_code, 201)
    isolation_board_id = r.json()["id"]

    # Add a label to each board
    r = client.post("/labels", headers=H, json={"category": "type", "value": "default-board-label", "board_id": default_board_id})
    assert_eq("POST label to default board → 201", r.status_code, 201)
    default_isolation_label_id = r.json()["id"]

    r = client.post("/labels", headers=H, json={"category": "type", "value": "other-board-label", "board_id": isolation_board_id})
    assert_eq("POST label to isolation board → 201", r.status_code, 201)
    isolation_label_id = r.json()["id"]

    # GET /labels?board_id=default_board_id must NOT include the isolation board's label
    r = client.get("/labels", headers=H, params={"board_id": default_board_id})
    assert_eq("GET /labels?board_id=default → 200", r.status_code, 200)
    default_board_labels = [l["id"] for l in r.json()["labels"]]
    assert_true("default board label appears in its own board GET /labels",
                default_isolation_label_id in default_board_labels)
    assert_true("isolation board label does NOT appear in default board GET /labels",
                isolation_label_id not in default_board_labels)

    # GET /labels?board_id=isolation_board_id must NOT include the default board's label
    r = client.get("/labels", headers=H, params={"board_id": isolation_board_id})
    assert_eq("GET /labels?board_id=isolation → 200", r.status_code, 200)
    isolation_board_labels = [l["id"] for l in r.json()["labels"]]
    assert_true("isolation board label appears in its own board GET /labels",
                isolation_label_id in isolation_board_labels)
    assert_true("default board label does NOT appear in isolation board GET /labels",
                default_isolation_label_id not in isolation_board_labels)

    # A label from board B cannot be assigned to a task in board A
    r = client.post("/tasks", headers=H, json={
        "title": "Cross-board label assignment test task",
        "label_ids": [isolation_label_id],  # label from isolation board
        "board_id": default_board_id,        # but task on default board
    })
    assert_eq("POST /tasks with cross-board label → 422", r.status_code, 422)

    # Clean up isolation labels and board
    client.delete(f"/labels/{default_isolation_label_id}", headers=H)
    client.delete(f"/labels/{isolation_label_id}", headers=H)
    client.delete(f"/boards/{isolation_board_id}", headers=H)

    # ── Boards: backward-compat — omitting board_id defaults to the default board ──
    print("\n── Boards: backward-compat default-board resolution ────")
    # Tasks created without board_id go to the default board
    r = client.post("/tasks", headers=H, json={
        "title": "Backward-compat task (no board_id)",
        "label_ids": [],
    })
    assert_eq("POST /tasks without board_id → 201 (backward-compat)", r.status_code, 201)
    compat_task = r.json()
    compat_task_id = compat_task["id"]
    assert_in("task response has board_id field (PR #33)", "board_id", compat_task)
    assert_eq("task board_id defaults to default board", compat_task["board_id"], default_board_id)
    client.delete(f"/tasks/{compat_task_id}", headers=H)

    # Labels created without board_id go to the default board
    r = client.post("/labels", headers=H, json={"category": "type", "value": "compat-test"})
    assert_eq("POST /labels without board_id → 201 (backward-compat)", r.status_code, 201)
    compat_label_id = r.json()["id"]
    # Verify it appears in GET /labels (default board)
    r = client.get("/labels", headers=H)
    all_label_ids_compat = [l["id"] for l in r.json()["labels"]]
    assert_in("label created without board_id appears in default board GET /labels", compat_label_id, all_label_ids_compat)
    client.delete(f"/labels/{compat_label_id}", headers=H)

    # ── Labels ─────────────────────────────────────────────────────────────────
    print("\n── Labels ─────────────────────────────────────────────")
    r = client.get("/labels", headers=H)
    assert_eq("GET /labels → 200", r.status_code, 200)
    labels = r.json()["labels"]
    # PR #51: mode labels removed — new users get 5 labels (type only, no mode)
    # Previously LABEL_SEED had 9 labels (4 mode + 5 type), now only 5 type labels are seeded.
    assert_true("at least 5 labels seeded (PR #51: mode removed)", len(labels) >= 5)

    # Pick specific labels for use in tests
    # PR #51: mode labels are removed end-to-end, so this dict will be empty
    mode_labels = {l["value"]: l["id"] for l in labels if l["category"] == "mode"}
    type_labels = {l["value"]: l["id"] for l in labels if l["category"] == "type"}

    # Verify the medical label added in PR #1 is seeded
    assert_in("medical label seeded", "medical", type_labels)

    # Verify raghav was renamed to child (PR #15 seed migration)
    assert_in("child label seeded (renamed from raghav)", "child", type_labels)
    assert_true("raghav label no longer exists", "raghav" not in type_labels)

    # PR #31: CategoryEnum.frequency removed from Python — GET /labels?category=frequency now
    # returns 400 (unknown category) rather than 200 with an empty or partial list.
    r = client.get("/labels?category=frequency", headers=H)
    assert_eq("GET /labels?category=frequency → 400 (PR #31: unknown category)", r.status_code, 400)

    # PR #51: mode category removed — GET /labels?category=mode now returns 400 (unknown category)
    # Previously this returned 200 with 4+ mode labels; now mode is not a valid category.
    r = client.get("/labels?category=mode", headers=H)
    assert_eq("GET /labels?category=mode → 400 (PR #51: mode removed)", r.status_code, 400)

    r = client.get("/labels?category=type", headers=H)
    assert_eq("GET /labels?category=type → 200", r.status_code, 200)
    type_only = r.json()["labels"]
    assert_true("type labels returned for user", len(type_only) >= 5)
    assert_true("type labels all have category=type", all(l["category"] == "type" for l in type_only))

    # Unknown category returns 400
    r = client.get("/labels?category=bogus", headers=H)
    assert_eq("GET /labels?category=bogus → 400", r.status_code, 400)

    # ── Labels: Per-User Model (PR #16, updated PR #31, updated PR #51) ───────
    print("\n── Labels: Per-User Model (PR #16, updated PR #31, updated PR #51) ─")
    # PR #30: LABEL_SEED originally contained 9 entries (4 mode + 5 type); frequency entries removed.
    # PR #31: SQL migration deletes all remaining frequency rows from the DB.
    # PR #51: mode labels removed end-to-end — LABEL_SEED now contains 5 entries (type only).
    # All users (including the persistent system test user) now have exactly the 5 seeded type labels.
    assert_true("GET /labels returns at least 5 seeded labels (PR #51: mode removed)", len(labels) >= 5)

    # PR #51: Only type category remains — mode is fully gone (PR #51), frequency was removed in PR #31
    all_categories = {l["category"] for l in labels}
    assert_true("type category present in GET /labels (PR #51)",
                "type" in all_categories)
    assert_true("mode category absent from GET /labels (PR #51)",
                "mode" not in all_categories)
    assert_true("frequency category absent from GET /labels (PR #31)",
                "frequency" not in all_categories)

    # Verify that label IDs from GET /labels can be used to create tasks (the core
    # bug fixed in PR #16 — per-user IDs were not matching global IDs on task creation)
    # PR #51: mode labels no longer seeded, use type label instead
    pr16_verify_task_r = client.post("/tasks", headers=H, json={
        "title": "PR #16 label-ID verification task",
        "label_ids": [type_labels["household"]],
    })
    assert_eq("POST task using per-user label IDs → 201 (PR #16)", pr16_verify_task_r.status_code, 201)
    pr16_task = pr16_verify_task_r.json()
    pr16_task_id = pr16_task["id"]
    pr16_label_values = {l["value"] for l in pr16_task["labels"]}
    assert_eq("per-user label IDs attach correctly to task (PR #16)", pr16_label_values, {"household"})
    # Clean up
    client.delete(f"/tasks/{pr16_task_id}", headers=H)

    # ── Labels: Frequency fully removed (PR #31) ─────────────────────────────
    # PR #29 removed frequency from all client UI surfaces.
    # PR #30 removed frequency entries from LABEL_SEED and recurrence logic from the backend.
    # PR #31 (this PR) runs the SQL migration and removes CategoryEnum.frequency from Python.
    # After PR #31:
    #   - All frequency label rows are deleted from the DB (SQL migration).
    #   - CategoryEnum.frequency no longer exists in Python.
    #   - GET /labels?category=frequency returns 400 (unknown category), not 200.
    #   - POST /labels with category=frequency returns 400 (unknown category).
    print("\n── Labels: Frequency fully removed (PR #31) ────────────")
    # GET /labels?category=frequency must return 400 (unknown category) — CategoryEnum.frequency gone
    r = client.get("/labels?category=frequency", headers=H)
    assert_eq("GET /labels?category=frequency → 400 (PR #31: CategoryEnum.frequency removed)",
              r.status_code, 400)

    # GET /labels must not include any frequency rows (all deleted by SQL migration)
    r = client.get("/labels", headers=H)
    all_labels_pr31 = r.json()["labels"]
    freq_rows = [l for l in all_labels_pr31 if l["category"] == "frequency"]
    assert_eq("no frequency label rows remain after PR #31 SQL migration", freq_rows, [])

    # POST /labels — frequency category must still be rejected (now: unknown category 400)
    r = client.post("/labels", headers=H, json={"category": "frequency", "value": "hourly"})
    assert_eq("POST /labels frequency category → 400 (PR #31: unknown category)",
              r.status_code, 400)

    # ── Labels: Mode fully removed (PR #51) ──────────────────────────────────
    # PR #51 removes the Mode label category end-to-end: all Mode labels deleted at startup,
    # and the API no longer accepts mode as a category in GET or POST requests.
    print("\n── Labels: Mode fully removed (PR #51) ──────────────────")
    # GET /labels?category=mode must return 400 (unknown category) — verified earlier
    r = client.get("/labels?category=mode", headers=H)
    assert_eq("GET /labels?category=mode → 400 (PR #51: mode removed)",
              r.status_code, 400)

    # GET /labels must not include any mode rows (all deleted by startup migration)
    r = client.get("/labels", headers=H)
    all_labels_pr51 = r.json()["labels"]
    mode_rows = [l for l in all_labels_pr51 if l["category"] == "mode"]
    assert_eq("no mode label rows remain after PR #51 startup migration", mode_rows, [])

    # POST /labels — mode category must be rejected (now: non-configurable 400)
    r = client.post("/labels", headers=H, json={"category": "mode", "value": "video-call"})
    assert_eq("POST /labels mode category → 400 (PR #51: mode no longer configurable)",
              r.status_code, 400)

    # ── Labels: Create / Update / Delete (PR #15, updated PR #51) ─────────────
    print("\n── Labels: Configurable Type (PR #15, PR #51: mode removed) ────")

    # PR #51: POST /labels with mode category now returns 400 (non-configurable)
    # Mode labels are no longer supported in the API
    r = client.post("/labels", headers=H, json={"category": "mode", "value": "in-person"})
    assert_eq("POST /labels (mode) → 400 (PR #51: mode removed)", r.status_code, 400)

    # POST /labels — create a type label
    r = client.post("/labels", headers=H, json={"category": "type", "value": "school"})
    assert_eq("POST /labels (type) → 201", r.status_code, 201)
    new_type_label = r.json()
    new_type_label_id = new_type_label["id"]
    assert_eq("new type label value", new_type_label["value"], "school")

    # POST /labels — duplicate type label returns 409
    r = client.post("/labels", headers=H, json={"category": "type", "value": "school"})
    assert_eq("POST /labels duplicate → 409", r.status_code, 409)

    # POST /labels — unknown category → 400
    r = client.post("/labels", headers=H, json={"category": "bogus", "value": "x"})
    assert_eq("POST /labels unknown category → 400", r.status_code, 400)

    # POST /labels — empty value → 400
    r = client.post("/labels", headers=H, json={"category": "type", "value": "   "})
    assert_eq("POST /labels empty value → 400", r.status_code, 400)

    # Newly created label appears in GET /labels
    r = client.get("/labels", headers=H)
    all_label_ids = [l["id"] for l in r.json()["labels"]]
    assert_in("new type label in GET /labels", new_type_label_id, all_label_ids)

    # PUT /labels/{id} — rename a label
    r = client.put(f"/labels/{new_type_label_id}", headers=H, json={"value": "school-work"})
    assert_eq("PUT /labels/:id rename → 200", r.status_code, 200)
    renamed = r.json()
    assert_eq("label renamed", renamed["value"], "school-work")
    assert_eq("category unchanged after rename", renamed["category"], "type")

    # PUT /labels/{id} — rename to existing value → 409
    r = client.put(f"/labels/{new_type_label_id}", headers=H, json={"value": "household"})
    assert_eq("PUT /labels/:id rename to existing value → 409", r.status_code, 409)

    # PUT /labels/{id} — empty value → 400
    r = client.put(f"/labels/{new_type_label_id}", headers=H, json={"value": "  "})
    assert_eq("PUT /labels/:id empty value → 400", r.status_code, 400)

    # PUT /labels/{id} — 404 for non-existent label
    r = client.put(f"/labels/{str(uuid.uuid4())}", headers=H, json={"value": "anything"})
    assert_eq("PUT /labels/:id non-existent → 404", r.status_code, 404)

    # NOTE: PUT /labels on a frequency label test is skipped — PR #30 removed
    # frequency labels from LABEL_SEED so fresh test users have no frequency rows.
    # Enforcement (400 for category=frequency) is verified in the PR #30 section above.

    # DELETE /labels/{id} — delete the type label
    r = client.delete(f"/labels/{new_type_label_id}", headers=H)
    assert_eq("DELETE /labels/:id → 204", r.status_code, 204)

    # Verify deleted label is gone from GET /labels
    r = client.get("/labels", headers=H)
    remaining_ids = [l["id"] for l in r.json()["labels"]]
    assert_true("deleted type label no longer in GET /labels", new_type_label_id not in remaining_ids)

    # DELETE /labels/{id} — 404 for already-deleted label
    r = client.delete(f"/labels/{new_type_label_id}", headers=H)
    assert_eq("DELETE /labels/:id already deleted → 404", r.status_code, 404)

    # NOTE: DELETE /labels on a frequency label test is skipped — PR #30 removed
    # frequency labels from LABEL_SEED so fresh test users have no frequency rows.
    # Enforcement (400 for category=frequency POST) is verified in the PR #30 section above.

    # DELETE /labels/{id} — 404 for non-existent label
    r = client.delete(f"/labels/{str(uuid.uuid4())}", headers=H)
    assert_eq("DELETE /labels/:id non-existent → 404", r.status_code, 404)

    # NOTE: no further cleanup needed here — new_type_label_id was already
    # permanently deleted above (labels are hard-deleted, not soft-deleted;
    # see Table: labels in DATA_MODEL_AND_API.MD). A prior version of this test
    # re-issued a DELETE on the same already-deleted id expecting 204, which is
    # wrong (the correct/actual response is 404, as already asserted above).

    # Verify label isolation: a task should not accept a label_id that belongs
    # to a different user.  Confirm that the per-user label we just deleted
    # can no longer be attached to a task.
    today_str_labels = date.today().isoformat()
    r = client.post("/tasks", headers=H, json={
        "title": "Label isolation test task",
        "must_do_by": today_str_labels,
        "label_ids": [new_type_label_id],  # already deleted — should 422
    })
    assert_eq("POST /tasks with deleted label_id → 422", r.status_code, 422)

    # ── Task CRUD ──────────────────────────────────────────────────────────────
    print("\n── Tasks: CRUD ─────────────────────────────────────────")
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    next_week = (date.today() + timedelta(days=7)).isoformat()
    r = client.post("/tasks", headers=H, json={
        "title": "Return library books",
        "notes": "Row 4, shelf B",
        "must_do_by": next_week,
        "target_date": tomorrow,
        "label_ids": [type_labels["child"], type_labels["household"]],
    })
    assert_eq("POST /tasks → 201", r.status_code, 201)
    task = r.json()
    task_id = task["id"]
    assert_eq("task title", task["title"], "Return library books")
    assert_eq("task state", task["state"], "pending")
    assert_eq("task label count", len(task["labels"]), 2)
    assert_eq("task notes round-trips on create", task["notes"], "Row 4, shelf B")
    # target_date and must_do_by must both be present in the task response
    assert_in("task has target_date field", "target_date", task)
    assert_in("task has must_do_by field", "must_do_by", task)
    assert_eq("task target_date round-trips", task["target_date"], tomorrow)
    assert_eq("task must_do_by round-trips", task["must_do_by"], next_week)
    # PR #31: recurrence_group_id column dropped — must not appear in API response
    assert_true("task response has no recurrence_group_id field (PR #31)",
                "recurrence_group_id" not in task)
    # PR #33: board_id must be present in task response
    assert_in("task response has board_id field (PR #33)", "board_id", task)
    assert_eq("task board_id is the default board (PR #33)", task["board_id"], default_board_id)

    r = client.get(f"/tasks/{task_id}", headers=H)
    assert_eq("GET /tasks/:id → 200", r.status_code, 200)
    fetched = r.json()
    assert_eq("fetched task id", fetched["id"], task_id)
    assert_eq("GET /tasks/:id target_date preserved", fetched["target_date"], tomorrow)

    r = client.put(f"/tasks/{task_id}", headers=H, json={
        "title": "Return library books (updated)",
        "label_ids": [type_labels["child"]],
    })
    assert_eq("PUT /tasks/:id → 200", r.status_code, 200)
    assert_eq("updated title", r.json()["title"], "Return library books (updated)")
    assert_eq("label replaced", len(r.json()["labels"]), 1)

    # PUT can update target_date independently
    r = client.put(f"/tasks/{task_id}", headers=H, json={
        "target_date": next_week,
    })
    assert_eq("PUT /tasks/:id target_date update → 200", r.status_code, 200)
    assert_eq("target_date updated via PUT", r.json()["target_date"], next_week)

    # ── Tasks: Links (PR #39) ──────────────────────────────────────────────────
    print("\n── Tasks: Links (PR #39) ────────────────────────────────")

    # POST /tasks — task without links defaults to an empty list
    r = client.post("/tasks", headers=H, json={"title": "Links default test task", "label_ids": []})
    assert_eq("POST /tasks without links → 201", r.status_code, 201)
    links_default_task = r.json()
    links_default_task_id = links_default_task["id"]
    assert_in("task response has links field", "links", links_default_task)
    assert_eq("task links defaults to empty list when omitted", links_default_task["links"], [])
    client.delete(f"/tasks/{links_default_task_id}", headers=H)

    # POST /tasks — create with up to MAX_TASK_LINKS (3) valid links
    link_a = {"id": str(uuid.uuid4()), "url": "https://example.com/a", "description": "Link A"}
    link_b = {"id": str(uuid.uuid4()), "url": "http://example.com/b", "description": "Link B"}
    link_c = {"id": str(uuid.uuid4()), "url": "https://example.com/c", "description": "Link C"}
    r = client.post("/tasks", headers=H, json={
        "title": "Task with 3 links",
        "label_ids": [],
        "links": [link_a, link_b, link_c],
    })
    assert_eq("POST /tasks with 3 links → 201", r.status_code, 201)
    links_task = r.json()
    links_task_id = links_task["id"]
    assert_eq("task has 3 links", len(links_task["links"]), 3)
    returned_link_ids = {l["id"] for l in links_task["links"]}
    assert_eq("returned link ids match submitted ids",
              returned_link_ids, {link_a["id"], link_b["id"], link_c["id"]})
    returned_urls = {l["url"] for l in links_task["links"]}
    assert_eq("returned link urls match submitted urls",
              returned_urls, {link_a["url"], link_b["url"], link_c["url"]})

    # GET /tasks/:id round-trips links
    r = client.get(f"/tasks/{links_task_id}", headers=H)
    assert_eq("GET /tasks/:id with links → 200", r.status_code, 200)
    assert_eq("GET /tasks/:id links count round-trips", len(r.json()["links"]), 3)

    # GET /tasks list includes the links field on each task
    r = client.get("/tasks", headers=H, params={"state": "pending"})
    links_task_in_list = next((t for t in r.json()["tasks"] if t["id"] == links_task_id), None)
    assert_true("links task found in GET /tasks list", links_task_in_list is not None)
    if links_task_in_list:
        assert_in("task in GET /tasks list has links field", "links", links_task_in_list)
        assert_eq("task in GET /tasks list has 3 links", len(links_task_in_list["links"]), 3)

    # POST /tasks — a 4th link exceeds MAX_TASK_LINKS (3) → 422
    link_d = {"id": str(uuid.uuid4()), "url": "https://example.com/d", "description": "Link D"}
    r = client.post("/tasks", headers=H, json={
        "title": "Task with 4 links (should fail)",
        "label_ids": [],
        "links": [link_a, link_b, link_c, link_d],
    })
    assert_eq("POST /tasks with 4 links → 422 (max 3)", r.status_code, 422)

    # POST /tasks — non-http(s) URL schemes are rejected
    for bad_scheme_url in [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "mailto:test@example.com",
        "ftp://example.com/file",
    ]:
        r = client.post("/tasks", headers=H, json={
            "title": "Task with bad link scheme",
            "label_ids": [],
            "links": [{"id": str(uuid.uuid4()), "url": bad_scheme_url, "description": "Bad link"}],
        })
        assert_eq(f"POST /tasks with url scheme '{bad_scheme_url.split(':')[0]}:' → 422", r.status_code, 422)

    # POST /tasks — schemeless URL rejected
    r = client.post("/tasks", headers=H, json={
        "title": "Task with schemeless link",
        "label_ids": [],
        "links": [{"id": str(uuid.uuid4()), "url": "example.com", "description": "No scheme"}],
    })
    assert_eq("POST /tasks with schemeless url → 422", r.status_code, 422)

    # POST /tasks — empty/whitespace-only description rejected
    r = client.post("/tasks", headers=H, json={
        "title": "Task with empty link description",
        "label_ids": [],
        "links": [{"id": str(uuid.uuid4()), "url": "https://example.com", "description": "   "}],
    })
    assert_eq("POST /tasks with whitespace-only link description → 422", r.status_code, 422)

    # POST /tasks — missing id rejected
    r = client.post("/tasks", headers=H, json={
        "title": "Task with link missing id",
        "label_ids": [],
        "links": [{"url": "https://example.com", "description": "No id"}],
    })
    assert_eq("POST /tasks with link missing id → 422", r.status_code, 422)

    # POST /tasks — oversized description rejected (max 200 chars)
    r = client.post("/tasks", headers=H, json={
        "title": "Task with oversized link description",
        "label_ids": [],
        "links": [{"id": str(uuid.uuid4()), "url": "https://example.com", "description": "x" * 201}],
    })
    assert_eq("POST /tasks with oversized link description → 422", r.status_code, 422)

    # POST /tasks — oversized url rejected (max 2048 chars)
    r = client.post("/tasks", headers=H, json={
        "title": "Task with oversized link url",
        "label_ids": [],
        "links": [{"id": str(uuid.uuid4()), "url": "https://example.com/" + "x" * 2048, "description": "Big"}],
    })
    assert_eq("POST /tasks with oversized link url → 422", r.status_code, 422)

    # PUT /tasks/:id — full-replace semantics: providing links replaces the whole array
    new_link = {"id": str(uuid.uuid4()), "url": "https://example.com/replaced", "description": "Replaced link"}
    r = client.put(f"/tasks/{links_task_id}", headers=H, json={"links": [new_link]})
    assert_eq("PUT /tasks/:id replace links → 200", r.status_code, 200)
    replaced_result = r.json()
    assert_eq("links replaced to 1 item", len(replaced_result["links"]), 1)
    assert_eq("replaced link id matches", replaced_result["links"][0]["id"], new_link["id"])

    # PUT /tasks/:id — omitting links entirely preserves existing links (does not clear them)
    r = client.put(f"/tasks/{links_task_id}", headers=H, json={"title": "Task with 3 links (renamed)"})
    assert_eq("PUT /tasks/:id omitting links → 200", r.status_code, 200)
    omit_links_result = r.json()
    assert_eq("links preserved when omitted from PUT body", len(omit_links_result["links"]), 1)
    assert_eq("preserved link id matches previous replace",
              omit_links_result["links"][0]["id"], new_link["id"])

    # PUT /tasks/:id — explicit empty list clears all links
    r = client.put(f"/tasks/{links_task_id}", headers=H, json={"links": []})
    assert_eq("PUT /tasks/:id links=[] → 200", r.status_code, 200)
    assert_eq("links cleared to empty list", r.json()["links"], [])

    # PUT /tasks/:id — a 4th link exceeds MAX_TASK_LINKS (3) → 422
    r = client.put(f"/tasks/{links_task_id}", headers=H, json={
        "links": [link_a, link_b, link_c, link_d],
    })
    assert_eq("PUT /tasks/:id with 4 links → 422 (max 3)", r.status_code, 422)

    # PUT /tasks/:id — bad url scheme rejected
    r = client.put(f"/tasks/{links_task_id}", headers=H, json={
        "links": [{"id": str(uuid.uuid4()), "url": "javascript:alert(1)", "description": "Bad"}],
    })
    assert_eq("PUT /tasks/:id with bad url scheme → 422", r.status_code, 422)

    # Clean up
    client.delete(f"/tasks/{links_task_id}", headers=H)

    # ── Date-clearing via PUT (PR #3 fix) ─────────────────────────────────────
    # Create a task that has both dates set so we can verify clearing them.
    print("\n── Tasks: Clear dates via PUT (null vs omit) ───────────")
    r = client.post("/tasks", headers=H, json={
        "title": "Date clearing test task",
        "must_do_by": next_week,
        "target_date": tomorrow,
        "label_ids": [],
    })
    assert_eq("POST date-clear task → 201", r.status_code, 201)
    dc_task = r.json()
    dc_task_id = dc_task["id"]
    assert_eq("date-clear task has must_do_by", dc_task["must_do_by"], next_week)
    assert_eq("date-clear task has target_date", dc_task["target_date"], tomorrow)

    # Explicitly send null for must_do_by — should clear it.
    r = client.put(f"/tasks/{dc_task_id}", headers=H, json={"must_do_by": None})
    assert_eq("PUT with must_do_by=null → 200", r.status_code, 200)
    assert_eq("must_do_by cleared to null", r.json()["must_do_by"], None)
    # target_date was not sent in body, so must be untouched.
    assert_eq("target_date untouched after must_do_by clear", r.json()["target_date"], tomorrow)

    # Explicitly send null for target_date — should clear it.
    r = client.put(f"/tasks/{dc_task_id}", headers=H, json={"target_date": None})
    assert_eq("PUT with target_date=null → 200", r.status_code, 200)
    assert_eq("target_date cleared to null", r.json()["target_date"], None)

    # Omitting both date fields from the body must NOT alter them.
    # Restore dates first, then verify omission is a no-op.
    r = client.put(f"/tasks/{dc_task_id}", headers=H, json={
        "must_do_by": next_week,
        "target_date": tomorrow,
    })
    assert_eq("Restore dates before omit test → 200", r.status_code, 200)
    r = client.put(f"/tasks/{dc_task_id}", headers=H, json={"title": "Date clearing test task (renamed)"})
    assert_eq("PUT omitting date fields → 200", r.status_code, 200)
    omit_result = r.json()
    assert_eq("must_do_by not cleared when omitted from body", omit_result["must_do_by"], next_week)
    assert_eq("target_date not cleared when omitted from body", omit_result["target_date"], tomorrow)

    # Clear both dates in a single request.
    r = client.put(f"/tasks/{dc_task_id}", headers=H, json={"must_do_by": None, "target_date": None})
    assert_eq("PUT clearing both dates → 200", r.status_code, 200)
    both_result = r.json()
    assert_eq("must_do_by cleared (both)", both_result["must_do_by"], None)
    assert_eq("target_date cleared (both)", both_result["target_date"], None)

    # Clean up the helper task.
    client.delete(f"/tasks/{dc_task_id}", headers=H)

    # ── Tasks: notes field semantics (PR #45 regression guard) ────────────────
    # PR #45 fixed a web frontend bug: TaskForm.tsx only included `notes` in the
    # PUT body when non-empty (`if (notes.trim()) data.notes = ...`), so clearing
    # the Notes textarea to empty silently failed to persist (the key was omitted
    # entirely, and the backend's "field absent → unchanged" contract kept the old
    # value). The fix was client-side only; these tests lock in the backend
    # contract the fix depends on so a future backend change can't reintroduce
    # this bug class silently. Unlike must_do_by/target_date, `notes` has no
    # dedicated clear_notes flag — TaskUpdate.notes is a plain Optional[str], so
    # explicit null and omission are indistinguishable at the schema level (both
    # decode to None) and BOTH leave the existing value unchanged; only a
    # non-None value (including "") writes through.
    print("\n── Tasks: Notes field semantics (PR #45 regression guard) ──")
    r = client.post("/tasks", headers=H, json={
        "title": "Notes semantics test task",
        "notes": "Initial notes",
        "label_ids": [],
    })
    assert_eq("POST notes-test task → 201", r.status_code, 201)
    notes_task = r.json()
    notes_task_id = notes_task["id"]
    assert_eq("notes round-trip on create", notes_task["notes"], "Initial notes")

    # Omitting notes from PUT body leaves the existing value unchanged.
    r = client.put(f"/tasks/{notes_task_id}", headers=H, json={"title": "Notes semantics test task (renamed)"})
    assert_eq("PUT omitting notes → 200", r.status_code, 200)
    assert_eq("notes unchanged when omitted from PUT body", r.json()["notes"], "Initial notes")

    # Explicit null for notes is indistinguishable from omission (no clear_notes
    # flag exists) — the value must be left unchanged, not cleared.
    r = client.put(f"/tasks/{notes_task_id}", headers=H, json={"notes": None})
    assert_eq("PUT notes=null → 200", r.status_code, 200)
    assert_eq("notes unchanged when explicitly sent null (no clear_notes flag)",
              r.json()["notes"], "Initial notes")

    # Explicit empty string clears notes — this is the fix PR #45 relies on:
    # the frontend must send "" (not omit the key, not send null) to clear.
    r = client.put(f"/tasks/{notes_task_id}", headers=H, json={"notes": ""})
    assert_eq("PUT notes='' → 200", r.status_code, 200)
    assert_eq("notes cleared to empty string via explicit ''", r.json()["notes"], "")

    # Re-set notes to a non-empty value, then verify a normal non-empty update works.
    r = client.put(f"/tasks/{notes_task_id}", headers=H, json={"notes": "Updated notes"})
    assert_eq("PUT notes='Updated notes' → 200", r.status_code, 200)
    assert_eq("notes updated to new non-empty value", r.json()["notes"], "Updated notes")

    client.delete(f"/tasks/{notes_task_id}", headers=H)

    # ── Drag-drop target_date-only updates (PR #11) ────────────────────────────
    # The frontend now always writes target_date on column drops, never must_do_by.
    # These tests verify the backend contract that supports this behaviour.
    print("\n── Tasks: Drag-drop target_date-only contract (PR #11) ─")
    # Create a task with only must_do_by set (no target_date).
    dd_task_r = client.post("/tasks", headers=H, json={
        "title": "Drag-drop contract task (must_do_by only)",
        "must_do_by": next_week,
        "label_ids": [],
    })
    assert_eq("POST drag-drop task (must_do_by only) → 201", dd_task_r.status_code, 201)
    dd_task = dd_task_r.json()
    dd_task_id = dd_task["id"]
    assert_eq("dd task has must_do_by", dd_task["must_do_by"], next_week)
    assert_eq("dd task has no target_date initially", dd_task["target_date"], None)

    # Simulate dropping to a column: PUT only target_date — must_do_by must survive.
    r = client.put(f"/tasks/{dd_task_id}", headers=H, json={"target_date": tomorrow})
    assert_eq("PUT target_date only on must_do_by-only task → 200", r.status_code, 200)
    dd_result = r.json()
    assert_eq("target_date set by drop", dd_result["target_date"], tomorrow)
    assert_eq("must_do_by unchanged after target_date-only PUT", dd_result["must_do_by"], next_week)

    # Simulate dropping to 'No Date': PUT target_date=null — must_do_by must survive.
    r = client.put(f"/tasks/{dd_task_id}", headers=H, json={"target_date": None, "is_high_priority": False})
    assert_eq("PUT target_date=null (No Date drop) → 200", r.status_code, 200)
    nodate_result = r.json()
    assert_eq("target_date cleared by No Date drop", nodate_result["target_date"], None)
    assert_eq("must_do_by preserved after No Date drop", nodate_result["must_do_by"], next_week)

    # Simulate a second column drop on a task that already has both dates:
    # only target_date should change.
    r = client.put(f"/tasks/{dd_task_id}", headers=H, json={
        "must_do_by": next_week,
        "target_date": tomorrow,
    })
    assert_eq("Restore both dates for second-drop test → 200", r.status_code, 200)
    r = client.put(f"/tasks/{dd_task_id}", headers=H, json={"target_date": tomorrow, "is_high_priority": False})
    assert_eq("PUT target_date only on both-dates task → 200", r.status_code, 200)
    both_drop_result = r.json()
    assert_eq("target_date updated by second drop", both_drop_result["target_date"], tomorrow)
    assert_eq("must_do_by unchanged by second drop", both_drop_result["must_do_by"], next_week)

    # Clean up drag-drop test task.
    client.delete(f"/tasks/{dd_task_id}", headers=H)

    r = client.get("/tasks", headers=H, params={"state": "pending"})
    assert_eq("GET /tasks?state=pending → 200", r.status_code, 200)
    task_ids = [t["id"] for t in r.json()["tasks"]]
    assert_in("task in list", task_id, task_ids)

    # ── Tasks: board_id scoping on GET /tasks (PR #35) ────────────────────────
    # PR #35 (mobile multi-board): the mobile client now always passes board_id
    # when listing tasks. Verify that GET /tasks?board_id=<id> correctly scopes
    # results to the requested board and excludes tasks from other boards.
    print("\n── Tasks: board_id filter on GET /tasks (PR #35) ──────")
    # Create a second board and put a task on it
    r = client.post("/boards", headers=H, json={"name": "Board filter test board"})
    assert_eq("POST /boards for board_id filter test → 201", r.status_code, 201)
    filter_board_id = r.json()["id"]

    r = client.post("/tasks", headers=H, json={
        "title": "Task on filter test board",
        "label_ids": [],
        "board_id": filter_board_id,
    })
    assert_eq("POST /tasks on filter test board → 201", r.status_code, 201)
    filter_board_task_id = r.json()["id"]
    assert_eq("filter board task board_id matches", r.json()["board_id"], filter_board_id)

    # GET /tasks?board_id=default_board must include the main task_id but NOT the filter board task
    r = client.get("/tasks", headers=H, params={"board_id": default_board_id})
    assert_eq("GET /tasks?board_id=default → 200", r.status_code, 200)
    default_board_task_ids = [t["id"] for t in r.json()["tasks"]]
    assert_in("main task appears in default board GET /tasks", task_id, default_board_task_ids)
    assert_true("filter board task excluded from default board GET /tasks",
                filter_board_task_id not in default_board_task_ids)

    # GET /tasks?board_id=filter_board must include filter board task but NOT the main task
    r = client.get("/tasks", headers=H, params={"board_id": filter_board_id})
    assert_eq("GET /tasks?board_id=filter_board → 200", r.status_code, 200)
    filter_board_task_ids = [t["id"] for t in r.json()["tasks"]]
    assert_in("filter board task appears in its own board GET /tasks", filter_board_task_id, filter_board_task_ids)
    assert_true("main task excluded from filter board GET /tasks",
                task_id not in filter_board_task_ids)

    # Clean up
    client.delete(f"/tasks/{filter_board_task_id}", headers=H)
    client.delete(f"/boards/{filter_board_id}", headers=H)

    # ── Tasks: Move between boards (PR #40) ────────────────────────────────────
    print("\n── Tasks: Move between boards (PR #40) ─────────────────")
    # Create two boards to move a task between
    r = client.post("/boards", headers=H, json={"name": "Move test board A"})
    assert_eq("POST /boards move-test board A → 201", r.status_code, 201)
    move_board_a_id = r.json()["id"]

    r = client.post("/boards", headers=H, json={"name": "Move test board B"})
    assert_eq("POST /boards move-test board B → 201", r.status_code, 201)
    move_board_b_id = r.json()["id"]

    # A label scoped to board A and a label scoped to board B (PR #51: use type labels, mode removed)
    r = client.post("/labels", headers=H, json={"category": "type", "value": "move-label-a", "board_id": move_board_a_id})
    assert_eq("POST label on move-test board A → 201", r.status_code, 201)
    move_label_a_id = r.json()["id"]

    r = client.post("/labels", headers=H, json={"category": "type", "value": "move-label-b", "board_id": move_board_b_id})
    assert_eq("POST label on move-test board B → 201", r.status_code, 201)
    move_label_b_id = r.json()["id"]

    # Create a task on board A with board A's label attached
    r = client.post("/tasks", headers=H, json={
        "title": "Move-between-boards test task",
        "label_ids": [move_label_a_id],
        "board_id": move_board_a_id,
    })
    assert_eq("POST /tasks on move-test board A → 201", r.status_code, 201)
    move_task = r.json()
    move_task_id = move_task["id"]
    assert_eq("move task starts on board A", move_task["board_id"], move_board_a_id)
    assert_eq("move task starts with board A's label", len(move_task["labels"]), 1)

    # PUT board_id to move the task to board B, WITHOUT sending label_ids — labels
    # must be unconditionally cleared server-side (board A's label is invalid on board B)
    r = client.put(f"/tasks/{move_task_id}", headers=H, json={"board_id": move_board_b_id})
    assert_eq("PUT /tasks/:id board_id move (no label_ids sent) → 200", r.status_code, 200)
    moved_task = r.json()
    assert_eq("task board_id updated to board B", moved_task["board_id"], move_board_b_id)
    assert_eq("labels cleared on board move even without label_ids in the request",
              moved_task["labels"], [])

    # GET /tasks?board_id=board_a must no longer include the moved task; board_b must
    r = client.get("/tasks", headers=H, params={"board_id": move_board_a_id})
    assert_true("moved task excluded from old board's GET /tasks",
                move_task_id not in [t["id"] for t in r.json()["tasks"]])
    r = client.get("/tasks", headers=H, params={"board_id": move_board_b_id})
    assert_in("moved task appears in new board's GET /tasks",
              move_task_id, [t["id"] for t in r.json()["tasks"]])

    # Moving board_id back to board A while sending label_ids for board B (invalid on
    # the destination) in the SAME request → 422, since labels are resolved against
    # the NEW board_id, not the board the task is currently on
    r = client.put(f"/tasks/{move_task_id}", headers=H, json={
        "board_id": move_board_a_id,
        "label_ids": [move_label_b_id],  # belongs to board B, task is moving to board A
    })
    assert_eq("PUT board_id move + label_ids invalid on destination board → 422",
              r.status_code, 422)

    # Moving board_id and sending label_ids that DO belong to the destination board
    # succeeds and attaches them (resolved against the new board_id)
    r = client.put(f"/tasks/{move_task_id}", headers=H, json={
        "board_id": move_board_a_id,
        "label_ids": [move_label_a_id],
    })
    assert_eq("PUT board_id move + matching new-board label_ids → 200", r.status_code, 200)
    moved_back_task = r.json()
    assert_eq("task board_id updated back to board A", moved_back_task["board_id"], move_board_a_id)
    assert_eq("new label attached, resolved against destination board", len(moved_back_task["labels"]), 1)
    if moved_back_task["labels"]:
        assert_eq("attached label matches board A's label", moved_back_task["labels"][0]["id"], move_label_a_id)

    # PUT with board_id equal to the task's current board is a no-op (labels untouched)
    r = client.put(f"/tasks/{move_task_id}", headers=H, json={"board_id": move_board_a_id})
    assert_eq("PUT board_id same as current board → 200 (no-op)", r.status_code, 200)
    assert_eq("labels untouched when board_id equals current board", len(r.json()["labels"]), 1)

    # Omitting board_id entirely leaves the task's board unchanged
    r = client.put(f"/tasks/{move_task_id}", headers=H, json={"title": "Move-between-boards test task (renamed)"})
    assert_eq("PUT omitting board_id → 200", r.status_code, 200)
    assert_eq("board_id unchanged when omitted from PUT body", r.json()["board_id"], move_board_a_id)

    # Moving to a board that doesn't exist → 404
    r = client.put(f"/tasks/{move_task_id}", headers=H, json={"board_id": str(uuid.uuid4())})
    assert_eq("PUT board_id to non-existent board → 404", r.status_code, 404)

    # Moving to a soft-deleted board → 404. get_board_or_404 filters on
    # (id, user_id, is_deleted=False) — the same ownership/existence check a board
    # belonging to a different user would also fail; this test suite only has one
    # user available (no real second Firebase identity to test against), so a
    # deleted board exercises the identical code path.
    r = client.post("/boards", headers=H, json={"name": "Move test board C (to be deleted)"})
    assert_eq("POST /boards move-test board C → 201", r.status_code, 201)
    move_board_c_id = r.json()["id"]
    r = client.delete(f"/boards/{move_board_c_id}", headers=H)
    assert_eq("DELETE move-test board C → 204", r.status_code, 204)
    r = client.put(f"/tasks/{move_task_id}", headers=H, json={"board_id": move_board_c_id})
    assert_eq("PUT board_id to soft-deleted board → 404", r.status_code, 404)

    # Clean up (labels before boards — DELETE /boards/:id 400s if labels remain)
    client.delete(f"/tasks/{move_task_id}", headers=H)
    client.delete(f"/labels/{move_label_a_id}", headers=H)
    client.delete(f"/labels/{move_label_b_id}", headers=H)
    client.delete(f"/boards/{move_board_a_id}", headers=H)
    client.delete(f"/boards/{move_board_b_id}", headers=H)

    # ── Due-date filter params ─────────────────────────────────────────────────
    print("\n── Tasks: Due-date filter params ───────────────────────")
    # Create a task due far in the future to use as a control
    far_future = (date.today() + timedelta(days=60)).isoformat()
    r = client.post("/tasks", headers=H, json={
        "title": "Far future task",
        "must_do_by": far_future,
        "label_ids": [],
    })
    assert_eq("POST /tasks far-future → 201", r.status_code, 201)
    far_task_id = r.json()["id"]

    # due_before should include tasks with must_do_by on or before the cutoff
    r = client.get("/tasks", headers=H, params={"due_before": next_week, "state": "pending"})
    assert_eq("GET /tasks?due_before → 200", r.status_code, 200)
    due_before_ids = [t["id"] for t in r.json()["tasks"]]
    assert_in("task within due_before window is returned", task_id, due_before_ids)
    assert_true("far-future task excluded by due_before",
                far_task_id not in due_before_ids)

    # due_after should include tasks with must_do_by on or after the cutoff
    r = client.get("/tasks", headers=H, params={"due_after": far_future, "state": "pending"})
    assert_eq("GET /tasks?due_after → 200", r.status_code, 200)
    due_after_ids = [t["id"] for t in r.json()["tasks"]]
    assert_in("far-future task included by due_after", far_task_id, due_after_ids)
    assert_true("near-term task excluded by due_after",
                task_id not in due_after_ids)

    # Soft-delete the far-future task so it doesn't pollute other sections
    client.delete(f"/tasks/{far_task_id}", headers=H)

    # Verify the medical label (added in PR #1) can be assigned to a task
    r = client.post("/tasks", headers=H, json={
        "title": "Book doctor appointment",
        "label_ids": [type_labels["medical"]],
    })
    assert_eq("POST /tasks with medical label → 201", r.status_code, 201)
    medical_task = r.json()
    medical_task_id = medical_task["id"]
    medical_label_values = [l["value"] for l in medical_task["labels"]]
    assert_in("medical label on task", "medical", medical_label_values)

    # Filter tasks by medical label to verify label_ids query param works
    r = client.get("/tasks", headers=H, params={"label_ids": type_labels["medical"]})
    assert_eq("GET /tasks?label_ids=medical → 200", r.status_code, 200)
    filtered_ids = [t["id"] for t in r.json()["tasks"]]
    assert_in("medical task in filtered list", medical_task_id, filtered_ids)

    # Soft-delete the medical task so it doesn't pollute other assertions
    client.delete(f"/tasks/{medical_task_id}", headers=H)

    # ── High-priority field ────────────────────────────────────────────────────
    print("\n── Tasks: High Priority ────────────────────────────────")
    today_str = date.today().isoformat()
    tomorrow_str = (date.today() + timedelta(days=1)).isoformat()
    future_str = (date.today() + timedelta(days=10)).isoformat()

    # Creating a task with is_high_priority=true and today's date keeps it true
    r = client.post("/tasks", headers=H, json={
        "title": "HP task due today",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST high-priority task with today's date → 201", r.status_code, 201)
    hp_today_task = r.json()
    hp_today_task_id = hp_today_task["id"]
    assert_eq("is_high_priority stays true for today", hp_today_task["is_high_priority"], True)

    # Creating a task with is_high_priority=true and tomorrow's date keeps it true
    r = client.post("/tasks", headers=H, json={
        "title": "HP task due tomorrow",
        "must_do_by": tomorrow_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST high-priority task with tomorrow's date → 201", r.status_code, 201)
    hp_tomorrow_task = r.json()
    hp_tomorrow_task_id = hp_tomorrow_task["id"]
    assert_eq("is_high_priority stays true for tomorrow", hp_tomorrow_task["is_high_priority"], True)

    # Creating a task with is_high_priority=true but a far-future date auto-resets to false
    r = client.post("/tasks", headers=H, json={
        "title": "HP task due in far future",
        "must_do_by": future_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST high-priority task with future date → 201", r.status_code, 201)
    hp_future_task = r.json()
    hp_future_task_id = hp_future_task["id"]
    assert_eq("is_high_priority auto-reset for future date", hp_future_task["is_high_priority"], False)

    # Creating a task with is_high_priority=true and no date auto-resets to false
    r = client.post("/tasks", headers=H, json={
        "title": "HP task with no date",
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST high-priority task with no date → 201", r.status_code, 201)
    hp_nodate_task = r.json()
    hp_nodate_task_id = hp_nodate_task["id"]
    assert_eq("is_high_priority auto-reset when no date", hp_nodate_task["is_high_priority"], False)

    # Creating a task with is_high_priority=true and target_date=today keeps it true
    r = client.post("/tasks", headers=H, json={
        "title": "HP task target_date today",
        "target_date": today_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST high-priority task with target_date=today → 201", r.status_code, 201)
    hp_target_today_task = r.json()
    hp_target_today_task_id = hp_target_today_task["id"]
    assert_eq("is_high_priority true via target_date=today", hp_target_today_task["is_high_priority"], True)

    # GET /tasks response includes is_high_priority field
    r = client.get("/tasks", headers=H, params={"state": "pending"})
    assert_eq("GET /tasks includes is_high_priority field → 200", r.status_code, 200)
    all_pending = r.json()["tasks"]
    hp_found = next((t for t in all_pending if t["id"] == hp_today_task_id), None)
    assert_true("hp task present in pending list", hp_found is not None)
    assert_true("is_high_priority field present in GET /tasks response",
                "is_high_priority" in (hp_found or {}))
    assert_eq("GET /tasks preserves is_high_priority=true", (hp_found or {}).get("is_high_priority"), True)

    # GET /tasks/:id returns is_high_priority
    r = client.get(f"/tasks/{hp_today_task_id}", headers=H)
    assert_eq("GET /tasks/:id preserves is_high_priority=true → 200", r.status_code, 200)
    assert_eq("GET /tasks/:id is_high_priority value", r.json()["is_high_priority"], True)

    # PUT with is_high_priority=true on a today-dated task keeps it true
    r = client.put(f"/tasks/{hp_today_task_id}", headers=H, json={"is_high_priority": True})
    assert_eq("PUT is_high_priority=true for today-task → 200", r.status_code, 200)
    assert_eq("PUT preserves is_high_priority=true for today", r.json()["is_high_priority"], True)

    # PUT with is_high_priority=false explicitly clears it
    r = client.put(f"/tasks/{hp_today_task_id}", headers=H, json={"is_high_priority": False})
    assert_eq("PUT is_high_priority=false → 200", r.status_code, 200)
    assert_eq("PUT clears is_high_priority", r.json()["is_high_priority"], False)

    # PUT date to future auto-resets is_high_priority regardless of current value
    # First re-enable high priority for the today task
    r = client.put(f"/tasks/{hp_today_task_id}", headers=H, json={"is_high_priority": True})
    assert_eq("Re-enable hp before date-move test → 200", r.status_code, 200)
    # Now move its date to far future — priority should auto-reset
    r = client.put(f"/tasks/{hp_today_task_id}", headers=H, json={"must_do_by": future_str})
    assert_eq("PUT date to future auto-resets is_high_priority → 200", r.status_code, 200)
    assert_eq("is_high_priority auto-reset after date moved to future", r.json()["is_high_priority"], False)

    # PUT clearing date auto-resets is_high_priority
    r = client.put(f"/tasks/{hp_tomorrow_task_id}", headers=H, json={"must_do_by": None})
    assert_eq("PUT clearing date auto-resets is_high_priority → 200", r.status_code, 200)
    assert_eq("is_high_priority auto-reset after date cleared", r.json()["is_high_priority"], False)

    # New tasks default to is_high_priority=false when field is omitted
    r = client.post("/tasks", headers=H, json={
        "title": "HP default test task",
        "must_do_by": today_str,
        "label_ids": [],
    })
    assert_eq("POST task without is_high_priority field → 201", r.status_code, 201)
    hp_default_task = r.json()
    hp_default_task_id = hp_default_task["id"]
    assert_eq("is_high_priority defaults to false when omitted", hp_default_task["is_high_priority"], False)

    # Clean up high-priority test tasks
    for tid in [hp_today_task_id, hp_tomorrow_task_id, hp_future_task_id,
                hp_nodate_task_id, hp_target_today_task_id, hp_default_task_id]:
        client.delete(f"/tasks/{tid}", headers=H)

    # ── HP effective-date min-rule (PR #20 contract) ───────────────────────────
    # PR #20 fixes the frontend's getEffectiveDate() to return min(must_do_by, target_date)
    # instead of preferring target_date. These tests verify the matching backend contract
    # that has always computed effective date as min(must_do_by, target_date).
    print("\n── Tasks: HP effective-date min-rule (PR #20) ──────────")

    # must_do_by=today (earlier) + target_date=far future → effective=today → HP valid
    r = client.post("/tasks", headers=H, json={
        "title": "HP min-date rule: must_do_by today, target_date future",
        "must_do_by": today_str,
        "target_date": future_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST HP task: must_do_by=today, target_date=future → 201", r.status_code, 201)
    hp_mindate_task = r.json()
    hp_mindate_task_id = hp_mindate_task["id"]
    assert_eq("HP valid when must_do_by (earlier) is today even if target_date is future",
              hp_mindate_task["is_high_priority"], True)

    # target_date=today (earlier) + must_do_by=far future → effective=today → HP valid
    r = client.post("/tasks", headers=H, json={
        "title": "HP min-date rule: target_date today, must_do_by future",
        "must_do_by": future_str,
        "target_date": today_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST HP task: target_date=today, must_do_by=future → 201", r.status_code, 201)
    hp_mindate_inv_task = r.json()
    hp_mindate_inv_task_id = hp_mindate_inv_task["id"]
    assert_eq("HP valid when target_date (earlier) is today even if must_do_by is future",
              hp_mindate_inv_task["is_high_priority"], True)

    # Both dates future → effective=future → HP auto-reset to false
    r = client.post("/tasks", headers=H, json={
        "title": "HP min-date rule: both dates future",
        "must_do_by": future_str,
        "target_date": future_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST HP task: both dates future → 201", r.status_code, 201)
    hp_both_future_task = r.json()
    hp_both_future_task_id = hp_both_future_task["id"]
    assert_eq("HP auto-reset when both must_do_by and target_date are future",
              hp_both_future_task["is_high_priority"], False)

    # Clean up min-date test tasks
    for tid in [hp_mindate_task_id, hp_mindate_inv_task_id, hp_both_future_task_id]:
        client.delete(f"/tasks/{tid}", headers=H)

    # ── High-priority daily limit (PR #7) ─────────────────────────────────────
    print("\n── Tasks: High Priority Daily Limit ────────────────────")
    # Create exactly 3 high-priority tasks for today — all should succeed
    hp_limit_ids = []
    for i in range(3):
        r = client.post("/tasks", headers=H, json={
            "title": f"HP limit task {i + 1}",
            "must_do_by": today_str,
            "label_ids": [],
            "is_high_priority": True,
        })
        assert_eq(f"POST hp limit task {i + 1}/3 → 201", r.status_code, 201)
        assert_eq(f"hp limit task {i + 1} is_high_priority=true", r.json()["is_high_priority"], True)
        hp_limit_ids.append(r.json()["id"])

    # 4th high-priority task for today must be rejected with 422
    r = client.post("/tasks", headers=H, json={
        "title": "HP limit task 4 (should fail)",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST 4th high-priority task for today → 422", r.status_code, 422)
    assert_true("422 detail mentions limit", "limited" in r.json().get("detail", "").lower())

    # The rejected task must NOT have been created (GET /tasks shouldn't include it)
    r = client.get("/tasks", headers=H, params={"state": "pending"})
    pending_titles = [t["title"] for t in r.json()["tasks"]]
    assert_true("rejected HP task not created", "HP limit task 4 (should fail)" not in pending_titles)

    # PUT an existing non-HP task to is_high_priority=True when limit is already reached → 422
    r = client.post("/tasks", headers=H, json={
        "title": "HP limit PUT test task",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": False,
    })
    assert_eq("POST normal task for PUT limit test → 201", r.status_code, 201)
    hp_limit_put_task_id = r.json()["id"]

    r = client.put(f"/tasks/{hp_limit_put_task_id}", headers=H, json={"is_high_priority": True})
    assert_eq("PUT is_high_priority=true when limit reached → 422", r.status_code, 422)
    assert_true("PUT 422 detail mentions limit", "limited" in r.json().get("detail", "").lower())

    # Verify that today and tomorrow limits are independent: a 4th HP task for
    # tomorrow must succeed even though today's limit is full
    r = client.post("/tasks", headers=H, json={
        "title": "HP limit task tomorrow",
        "must_do_by": tomorrow_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST 4th high-priority task for tomorrow (different day) → 201", r.status_code, 201)
    hp_limit_tomorrow_id = r.json()["id"]
    assert_eq("tomorrow HP task is_high_priority=true", r.json()["is_high_priority"], True)

    # Removing one task from today's limit allows the 4th to be added again
    client.delete(f"/tasks/{hp_limit_ids[0]}", headers=H)
    hp_limit_ids.pop(0)
    r = client.post("/tasks", headers=H, json={
        "title": "HP limit task after removal",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST HP task after removing one from limit → 201", r.status_code, 201)
    hp_limit_ids.append(r.json()["id"])
    assert_eq("new HP task is_high_priority=true after slot freed", r.json()["is_high_priority"], True)

    # Clean up all high-priority limit test tasks
    for tid in hp_limit_ids + [hp_limit_put_task_id, hp_limit_tomorrow_id]:
        client.delete(f"/tasks/{tid}", headers=H)

    # ── Task completion (one-time) ─────────────────────────────────────────────
    print("\n── Tasks: Complete (one-time) ──────────────────────────")
    r = client.post(f"/tasks/{task_id}/complete", headers=H, json={"notes": "All returned"})
    assert_eq("POST /tasks/:id/complete → 200", r.status_code, 200)
    result = r.json()
    assert_eq("completed state", result["completed_task"]["state"], "done")
    assert_eq("no next task for one-time", result["next_task"], None)

    # ── Recurring task (PR #30: recurrence logic removed) ─────────────────────
    # PR #30 removes recurrence logic from complete_task(). next_task is always null.
    # Frequency labels are no longer seeded for new users, and mode labels are removed in PR #51,
    # so this section now verifies that completing ANY task always returns next_task: null.
    print("\n── Tasks: Complete always returns next_task=null (PR #30) ──")
    today_str = date.today().isoformat()
    r = client.post("/tasks", headers=H, json={
        "title": "Daily exercise",
        "must_do_by": today_str,
        "label_ids": [type_labels["household"]],
    })
    assert_eq("POST task for recurrence-removal test → 201", r.status_code, 201)
    rec_task_id = r.json()["id"]

    r = client.post(f"/tasks/{rec_task_id}/complete", headers=H)
    assert_eq("Complete task → 200 (PR #30)", r.status_code, 200)
    result = r.json()
    assert_eq("completed task state is done (PR #30)", result["completed_task"]["state"], "done")
    # PR #30: recurrence logic removed — next_task is always null regardless of labels
    assert_eq("next_task is always null after PR #30", result["next_task"], None)
    # Completing the same task again must return 422 (already done)
    r = client.post(f"/tasks/{rec_task_id}/complete", headers=H)
    assert_eq("Complete already-done task → 422", r.status_code, 422)

    # ── Soft delete ────────────────────────────────────────────────────────────
    print("\n── Tasks: Soft Delete ──────────────────────────────────")
    r = client.delete(f"/tasks/{rec_task_id}", headers=H)
    assert_eq("DELETE /tasks/:id → 204", r.status_code, 204)
    r = client.get(f"/tasks/{rec_task_id}", headers=H)
    assert_eq("deleted task is 404", r.status_code, 404)

    r = client.get("/tasks", headers=H, params={"include_deleted": "true"})
    deleted_ids = [t["id"] for t in r.json()["tasks"] if t["is_deleted"]]
    assert_in("soft deleted task present with include_deleted", rec_task_id, deleted_ids)

    # ── Beliefs ────────────────────────────────────────────────────────────────
    print("\n── Beliefs ─────────────────────────────────────────────")
    r = client.post("/tasks", headers=H, json={
        "title": "Pay electricity bill online",
        "label_ids": [],
    })
    belief_task_id = r.json()["id"]

    if os.getenv("ANTHROPIC_API_KEY"):
        r = client.post(f"/tasks/{belief_task_id}/beliefs/generate", headers=H)
        assert_eq("POST beliefs/generate → 200", r.status_code, 200)
        beliefs = r.json()["beliefs"]
        print(f"    Generated {len(beliefs)} belief(s)")
        assert_true("at least one belief generated", len(beliefs) >= 1)

        if beliefs:
            belief_id = beliefs[0]["id"]
            r = client.put(f"/beliefs/{belief_id}", headers=H, json={"status": "accepted"})
            assert_eq("PUT /beliefs/:id → 200", r.status_code, 200)
            assert_eq("belief status accepted", r.json()["status"], "accepted")

        r = client.get(f"/tasks/{belief_task_id}/beliefs", headers=H, params={"status": "accepted"})
        assert_eq("GET task beliefs → 200", r.status_code, 200)
    else:
        print("  (skipping belief AI tests — ANTHROPIC_API_KEY not set)")

    # ── target_date-only task (PR #4: must not be excluded from pending queries
    # just because must_do_by is unset; originally added to cover the now-removed
    # chat AI context, the underlying task-model behavior is still worth pinning) ─
    print("\n── Tasks: target_date-only task ─────────────────────────")
    target_only_date = (date.today() + timedelta(days=3)).isoformat()
    r = client.post("/tasks", headers=H, json={
        "title": "Target-date-only test task",
        "must_do_by": None,
        "target_date": target_only_date,
        "label_ids": [],
    })
    assert_eq("POST task with target_date only → 201", r.status_code, 201)
    target_only_task = r.json()
    target_only_task_id = target_only_task["id"]
    assert_eq("target_date-only task has no must_do_by", target_only_task["must_do_by"], None)
    assert_eq("target_date-only task has target_date", target_only_task["target_date"], target_only_date)

    # Verify the task is returned in a normal GET /tasks listing (state=pending)
    r = client.get("/tasks", headers=H, params={"state": "pending"})
    assert_eq("GET /tasks pending includes target_date-only task → 200", r.status_code, 200)
    pending_ids = [t["id"] for t in r.json()["tasks"]]
    assert_in("target_date-only task in pending list", target_only_task_id, pending_ids)

    # ── Conversations — removed (PR #50) ──────────────────────────────────────
    # The /conversations router, ai_service.handle_conversation_message(), and the
    # conversations/messages tables were deleted entirely — chat was already gone
    # from both frontends (web PR #41, mobile PR #46) and this PR completes the
    # removal. Verify the endpoints are actually gone rather than just untested.
    print("\n── Conversations (removed, PR #50) ──────────────────────")
    r = client.post("/conversations", headers=H)
    assert_eq("POST /conversations → 404 (router removed, PR #50)", r.status_code, 404)
    r = client.get(f"/conversations/{uuid.uuid4()}/messages", headers=H)
    assert_eq("GET /conversations/:id/messages → 404 (router removed, PR #50)", r.status_code, 404)

    # Clean up the target-date-only task
    client.delete(f"/tasks/{target_only_task_id}", headers=H)

    # ── Reports ────────────────────────────────────────────────────────────────
    print("\n── Reports ─────────────────────────────────────────────")
    # NOTE: the backend filters completed_at (TIMESTAMP) against to_date (DATE).
    # In PostgreSQL, '2026-06-10T15:00:00 <= 2026-06-10' is FALSE because a bare
    # date is cast to midnight (00:00:00). Tasks completed TODAY are therefore
    # excluded when to_date = today. We use to_date = tomorrow so that tasks
    # completed during this test run are included in the results.
    from_date = (date.today() - timedelta(days=7)).isoformat()
    to_date = (date.today() + timedelta(days=1)).isoformat()  # tomorrow, to include today's completions
    r = client.get("/reports/completions", headers=H, params={"from": from_date, "to": to_date})
    assert_eq("GET /reports/completions → 200", r.status_code, 200)
    report = r.json()
    assert_in("report has completions", "completions", report)
    assert_in("report has total", "total", report)
    assert_true("total matches completions count", report["total"] == len(report["completions"]))

    # The one-time task (task_id) was completed earlier in this test run.
    # Verify that a completion record has all fields the mobile ReportsScreen needs.
    completed_ids_in_report = [c["task_id"] for c in report["completions"]]
    assert_in("completed task appears in report by task_id", task_id, completed_ids_in_report)
    completion_rec = next((c for c in report["completions"] if c["task_id"] == task_id), None)
    assert_true("completion record found for completed task", completion_rec is not None)
    if completion_rec is not None:
        assert_in("completion record has task_id field", "task_id", completion_rec)
        assert_in("completion record has title field", "title", completion_rec)
        assert_in("completion record has completed_at field", "completed_at", completion_rec)
        assert_in("completion record has labels field", "labels", completion_rec)
        assert_true("completion record labels is a list", isinstance(completion_rec["labels"], list))
        # The completed task had its labels updated to [child] via PUT before completion (PR #51: mode removed).
        completion_label_values = {l["value"] for l in completion_rec["labels"]}
        assert_in("child label in completion record", "child", completion_label_values)
        # Each label in a completion record must have id, category, value
        if completion_rec["labels"]:
            first_label = completion_rec["labels"][0]
            assert_in("completion label has id", "id", first_label)
            assert_in("completion label has category", "category", first_label)
            assert_in("completion label has value", "value", first_label)

    # Missing required query params → 422
    r = client.get("/reports/completions", headers=H, params={"from": from_date})
    assert_eq("GET /reports/completions missing 'to' → 422", r.status_code, 422)
    r = client.get("/reports/completions", headers=H, params={"to": to_date})
    assert_eq("GET /reports/completions missing 'from' → 422", r.status_code, 422)
    r = client.get("/reports/completions", headers=H)
    assert_eq("GET /reports/completions missing both params → 422", r.status_code, 422)

    # Date range filtering: a future-only range must return empty results
    future_from = (date.today() + timedelta(days=30)).isoformat()
    future_to = (date.today() + timedelta(days=37)).isoformat()
    r = client.get("/reports/completions", headers=H, params={"from": future_from, "to": future_to})
    assert_eq("GET /reports/completions future range → 200", r.status_code, 200)
    future_report = r.json()
    assert_eq("future range returns 0 completions", future_report["total"], 0)
    assert_eq("future range completions list is empty", future_report["completions"], [])

    # Auth required: no headers → 401
    r = client.get("/reports/completions", params={"from": from_date, "to": to_date})
    assert_eq("GET /reports/completions with no auth → 401", r.status_code, 401)

    # label_ids filter on reports: the completed task (task_id) now has child + household labels
    # (PR #51: mode labels removed, so we use type labels instead).
    # Filtering by child label should include the task.
    child_label_id = type_labels["child"]
    r = client.get("/reports/completions", headers=H,
                   params={"from": from_date, "to": to_date, "label_ids": child_label_id})
    assert_eq("GET /reports/completions with label_ids filter → 200", r.status_code, 200)
    label_filtered_report = r.json()
    label_filtered_ids = [c["task_id"] for c in label_filtered_report["completions"]]
    assert_in("completed task found via label_ids filter", task_id, label_filtered_ids)

    # Filtering by a label that the completed task does NOT have → excludes the task
    financial_label_id = type_labels["financial"]
    r = client.get("/reports/completions", headers=H,
                   params={"from": from_date, "to": to_date, "label_ids": financial_label_id})
    assert_eq("GET /reports/completions with non-matching label_ids → 200", r.status_code, 200)
    nonmatch_report = r.json()
    nonmatch_ids = [c["task_id"] for c in nonmatch_report["completions"]]
    assert_true("completed task excluded by non-matching label_ids filter",
                task_id not in nonmatch_ids)

    # board_id filter on reports (PR #35): mobile client now always passes board_id.
    # The completed task (task_id) is on default_board_id. Filtering by default board
    # should include it; filtering by a different board should exclude it.
    print("\n── Reports: board_id filter on GET /reports/completions (PR #35) ─")
    # task_id is on default_board_id — it should appear when scoped to that board
    r = client.get("/reports/completions", headers=H,
                   params={"from": from_date, "to": to_date, "board_id": default_board_id})
    assert_eq("GET /reports/completions?board_id=default → 200", r.status_code, 200)
    board_report_default = r.json()
    board_report_default_ids = [c["task_id"] for c in board_report_default["completions"]]
    assert_in("completed task appears in default board report", task_id, board_report_default_ids)

    # Create a second board to use as a control — the completed task must NOT appear there
    r = client.post("/boards", headers=H, json={"name": "Reports filter test board"})
    assert_eq("POST /boards for reports board_id filter test → 201", r.status_code, 201)
    reports_filter_board_id = r.json()["id"]

    r = client.get("/reports/completions", headers=H,
                   params={"from": from_date, "to": to_date, "board_id": reports_filter_board_id})
    assert_eq("GET /reports/completions?board_id=other_board → 200", r.status_code, 200)
    board_report_other = r.json()
    board_report_other_ids = [c["task_id"] for c in board_report_other["completions"]]
    assert_true("completed task excluded from other board report",
                task_id not in board_report_other_ids)

    # Clean up the board created for this test
    client.delete(f"/boards/{reports_filter_board_id}", headers=H)

    # ── Settings ───────────────────────────────────────────────────────────────
    print("\n── Settings ────────────────────────────────────────────")
    r = client.get("/settings", headers=H)
    assert_eq("GET /settings → 200", r.status_code, 200)
    settings_body = r.json()
    assert_in("GET /settings has high_priority_daily_limit field", "high_priority_daily_limit", settings_body)
    assert_eq("GET /settings default high_priority_daily_limit is 3", settings_body["high_priority_daily_limit"], 3)
    # PR #50: starter_questions removed end-to-end (only ever fed the removed chat screen)
    assert_true("GET /settings no longer has starter_questions field (PR #50)",
                "starter_questions" not in settings_body)

    r = client.put("/settings", headers=H, json={"high_priority_daily_limit": 3})
    assert_eq("PUT /settings → 200", r.status_code, 200)
    assert_in("PUT /settings response has high_priority_daily_limit", "high_priority_daily_limit", r.json())
    assert_true("PUT /settings response no longer has starter_questions field (PR #50)",
                "starter_questions" not in r.json())

    # PUT /settings with explicit high_priority_daily_limit persists and round-trips
    r = client.put("/settings", headers=H, json={"high_priority_daily_limit": 5})
    assert_eq("PUT /settings with custom limit → 200", r.status_code, 200)
    assert_eq("PUT /settings custom limit round-trips", r.json()["high_priority_daily_limit"], 5)
    r = client.get("/settings", headers=H)
    assert_eq("GET /settings after update → 200", r.status_code, 200)
    assert_eq("GET /settings persisted custom limit", r.json()["high_priority_daily_limit"], 5)

    # Floor of 1: sending 0 is rejected by schema validation (ge=1 on SettingsUpdate)
    # The PRD says minimum 1; the schema enforces this at the Pydantic layer (422),
    # rather than silently clamping. 422 is correct behaviour here.
    r = client.put("/settings", headers=H, json={"high_priority_daily_limit": 0})
    assert_eq("PUT /settings with limit=0 → 422 (schema min=1 rejects it)", r.status_code, 422)

    # Omitting high_priority_daily_limit in PUT body uses schema default of 3
    r = client.put("/settings", headers=H, json={})
    assert_eq("PUT /settings with empty body → 200", r.status_code, 200)
    assert_eq("limit defaults to 3 when omitted from PUT body", r.json()["high_priority_daily_limit"], 3)

    # PR #50: starter_questions is no longer a field on SettingsUpdate at all. A stale
    # client (or the mobile/web clients before this PR is deployed to them) may still
    # send it — Pydantic's default "ignore extra fields" behaviour means the request
    # must still succeed and the field must not be echoed back or persisted anywhere.
    r = client.put("/settings", headers=H, json={"starter_questions": ["stale client field"], "high_priority_daily_limit": 3})
    assert_eq("PUT /settings with stray starter_questions field → 200 (ignored, not rejected)", r.status_code, 200)
    assert_true("stray starter_questions field not echoed back in response",
                "starter_questions" not in r.json())

    # ── Configurable high-priority limit (PR #9) ──────────────────────────────
    print("\n── Settings: Configurable High-Priority Limit ──────────")
    # Set limit to 2 for this test section
    r = client.put("/settings", headers=H, json={"high_priority_daily_limit": 2})
    assert_eq("PUT /settings set limit to 2 → 200", r.status_code, 200)
    assert_eq("limit confirmed as 2", r.json()["high_priority_daily_limit"], 2)

    # Create 2 HP tasks for today — both should succeed under limit=2
    hp_config_ids = []
    for i in range(2):
        r = client.post("/tasks", headers=H, json={
            "title": f"HP config task {i + 1}",
            "must_do_by": today_str,
            "label_ids": [],
            "is_high_priority": True,
        })
        assert_eq(f"POST hp config task {i + 1}/2 with limit=2 → 201", r.status_code, 201)
        assert_eq(f"hp config task {i + 1} is_high_priority=true", r.json()["is_high_priority"], True)
        hp_config_ids.append(r.json()["id"])

    # 3rd HP task must be rejected now that limit=2 is reached
    r = client.post("/tasks", headers=H, json={
        "title": "HP config task 3 (should fail at limit=2)",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST 3rd HP task when limit=2 → 422", r.status_code, 422)
    assert_true("422 detail references limit=2", "2" in r.json().get("detail", ""))

    # Raise limit to 4 — the same 3rd task should now succeed
    r = client.put("/settings", headers=H, json={"high_priority_daily_limit": 4})
    assert_eq("PUT /settings raise limit to 4 → 200", r.status_code, 200)
    r = client.post("/tasks", headers=H, json={
        "title": "HP config task 3 (should succeed at limit=4)",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST 3rd HP task when limit=4 → 201", r.status_code, 201)
    assert_eq("3rd HP task is_high_priority=true under limit=4", r.json()["is_high_priority"], True)
    hp_config_ids.append(r.json()["id"])

    # PUT an existing non-HP task to HP when limit=4 but 3 already exist → should succeed
    r = client.post("/tasks", headers=H, json={
        "title": "HP config PUT test task",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": False,
    })
    assert_eq("POST normal task for HP config PUT test → 201", r.status_code, 201)
    hp_config_put_task_id = r.json()["id"]
    r = client.put(f"/tasks/{hp_config_put_task_id}", headers=H, json={"is_high_priority": True})
    assert_eq("PUT is_high_priority=true when count=3, limit=4 → 200", r.status_code, 200)
    assert_eq("PUT HP succeeds under limit=4", r.json()["is_high_priority"], True)
    hp_config_ids.append(hp_config_put_task_id)

    # 5th task must be rejected (count=4, limit=4)
    r = client.post("/tasks", headers=H, json={
        "title": "HP config task 5 (should fail at limit=4)",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST 5th HP task when limit=4 → 422", r.status_code, 422)

    # Clean up HP config test tasks and restore limit to 3
    for tid in hp_config_ids:
        client.delete(f"/tasks/{tid}", headers=H)
    r = client.put("/settings", headers=H, json={"high_priority_daily_limit": 3})
    assert_eq("Restore limit to 3 after configurable-limit test → 200", r.status_code, 200)

    # ── Sync ───────────────────────────────────────────────────────────────────
    print("\n── Sync ────────────────────────────────────────────────")
    from datetime import datetime, timezone
    last_synced = "2020-01-01T00:00:00Z"
    r = client.post("/sync", headers=H, json={
        "last_synced_at": last_synced,
        "changes": {"tasks": [], "task_labels": [], "beliefs": []},
    })
    assert_eq("POST /sync → 200", r.status_code, 200)
    sync_result = r.json()
    assert_in("sync has synced_at", "synced_at", sync_result)
    assert_in("sync has changes", "changes", sync_result)
    assert_true("sync returns tasks", isinstance(sync_result["changes"]["tasks"], list))
    assert_true("completed tasks in sync response", len(sync_result["changes"]["tasks"]) >= 2)
    # Verify is_high_priority field is included in sync task objects (PR #6)
    # PR #31: recurrence_group_id column dropped — must not appear in sync task objects
    if sync_result["changes"]["tasks"]:
        first_sync_task = sync_result["changes"]["tasks"][0]
        assert_in("sync task object includes is_high_priority field", "is_high_priority", first_sync_task)
        assert_true("sync task object has no recurrence_group_id field (PR #31)",
                    "recurrence_group_id" not in first_sync_task)
        # PR #33: board_id must be present in sync task objects
        assert_in("sync task object includes board_id field (PR #33)", "board_id", first_sync_task)
    # PR #33: sync response must include boards array
    assert_in("sync changes has boards array (PR #33)", "boards", sync_result["changes"])
    assert_true("sync boards is a list (PR #33)", isinstance(sync_result["changes"]["boards"], list))

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
            "beliefs": [],
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
            "beliefs": [],
        },
    })
    assert_eq("POST /sync with stale recurrence_group_id field → 200 (PR #31 backward compat)",
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
            "beliefs": [],
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
            "beliefs": [],
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
            "beliefs": [],
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
            "beliefs": [],
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
        "changes": {"tasks": [], "task_labels": [], "beliefs": []},
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

    # ── Focused View: config (PR #36) ─────────────────────────────────────────
    print("\n── Focused View: config (PR #36) ────────────────────────────────")

    # Auth required for all focused-view endpoints
    r = client.get("/focused-view/config")
    assert_eq("GET /focused-view/config with no auth → 401", r.status_code, 401)
    r = client.put("/focused-view/config", json={
        "board_selection": "all", "selected_board_ids": [], "day_range": "today"
    })
    assert_eq("PUT /focused-view/config with no auth → 401", r.status_code, 401)
    r = client.get("/focused-view/tasks")
    assert_eq("GET /focused-view/tasks with no auth → 401", r.status_code, 401)

    # GET /focused-view/config — creates default config on first call
    r = client.get("/focused-view/config", headers=H)
    assert_eq("GET /focused-view/config → 200", r.status_code, 200)
    fv_config = r.json()
    assert_in("focused view config has id", "id", fv_config)
    assert_in("focused view config has board_selection", "board_selection", fv_config)
    assert_in("focused view config has selected_board_ids", "selected_board_ids", fv_config)
    assert_in("focused view config has day_range", "day_range", fv_config)
    assert_eq("default board_selection is all", fv_config.get("board_selection"), "all")
    # PR #40: get_or_create_config() now defaults new configs' day_range to "today"
    # (was "today_tomorrow"). Existing users are migrated by a one-off script, not
    # runtime behavior — this assertion covers the lazy-create path exercised here
    # since cleanup() deletes focused_view_configs for the test user before this runs.
    assert_eq("default day_range is today (PR #40: changed from today_tomorrow)",
              fv_config.get("day_range"), "today")
    assert_eq("default selected_board_ids is empty list", fv_config.get("selected_board_ids"), [])

    # GET /focused-view/config — idempotent: second call returns same config row
    r = client.get("/focused-view/config", headers=H)
    assert_eq("GET /focused-view/config second call → 200", r.status_code, 200)
    assert_eq("same config id on second call (idempotent)", r.json().get("id"), fv_config.get("id"))

    # PUT /focused-view/config — update to all/today
    r = client.put("/focused-view/config", headers=H, json={
        "board_selection": "all",
        "selected_board_ids": [],
        "day_range": "today",
    })
    assert_eq("PUT /focused-view/config all/today → 200", r.status_code, 200)
    updated_fv_config = r.json()
    assert_eq("board_selection updated to all", updated_fv_config.get("board_selection"), "all")
    assert_eq("day_range updated to today", updated_fv_config.get("day_range"), "today")
    assert_eq("selected_board_ids cleared to [] for all mode",
              updated_fv_config.get("selected_board_ids"), [])

    # PUT /focused-view/config — update to selected boards
    r = client.put("/focused-view/config", headers=H, json={
        "board_selection": "selected",
        "selected_board_ids": [default_board_id],
        "day_range": "today_plus_two",
    })
    assert_eq("PUT /focused-view/config selected/today_plus_two → 200", r.status_code, 200)
    selected_fv_config = r.json()
    assert_eq("board_selection set to selected", selected_fv_config.get("board_selection"), "selected")
    assert_eq("selected_board_ids contains default board",
              selected_fv_config.get("selected_board_ids"), [default_board_id])
    assert_eq("day_range set to today_plus_two", selected_fv_config.get("day_range"), "today_plus_two")

    # PUT /focused-view/config — invalid board_selection → 400
    r = client.put("/focused-view/config", headers=H, json={
        "board_selection": "weekly",
        "selected_board_ids": [],
        "day_range": "today",
    })
    assert_eq("PUT /focused-view/config invalid board_selection → 400", r.status_code, 400)

    # PUT /focused-view/config — invalid day_range → 400
    r = client.put("/focused-view/config", headers=H, json={
        "board_selection": "all",
        "selected_board_ids": [],
        "day_range": "this_week",
    })
    assert_eq("PUT /focused-view/config invalid day_range → 400", r.status_code, 400)

    # PUT /focused-view/config — selected with empty selected_board_ids → 400
    r = client.put("/focused-view/config", headers=H, json={
        "board_selection": "selected",
        "selected_board_ids": [],
        "day_range": "today",
    })
    assert_eq("PUT /focused-view/config selected with empty ids → 400", r.status_code, 400)
    assert_true("400 detail mentions selected_board_ids",
                "selected" in r.json().get("detail", "").lower())

    # PUT /focused-view/config — selected with board ID not owned by caller → 400
    fake_board_id = str(uuid.uuid4())
    r = client.put("/focused-view/config", headers=H, json={
        "board_selection": "selected",
        "selected_board_ids": [fake_board_id],
        "day_range": "today",
    })
    assert_eq("PUT /focused-view/config selected with unowned board → 400", r.status_code, 400)

    # Reset config to all/today_tomorrow for tasks section
    r = client.put("/focused-view/config", headers=H, json={
        "board_selection": "all",
        "selected_board_ids": [],
        "day_range": "today_tomorrow",
    })
    assert_eq("PUT /focused-view/config reset to all/today_tomorrow → 200", r.status_code, 200)

    # ── Focused View: tasks (PR #36) ──────────────────────────────────────────
    print("\n── Focused View: tasks (PR #36) ─────────────────────────────────")
    fv_today_str = date.today().isoformat()

    # Create an HP task due today on the default board
    r = client.post("/tasks", headers=H, json={
        "title": "Focused view HP task today",
        "must_do_by": fv_today_str,
        "label_ids": [],
        "is_high_priority": True,
        "board_id": default_board_id,
    })
    assert_eq("POST focused view HP task (default board) → 201", r.status_code, 201)
    fv_hp_task_id = r.json()["id"]
    assert_eq("focused view HP task is_high_priority=true", r.json()["is_high_priority"], True)

    # Create a non-HP task due today — must NOT appear in focused view
    r = client.post("/tasks", headers=H, json={
        "title": "Focused view non-HP task",
        "must_do_by": fv_today_str,
        "label_ids": [],
        "is_high_priority": False,
        "board_id": default_board_id,
    })
    assert_eq("POST focused view non-HP task → 201", r.status_code, 201)
    fv_nonhp_task_id = r.json()["id"]

    # Create a second board and set a color on it
    r = client.post("/boards", headers=H, json={"name": "Focused view test board"})
    assert_eq("POST /boards for focused view test → 201", r.status_code, 201)
    fv_board_id = r.json()["id"]

    r = client.put(f"/boards/{fv_board_id}", headers=H, json={"color": "#ff6600"})
    assert_eq("PUT /boards/:id set color for focused view board → 200", r.status_code, 200)

    # Create an HP task on the colored board
    r = client.post("/tasks", headers=H, json={
        "title": "HP task on colored board",
        "must_do_by": fv_today_str,
        "label_ids": [],
        "is_high_priority": True,
        "board_id": fv_board_id,
    })
    assert_eq("POST HP task on colored board → 201", r.status_code, 201)
    fv_colored_board_task_id = r.json()["id"]
    assert_eq("colored board HP task is_high_priority=true", r.json()["is_high_priority"], True)

    # GET /focused-view/tasks — all boards, today_tomorrow window
    r = client.get("/focused-view/tasks", headers=H, params={"reference_date": fv_today_str})
    assert_eq("GET /focused-view/tasks → 200", r.status_code, 200)
    fv_tasks_body = r.json()
    assert_in("focused view response has boards key", "boards", fv_tasks_body)
    fv_boards_list = fv_tasks_body["boards"]

    # Default board group — must appear (has HP task)
    fv_default_group = next((b for b in fv_boards_list if b["board_id"] == default_board_id), None)
    assert_true("default board group appears in focused view tasks", fv_default_group is not None)
    if fv_default_group is not None:
        # Board group shape
        assert_in("board group has board_id", "board_id", fv_default_group)
        assert_in("board group has board_name", "board_name", fv_default_group)
        assert_in("board group has board_color", "board_color", fv_default_group)
        assert_in("board group has tasks", "tasks", fv_default_group)
        assert_eq("board group board_name is General tasks", fv_default_group["board_name"], "General tasks")
        assert_eq("board_color is null (no color set on default board)", fv_default_group.get("board_color"), None)
        # HP task must appear; non-HP task must not
        fv_default_task_ids = [t["id"] for t in fv_default_group["tasks"]]
        assert_in("HP task appears in focused view default board", fv_hp_task_id, fv_default_task_ids)
        assert_true("non-HP task excluded from focused view", fv_nonhp_task_id not in fv_default_task_ids)
        # Task objects include full shape
        hp_task_obj = next((t for t in fv_default_group["tasks"] if t["id"] == fv_hp_task_id), None)
        assert_true("HP task object found in focused view", hp_task_obj is not None)
        if hp_task_obj:
            assert_in("focused view task has board_id", "board_id", hp_task_obj)
            assert_eq("focused view task is_high_priority=true", hp_task_obj.get("is_high_priority"), True)
            assert_eq("focused view task state is pending", hp_task_obj.get("state"), "pending")

    # Colored board group — must appear with board_color set
    fv_colored_group = next((b for b in fv_boards_list if b["board_id"] == fv_board_id), None)
    assert_true("colored board group appears in focused view tasks", fv_colored_group is not None)
    if fv_colored_group is not None:
        assert_eq("board_color reflects PUT value (#ff6600)", fv_colored_group.get("board_color"), "#ff6600")

    # HP task with only target_date (no must_do_by) must also appear in focused view.
    # The service uses or_(must_do_by.in_(window), target_date.in_(window)) —
    # verify the target_date branch works at the integration level.
    r = client.post("/tasks", headers=H, json={
        "title": "FV target_date-only HP task",
        "target_date": fv_today_str,
        "label_ids": [],
        "is_high_priority": True,
        "board_id": default_board_id,
    })
    assert_eq("POST FV target_date-only HP task → 201", r.status_code, 201)
    fv_target_only_task_id = r.json()["id"]
    assert_eq("FV target_date-only HP task is_high_priority=true", r.json()["is_high_priority"], True)

    r = client.get("/focused-view/tasks", headers=H, params={"reference_date": fv_today_str})
    assert_eq("GET /focused-view/tasks with target_date-only HP task → 200", r.status_code, 200)
    fv_target_boards = r.json()["boards"]
    fv_target_group = next((b for b in fv_target_boards if b["board_id"] == default_board_id), None)
    assert_true("default board group present for target_date-only HP task", fv_target_group is not None)
    if fv_target_group is not None:
        fv_target_task_ids = [t["id"] for t in fv_target_group["tasks"]]
        assert_in("target_date-only HP task appears in focused view", fv_target_only_task_id, fv_target_task_ids)

        # PR #47: Verify high-priority tasks are sorted by updated_at DESC
        # Both tasks are HP, so order should be by updated_at DESC (most recent first)
        fv_target_only_pos = None
        fv_hp_original_pos = None
        for idx, task in enumerate(fv_target_group["tasks"]):
            if task["id"] == fv_target_only_task_id:
                fv_target_only_pos = idx
            elif task["id"] == fv_hp_task_id:
                fv_hp_original_pos = idx
        assert_true("target_date-only HP task position found", fv_target_only_pos is not None)
        assert_true("original HP task position found", fv_hp_original_pos is not None)
        if fv_target_only_pos is not None and fv_hp_original_pos is not None:
            assert_true("target_date-only task appears before original task (PR #47: sorted by updated_at DESC)",
                        fv_target_only_pos < fv_hp_original_pos)

    # Complete the HP task on the default board — done tasks must NOT appear
    r = client.post(f"/tasks/{fv_hp_task_id}/complete", headers=H)
    assert_eq("Complete focused view HP task → 200", r.status_code, 200)

    r = client.get("/focused-view/tasks", headers=H, params={"reference_date": fv_today_str})
    assert_eq("GET /focused-view/tasks after HP task completion → 200", r.status_code, 200)
    fv_boards_after = r.json()["boards"]
    fv_default_after = next((b for b in fv_boards_after if b["board_id"] == default_board_id), None)
    if fv_default_after is not None:
        fv_task_ids_after = [t["id"] for t in fv_default_after["tasks"]]
        assert_true("completed HP task excluded from focused view", fv_hp_task_id not in fv_task_ids_after)
    # If fv_default_after is None, the board is correctly omitted (zero qualifying tasks)

    # board_selection=selected: only the colored board's tasks appear
    r = client.put("/focused-view/config", headers=H, json={
        "board_selection": "selected",
        "selected_board_ids": [fv_board_id],
        "day_range": "today_tomorrow",
    })
    assert_eq("PUT /focused-view/config to selected/fv_board only → 200", r.status_code, 200)

    r = client.get("/focused-view/tasks", headers=H, params={"reference_date": fv_today_str})
    assert_eq("GET /focused-view/tasks with selected board only → 200", r.status_code, 200)
    fv_selected_result = r.json()["boards"]
    fv_result_board_ids = [b["board_id"] for b in fv_selected_result]
    assert_true("only selected board appears when board_selection=selected",
                all(bid == fv_board_id for bid in fv_result_board_ids))
    assert_true("default board excluded by selected board_selection",
                default_board_id not in fv_result_board_ids)

    # reference_date param: pass tomorrow's date — HP task with must_do_by=today
    # is NOT in window for tomorrow, so the colored board should not appear if
    # the colored board task has must_do_by=today and the reference_date is day_after_tomorrow.
    # Use day_after_tomorrow to check the window exclusion.
    fv_day_after_tomorrow = (date.today() + timedelta(days=2)).isoformat()
    r = client.get("/focused-view/tasks", headers=H, params={"reference_date": fv_day_after_tomorrow})
    assert_eq("GET /focused-view/tasks with reference_date=day_after_tomorrow → 200", r.status_code, 200)
    # Config is selected/today_tomorrow window relative to day_after_tomorrow.
    # The colored board task has must_do_by=today, which is NOT in
    # [day_after_tomorrow, day_after_tomorrow+1], so the colored board should be omitted.
    fv_datat_result = r.json()["boards"]
    fv_datat_board_ids = [b["board_id"] for b in fv_datat_result]
    assert_true("colored board excluded when reference_date moves window past today",
                fv_board_id not in fv_datat_board_ids)

    # Reset config back to all/today_tomorrow
    r = client.put("/focused-view/config", headers=H, json={
        "board_selection": "all",
        "selected_board_ids": [],
        "day_range": "today_tomorrow",
    })
    assert_eq("PUT /focused-view/config reset to all/today_tomorrow → 200", r.status_code, 200)

    # Clean up focused view test tasks and board
    client.delete(f"/tasks/{fv_nonhp_task_id}", headers=H)
    client.delete(f"/tasks/{fv_target_only_task_id}", headers=H)
    client.delete(f"/tasks/{fv_colored_board_task_id}", headers=H)
    client.delete(f"/boards/{fv_board_id}", headers=H)

    # ── Day View (PR #40) ───────────────────────────────────────────────────────
    # GET /day-view/tasks reuses the FocusedViewTasksOut response shape but, unlike
    # Focused View, returns ALL pending tasks (any priority) across ALL boards for a
    # single reference_date — no config, no board_selection, no day_range window.
    print("\n── Day View (PR #40) ────────────────────────────────────")

    # Auth required
    r = client.get("/day-view/tasks", params={"reference_date": date.today().isoformat()})
    assert_eq("GET /day-view/tasks with no auth → 401", r.status_code, 401)

    # reference_date is a required query param (no default) → 422 when omitted
    r = client.get("/day-view/tasks", headers=H)
    assert_eq("GET /day-view/tasks without reference_date → 422", r.status_code, 422)

    dv_today_str = date.today().isoformat()
    dv_tomorrow_str = (date.today() + timedelta(days=1)).isoformat()

    # HP task due today on the default board — must appear
    r = client.post("/tasks", headers=H, json={
        "title": "Day view HP task today",
        "must_do_by": dv_today_str,
        "label_ids": [],
        "is_high_priority": True,
        "board_id": default_board_id,
    })
    assert_eq("POST day view HP task (default board) → 201", r.status_code, 201)
    dv_hp_task_id = r.json()["id"]

    # Normal-priority task due today on the default board — must ALSO appear
    # (day-view, unlike focused-view, is not filtered to is_high_priority)
    r = client.post("/tasks", headers=H, json={
        "title": "Day view normal-priority task today",
        "must_do_by": dv_today_str,
        "label_ids": [],
        "is_high_priority": False,
        "board_id": default_board_id,
    })
    assert_eq("POST day view normal-priority task (default board) → 201", r.status_code, 201)
    dv_normal_task_id = r.json()["id"]

    # A second board with its own qualifying task — must appear as its own group
    r = client.post("/boards", headers=H, json={"name": "Day view test board"})
    assert_eq("POST /boards for day view test → 201", r.status_code, 201)
    dv_board_id = r.json()["id"]

    r = client.post("/tasks", headers=H, json={
        "title": "Day view task on second board",
        "target_date": dv_today_str,
        "label_ids": [],
        "board_id": dv_board_id,
    })
    assert_eq("POST day view task (second board, target_date-only) → 201", r.status_code, 201)
    dv_other_board_task_id = r.json()["id"]

    # A task due tomorrow (not today) — must NOT appear when reference_date=today
    r = client.post("/tasks", headers=H, json={
        "title": "Day view task due tomorrow",
        "must_do_by": dv_tomorrow_str,
        "label_ids": [],
        "board_id": default_board_id,
    })
    assert_eq("POST day view task due tomorrow → 201", r.status_code, 201)
    dv_tomorrow_task_id = r.json()["id"]

    # A task due today but already completed — must NOT appear (pending only)
    r = client.post("/tasks", headers=H, json={
        "title": "Day view task due today (will be completed)",
        "must_do_by": dv_today_str,
        "label_ids": [],
        "board_id": default_board_id,
    })
    assert_eq("POST day view task to be completed → 201", r.status_code, 201)
    dv_done_task_id = r.json()["id"]
    r = client.post(f"/tasks/{dv_done_task_id}/complete", headers=H)
    assert_eq("Complete day view done-task → 200", r.status_code, 200)

    # Day view ignores the Focused View config entirely — set it to a restrictive
    # "selected" board_selection that excludes dv_board_id, and confirm day-view
    # still returns dv_board_id's task anyway.
    r = client.put("/focused-view/config", headers=H, json={
        "board_selection": "selected",
        "selected_board_ids": [default_board_id],
        "day_range": "today",
    })
    assert_eq("PUT /focused-view/config restrict to default board (day-view isolation setup) → 200",
              r.status_code, 200)

    r = client.get("/day-view/tasks", headers=H, params={"reference_date": dv_today_str})
    assert_eq("GET /day-view/tasks → 200", r.status_code, 200)
    dv_body = r.json()
    assert_in("day view response has boards key", "boards", dv_body)
    dv_boards_list = dv_body["boards"]

    # Default board group: both the HP and normal-priority tasks due today must appear
    dv_default_group = next((b for b in dv_boards_list if b["board_id"] == default_board_id), None)
    assert_true("default board group appears in day view", dv_default_group is not None)
    if dv_default_group is not None:
        assert_in("day view board group has board_id", "board_id", dv_default_group)
        assert_in("day view board group has board_name", "board_name", dv_default_group)
        assert_in("day view board group has board_color", "board_color", dv_default_group)
        assert_in("day view board group has tasks", "tasks", dv_default_group)
        dv_default_task_ids = [t["id"] for t in dv_default_group["tasks"]]
        assert_in("HP task appears in day view", dv_hp_task_id, dv_default_task_ids)
        assert_in("normal-priority task appears in day view (all priorities, unlike focused view)",
                  dv_normal_task_id, dv_default_task_ids)
        assert_true("tomorrow's task excluded from day view for reference_date=today",
                    dv_tomorrow_task_id not in dv_default_task_ids)
        assert_true("completed task excluded from day view",
                    dv_done_task_id not in dv_default_task_ids)

        # PR #47: Verify high-priority tasks appear before non-high-priority tasks
        # in the task list (sorted by is_high_priority DESC, then updated_at DESC)
        hp_task_pos = None
        normal_task_pos = None
        for idx, task in enumerate(dv_default_group["tasks"]):
            if task["id"] == dv_hp_task_id:
                hp_task_pos = idx
            elif task["id"] == dv_normal_task_id:
                normal_task_pos = idx
        assert_true("HP task position found in day view response", hp_task_pos is not None)
        assert_true("normal-priority task position found in day view response", normal_task_pos is not None)
        if hp_task_pos is not None and normal_task_pos is not None:
            assert_true("HP task appears before non-HP task in day view (PR #47: high-priority sorting)",
                        hp_task_pos < normal_task_pos)

    # Second board group must appear, even though Focused View config's
    # board_selection=selected excludes it — day-view has no board_selection concept
    dv_other_group = next((b for b in dv_boards_list if b["board_id"] == dv_board_id), None)
    assert_true("day view is not scoped by the focused-view board_selection config",
                dv_other_group is not None)
    if dv_other_group is not None:
        dv_other_task_ids = [t["id"] for t in dv_other_group["tasks"]]
        assert_in("second board's target_date-only task appears in day view",
                  dv_other_board_task_id, dv_other_task_ids)

    # reference_date=tomorrow must include the tomorrow task and exclude today's tasks
    r = client.get("/day-view/tasks", headers=H, params={"reference_date": dv_tomorrow_str})
    assert_eq("GET /day-view/tasks?reference_date=tomorrow → 200", r.status_code, 200)
    dv_tomorrow_boards = r.json()["boards"]
    dv_tomorrow_default_group = next((b for b in dv_tomorrow_boards if b["board_id"] == default_board_id), None)
    assert_true("default board group appears for tomorrow's reference_date",
                dv_tomorrow_default_group is not None)
    if dv_tomorrow_default_group is not None:
        dv_tomorrow_ids = [t["id"] for t in dv_tomorrow_default_group["tasks"]]
        assert_in("tomorrow's task appears when reference_date=tomorrow", dv_tomorrow_task_id, dv_tomorrow_ids)
        assert_true("today's HP task excluded when reference_date=tomorrow",
                    dv_hp_task_id not in dv_tomorrow_ids)

    # Restore focused-view config to the default used by later assertions
    r = client.put("/focused-view/config", headers=H, json={
        "board_selection": "all",
        "selected_board_ids": [],
        "day_range": "today_tomorrow",
    })
    assert_eq("PUT /focused-view/config restore all/today_tomorrow after day view tests → 200",
              r.status_code, 200)

    # Clean up day view test tasks and board
    client.delete(f"/tasks/{dv_hp_task_id}", headers=H)
    client.delete(f"/tasks/{dv_normal_task_id}", headers=H)
    client.delete(f"/tasks/{dv_other_board_task_id}", headers=H)
    client.delete(f"/tasks/{dv_tomorrow_task_id}", headers=H)
    client.delete(f"/tasks/{dv_done_task_id}", headers=H)
    client.delete(f"/boards/{dv_board_id}", headers=H)

    # ── Overdue View (PR #55) ────────────────────────────────────────────────────
    # GET /day-view/tasks?overdue=true reuses the day-view endpoint (no new router),
    # switching the date comparison on both must_do_by/target_date (OR'd together)
    # from `==` to `<` — i.e. the task's *effective date* (earliest of the two when
    # both are set) is strictly before reference_date. `overdue` defaults to False,
    # which must remain byte-identical to the pre-existing Today/Tomorrow exact-match
    # behavior already covered above. Unit tests (test_focused_view_service.py) mock
    # the SQLAlchemy session and can only inspect the compiled filter clause's shape
    # (`<` vs `=`, `OR`) — they cannot exercise real mixed-field row data, so the
    # "earliest of the two wins" cases below are covered only here.
    print("\n── Overdue View (PR #55) ────────────────────────────────")

    ov_today_str = date.today().isoformat()
    ov_yesterday_str = (date.today() - timedelta(days=1)).isoformat()
    ov_next_week_str = (date.today() + timedelta(days=7)).isoformat()

    # 1. must_do_by only, in the past → overdue
    r = client.post("/tasks", headers=H, json={
        "title": "Overdue: must_do_by only (yesterday)",
        "must_do_by": ov_yesterday_str,
        "label_ids": [],
        "board_id": default_board_id,
    })
    assert_eq("POST overdue task (must_do_by only) → 201", r.status_code, 201)
    ov_must_only_id = r.json()["id"]

    # 2. target_date only, in the past → overdue
    r = client.post("/tasks", headers=H, json={
        "title": "Overdue: target_date only (yesterday)",
        "target_date": ov_yesterday_str,
        "label_ids": [],
        "board_id": default_board_id,
    })
    assert_eq("POST overdue task (target_date only) → 201", r.status_code, 201)
    ov_target_only_id = r.json()["id"]

    # 3. Mixed: must_do_by = yesterday (earliest of the two), target_date = next week
    # → still overdue, since the effective date is the earliest of the two
    r = client.post("/tasks", headers=H, json={
        "title": "Overdue: must_do_by yesterday, target_date next week",
        "must_do_by": ov_yesterday_str,
        "target_date": ov_next_week_str,
        "label_ids": [],
        "board_id": default_board_id,
    })
    assert_eq("POST overdue task (mixed, must_do_by earliest) → 201", r.status_code, 201)
    ov_mixed_must_earliest_id = r.json()["id"]

    # 4. Inverse mixed: target_date = yesterday (earliest), must_do_by = next week
    # → still overdue (same "earliest wins" logic, fields swapped)
    r = client.post("/tasks", headers=H, json={
        "title": "Overdue: target_date yesterday, must_do_by next week",
        "must_do_by": ov_next_week_str,
        "target_date": ov_yesterday_str,
        "label_ids": [],
        "board_id": default_board_id,
    })
    assert_eq("POST overdue task (mixed, target_date earliest) → 201", r.status_code, 201)
    ov_mixed_target_earliest_id = r.json()["id"]

    # 5. Effective date is exactly today → NOT overdue (strictly-before, not on-or-before)
    r = client.post("/tasks", headers=H, json={
        "title": "Overdue: due exactly today (not overdue)",
        "must_do_by": ov_today_str,
        "label_ids": [],
        "board_id": default_board_id,
    })
    assert_eq("POST task due exactly today → 201", r.status_code, 201)
    ov_today_task_id = r.json()["id"]

    # 6. Effective date in the future → NOT overdue
    r = client.post("/tasks", headers=H, json={
        "title": "Overdue: due next week (future, not overdue)",
        "target_date": ov_next_week_str,
        "label_ids": [],
        "board_id": default_board_id,
    })
    assert_eq("POST task due next week (future) → 201", r.status_code, 201)
    ov_future_task_id = r.json()["id"]

    r = client.get("/day-view/tasks", headers=H,
                    params={"reference_date": ov_today_str, "overdue": "true"})
    assert_eq("GET /day-view/tasks?overdue=true → 200", r.status_code, 200)
    ov_boards = r.json()["boards"]
    ov_default_group = next((b for b in ov_boards if b["board_id"] == default_board_id), None)
    assert_true("default board group appears in overdue view", ov_default_group is not None)
    if ov_default_group is not None:
        ov_ids = [t["id"] for t in ov_default_group["tasks"]]
        assert_in("must_do_by-only overdue task included (overdue=true)", ov_must_only_id, ov_ids)
        assert_in("target_date-only overdue task included (overdue=true)", ov_target_only_id, ov_ids)
        assert_in("mixed task (must_do_by earliest) included — earliest-of-two wins",
                  ov_mixed_must_earliest_id, ov_ids)
        assert_in("mixed task (target_date earliest) included — earliest-of-two wins",
                  ov_mixed_target_earliest_id, ov_ids)
        assert_true("task due exactly today excluded from overdue=true",
                    ov_today_task_id not in ov_ids)
        assert_true("task due in the future excluded from overdue=true",
                    ov_future_task_id not in ov_ids)

    # 7. Regression: overdue omitted, and overdue=false explicitly, must preserve the
    # existing Today/Tomorrow exact-match behavior — none of the overdue-only tasks
    # above should appear, and the exactly-today task should still appear.
    r = client.get("/day-view/tasks", headers=H, params={"reference_date": ov_today_str})
    assert_eq("GET /day-view/tasks (overdue omitted) → 200", r.status_code, 200)
    ov_group_omitted = next(
        (b for b in r.json()["boards"] if b["board_id"] == default_board_id), None)
    assert_true("default board group appears (overdue omitted)", ov_group_omitted is not None)
    if ov_group_omitted is not None:
        ov_ids_omitted = [t["id"] for t in ov_group_omitted["tasks"]]
        assert_in("exact-match today task appears when overdue omitted (regression)",
                  ov_today_task_id, ov_ids_omitted)
        assert_true("yesterday-only overdue task excluded when overdue omitted (regression)",
                    ov_must_only_id not in ov_ids_omitted)
        assert_true("mixed overdue task excluded when overdue omitted (regression)",
                    ov_mixed_must_earliest_id not in ov_ids_omitted)

    r = client.get("/day-view/tasks", headers=H,
                    params={"reference_date": ov_today_str, "overdue": "false"})
    assert_eq("GET /day-view/tasks?overdue=false → 200", r.status_code, 200)
    ov_group_false = next(
        (b for b in r.json()["boards"] if b["board_id"] == default_board_id), None)
    assert_true("default board group appears (overdue=false)", ov_group_false is not None)
    if ov_group_false is not None:
        ov_ids_false = [t["id"] for t in ov_group_false["tasks"]]
        assert_in("exact-match today task appears with overdue=false (regression)",
                  ov_today_task_id, ov_ids_false)
        assert_true("yesterday-only overdue task excluded with overdue=false (regression)",
                    ov_must_only_id not in ov_ids_false)

    # Clean up overdue view test tasks
    for ov_tid in [ov_must_only_id, ov_target_only_id, ov_mixed_must_earliest_id,
                   ov_mixed_target_earliest_id, ov_today_task_id, ov_future_task_id]:
        client.delete(f"/tasks/{ov_tid}", headers=H)

    # ── Summary ────────────────────────────────────────────────────────────────
    print(f"\n── Results ─────────────────────────────────────────────")
    if _failures:
        print(f"  {FAIL} {len(_failures)} failure(s):")
        for f in _failures:
            print(f"    - {f}")
    else:
        print(f"  {PASS} All tests passed")

    if _failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
