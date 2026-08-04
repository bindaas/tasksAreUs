"""Shared test context: httpx client, test user id, auth headers, DB cleanup,
and the cross-module state later `run(ctx)` calls read/write
(`default_board_id`, `task_id`, `type_labels`). Also owns the original
Health and Auth sections as part of context construction (they are one-shot
setup checks, not a standalone domain module) — see the "Revised module
list" note in development-plans/PLAN-chore-modularize-test-suite.md.
"""
import atexit
import os

import httpx
import psycopg2

from .asserts import PASS, assert_eq, assert_in

BASE_URL = os.getenv("BASE_URL", "http://localhost:8000/api/v1")
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/tasksareus")

SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"


class Ctx:
    """Mutable state threaded through every module's run(ctx), mirroring the
    local variables today's test_api.py's main() shares across sections via
    closure. Populated lazily: default_board_id by test_boards.py, task_id by
    test_task_crud.py, type_labels by test_labels.py — each is read by
    several later modules (see the plan's cross-section state note)."""

    def __init__(self, client: httpx.Client, test_user_id: str, headers: dict):
        self.client = client
        self.test_user_id = test_user_id
        self.H = headers
        self.default_board_id = None
        self.task_id = None
        self.type_labels = None


def cleanup(user_id: str):
    print("\n── Cleanup ────────────────────────────────────────────")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    # task_labels has no user_id — delete via tasks FK
    cur.execute(
        "DELETE FROM task_labels WHERE task_id IN (SELECT id FROM tasks WHERE user_id = %s)",
        (user_id,),
    )
    # PR #50: conversations/messages tables were dropped entirely (chat removal) —
    # deleting from them here would fail with "relation does not exist" against a
    # DB that has run this PR's startup migration.
    # PR #67: beliefs/ai_cost_log tables were dropped entirely (Beliefs/LLM removal) —
    # same failure mode as above (UndefinedTable) if left in this list. This is the
    # second time this exact mistake class has hit this loop — if a future PR drops
    # another table, remove it from this list in the same PR that drops it, not after.
    for table in ["tasks", "user_settings", "focused_view_configs"]:
        cur.execute(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))
    # Per-user labels created by PR #15 (mode/type labels with user_id set)
    cur.execute("DELETE FROM labels WHERE user_id = %s", (user_id,))
    # PR #33: boards table; labels must be deleted before boards (FK constraint)
    cur.execute("DELETE FROM boards WHERE user_id = %s", (user_id,))
    # System user is permanent — only delete data, not the user row itself
    if user_id != SYSTEM_USER_ID:
        cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    conn.commit()
    cur.close()
    conn.close()
    print(f"  {PASS} Deleted all records for test user {user_id}")


def build_ctx() -> Ctx:
    """Creates the shared httpx client, runs the Health and Auth checks, wipes
    any leftover data for the system test user, registers atexit cleanup, and
    returns the Ctx object every later module's run(ctx) receives."""
    client = httpx.Client(base_url=BASE_URL, timeout=30)

    # ── Health ─────────────────────────────────────────────────────────────────
    # GET /health is intentionally unauthenticated — the Settings Connection widget
    # calls it without a Bearer token to test backend reachability (PR #25).
    print("\n── Health ─────────────────────────────────────────────")
    r = client.get("/health")
    assert_eq("GET /health → 200", r.status_code, 200)
    health_body = r.json()
    assert_in("health has status", "status", health_body)
    assert_eq("health status is ok", health_body.get("status"), "ok")
    # PR #25: Settings connection widget reads the response — verify full shape
    assert_in("health has timestamp", "timestamp", health_body)
    assert_in("health has version", "version", health_body)
    assert_in("health has checks", "checks", health_body)
    assert_in("health checks has database", "database", health_body.get("checks", {}))
    assert_eq("health checks.database.status is ok",
              health_body.get("checks", {}).get("database", {}).get("status"), "ok")
    # Must be accessible without any auth header (no X-User-ID, no Bearer)
    r_noauth = httpx.get(f"{BASE_URL}/health", timeout=10)
    assert_eq("GET /health with no auth header → 200 (unauthenticated endpoint)", r_noauth.status_code, 200)

    # Use the system user for test data (it is seeded at startup and never deleted)
    test_user_id = SYSTEM_USER_ID
    # Clean up any leftover data from a previous run before starting
    cleanup(test_user_id)
    atexit.register(cleanup, test_user_id)

    H = {"X-User-ID": test_user_id}

    # ── Auth ───────────────────────────────────────────────────────────────────
    # Bearer token is the ONLY accepted auth path. Integration tests cannot
    # obtain a real Firebase token, so all subsequent tests use X-User-ID which
    # returns 401 on the backend. All failures after this point are caused by
    # this structural limitation, not by the feature under test.
    print("\n── Auth (Bearer-only) ─────────────────────────────────")

    # Protected endpoint with no auth at all must return 401
    r = client.get("/labels")
    assert_eq("GET /labels with no auth → 401", r.status_code, 401)

    return Ctx(client, test_user_id, H)
