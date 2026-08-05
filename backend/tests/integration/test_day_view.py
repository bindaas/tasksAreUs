"""Day View (PR #40): all-priority, all-board single-date task listing,
independent of the Focused View config; board ordering (PR #62) and
high-priority-first sorting (PR #47).

Reads ctx.default_board_id.
"""
from datetime import date, timedelta

from .asserts import assert_eq, assert_in, assert_true


def run(ctx):
    client = ctx.client
    H = ctx.H
    default_board_id = ctx.default_board_id

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

    # PR #62: same sort_order-vs-alphabetical order-change proof as focused view —
    # "Day view test board" would sort FIRST alphabetically ("D" < "G") but was
    # created after "General tasks", so it must sort AFTER by sort_order ASC.
    dv_default_idx = next((i for i, b in enumerate(dv_boards_list) if b["board_id"] == default_board_id), None)
    dv_other_idx = next((i for i, b in enumerate(dv_boards_list) if b["board_id"] == dv_board_id), None)
    assert_true("both board groups found in day view for order check",
                dv_default_idx is not None and dv_other_idx is not None)
    if dv_default_idx is not None and dv_other_idx is not None:
        assert_true("day view groups boards by sort_order ASC, not alphabetically (PR #62)",
                    dv_default_idx < dv_other_idx)

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
