"""Drag-drop target_date-only contract (PR #11), board_id scoping on GET
/tasks (PR #35), move-between-boards (PR #40), column ordering / sort_order
(PR #61), sort_order driving real Day View ordering (PR #61), and due-date
filter params.

Reads ctx.task_id, ctx.default_board_id.
"""
import uuid
from datetime import date, timedelta

from .asserts import assert_eq, assert_in, assert_true


def run(ctx):
    client = ctx.client
    H = ctx.H
    task_id = ctx.task_id
    default_board_id = ctx.default_board_id
    type_labels = ctx.type_labels

    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    next_week = (date.today() + timedelta(days=7)).isoformat()

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
    move_task_initial_sort_order = move_task["sort_order"]

    # PUT board_id to move the task to board B, WITHOUT sending label_ids — labels
    # must be unconditionally cleared server-side (board A's label is invalid on board B)
    r = client.put(f"/tasks/{move_task_id}", headers=H, json={"board_id": move_board_b_id})
    assert_eq("PUT /tasks/:id board_id move (no label_ids sent) → 200", r.status_code, 200)
    moved_task = r.json()
    assert_eq("task board_id updated to board B", moved_task["board_id"], move_board_b_id)
    assert_eq("labels cleared on board move even without label_ids in the request",
              moved_task["labels"], [])
    # PR #61: sort_order auto-resets to the bottom of the destination list on a board move
    assert_true("sort_order auto-resets to bottom when board changes (PR #61)",
                moved_task["sort_order"] != move_task_initial_sort_order)

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
    move_task_sort_order_before_noop = moved_back_task["sort_order"]
    r = client.put(f"/tasks/{move_task_id}", headers=H, json={"board_id": move_board_a_id})
    assert_eq("PUT board_id same as current board → 200 (no-op)", r.status_code, 200)
    assert_eq("labels untouched when board_id equals current board", len(r.json()["labels"]), 1)
    # PR #61: board_id equal to current board must NOT count as a "board changed" event
    assert_eq("sort_order unchanged when board_id equals current board (no-op) (PR #61)",
              r.json()["sort_order"], move_task_sort_order_before_noop)

    # Omitting board_id entirely leaves the task's board unchanged
    r = client.put(f"/tasks/{move_task_id}", headers=H, json={"title": "Move-between-boards test task (renamed)"})
    assert_eq("PUT omitting board_id → 200", r.status_code, 200)
    assert_eq("board_id unchanged when omitted from PUT body", r.json()["board_id"], move_board_a_id)
    assert_eq("sort_order unchanged when board_id omitted from PUT body (PR #61)",
              r.json()["sort_order"], move_task_sort_order_before_noop)

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

    # ── Tasks: Column ordering / sort_order (PR #61) ────────────────────────────
    # Adds a fractional-index `sort_order` column, client-computed, no server
    # renumbering. update_task() sets it explicitly when the caller supplies a
    # value (drag-to-a-position), and auto-resets it to "bottom of list" (a fresh,
    # much larger epoch-seconds float) whenever the task's effective date or board
    # changes and the caller did NOT explicitly supply a new sort_order.
    print("\n── Tasks: Column ordering (sort_order) (PR #61) ────────")

    r = client.post("/tasks", headers=H, json={
        "title": "Sort order test task",
        "label_ids": [],
        "board_id": default_board_id,
    })
    assert_eq("POST /tasks for sort_order test → 201", r.status_code, 201)
    so_task_id = r.json()["id"]
    assert_true("new task's sort_order looks like an epoch-seconds float (PR #61)",
                r.json()["sort_order"] > 1_000_000_000)

    # PUT with an explicit sort_order places the task at exactly that value
    r = client.put(f"/tasks/{so_task_id}", headers=H, json={"sort_order": 42.5})
    assert_eq("PUT /tasks/:id explicit sort_order → 200", r.status_code, 200)
    assert_eq("explicit sort_order persisted exactly (PR #61)", r.json()["sort_order"], 42.5)

    # An unrelated field update (no date/board change, sort_order omitted) preserves it
    r = client.put(f"/tasks/{so_task_id}", headers=H, json={"title": "Sort order test task (renamed)"})
    assert_eq("PUT /tasks/:id unrelated field update → 200", r.status_code, 200)
    assert_eq("sort_order preserved when neither date nor board changes (PR #61)",
              r.json()["sort_order"], 42.5)

    # Changing the effective date (must_do_by) without an explicit sort_order
    # auto-resets it to the bottom of the list (a fresh, much larger value)
    r = client.put(f"/tasks/{so_task_id}", headers=H, json={"must_do_by": tomorrow})
    assert_eq("PUT /tasks/:id date change (no explicit sort_order) → 200", r.status_code, 200)
    so_after_date_change = r.json()["sort_order"]
    assert_true("sort_order auto-resets to bottom on effective-date change (PR #61)",
                so_after_date_change != 42.5 and so_after_date_change > 1_000_000_000)

    # An explicit sort_order supplied alongside a date change wins over auto-reset
    r = client.put(f"/tasks/{so_task_id}", headers=H, json={"must_do_by": next_week, "sort_order": 7.25})
    assert_eq("PUT /tasks/:id date change + explicit sort_order → 200", r.status_code, 200)
    assert_eq("explicit sort_order wins over auto-reset even with a simultaneous date change (PR #61)",
              r.json()["sort_order"], 7.25)

    client.delete(f"/tasks/{so_task_id}", headers=H)

    # ── Tasks: sort_order drives real ordering in Day View (PR #61) ─────────────
    # Unit tests (test_focused_view_service.py) only assert the SQL clause shape
    # (does "sort_order" appear in the compiled order_by args); they cannot prove
    # actual row ordering against real data. This is the only place that does.
    print("\n── Tasks: sort_order drives Day View ordering (PR #61) ──")

    so_order_today = date.today().isoformat()
    r = client.post("/tasks", headers=H, json={
        "title": "Order test A", "must_do_by": so_order_today, "label_ids": [], "board_id": default_board_id,
    })
    assert_eq("POST order test task A → 201", r.status_code, 201)
    order_task_a_id = r.json()["id"]

    r = client.post("/tasks", headers=H, json={
        "title": "Order test B", "must_do_by": so_order_today, "label_ids": [], "board_id": default_board_id,
    })
    assert_eq("POST order test task B → 201", r.status_code, 201)
    order_task_b_id = r.json()["id"]

    # Force B to sort ahead of A via a smaller explicit sort_order
    r = client.put(f"/tasks/{order_task_b_id}", headers=H, json={"sort_order": 1.0})
    assert_eq("PUT order test task B sort_order=1.0 → 200", r.status_code, 200)
    r = client.put(f"/tasks/{order_task_a_id}", headers=H, json={"sort_order": 2.0})
    assert_eq("PUT order test task A sort_order=2.0 → 200", r.status_code, 200)

    r = client.get("/day-view/tasks", headers=H, params={"reference_date": so_order_today})
    assert_eq("GET /day-view/tasks for sort_order ordering check → 200", r.status_code, 200)
    order_group = next((b for b in r.json()["boards"] if b["board_id"] == default_board_id), None)
    assert_true("default board group present for sort_order ordering check", order_group is not None)
    if order_group is not None:
        order_ids = [t["id"] for t in order_group["tasks"]]
        a_pos = order_ids.index(order_task_a_id) if order_task_a_id in order_ids else None
        b_pos = order_ids.index(order_task_b_id) if order_task_b_id in order_ids else None
        assert_true("both order-test tasks found in day view", a_pos is not None and b_pos is not None)
        if a_pos is not None and b_pos is not None:
            assert_true("day view orders same-priority tasks by sort_order ascending (PR #61)",
                        b_pos < a_pos)

    client.delete(f"/tasks/{order_task_a_id}", headers=H)
    client.delete(f"/tasks/{order_task_b_id}", headers=H)

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
