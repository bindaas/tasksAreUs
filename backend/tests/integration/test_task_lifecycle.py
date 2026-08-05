"""Task completion (one-time and post-recurrence-removal), reopen (PR #64,
including the daily-HP-cap bypass-on-reopen behavior), soft delete, and two
trailing removed-route smoke checks (Beliefs PR #67, target_date-only task,
Conversations PR #50) that sat in this same stretch of the original file and
are kept together here rather than forced into unrelated modules — see the
"Beliefs and Conversations-removed" sequencing note in
development-plans/PLAN-chore-modularize-test-suite.md.

Reads ctx.task_id, ctx.type_labels.
"""
import uuid
from datetime import date, timedelta

from .asserts import assert_eq, assert_in, assert_true


def run(ctx):
    client = ctx.client
    H = ctx.H
    task_id = ctx.task_id
    type_labels = ctx.type_labels

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

    # ── Tasks: Reopen completed task (PR #64) ──────────────────────────────────
    # POST /tasks/{id}/reopen is the inverse of /complete: sets state back to
    # pending, clears completed_at, and resets sort_order to the bottom of its
    # list (same _sort_order_default() convention update_task() uses on
    # date/board changes). is_high_priority is deliberately left untouched — no
    # re-check of _is_hp_eligible_date() or the daily high-priority cap runs on
    # reopen — see task_service.reopen_task()'s code comment.
    print("\n── Tasks: Reopen completed task (PR #64) ────────────────")

    # 422 when the task is not currently done
    r = client.post("/tasks", headers=H, json={"title": "Reopen 422 pending guard task", "label_ids": []})
    assert_eq("POST reopen-guard pending task → 201", r.status_code, 201)
    reopen_guard_task_id = r.json()["id"]
    r = client.post(f"/tasks/{reopen_guard_task_id}/reopen", headers=H)
    assert_eq("POST /tasks/:id/reopen on pending task → 422", r.status_code, 422)
    assert_true("422 detail explains task is not completed",
                "not completed" in r.json().get("detail", "").lower())
    client.delete(f"/tasks/{reopen_guard_task_id}", headers=H)

    # 404 for a non-existent task
    r = client.post(f"/tasks/{uuid.uuid4()}/reopen", headers=H)
    assert_eq("POST /tasks/:id/reopen non-existent task → 404", r.status_code, 404)

    # No auth → 401
    r = client.post(f"/tasks/{uuid.uuid4()}/reopen")
    assert_eq("POST /tasks/:id/reopen with no auth → 401", r.status_code, 401)

    # Happy path: create + complete a fresh HP task, capture its sort_order while
    # done, then reopen it and verify state/completed_at/sort_order/is_high_priority.
    r = client.post("/tasks", headers=H, json={
        "title": "Reopen test task",
        "must_do_by": today_str,
        "label_ids": [type_labels["household"]],
        "is_high_priority": True,
    })
    assert_eq("POST reopen test task → 201", r.status_code, 201)
    reopen_task_obj = r.json()
    reopen_task_id = reopen_task_obj["id"]
    assert_eq("reopen test task starts pending", reopen_task_obj["state"], "pending")

    r = client.post(f"/tasks/{reopen_task_id}/complete", headers=H)
    assert_eq("Complete reopen test task → 200", r.status_code, 200)
    completed_reopen_task = r.json()["completed_task"]
    assert_eq("reopen test task now done", completed_reopen_task["state"], "done")
    assert_true("reopen test task has completed_at set", completed_reopen_task["completed_at"] is not None)
    sort_order_while_done = completed_reopen_task["sort_order"]

    # While still done, the task must appear in the completions report (Archive) —
    # confirms the completion this test is about to reverse was actually recorded.
    reopen_report_from = (date.today() - timedelta(days=1)).isoformat()
    reopen_report_to = (date.today() + timedelta(days=1)).isoformat()  # tomorrow — see completed_at-vs-DATE cast note above
    r = client.get("/reports/completions", headers=H, params={"from": reopen_report_from, "to": reopen_report_to})
    assert_eq("GET /reports/completions before reopen → 200", r.status_code, 200)
    report_ids_before_reopen = [c["task_id"] for c in r.json()["completions"]]
    assert_in("completed task appears in Archive before reopen", reopen_task_id, report_ids_before_reopen)

    r = client.post(f"/tasks/{reopen_task_id}/reopen", headers=H)
    assert_eq("POST /tasks/:id/reopen → 200", r.status_code, 200)
    reopened = r.json()
    assert_eq("reopened task id unchanged", reopened["id"], reopen_task_id)
    assert_eq("reopened task state is pending", reopened["state"], "pending")
    assert_eq("reopened task completed_at cleared", reopened["completed_at"], None)
    # No re-validation against _is_hp_eligible_date() or the daily cap happens on
    # reopen (deliberate; see task_service.reopen_task()'s code comment) — the
    # flag simply survives.
    assert_eq("reopened task is_high_priority unchanged (no re-eligibility check)",
              reopened["is_high_priority"], True)
    assert_true("reopened task sort_order changed (reset to bottom of list)",
                reopened["sort_order"] != sort_order_while_done)
    assert_eq("reopened task labels untouched", len(reopened["labels"]), 1)

    # GET /tasks/:id reflects the reopened state
    r = client.get(f"/tasks/{reopen_task_id}", headers=H)
    assert_eq("GET /tasks/:id after reopen → 200", r.status_code, 200)
    assert_eq("GET reflects pending state after reopen", r.json()["state"], "pending")
    assert_eq("GET reflects cleared completed_at after reopen", r.json()["completed_at"], None)

    # A reopened task must reappear in the default pending-state task list
    r = client.get("/tasks", headers=H, params={"state": "pending"})
    pending_ids_after_reopen = [t["id"] for t in r.json()["tasks"]]
    assert_true("reopened task appears in pending task list", reopen_task_id in pending_ids_after_reopen)

    # ...and must disappear from the Archive completions report over the same
    # date range, since completed_at (what the report filters on) is now null.
    r = client.get("/reports/completions", headers=H, params={"from": reopen_report_from, "to": reopen_report_to})
    assert_eq("GET /reports/completions after reopen → 200", r.status_code, 200)
    report_ids_after_reopen = [c["task_id"] for c in r.json()["completions"]]
    assert_true("reopened task no longer appears in Archive after reopen",
                reopen_task_id not in report_ids_after_reopen)

    # Reopening an already-reopened (pending) task again → 422
    r = client.post(f"/tasks/{reopen_task_id}/reopen", headers=H)
    assert_eq("POST /tasks/:id/reopen on already-pending task → 422", r.status_code, 422)

    client.delete(f"/tasks/{reopen_task_id}", headers=H)

    # ── Tasks: Reopen bypasses daily HP cap re-check (PR #64) ──────────────────
    # _count_high_priority_for_date() only counts Task.state == pending rows, so
    # a completed HP task doesn't count toward the day's cap while it sits done.
    # Fill a day's cap with pending HP tasks, then reopen a separately-completed
    # HP task for the same day — this pushes that day over the configured limit,
    # but reopen must succeed anyway since it deliberately skips the daily
    # high-priority limit check (mirrors complete_task() never re-validating
    # priority either).
    print("\n── Tasks: Reopen bypasses daily HP cap re-check (PR #64) ──")
    # Reuse today_str (always HP-eligible, d <= today+1) rather than an arbitrary
    # future offset — _is_hp_eligible_date() only accepts today/tomorrow/day-
    # after-tomorrow (and Friday-only Monday); a date further out would silently
    # fail eligibility and never become high-priority in the first place, making
    # this whole cap-bypass scenario impossible to set up.
    hp_cap_day = today_str

    r = client.post("/tasks", headers=H, json={
        "title": "Reopen HP cap boundary task",
        "must_do_by": hp_cap_day,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST HP cap boundary task → 201", r.status_code, 201)
    hp_cap_boundary_id = r.json()["id"]

    r = client.post(f"/tasks/{hp_cap_boundary_id}/complete", headers=H)
    assert_eq("Complete HP cap boundary task → 200", r.status_code, 200)

    hp_cap_fill_ids = []
    for i in range(3):
        r = client.post("/tasks", headers=H, json={
            "title": f"Reopen HP cap fill {i + 1}",
            "must_do_by": hp_cap_day,
            "label_ids": [],
            "is_high_priority": True,
        })
        assert_eq(f"POST HP cap fill task {i + 1}/3 → 201", r.status_code, 201)
        hp_cap_fill_ids.append(r.json()["id"])

    # Sanity check: a brand-new 4th HP task for the same day is correctly
    # rejected — confirms the day really is at the cap before testing reopen's
    # bypass of it.
    r = client.post("/tasks", headers=H, json={
        "title": "Reopen HP cap sanity check (should fail)",
        "must_do_by": hp_cap_day,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST 4th new HP task for a full day → 422 (sanity check)", r.status_code, 422)

    r = client.post(f"/tasks/{hp_cap_boundary_id}/reopen", headers=H)
    assert_eq("POST /tasks/:id/reopen over daily HP cap → 200 (deliberately not re-checked)",
              r.status_code, 200)
    reopened_over_cap = r.json()
    assert_eq("reopened-over-cap task state is pending", reopened_over_cap["state"], "pending")
    assert_eq("reopened-over-cap task is_high_priority still true",
              reopened_over_cap["is_high_priority"], True)

    for tid in hp_cap_fill_ids + [hp_cap_boundary_id]:
        client.delete(f"/tasks/{tid}", headers=H)

    # ── Soft delete ────────────────────────────────────────────────────────────
    print("\n── Tasks: Soft Delete ──────────────────────────────────")
    # rec_task_id was completed (state=done) above and never reopened — DELETE
    # is deliberately state-agnostic (delete_task() has no state check), which
    # is exactly the invariant the web "Delete Task" button on a completed
    # task's detail page (PR #65) relies on. Assert the precondition explicitly
    # rather than relying on it being true "by accident" of test ordering.
    r = client.get(f"/tasks/{rec_task_id}", headers=H)
    assert_eq("task is done before delete (PR #65 precondition)", r.json()["state"], "done")
    r = client.delete(f"/tasks/{rec_task_id}", headers=H)
    assert_eq("DELETE /tasks/:id on a done task → 204 (PR #65: no state restriction)", r.status_code, 204)
    r = client.get(f"/tasks/{rec_task_id}", headers=H)
    assert_eq("deleted task is 404", r.status_code, 404)

    r = client.get("/tasks", headers=H, params={"include_deleted": "true"})
    deleted_ids = [t["id"] for t in r.json()["tasks"] if t["is_deleted"]]
    assert_in("soft deleted task present with include_deleted", rec_task_id, deleted_ids)
    deleted_task = next(t for t in r.json()["tasks"] if t["id"] == rec_task_id)
    assert_eq("soft-deleted done task retains state=done", deleted_task["state"], "done")

    # ── Beliefs — removed (PR #67) ────────────────────────────────────────────
    # The Beliefs feature (and all LLM/Anthropic integration) was removed entirely
    # in PR #67: routers/beliefs.py, services/ai_service.py, the Belief/AICostLog
    # models, and the beliefs/ai_cost_log tables are all gone. Mirrors the
    # "Conversations — removed (PR #50)" pattern below: assert the routes now 404
    # instead of exercising behavior that no longer exists.
    print("\n── Beliefs — removed (PR #67) ───────────────────────────")
    r = client.post("/tasks", headers=H, json={
        "title": "Pay electricity bill online",
        "label_ids": [],
    })
    belief_task_id = r.json()["id"]

    r = client.post(f"/tasks/{belief_task_id}/beliefs/generate", headers=H)
    assert_eq("POST /tasks/:id/beliefs/generate → 404 (route removed, PR #67)", r.status_code, 404)
    r = client.get(f"/tasks/{belief_task_id}/beliefs", headers=H)
    assert_eq("GET /tasks/:id/beliefs → 404 (route removed, PR #67)", r.status_code, 404)
    r = client.put(f"/beliefs/{uuid.uuid4()}", headers=H, json={"status": "accepted"})
    assert_eq("PUT /beliefs/:id → 404 (route removed, PR #67)", r.status_code, 404)

    client.delete(f"/tasks/{belief_task_id}", headers=H)

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
