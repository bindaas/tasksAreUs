"""Focused View: config (PR #36) and tasks (PR #36, board-order changes
PR #62, sort_order tiebreak PR #61).

Reads ctx.default_board_id.
"""
import uuid
from datetime import date, timedelta

from .asserts import assert_eq, assert_in, assert_true


def run(ctx):
    client = ctx.client
    H = ctx.H
    default_board_id = ctx.default_board_id

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

    # PR #62: board grouping order changed from alphabetical-by-name to sort_order
    # ASC. "Focused view test board" was created after (and so sorts after)
    # "General tasks" by sort_order, even though it would sort FIRST alphabetically
    # ("F" < "G") — proves the ordering actually switched, not just that it happens
    # to coincide with alphabetical order here.
    fv_default_idx = next((i for i, b in enumerate(fv_boards_list) if b["board_id"] == default_board_id), None)
    fv_colored_idx = next((i for i, b in enumerate(fv_boards_list) if b["board_id"] == fv_board_id), None)
    assert_true("both board groups found in focused view for order check",
                fv_default_idx is not None and fv_colored_idx is not None)
    if fv_default_idx is not None and fv_colored_idx is not None:
        assert_true("focused view groups boards by sort_order ASC, not alphabetically (PR #62)",
                    fv_default_idx < fv_colored_idx)

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

        # PR #61: Focused View's same-priority tiebreak changed from updated_at DESC
        # (PR #47) to sort_order ASC. Both tasks are HP with no explicit sort_order
        # ever set, so creation order decides it: sort_order defaults to a
        # monotonically-increasing "now" timestamp, so the EARLIER-created task
        # (fv_hp_task_id) has the smaller sort_order and sorts first — the inverse
        # of the old PR #47 updated_at-DESC behavior, which favored the
        # most-recently-created task.
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
            assert_true("original HP task appears before later-created task (PR #61: sorted by sort_order ASC)",
                        fv_hp_original_pos < fv_target_only_pos)

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
