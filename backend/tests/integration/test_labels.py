"""Labels: default seeding, per-user model, frequency/mode removal, mode
migration dead-code (PR #66 xfail), and configurable type-label CRUD.
(PR #15, #16, #29, #30, #31, #51, #66)

Sets ctx.type_labels, read by several later modules.
"""
import uuid
from datetime import date

import psycopg2

from .asserts import assert_eq, assert_eq_xfail, assert_in, assert_true
from .ctx import DB_URL


def run(ctx):
    client = ctx.client
    H = ctx.H

    # ── Labels ─────────────────────────────────────────────────────────────────
    print("\n── Labels ─────────────────────────────────────────────")
    r = client.get("/labels", headers=H)
    assert_eq("GET /labels → 200", r.status_code, 200)
    labels = r.json()["labels"]
    # PR #51: mode labels removed — new users get 5 labels (type only, no mode)
    # Previously LABEL_SEED had 9 labels (4 mode + 5 type), now only 5 type labels are seeded.
    assert_true("at least 5 labels seeded (PR #51: mode removed)", len(labels) >= 5)

    # Pick specific labels for use in tests
    # PR #51: mode labels are removed end-to-end, so this dict will be empty
    mode_labels = {l["value"]: l["id"] for l in labels if l["category"] == "mode"}
    type_labels = {l["value"]: l["id"] for l in labels if l["category"] == "type"}

    # Verify the medical label added in PR #1 is seeded
    assert_in("medical label seeded", "medical", type_labels)

    # Verify raghav was renamed to child (PR #15 seed migration)
    assert_in("child label seeded (renamed from raghav)", "child", type_labels)
    assert_true("raghav label no longer exists", "raghav" not in type_labels)

    # PR #31: CategoryEnum.frequency removed from Python — GET /labels?category=frequency now
    # returns 400 (unknown category) rather than 200 with an empty or partial list.
    r = client.get("/labels?category=frequency", headers=H)
    assert_eq("GET /labels?category=frequency → 400 (PR #31: unknown category)", r.status_code, 400)

    # PR #51: mode category removed — GET /labels?category=mode now returns 400 (unknown category)
    # Previously this returned 200 with 4+ mode labels; now mode is not a valid category.
    r = client.get("/labels?category=mode", headers=H)
    assert_eq("GET /labels?category=mode → 400 (PR #51: mode removed)", r.status_code, 400)

    r = client.get("/labels?category=type", headers=H)
    assert_eq("GET /labels?category=type → 200", r.status_code, 200)
    type_only = r.json()["labels"]
    assert_true("type labels returned for user", len(type_only) >= 5)
    assert_true("type labels all have category=type", all(l["category"] == "type" for l in type_only))

    # Unknown category returns 400
    r = client.get("/labels?category=bogus", headers=H)
    assert_eq("GET /labels?category=bogus → 400", r.status_code, 400)

    # ── Labels: Per-User Model (PR #16, updated PR #31, updated PR #51) ───────
    print("\n── Labels: Per-User Model (PR #16, updated PR #31, updated PR #51) ─")
    # PR #30: LABEL_SEED originally contained 9 entries (4 mode + 5 type); frequency entries removed.
    # PR #31: SQL migration deletes all remaining frequency rows from the DB.
    # PR #51: mode labels removed end-to-end — LABEL_SEED now contains 5 entries (type only).
    # All users (including the persistent system test user) now have exactly the 5 seeded type labels.
    assert_true("GET /labels returns at least 5 seeded labels (PR #51: mode removed)", len(labels) >= 5)

    # PR #51: Only type category remains — mode is fully gone (PR #51), frequency was removed in PR #31
    all_categories = {l["category"] for l in labels}
    assert_true("type category present in GET /labels (PR #51)",
                "type" in all_categories)
    assert_true("mode category absent from GET /labels (PR #51)",
                "mode" not in all_categories)
    assert_true("frequency category absent from GET /labels (PR #31)",
                "frequency" not in all_categories)

    # Verify that label IDs from GET /labels can be used to create tasks (the core
    # bug fixed in PR #16 — per-user IDs were not matching global IDs on task creation)
    # PR #51: mode labels no longer seeded, use type label instead
    pr16_verify_task_r = client.post("/tasks", headers=H, json={
        "title": "PR #16 label-ID verification task",
        "label_ids": [type_labels["household"]],
    })
    assert_eq("POST task using per-user label IDs → 201 (PR #16)", pr16_verify_task_r.status_code, 201)
    pr16_task = pr16_verify_task_r.json()
    pr16_task_id = pr16_task["id"]
    pr16_label_values = {l["value"] for l in pr16_task["labels"]}
    assert_eq("per-user label IDs attach correctly to task (PR #16)", pr16_label_values, {"household"})
    # Clean up
    client.delete(f"/tasks/{pr16_task_id}", headers=H)

    # ── Labels: Frequency fully removed (PR #31) ─────────────────────────────
    # PR #29 removed frequency from all client UI surfaces.
    # PR #30 removed frequency entries from LABEL_SEED and recurrence logic from the backend.
    # PR #31 (this PR) runs the SQL migration and removes CategoryEnum.frequency from Python.
    # After PR #31:
    #   - All frequency label rows are deleted from the DB (SQL migration).
    #   - CategoryEnum.frequency no longer exists in Python.
    #   - GET /labels?category=frequency returns 400 (unknown category), not 200.
    #   - POST /labels with category=frequency returns 400 (unknown category).
    print("\n── Labels: Frequency fully removed (PR #31) ────────────")
    # GET /labels?category=frequency must return 400 (unknown category) — CategoryEnum.frequency gone
    r = client.get("/labels?category=frequency", headers=H)
    assert_eq("GET /labels?category=frequency → 400 (PR #31: CategoryEnum.frequency removed)",
              r.status_code, 400)

    # GET /labels must not include any frequency rows (all deleted by SQL migration)
    r = client.get("/labels", headers=H)
    all_labels_pr31 = r.json()["labels"]
    freq_rows = [l for l in all_labels_pr31 if l["category"] == "frequency"]
    assert_eq("no frequency label rows remain after PR #31 SQL migration", freq_rows, [])

    # POST /labels — frequency category must still be rejected (now: unknown category 400)
    r = client.post("/labels", headers=H, json={"category": "frequency", "value": "hourly"})
    assert_eq("POST /labels frequency category → 400 (PR #31: unknown category)",
              r.status_code, 400)

    # ── Labels: Mode fully removed (PR #51) ──────────────────────────────────
    # PR #51 removes the Mode label category end-to-end: all Mode labels deleted at startup,
    # and the API no longer accepts mode as a category in GET or POST requests.
    print("\n── Labels: Mode fully removed (PR #51) ──────────────────")
    # GET /labels?category=mode must return 400 (unknown category) — verified earlier
    r = client.get("/labels?category=mode", headers=H)
    assert_eq("GET /labels?category=mode → 400 (PR #51: mode removed)",
              r.status_code, 400)

    # GET /labels must not include any mode rows (all deleted by startup migration)
    r = client.get("/labels", headers=H)
    all_labels_pr51 = r.json()["labels"]
    mode_rows = [l for l in all_labels_pr51 if l["category"] == "mode"]
    assert_eq("no mode label rows remain after PR #51 startup migration", mode_rows, [])

    # POST /labels — mode category must be rejected (now: non-configurable 400)
    r = client.post("/labels", headers=H, json={"category": "mode", "value": "video-call"})
    assert_eq("POST /labels mode category → 400 (PR #51: mode no longer configurable)",
              r.status_code, 400)

    # ── Labels: Create / Update / Delete (PR #15, updated PR #51) ─────────────
    print("\n── Labels: Configurable Type (PR #15, PR #51: mode removed) ────")

    # PR #51: POST /labels with mode category now returns 400 (non-configurable)
    # Mode labels are no longer supported in the API
    r = client.post("/labels", headers=H, json={"category": "mode", "value": "in-person"})
    assert_eq("POST /labels (mode) → 400 (PR #51: mode removed)", r.status_code, 400)

    # ── Labels: Mode migration dead-code removal (PR #66) ─────────────────────
    # PR #66 deletes the startup migration block in main.py that tried to rebuild
    # the `categoryenum` Postgres enum type to drop 'mode'. Static analysis (Sneezy's
    # plan review) plus direct production/dev-DB verification (Grumpy's response on
    # the plan) confirmed that block never actually executed anywhere: it checked
    # for a type named `category_enum` (underscore) while SQLAlchemy's real default
    # name for `Column(Enum(CategoryEnum))` is `categoryenum` (no underscore). Only
    # the unconditional `DELETE FROM labels WHERE category = 'mode'` on the line
    # above the broken `IF EXISTS` block ever ran — which is why zero `mode` rows
    # remain in `labels` even though the enum type itself was never actually
    # rebuilt. The maintainer explicitly decided NOT to fix the enum-level typo in
    # PR #66 (out of scope, "future ticket") — so the Postgres enum type still
    # nominally permits an unused 'mode' member. Pinned here via assert_eq_xfail so
    # a future corrective migration gets caught (XPASS) and this marker removed.
    print("\n── Labels: Mode migration dead-code removal (PR #66) ────")
    _mode_conn = psycopg2.connect(DB_URL)
    _mode_cur = _mode_conn.cursor()
    _mode_cur.execute(
        "SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid "
        "WHERE t.typname = 'categoryenum'"
    )
    categoryenum_members = sorted(row[0] for row in _mode_cur.fetchall())
    _mode_cur.close()
    _mode_conn.close()
    assert_eq_xfail(
        "categoryenum Postgres type no longer nominally permits 'mode'",
        categoryenum_members, ["type"],
        reason="known latent defect, deliberately deferred in PR #66 — the mode-removal "
               "migration block deleted in that PR never ran due to a category_enum vs. "
               "categoryenum type-name mismatch, so the enum type was never actually "
               "rebuilt (only the label row DELETE, unaffected by the typo, ever ran); "
               "see PR #66's description for the full investigation",
    )

    # POST /labels — create a type label
    r = client.post("/labels", headers=H, json={"category": "type", "value": "school"})
    assert_eq("POST /labels (type) → 201", r.status_code, 201)
    new_type_label = r.json()
    new_type_label_id = new_type_label["id"]
    assert_eq("new type label value", new_type_label["value"], "school")

    # POST /labels — duplicate type label returns 409
    r = client.post("/labels", headers=H, json={"category": "type", "value": "school"})
    assert_eq("POST /labels duplicate → 409", r.status_code, 409)

    # POST /labels — unknown category → 400
    r = client.post("/labels", headers=H, json={"category": "bogus", "value": "x"})
    assert_eq("POST /labels unknown category → 400", r.status_code, 400)

    # POST /labels — empty value → 400
    r = client.post("/labels", headers=H, json={"category": "type", "value": "   "})
    assert_eq("POST /labels empty value → 400", r.status_code, 400)

    # POST /labels — non-existent board_id → 404 (documented in DATA_MODEL_AND_API.MD's
    # POST /labels error cases, but previously untested). PR #58 adds inline tag creation
    # from the Edit/Add Task form (TaskForm.tsx's "+ Add" control), which always sends an
    # explicit board_id — if that board_id is ever stale (e.g. a board deleted in another
    # tab/device since the form loaded), the request must fail cleanly with 404 rather
    # than silently creating the label in the wrong place or 500ing.
    r = client.post("/labels", headers=H, json={"category": "type", "value": "ghost-board-label", "board_id": str(uuid.uuid4())})
    assert_eq("POST /labels non-existent board_id → 404", r.status_code, 404)

    # Newly created label appears in GET /labels
    r = client.get("/labels", headers=H)
    all_label_ids = [l["id"] for l in r.json()["labels"]]
    assert_in("new type label in GET /labels", new_type_label_id, all_label_ids)

    # PUT /labels/{id} — rename a label
    r = client.put(f"/labels/{new_type_label_id}", headers=H, json={"value": "school-work"})
    assert_eq("PUT /labels/:id rename → 200", r.status_code, 200)
    renamed = r.json()
    assert_eq("label renamed", renamed["value"], "school-work")
    assert_eq("category unchanged after rename", renamed["category"], "type")

    # PUT /labels/{id} — rename to existing value → 409
    r = client.put(f"/labels/{new_type_label_id}", headers=H, json={"value": "household"})
    assert_eq("PUT /labels/:id rename to existing value → 409", r.status_code, 409)

    # PUT /labels/{id} — empty value → 400
    r = client.put(f"/labels/{new_type_label_id}", headers=H, json={"value": "  "})
    assert_eq("PUT /labels/:id empty value → 400", r.status_code, 400)

    # PUT /labels/{id} — 404 for non-existent label
    r = client.put(f"/labels/{str(uuid.uuid4())}", headers=H, json={"value": "anything"})
    assert_eq("PUT /labels/:id non-existent → 404", r.status_code, 404)

    # NOTE: PUT /labels on a frequency label test is skipped — PR #30 removed
    # frequency labels from LABEL_SEED so fresh test users have no frequency rows.
    # Enforcement (400 for category=frequency) is verified in the PR #30 section above.

    # DELETE /labels/{id} — delete the type label
    r = client.delete(f"/labels/{new_type_label_id}", headers=H)
    assert_eq("DELETE /labels/:id → 204", r.status_code, 204)

    # Verify deleted label is gone from GET /labels
    r = client.get("/labels", headers=H)
    remaining_ids = [l["id"] for l in r.json()["labels"]]
    assert_true("deleted type label no longer in GET /labels", new_type_label_id not in remaining_ids)

    # DELETE /labels/{id} — 404 for already-deleted label
    r = client.delete(f"/labels/{new_type_label_id}", headers=H)
    assert_eq("DELETE /labels/:id already deleted → 404", r.status_code, 404)

    # NOTE: DELETE /labels on a frequency label test is skipped — PR #30 removed
    # frequency labels from LABEL_SEED so fresh test users have no frequency rows.
    # Enforcement (400 for category=frequency POST) is verified in the PR #30 section above.

    # DELETE /labels/{id} — 404 for non-existent label
    r = client.delete(f"/labels/{str(uuid.uuid4())}", headers=H)
    assert_eq("DELETE /labels/:id non-existent → 404", r.status_code, 404)

    # NOTE: no further cleanup needed here — new_type_label_id was already
    # permanently deleted above (labels are hard-deleted, not soft-deleted;
    # see Table: labels in DATA_MODEL_AND_API.MD). A prior version of this test
    # re-issued a DELETE on the same already-deleted id expecting 204, which is
    # wrong (the correct/actual response is 404, as already asserted above).

    # Verify label isolation: a task should not accept a label_id that belongs
    # to a different user.  Confirm that the per-user label we just deleted
    # can no longer be attached to a task.
    today_str_labels = date.today().isoformat()
    r = client.post("/tasks", headers=H, json={
        "title": "Label isolation test task",
        "must_do_by": today_str_labels,
        "label_ids": [new_type_label_id],  # already deleted — should 422
    })
    assert_eq("POST /tasks with deleted label_id → 422", r.status_code, 422)

    ctx.type_labels = type_labels
