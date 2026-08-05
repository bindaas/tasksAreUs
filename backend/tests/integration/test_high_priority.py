"""High-priority field behavior, effective-date min-rule (PR #20), eligibility
for day-after-tomorrow/Friday-only-Monday (PR #60), daily limit (PR #7), and
the known daily-limit bypass via date-only move (xfail, tracked gap from the
PR #60 review).

Self-contained aside from ctx.client/ctx.H — no cross-module state read or
written.
"""
from datetime import date, timedelta

from .asserts import assert_eq, assert_eq_xfail, assert_true


def run(ctx):
    client = ctx.client
    H = ctx.H

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

    # ── HP eligibility: day-after-tomorrow and Friday-only Monday (PR #60) ─────
    # PR #60 fixes a bug where _is_hp_eligible_date() only accepted dates up to
    # tomorrow, so the server silently reset is_high_priority back to false for
    # tasks dated the day after tomorrow or the Friday-only Monday column, even
    # though the board already let users drag tasks into those columns' High
    # Priority zones. These tests pin the corrected server-side window.
    print("\n── Tasks: HP eligibility for day-after-tomorrow/Monday (PR #60) ──")
    day_after_tomorrow_str = (date.today() + timedelta(days=2)).isoformat()
    three_days_str = (date.today() + timedelta(days=3)).isoformat()
    today_is_friday = date.today().weekday() == 4  # Monday=0 .. Sunday=6

    # POST with must_do_by=day-after-tomorrow, is_high_priority=true → stays true
    r = client.post("/tasks", headers=H, json={
        "title": "HP task due day after tomorrow",
        "must_do_by": day_after_tomorrow_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST high-priority task with day-after-tomorrow date → 201", r.status_code, 201)
    hp_dat_task = r.json()
    hp_dat_task_id = hp_dat_task["id"]
    assert_eq("is_high_priority stays true for day after tomorrow", hp_dat_task["is_high_priority"], True)

    # Same via target_date instead of must_do_by
    r = client.post("/tasks", headers=H, json={
        "title": "HP task target_date day after tomorrow",
        "target_date": day_after_tomorrow_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST high-priority task with target_date=day-after-tomorrow → 201", r.status_code, 201)
    hp_dat_target_task = r.json()
    hp_dat_target_task_id = hp_dat_target_task["id"]
    assert_eq("is_high_priority true via target_date=day-after-tomorrow",
              hp_dat_target_task["is_high_priority"], True)

    # PUT: dragging an existing HP task from today onto day-after-tomorrow must
    # NOT auto-reset is_high_priority — this is the exact drag-and-drop bug PR #60 fixes.
    r = client.post("/tasks", headers=H, json={
        "title": "HP task starting today, moved to day-after-tomorrow",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST HP task due today (for drag-to-DAT test) → 201", r.status_code, 201)
    hp_drag_dat_task_id = r.json()["id"]
    r = client.put(f"/tasks/{hp_drag_dat_task_id}", headers=H, json={"must_do_by": day_after_tomorrow_str})
    assert_eq("PUT move today HP task to day-after-tomorrow → 200", r.status_code, 200)
    assert_eq("PUT to day-after-tomorrow preserves is_high_priority=true",
              r.json()["is_high_priority"], True)

    # today+3 ("the following Monday") is only HP-eligible when today is Friday.
    # This assertion naturally covers whichever branch is live on the day the
    # suite runs, without needing to mock server time.
    r = client.post("/tasks", headers=H, json={
        "title": "HP task due today+3 (Monday-only-if-Friday)",
        "must_do_by": three_days_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST high-priority task with today+3 date → 201", r.status_code, 201)
    hp_plus3_task = r.json()
    hp_plus3_task_id = hp_plus3_task["id"]
    if today_is_friday:
        assert_eq("is_high_priority stays true for today+3 when today is Friday (Monday column)",
                  hp_plus3_task["is_high_priority"], True)
    else:
        assert_eq("is_high_priority auto-reset for today+3 when today is not Friday",
                  hp_plus3_task["is_high_priority"], False)
        print("    (Friday-only Monday-eligible branch not exercised — today is not Friday)")

    # today+4 must always be ineligible, Friday or not (one step past the widest window)
    four_days_str = (date.today() + timedelta(days=4)).isoformat()
    r = client.post("/tasks", headers=H, json={
        "title": "HP task due today+4 (always ineligible)",
        "must_do_by": four_days_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST high-priority task with today+4 date → 201", r.status_code, 201)
    hp_plus4_task_id = r.json()["id"]
    assert_eq("is_high_priority auto-reset for today+4 regardless of weekday",
              r.json()["is_high_priority"], False)

    # Clean up day-after-tomorrow/Monday eligibility test tasks
    for tid in [hp_dat_task_id, hp_dat_target_task_id, hp_drag_dat_task_id,
                hp_plus3_task_id, hp_plus4_task_id]:
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

    # ── HP daily limit bypass via date-only move (found during PR #60 review) ──
    # update_task() only re-checks the per-day HP cap when is_high_priority=True
    # is explicitly present in the PUT body (task_service.py line ~178). Moving
    # an already-high-priority task's date onto a day that is already at the cap
    # — without re-sending is_high_priority — skips the check entirely, silently
    # violating the "at most N high-priority tasks per day" invariant documented
    # in DATA_MODEL_AND_API.MD. Not reachable through the web UI today (TaskForm
    # and the kanban drag handler both always send is_high_priority explicitly),
    # but reachable directly via the API/mobile/sync and newly more relevant now
    # that day-after-tomorrow/Monday are real drop targets.
    #
    # KNOWN, TRACKED GAP — marked xfail, not fixed here:
    # Filed as a bug comment on PR #60:
    #   https://github.com/bindaas/tasksAreUs/pull/60#issuecomment-5153670431
    # The maintainer has explicitly decided NOT to fix this in PR #60 — it is an
    # intentional, tracked follow-up (this project has no separate issue tracker,
    # so the PR comment above is the tracking anchor). Left hard-failing, this
    # assertion would fail the whole suite with no CI to explain why (no GitHub
    # Actions configured here), so it is downgraded to xfail via assert_eq_xfail:
    # it still runs and reports the live status, but won't break the suite while
    # the bug remains open, and will loudly XPASS-flag itself once someone fixes
    # update_task() so the marker gets noticed and removed.
    print("\n── Tasks: HP daily limit bypass via date-only move (bug, xfail) ──")
    bypass_dat_str = (date.today() + timedelta(days=2)).isoformat()
    bypass_fill_ids = []
    for i in range(3):
        r = client.post("/tasks", headers=H, json={
            "title": f"HP bypass fill {i + 1}",
            "must_do_by": bypass_dat_str,
            "label_ids": [],
            "is_high_priority": True,
        })
        bypass_fill_ids.append(r.json()["id"])
    r = client.post("/tasks", headers=H, json={
        "title": "HP bypass mover (starts today)",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    bypass_mover_id = r.json()["id"]
    r = client.put(f"/tasks/{bypass_mover_id}", headers=H, json={"must_do_by": bypass_dat_str})
    assert_eq_xfail(
        "PUT date-only move onto a full day should be rejected → 422",
        r.status_code, 422,
        reason="known HP-cap bypass bug, deferred per explicit maintainer decision — "
               "see https://github.com/bindaas/tasksAreUs/pull/60#issuecomment-5153670431",
    )

    for tid in bypass_fill_ids + [bypass_mover_id]:
        client.delete(f"/tasks/{tid}", headers=H)
