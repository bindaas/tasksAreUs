"""
Standalone API test script.
- Creates its own test data
- Exercises all major endpoints
- Cleans up everything at the end via direct DB connection

Usage:
    pip install httpx psycopg2-binary
    DATABASE_URL=postgresql://... BASE_URL=http://localhost:8000 python tests/test_api.py
"""
import os
import sys
import uuid
from datetime import date, timedelta

import httpx
import psycopg2

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000/api/v1")
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/tasksareus")

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
    for table in ["ai_cost_log", "messages", "conversations", "beliefs", "tasks", "user_settings"]:
        cur.execute(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))
    cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
    cur.close()
    conn.close()
    print(f"  {PASS} Deleted all records for test user {user_id}")


def main():
    client = httpx.Client(base_url=BASE_URL, timeout=30)
    test_device_uuid = str(uuid.uuid4())
    test_user_id = None

    # ── Health ─────────────────────────────────────────────────────────────────
    print("\n── Health ─────────────────────────────────────────────")
    r = client.get("/health")
    assert_eq("GET /health → 200", r.status_code, 200)
    assert_in("health has status", "status", r.json())

    # ── Users ──────────────────────────────────────────────────────────────────
    print("\n── Users ──────────────────────────────────────────────")
    r = client.post("/users", json={"device_uuid": test_device_uuid})
    assert_eq("POST /users → 201", r.status_code, 201)
    test_user_id = r.json()["id"]
    assert_true("user has id", bool(test_user_id))

    # Idempotency
    r2 = client.post("/users", json={"device_uuid": test_device_uuid})
    assert_eq("POST /users idempotent → 201", r2.status_code, 201)
    assert_eq("same user returned", r2.json()["id"], test_user_id)

    H = {"X-User-ID": test_user_id}

    # ── Labels ─────────────────────────────────────────────────────────────────
    print("\n── Labels ─────────────────────────────────────────────")
    r = client.get("/labels", headers=H)
    assert_eq("GET /labels → 200", r.status_code, 200)
    labels = r.json()["labels"]
    assert_true("at least 14 labels seeded", len(labels) >= 14)

    # Pick specific labels for use in tests
    freq_labels = {l["value"]: l["id"] for l in labels if l["category"] == "frequency"}
    mode_labels = {l["value"]: l["id"] for l in labels if l["category"] == "mode"}
    type_labels = {l["value"]: l["id"] for l in labels if l["category"] == "type"}

    # Verify the medical label added in PR #1 is seeded
    assert_in("medical label seeded", "medical", type_labels)

    r = client.get("/labels?category=frequency", headers=H)
    freq_only = r.json()["labels"]
    assert_true("category filter works", all(l["category"] == "frequency" for l in freq_only))

    # ── Task CRUD ──────────────────────────────────────────────────────────────
    print("\n── Tasks: CRUD ─────────────────────────────────────────")
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    next_week = (date.today() + timedelta(days=7)).isoformat()
    r = client.post("/tasks", headers=H, json={
        "title": "Return library books",
        "notes": "Row 4, shelf B",
        "must_do_by": next_week,
        "target_date": tomorrow,
        "label_ids": [mode_labels["outdoor"], type_labels["raghav"]],
    })
    assert_eq("POST /tasks → 201", r.status_code, 201)
    task = r.json()
    task_id = task["id"]
    assert_eq("task title", task["title"], "Return library books")
    assert_eq("task state", task["state"], "pending")
    assert_eq("task label count", len(task["labels"]), 2)
    # target_date and must_do_by must both be present in the task response
    assert_in("task has target_date field", "target_date", task)
    assert_in("task has must_do_by field", "must_do_by", task)
    assert_eq("task target_date round-trips", task["target_date"], tomorrow)
    assert_eq("task must_do_by round-trips", task["must_do_by"], next_week)

    r = client.get(f"/tasks/{task_id}", headers=H)
    assert_eq("GET /tasks/:id → 200", r.status_code, 200)
    fetched = r.json()
    assert_eq("fetched task id", fetched["id"], task_id)
    assert_eq("GET /tasks/:id target_date preserved", fetched["target_date"], tomorrow)

    r = client.put(f"/tasks/{task_id}", headers=H, json={
        "title": "Return library books (updated)",
        "label_ids": [mode_labels["outdoor"]],
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

    r = client.get("/tasks", headers=H, params={"state": "pending"})
    assert_eq("GET /tasks?state=pending → 200", r.status_code, 200)
    task_ids = [t["id"] for t in r.json()["tasks"]]
    assert_in("task in list", task_id, task_ids)

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

    # ── Recurring task ─────────────────────────────────────────────────────────
    print("\n── Tasks: Recurring ────────────────────────────────────")
    today_str = date.today().isoformat()
    r = client.post("/tasks", headers=H, json={
        "title": "Daily exercise",
        "must_do_by": today_str,
        "label_ids": [freq_labels["daily"], mode_labels["outdoor"]],
    })
    assert_eq("POST recurring task → 201", r.status_code, 201)
    rec_task_id = r.json()["id"]

    r = client.post(f"/tasks/{rec_task_id}/complete", headers=H)
    assert_eq("Complete recurring → 200", r.status_code, 200)
    result = r.json()
    assert_eq("recurring task done", result["completed_task"]["state"], "done")
    assert_true("next_task created", result["next_task"] is not None)
    next_task = result["next_task"]
    assert_eq("next task is pending", next_task["state"], "pending")
    assert_true("next task shares recurrence_group_id",
                next_task["recurrence_group_id"] == result["completed_task"]["recurrence_group_id"])
    tomorrow_check = (date.today() + timedelta(days=1)).isoformat()
    assert_eq("next task due tomorrow", next_task["must_do_by"], tomorrow_check)
    next_task_id = next_task["id"]

    # ── Soft delete ────────────────────────────────────────────────────────────
    print("\n── Tasks: Soft Delete ──────────────────────────────────")
    r = client.delete(f"/tasks/{next_task_id}", headers=H)
    assert_eq("DELETE /tasks/:id → 204", r.status_code, 204)
    r = client.get(f"/tasks/{next_task_id}", headers=H)
    assert_eq("deleted task is 404", r.status_code, 404)

    r = client.get("/tasks", headers=H, params={"include_deleted": "true"})
    deleted_ids = [t["id"] for t in r.json()["tasks"] if t["is_deleted"]]
    assert_in("soft deleted task present with include_deleted", next_task_id, deleted_ids)

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

    # ── target_date-only task (PR #4 fix: chat context must include target_date) ─
    print("\n── Tasks: target_date-only (chat context fix) ──────────")
    target_only_date = (date.today() + timedelta(days=3)).isoformat()
    r = client.post("/tasks", headers=H, json={
        "title": "Chat target-date test task",
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

    # ── Conversations ──────────────────────────────────────────────────────────
    print("\n── Conversations ───────────────────────────────────────")
    r = client.post("/conversations", headers=H)
    assert_eq("POST /conversations → 201", r.status_code, 201)
    conv_id = r.json()["id"]

    if os.getenv("ANTHROPIC_API_KEY"):
        r = client.post(f"/conversations/{conv_id}/messages", headers=H, json={
            "content": "What pending tasks do I have?"
        })
        assert_eq("POST conversation message → 200", r.status_code, 200)
        msg = r.json()["message"]
        assert_eq("assistant role", msg["role"], "assistant")
        assert_true("has content", bool(msg["content"]))
        assert_true("has suggested questions", bool(msg.get("suggested_questions")))

        r = client.get(f"/conversations/{conv_id}/messages", headers=H)
        assert_eq("GET conversation messages → 200", r.status_code, 200)
        assert_true("2 messages (user + assistant)", len(r.json()["messages"]) == 2)

        # PR #4 fix: the AI should see tasks that have only target_date set.
        # Ask specifically about the target-date-only task we just created.
        r2 = client.post("/conversations", headers=H)
        assert_eq("POST /conversations for target_date test → 201", r2.status_code, 201)
        conv2_id = r2.json()["id"]
        r = client.post(f"/conversations/{conv2_id}/messages", headers=H, json={
            "content": "Tell me about the task called 'Chat target-date test task'."
        })
        assert_eq("conversation msg about target_date-only task → 200", r.status_code, 200)
        msg2 = r.json()["message"]
        assert_true(
            "AI response references target_date-only task",
            "target" in msg2["content"].lower() or "chat target-date test task" in msg2["content"].lower(),
        )
    else:
        print("  (skipping conversation AI tests — ANTHROPIC_API_KEY not set)")

    # Clean up the target-date-only task after conversation tests
    client.delete(f"/tasks/{target_only_task_id}", headers=H)

    # ── Reports ────────────────────────────────────────────────────────────────
    print("\n── Reports ─────────────────────────────────────────────")
    from_date = (date.today() - timedelta(days=7)).isoformat()
    to_date = date.today().isoformat()
    r = client.get("/reports/completions", headers=H, params={"from": from_date, "to": to_date})
    assert_eq("GET /reports/completions → 200", r.status_code, 200)
    report = r.json()
    assert_in("report has completions", "completions", report)
    assert_in("report has total", "total", report)
    assert_true("total matches completions count", report["total"] == len(report["completions"]))

    # ── Settings ───────────────────────────────────────────────────────────────
    print("\n── Settings ────────────────────────────────────────────")
    r = client.get("/settings", headers=H)
    assert_eq("GET /settings → 200", r.status_code, 200)

    questions = ["What tasks do I need to do today?", "What outdoor tasks are pending?"]
    r = client.put("/settings", headers=H, json={"starter_questions": questions})
    assert_eq("PUT /settings → 200", r.status_code, 200)
    assert_eq("settings saved", r.json()["starter_questions"], questions)

    # ── Sync ───────────────────────────────────────────────────────────────────
    print("\n── Sync ────────────────────────────────────────────────")
    from datetime import datetime, timezone
    last_synced = "2020-01-01T00:00:00Z"
    r = client.post("/sync", headers=H, json={
        "last_synced_at": last_synced,
        "changes": {"tasks": [], "task_labels": [], "beliefs": [], "settings": None},
    })
    assert_eq("POST /sync → 200", r.status_code, 200)
    sync_result = r.json()
    assert_in("sync has synced_at", "synced_at", sync_result)
    assert_in("sync has changes", "changes", sync_result)
    assert_true("sync returns tasks", isinstance(sync_result["changes"]["tasks"], list))
    assert_true("completed tasks in sync response", len(sync_result["changes"]["tasks"]) >= 2)
    # Verify is_high_priority field is included in sync task objects (PR #6)
    if sync_result["changes"]["tasks"]:
        first_sync_task = sync_result["changes"]["tasks"][0]
        assert_in("sync task object includes is_high_priority field", "is_high_priority", first_sync_task)

    # Verify sync push: sending a task with is_high_priority=true round-trips correctly
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
                "recurrence_group_id": None,
                "completed_at": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }],
            "task_labels": [],
            "beliefs": [],
            "settings": None,
        },
    })
    assert_eq("POST /sync with is_high_priority task → 200", r.status_code, 200)
    # Read it back to confirm the field was stored
    r = client.get(f"/tasks/{hp_sync_task_id}", headers=H)
    assert_eq("GET synced HP task → 200", r.status_code, 200)
    assert_eq("synced task is_high_priority persisted", r.json()["is_high_priority"], True)
    # Clean up the sync test task
    client.delete(f"/tasks/{hp_sync_task_id}", headers=H)

    # ── Summary ────────────────────────────────────────────────────────────────
    print(f"\n── Results ─────────────────────────────────────────────")
    if _failures:
        print(f"  {FAIL} {len(_failures)} failure(s):")
        for f in _failures:
            print(f"    - {f}")
    else:
        print(f"  {PASS} All tests passed")

    cleanup(test_user_id)

    if _failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
