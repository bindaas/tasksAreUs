"""Settings: GET/PUT high_priority_daily_limit, starter_questions removal
(PR #50), and the configurable high-priority limit driving create/PUT
enforcement (PR #9).

Self-contained aside from ctx.client/ctx.H.
"""
from datetime import date

from .asserts import assert_eq, assert_in, assert_true


def run(ctx):
    client = ctx.client
    H = ctx.H

    # ── Settings ───────────────────────────────────────────────────────────────
    print("\n── Settings ────────────────────────────────────────────")
    r = client.get("/settings", headers=H)
    assert_eq("GET /settings → 200", r.status_code, 200)
    settings_body = r.json()
    assert_in("GET /settings has high_priority_daily_limit field", "high_priority_daily_limit", settings_body)
    assert_eq("GET /settings default high_priority_daily_limit is 3", settings_body["high_priority_daily_limit"], 3)
    # PR #50: starter_questions removed end-to-end (only ever fed the removed chat screen)
    assert_true("GET /settings no longer has starter_questions field (PR #50)",
                "starter_questions" not in settings_body)

    r = client.put("/settings", headers=H, json={"high_priority_daily_limit": 3})
    assert_eq("PUT /settings → 200", r.status_code, 200)
    assert_in("PUT /settings response has high_priority_daily_limit", "high_priority_daily_limit", r.json())
    assert_true("PUT /settings response no longer has starter_questions field (PR #50)",
                "starter_questions" not in r.json())

    # PUT /settings with explicit high_priority_daily_limit persists and round-trips
    r = client.put("/settings", headers=H, json={"high_priority_daily_limit": 5})
    assert_eq("PUT /settings with custom limit → 200", r.status_code, 200)
    assert_eq("PUT /settings custom limit round-trips", r.json()["high_priority_daily_limit"], 5)
    r = client.get("/settings", headers=H)
    assert_eq("GET /settings after update → 200", r.status_code, 200)
    assert_eq("GET /settings persisted custom limit", r.json()["high_priority_daily_limit"], 5)

    # Floor of 1: sending 0 is rejected by schema validation (ge=1 on SettingsUpdate)
    # The PRD says minimum 1; the schema enforces this at the Pydantic layer (422),
    # rather than silently clamping. 422 is correct behaviour here.
    r = client.put("/settings", headers=H, json={"high_priority_daily_limit": 0})
    assert_eq("PUT /settings with limit=0 → 422 (schema min=1 rejects it)", r.status_code, 422)

    # Omitting high_priority_daily_limit in PUT body uses schema default of 3
    r = client.put("/settings", headers=H, json={})
    assert_eq("PUT /settings with empty body → 200", r.status_code, 200)
    assert_eq("limit defaults to 3 when omitted from PUT body", r.json()["high_priority_daily_limit"], 3)

    # PR #50: starter_questions is no longer a field on SettingsUpdate at all. A stale
    # client (or the mobile/web clients before this PR is deployed to them) may still
    # send it — Pydantic's default "ignore extra fields" behaviour means the request
    # must still succeed and the field must not be echoed back or persisted anywhere.
    r = client.put("/settings", headers=H, json={"starter_questions": ["stale client field"], "high_priority_daily_limit": 3})
    assert_eq("PUT /settings with stray starter_questions field → 200 (ignored, not rejected)", r.status_code, 200)
    assert_true("stray starter_questions field not echoed back in response",
                "starter_questions" not in r.json())

    # ── Configurable high-priority limit (PR #9) ──────────────────────────────
    print("\n── Settings: Configurable High-Priority Limit ──────────")
    today_str = date.today().isoformat()

    # Set limit to 2 for this test section
    r = client.put("/settings", headers=H, json={"high_priority_daily_limit": 2})
    assert_eq("PUT /settings set limit to 2 → 200", r.status_code, 200)
    assert_eq("limit confirmed as 2", r.json()["high_priority_daily_limit"], 2)

    # Create 2 HP tasks for today — both should succeed under limit=2
    hp_config_ids = []
    for i in range(2):
        r = client.post("/tasks", headers=H, json={
            "title": f"HP config task {i + 1}",
            "must_do_by": today_str,
            "label_ids": [],
            "is_high_priority": True,
        })
        assert_eq(f"POST hp config task {i + 1}/2 with limit=2 → 201", r.status_code, 201)
        assert_eq(f"hp config task {i + 1} is_high_priority=true", r.json()["is_high_priority"], True)
        hp_config_ids.append(r.json()["id"])

    # 3rd HP task must be rejected now that limit=2 is reached
    r = client.post("/tasks", headers=H, json={
        "title": "HP config task 3 (should fail at limit=2)",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST 3rd HP task when limit=2 → 422", r.status_code, 422)
    assert_true("422 detail references limit=2", "2" in r.json().get("detail", ""))

    # Raise limit to 4 — the same 3rd task should now succeed
    r = client.put("/settings", headers=H, json={"high_priority_daily_limit": 4})
    assert_eq("PUT /settings raise limit to 4 → 200", r.status_code, 200)
    r = client.post("/tasks", headers=H, json={
        "title": "HP config task 3 (should succeed at limit=4)",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST 3rd HP task when limit=4 → 201", r.status_code, 201)
    assert_eq("3rd HP task is_high_priority=true under limit=4", r.json()["is_high_priority"], True)
    hp_config_ids.append(r.json()["id"])

    # PUT an existing non-HP task to HP when limit=4 but 3 already exist → should succeed
    r = client.post("/tasks", headers=H, json={
        "title": "HP config PUT test task",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": False,
    })
    assert_eq("POST normal task for HP config PUT test → 201", r.status_code, 201)
    hp_config_put_task_id = r.json()["id"]
    r = client.put(f"/tasks/{hp_config_put_task_id}", headers=H, json={"is_high_priority": True})
    assert_eq("PUT is_high_priority=true when count=3, limit=4 → 200", r.status_code, 200)
    assert_eq("PUT HP succeeds under limit=4", r.json()["is_high_priority"], True)
    hp_config_ids.append(hp_config_put_task_id)

    # 5th task must be rejected (count=4, limit=4)
    r = client.post("/tasks", headers=H, json={
        "title": "HP config task 5 (should fail at limit=4)",
        "must_do_by": today_str,
        "label_ids": [],
        "is_high_priority": True,
    })
    assert_eq("POST 5th HP task when limit=4 → 422", r.status_code, 422)

    # Clean up HP config test tasks and restore limit to 3
    for tid in hp_config_ids:
        client.delete(f"/tasks/{tid}", headers=H)
    r = client.put("/settings", headers=H, json={"high_priority_daily_limit": 3})
    assert_eq("Restore limit to 3 after configurable-limit test → 200", r.status_code, 200)
