"""Reports/Archive completions: date-range filtering, label_ids/board_id
filters, and the all_boards grouped response (PR #63).

Reads ctx.task_id, ctx.type_labels, ctx.default_board_id.
"""
from datetime import date, timedelta

from .asserts import assert_eq, assert_in, assert_true


def run(ctx):
    client = ctx.client
    H = ctx.H
    task_id = ctx.task_id
    type_labels = ctx.type_labels
    default_board_id = ctx.default_board_id

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

    # ── Reports: all_boards grouping for Archive view (PR #63) ─────────────────
    # PR #63 renames Reports → Archive and adds an additive `all_boards` query
    # param + `boards` response field to GET /reports/completions, backing the
    # Archive page's Today-view-style grouped/collapsible board rendering.
    # Fully backward compatible: omitting all_boards must behave exactly as
    # before (verified above); `boards` must be null in that mode.
    print("\n── Reports: all_boards grouping (PR #63) ────────────────")

    assert_true("GET /reports/completions boards is null when all_boards omitted (PR #63)",
                report.get("boards") is None)

    # Three boards: A and B each get a completed task in range; C gets a task
    # that stays pending — C must never appear in either report shape.
    r = client.post("/boards", headers=H, json={"name": "Archive board A"})
    assert_eq("POST /boards for archive test (board A) → 201", r.status_code, 201)
    archive_board_a_id = r.json()["id"]

    r = client.post("/boards", headers=H, json={"name": "Archive board B"})
    assert_eq("POST /boards for archive test (board B) → 201", r.status_code, 201)
    archive_board_b_id = r.json()["id"]

    r = client.post("/boards", headers=H, json={"name": "Archive board C (no completions)"})
    assert_eq("POST /boards for archive test (board C, empty) → 201", r.status_code, 201)
    archive_board_c_id = r.json()["id"]

    # Give board A a color to verify board_color propagates into the grouped response;
    # board B is left uncolored to verify board_color is null when never set.
    r = client.put(f"/boards/{archive_board_a_id}", headers=H, json={"color": "#10b981"})
    assert_eq("PUT /boards/:id set color on archive board A → 200", r.status_code, 200)

    # Force a deterministic order: board B sorts ahead of board A regardless of
    # creation order, by giving it a smaller explicit sort_order (PR #62 mechanism) —
    # the grouped response must reflect this same custom order (sort_order ASC).
    r = client.get("/boards", headers=H)
    boards_for_archive_order = r.json()["boards"]
    archive_a_sort_order = next(
        b["sort_order"] for b in boards_for_archive_order if b["id"] == archive_board_a_id
    )
    r = client.put(f"/boards/{archive_board_b_id}", headers=H,
                    json={"sort_order": archive_a_sort_order - 1.0})
    assert_eq("PUT /boards/:id sort_order on archive board B (ahead of A) → 200", r.status_code, 200)

    r = client.post("/tasks", headers=H, json={
        "title": "Archive task on board A", "label_ids": [], "board_id": archive_board_a_id,
    })
    assert_eq("POST /tasks archive board A task → 201", r.status_code, 201)
    archive_task_a_id = r.json()["id"]
    r = client.post(f"/tasks/{archive_task_a_id}/complete", headers=H)
    assert_eq("Complete archive board A task → 200", r.status_code, 200)

    r = client.post("/tasks", headers=H, json={
        "title": "Archive task on board B", "label_ids": [], "board_id": archive_board_b_id,
    })
    assert_eq("POST /tasks archive board B task → 201", r.status_code, 201)
    archive_task_b_id = r.json()["id"]
    r = client.post(f"/tasks/{archive_task_b_id}/complete", headers=H)
    assert_eq("Complete archive board B task → 200", r.status_code, 200)

    r = client.post("/tasks", headers=H, json={
        "title": "Archive task on board C (stays pending)", "label_ids": [], "board_id": archive_board_c_id,
    })
    assert_eq("POST /tasks archive board C task → 201", r.status_code, 201)
    archive_task_c_id = r.json()["id"]

    # all_boards=true: grouped response across every board with a match
    r = client.get("/reports/completions", headers=H,
                   params={"from": from_date, "to": to_date, "all_boards": "true"})
    assert_eq("GET /reports/completions?all_boards=true → 200", r.status_code, 200)
    all_boards_report = r.json()
    assert_in("all_boards report has boards key", "boards", all_boards_report)
    archive_boards_list = all_boards_report["boards"]
    assert_true("all_boards report boards is a list", isinstance(archive_boards_list, list))

    archive_board_ids_in_response = [b["board_id"] for b in archive_boards_list]
    assert_in("board A appears in all_boards grouped response", archive_board_a_id, archive_board_ids_in_response)
    assert_in("board B appears in all_boards grouped response", archive_board_b_id, archive_board_ids_in_response)
    assert_in("default board appears in all_boards grouped response", default_board_id, archive_board_ids_in_response)
    assert_true("board C (zero completions) excluded from grouped response (PR #63)",
                archive_board_c_id not in archive_board_ids_in_response)

    board_a_pos = archive_board_ids_in_response.index(archive_board_a_id)
    board_b_pos = archive_board_ids_in_response.index(archive_board_b_id)
    assert_true("board B (lower sort_order) appears before board A in grouped response (PR #63)",
                board_b_pos < board_a_pos)

    archive_group_a = next((b for b in archive_boards_list if b["board_id"] == archive_board_a_id), None)
    assert_true("board A group found", archive_group_a is not None)
    if archive_group_a is not None:
        assert_eq("board A group board_name", archive_group_a["board_name"], "Archive board A")
        assert_eq("board A group board_color reflects set color (PR #63)",
                  archive_group_a["board_color"], "#10b981")
        assert_in("board A group has completions", "completions", archive_group_a)
        archive_a_task_ids = [c["task_id"] for c in archive_group_a["completions"]]
        assert_in("board A's completed task appears in its group", archive_task_a_id, archive_a_task_ids)

    archive_group_b = next((b for b in archive_boards_list if b["board_id"] == archive_board_b_id), None)
    assert_true("board B group found", archive_group_b is not None)
    if archive_group_b is not None:
        assert_eq("board B group board_color is null (never set)", archive_group_b["board_color"], None)

    # The flat `completions` field (what pre-PR-#63 clients read) must still include
    # every matched task across every board in all_boards mode, not just one board.
    archive_flat_ids = [c["task_id"] for c in all_boards_report["completions"]]
    assert_in("flat completions includes board A task in all_boards mode", archive_task_a_id, archive_flat_ids)
    assert_in("flat completions includes board B task in all_boards mode", archive_task_b_id, archive_flat_ids)
    assert_in("flat completions includes pre-existing default-board task in all_boards mode",
              task_id, archive_flat_ids)
    assert_true("pending board C task never appears in all_boards completions",
                archive_task_c_id not in archive_flat_ids)
    assert_eq("all_boards report total matches flat completions length",
              all_boards_report["total"], len(all_boards_report["completions"]))

    # all_boards=true takes precedence over a simultaneously-supplied board_id — the
    # dev plan states board_id is silently ignored server-side in this mode.
    r = client.get("/reports/completions", headers=H,
                   params={"from": from_date, "to": to_date, "all_boards": "true", "board_id": default_board_id})
    assert_eq("GET /reports/completions?all_boards=true&board_id=... → 200", r.status_code, 200)
    both_params_board_ids = [b["board_id"] for b in r.json()["boards"]]
    assert_in("board_id is ignored when all_boards=true — board B still present",
              archive_board_b_id, both_params_board_ids)

    # label_ids filter still applies within all_boards mode — narrows both the
    # flat list and which board groups survive.
    r = client.post("/labels", headers=H,
                    json={"category": "type", "value": "archive-label", "board_id": archive_board_a_id})
    assert_eq("POST label for archive label filter test → 201", r.status_code, 201)
    archive_label_id = r.json()["id"]
    r = client.put(f"/tasks/{archive_task_a_id}", headers=H, json={"label_ids": [archive_label_id]})
    assert_eq("PUT archive board A task to add label → 200", r.status_code, 200)

    r = client.get("/reports/completions", headers=H,
                   params={"from": from_date, "to": to_date, "all_boards": "true", "label_ids": archive_label_id})
    assert_eq("GET /reports/completions?all_boards=true&label_ids=... → 200", r.status_code, 200)
    label_filtered_all_boards = r.json()
    label_filtered_board_ids = [b["board_id"] for b in label_filtered_all_boards["boards"]]
    assert_eq("label filter in all_boards mode narrows grouped boards to exactly board A",
              label_filtered_board_ids, [archive_board_a_id])

    # Future date range with all_boards=true → boards list is empty (not omitted)
    r = client.get("/reports/completions", headers=H,
                   params={"from": future_from, "to": future_to, "all_boards": "true"})
    assert_eq("GET /reports/completions?all_boards=true future range → 200", r.status_code, 200)
    future_all_boards_report = r.json()
    assert_eq("future range all_boards boards list is empty", future_all_boards_report["boards"], [])
    assert_eq("future range all_boards completions list is empty", future_all_boards_report["completions"], [])

    # Auth required in all_boards mode too
    r = client.get("/reports/completions", params={"from": from_date, "to": to_date, "all_boards": "true"})
    assert_eq("GET /reports/completions?all_boards=true with no auth → 401", r.status_code, 401)

    # Clean up archive test data (label + tasks before boards, per delete_board guards)
    client.delete(f"/labels/{archive_label_id}", headers=H)
    client.delete(f"/tasks/{archive_task_a_id}", headers=H)
    client.delete(f"/tasks/{archive_task_b_id}", headers=H)
    client.delete(f"/tasks/{archive_task_c_id}", headers=H)
    client.delete(f"/boards/{archive_board_a_id}", headers=H)
    client.delete(f"/boards/{archive_board_b_id}", headers=H)
    client.delete(f"/boards/{archive_board_c_id}", headers=H)
