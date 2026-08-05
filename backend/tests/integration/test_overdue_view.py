"""Overdue View (PR #55): GET /day-view/tasks?overdue=true — earliest-of-two-
dates "before reference_date" semantics, and the overdue-omitted/overdue=false
regression cases that must stay byte-identical to pre-PR-#55 behavior.

Reads ctx.default_board_id.
"""
from datetime import date, timedelta

from .asserts import assert_eq, assert_in, assert_true


def run(ctx):
    client = ctx.client
    H = ctx.H
    default_board_id = ctx.default_board_id

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
