"""Boards: CRUD, is_default no longer client-writable, custom order &
order-driven default, color field, cross-board label isolation, and
backward-compat default-board resolution. (PR #33, #36, #37, #62)

Sets ctx.default_board_id, read by nearly every later module.
"""
import uuid

from .asserts import assert_eq, assert_in, assert_true


def run(ctx):
    client = ctx.client
    H = ctx.H

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

    # The default board must be first in the list (ordered sort_order ASC, created_at ASC
    # as of PR #62 — was is_default DESC, created_at ASC before board order became a
    # user-draggable custom order with an order-derived default)
    default_board = boards_list[0]
    assert_eq("first board is_default=true", default_board["is_default"], True)
    assert_eq("default board name is 'General tasks'", default_board["name"], "General tasks")
    assert_in("board has id field", "id", default_board)
    assert_in("board has is_deleted field", "is_deleted", default_board)
    assert_in("board has created_at field", "created_at", default_board)
    assert_in("board has updated_at field", "updated_at", default_board)
    assert_in("board has sort_order field (PR #62)", "sort_order", default_board)
    assert_true("board sort_order is numeric (PR #62)", isinstance(default_board["sort_order"], (int, float)))
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
    assert_in("new board has sort_order field (PR #62)", "sort_order", new_board)
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

    # ── Boards: is_default no longer client-writable (PR #62) ──────────────────
    # Order-driven default: is_default is now a derived field the server maintains
    # (topmost board by sort_order is the default). BoardUpdate dropped the
    # is_default field from its schema entirely — Pydantic silently ignores
    # unknown request-body keys by default, so these requests still succeed (200)
    # but have zero effect on is_default.
    r = client.put(f"/boards/{new_board_id}", headers=H, json={"is_default": True})
    assert_eq("PUT /boards/:id is_default=true → 200 (PR #62: field silently ignored, no longer writable)",
              r.status_code, 200)
    assert_eq("is_default unaffected by request body — new_board_id still not default (PR #62)",
              r.json()["is_default"], False)

    r = client.put(f"/boards/{default_board_id}", headers=H, json={"is_default": False})
    assert_eq("PUT /boards/:id is_default=false on current default → 200, no longer 400 (PR #62: field ignored)",
              r.status_code, 200)
    assert_eq("default board still is_default=true — old demote-guard error went away with the field (PR #62)",
              r.json()["is_default"], True)

    # PUT /boards/{id} — 404 for non-existent board
    r = client.put(f"/boards/{str(uuid.uuid4())}", headers=H, json={"name": "Ghost board"})
    assert_eq("PUT /boards/:id non-existent → 404", r.status_code, 404)

    # ── Boards: custom order & order-driven default (PR #62) ───────────────────
    print("\n── Boards: custom order & order-driven default (PR #62) ─")
    # Dragging a board above the current default via an explicit sort_order is now
    # the only way to change which board is default.
    r = client.get("/boards", headers=H)
    boards_before_reorder = r.json()["boards"]
    default_sort_order_before = next(
        b["sort_order"] for b in boards_before_reorder if b["id"] == default_board_id
    )
    dragged_sort_order = default_sort_order_before - 1.0

    r = client.put(f"/boards/{new_board_id}", headers=H, json={"sort_order": dragged_sort_order})
    assert_eq("PUT /boards/:id sort_order (drag above default) → 200", r.status_code, 200)
    reordered = r.json()
    assert_eq("dragged board's sort_order persisted exactly (PR #62)",
              reordered["sort_order"], dragged_sort_order)
    assert_eq("dragging a board above the default promotes it to is_default=true (PR #62)",
              reordered["is_default"], True)

    # Old default board must now be demoted — _recompute_default() re-derives the
    # default from the full ordered list, not just the board that moved (the old
    # default's own row isn't touched by this PUT).
    r = client.get("/boards", headers=H)
    all_boards = r.json()["boards"]
    old_default_in_list = next((b for b in all_boards if b["id"] == default_board_id), None)
    assert_true("old default board found in list", old_default_in_list is not None)
    if old_default_in_list:
        assert_eq("old default board demoted when another board is dragged above it (PR #62)",
                  old_default_in_list["is_default"], False)

    # GET /boards now reflects the new order (sort_order ASC)
    assert_eq("GET /boards topmost board is the reordered board (PR #62: sort_order ASC ordering)",
              all_boards[0]["id"], new_board_id)

    # Restore default_board_id to the top so later tests use the original default board
    r = client.put(f"/boards/{default_board_id}", headers=H, json={"sort_order": dragged_sort_order - 1.0})
    assert_eq("Restore original board order → 200", r.status_code, 200)
    assert_eq("original board is_default=true again after being dragged back to the top (PR #62)",
              r.json()["is_default"], True)

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

    # The same label value can exist independently in two different boards —
    # uniqueness is scoped to (board_id, category, value), not (user_id, category, value)
    # (DATA_MODEL_AND_API.MD: labels_board_id_category_value_key). Relevant to PR #58's
    # inline tag-add feature: a user with tags of the same name on two boards must be able
    # to create both without a spurious 409.
    r = client.post("/labels", headers=H, json={"category": "type", "value": "shared-name", "board_id": default_board_id})
    assert_eq("POST label 'shared-name' to default board → 201", r.status_code, 201)
    shared_name_default_id = r.json()["id"]

    r = client.post("/labels", headers=H, json={"category": "type", "value": "shared-name", "board_id": isolation_board_id})
    assert_eq("POST label 'shared-name' to isolation board (same value, different board) → 201", r.status_code, 201)
    shared_name_isolation_id = r.json()["id"]
    assert_true("same-value labels in different boards get distinct ids",
                shared_name_default_id != shared_name_isolation_id)

    client.delete(f"/labels/{shared_name_default_id}", headers=H)
    client.delete(f"/labels/{shared_name_isolation_id}", headers=H)

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

    ctx.default_board_id = default_board_id
