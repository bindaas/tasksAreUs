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
    else:
        print("  (skipping conversation AI tests — ANTHROPIC_API_KEY not set)")

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
