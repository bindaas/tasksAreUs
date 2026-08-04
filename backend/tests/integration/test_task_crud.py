"""Task CRUD, Links (PR #39), date-clearing via PUT (null vs. omit), notes
field semantics (PR #45), and notes-preserves-Markdown-verbatim (PR #59).

Reads ctx.type_labels, ctx.default_board_id. Sets ctx.task_id, read by many
later modules (scheduling, high-priority, lifecycle, reports).
"""
import uuid
from datetime import date, timedelta

from .asserts import assert_eq, assert_in, assert_true


def run(ctx):
    client = ctx.client
    H = ctx.H
    type_labels = ctx.type_labels
    default_board_id = ctx.default_board_id

    # ── Task CRUD ──────────────────────────────────────────────────────────────
    print("\n── Tasks: CRUD ─────────────────────────────────────────")
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    next_week = (date.today() + timedelta(days=7)).isoformat()
    r = client.post("/tasks", headers=H, json={
        "title": "Return library books",
        "notes": "Row 4, shelf B",
        "must_do_by": next_week,
        "target_date": tomorrow,
        "label_ids": [type_labels["child"], type_labels["household"]],
    })
    assert_eq("POST /tasks → 201", r.status_code, 201)
    task = r.json()
    task_id = task["id"]
    assert_eq("task title", task["title"], "Return library books")
    assert_eq("task state", task["state"], "pending")
    assert_eq("task label count", len(task["labels"]), 2)
    assert_eq("task notes round-trips on create", task["notes"], "Row 4, shelf B")
    # target_date and must_do_by must both be present in the task response
    assert_in("task has target_date field", "target_date", task)
    assert_in("task has must_do_by field", "must_do_by", task)
    assert_eq("task target_date round-trips", task["target_date"], tomorrow)
    assert_eq("task must_do_by round-trips", task["must_do_by"], next_week)
    # PR #31: recurrence_group_id column dropped — must not appear in API response
    assert_true("task response has no recurrence_group_id field (PR #31)",
                "recurrence_group_id" not in task)
    # PR #33: board_id must be present in task response
    assert_in("task response has board_id field (PR #33)", "board_id", task)
    assert_eq("task board_id is the default board (PR #33)", task["board_id"], default_board_id)
    # PR #61: sort_order must be present and auto-populated on create
    assert_in("task response has sort_order field (PR #61)", "sort_order", task)
    assert_true("task sort_order is a float (PR #61)", isinstance(task["sort_order"], float))

    r = client.get(f"/tasks/{task_id}", headers=H)
    assert_eq("GET /tasks/:id → 200", r.status_code, 200)
    fetched = r.json()
    assert_eq("fetched task id", fetched["id"], task_id)
    assert_eq("GET /tasks/:id target_date preserved", fetched["target_date"], tomorrow)
    assert_in("GET /tasks/:id has sort_order field (PR #61)", "sort_order", fetched)

    r = client.put(f"/tasks/{task_id}", headers=H, json={
        "title": "Return library books (updated)",
        "label_ids": [type_labels["child"]],
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

    # ── Tasks: Links (PR #39) ──────────────────────────────────────────────────
    print("\n── Tasks: Links (PR #39) ────────────────────────────────")

    # POST /tasks — task without links defaults to an empty list
    r = client.post("/tasks", headers=H, json={"title": "Links default test task", "label_ids": []})
    assert_eq("POST /tasks without links → 201", r.status_code, 201)
    links_default_task = r.json()
    links_default_task_id = links_default_task["id"]
    assert_in("task response has links field", "links", links_default_task)
    assert_eq("task links defaults to empty list when omitted", links_default_task["links"], [])
    client.delete(f"/tasks/{links_default_task_id}", headers=H)

    # POST /tasks — create with up to MAX_TASK_LINKS (3) valid links
    link_a = {"id": str(uuid.uuid4()), "url": "https://example.com/a", "description": "Link A"}
    link_b = {"id": str(uuid.uuid4()), "url": "http://example.com/b", "description": "Link B"}
    link_c = {"id": str(uuid.uuid4()), "url": "https://example.com/c", "description": "Link C"}
    r = client.post("/tasks", headers=H, json={
        "title": "Task with 3 links",
        "label_ids": [],
        "links": [link_a, link_b, link_c],
    })
    assert_eq("POST /tasks with 3 links → 201", r.status_code, 201)
    links_task = r.json()
    links_task_id = links_task["id"]
    assert_eq("task has 3 links", len(links_task["links"]), 3)
    returned_link_ids = {l["id"] for l in links_task["links"]}
    assert_eq("returned link ids match submitted ids",
              returned_link_ids, {link_a["id"], link_b["id"], link_c["id"]})
    returned_urls = {l["url"] for l in links_task["links"]}
    assert_eq("returned link urls match submitted urls",
              returned_urls, {link_a["url"], link_b["url"], link_c["url"]})

    # GET /tasks/:id round-trips links
    r = client.get(f"/tasks/{links_task_id}", headers=H)
    assert_eq("GET /tasks/:id with links → 200", r.status_code, 200)
    assert_eq("GET /tasks/:id links count round-trips", len(r.json()["links"]), 3)

    # GET /tasks list includes the links field on each task
    r = client.get("/tasks", headers=H, params={"state": "pending"})
    links_task_in_list = next((t for t in r.json()["tasks"] if t["id"] == links_task_id), None)
    assert_true("links task found in GET /tasks list", links_task_in_list is not None)
    if links_task_in_list:
        assert_in("task in GET /tasks list has links field", "links", links_task_in_list)
        assert_eq("task in GET /tasks list has 3 links", len(links_task_in_list["links"]), 3)

    # POST /tasks — a 4th link exceeds MAX_TASK_LINKS (3) → 422
    link_d = {"id": str(uuid.uuid4()), "url": "https://example.com/d", "description": "Link D"}
    r = client.post("/tasks", headers=H, json={
        "title": "Task with 4 links (should fail)",
        "label_ids": [],
        "links": [link_a, link_b, link_c, link_d],
    })
    assert_eq("POST /tasks with 4 links → 422 (max 3)", r.status_code, 422)

    # POST /tasks — non-http(s) URL schemes are rejected
    for bad_scheme_url in [
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "mailto:test@example.com",
        "ftp://example.com/file",
    ]:
        r = client.post("/tasks", headers=H, json={
            "title": "Task with bad link scheme",
            "label_ids": [],
            "links": [{"id": str(uuid.uuid4()), "url": bad_scheme_url, "description": "Bad link"}],
        })
        assert_eq(f"POST /tasks with url scheme '{bad_scheme_url.split(':')[0]}:' → 422", r.status_code, 422)

    # POST /tasks — schemeless URL rejected
    r = client.post("/tasks", headers=H, json={
        "title": "Task with schemeless link",
        "label_ids": [],
        "links": [{"id": str(uuid.uuid4()), "url": "example.com", "description": "No scheme"}],
    })
    assert_eq("POST /tasks with schemeless url → 422", r.status_code, 422)

    # POST /tasks — empty/whitespace-only description rejected
    r = client.post("/tasks", headers=H, json={
        "title": "Task with empty link description",
        "label_ids": [],
        "links": [{"id": str(uuid.uuid4()), "url": "https://example.com", "description": "   "}],
    })
    assert_eq("POST /tasks with whitespace-only link description → 422", r.status_code, 422)

    # POST /tasks — missing id rejected
    r = client.post("/tasks", headers=H, json={
        "title": "Task with link missing id",
        "label_ids": [],
        "links": [{"url": "https://example.com", "description": "No id"}],
    })
    assert_eq("POST /tasks with link missing id → 422", r.status_code, 422)

    # POST /tasks — oversized description rejected (max 200 chars)
    r = client.post("/tasks", headers=H, json={
        "title": "Task with oversized link description",
        "label_ids": [],
        "links": [{"id": str(uuid.uuid4()), "url": "https://example.com", "description": "x" * 201}],
    })
    assert_eq("POST /tasks with oversized link description → 422", r.status_code, 422)

    # POST /tasks — oversized url rejected (max 2048 chars)
    r = client.post("/tasks", headers=H, json={
        "title": "Task with oversized link url",
        "label_ids": [],
        "links": [{"id": str(uuid.uuid4()), "url": "https://example.com/" + "x" * 2048, "description": "Big"}],
    })
    assert_eq("POST /tasks with oversized link url → 422", r.status_code, 422)

    # PUT /tasks/:id — full-replace semantics: providing links replaces the whole array
    new_link = {"id": str(uuid.uuid4()), "url": "https://example.com/replaced", "description": "Replaced link"}
    r = client.put(f"/tasks/{links_task_id}", headers=H, json={"links": [new_link]})
    assert_eq("PUT /tasks/:id replace links → 200", r.status_code, 200)
    replaced_result = r.json()
    assert_eq("links replaced to 1 item", len(replaced_result["links"]), 1)
    assert_eq("replaced link id matches", replaced_result["links"][0]["id"], new_link["id"])

    # PUT /tasks/:id — omitting links entirely preserves existing links (does not clear them)
    r = client.put(f"/tasks/{links_task_id}", headers=H, json={"title": "Task with 3 links (renamed)"})
    assert_eq("PUT /tasks/:id omitting links → 200", r.status_code, 200)
    omit_links_result = r.json()
    assert_eq("links preserved when omitted from PUT body", len(omit_links_result["links"]), 1)
    assert_eq("preserved link id matches previous replace",
              omit_links_result["links"][0]["id"], new_link["id"])

    # PUT /tasks/:id — explicit empty list clears all links
    r = client.put(f"/tasks/{links_task_id}", headers=H, json={"links": []})
    assert_eq("PUT /tasks/:id links=[] → 200", r.status_code, 200)
    assert_eq("links cleared to empty list", r.json()["links"], [])

    # PUT /tasks/:id — a 4th link exceeds MAX_TASK_LINKS (3) → 422
    r = client.put(f"/tasks/{links_task_id}", headers=H, json={
        "links": [link_a, link_b, link_c, link_d],
    })
    assert_eq("PUT /tasks/:id with 4 links → 422 (max 3)", r.status_code, 422)

    # PUT /tasks/:id — bad url scheme rejected
    r = client.put(f"/tasks/{links_task_id}", headers=H, json={
        "links": [{"id": str(uuid.uuid4()), "url": "javascript:alert(1)", "description": "Bad"}],
    })
    assert_eq("PUT /tasks/:id with bad url scheme → 422", r.status_code, 422)

    # Clean up
    client.delete(f"/tasks/{links_task_id}", headers=H)

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

    # ── Tasks: notes field semantics (PR #45 regression guard) ────────────────
    # PR #45 fixed a web frontend bug: TaskForm.tsx only included `notes` in the
    # PUT body when non-empty (`if (notes.trim()) data.notes = ...`), so clearing
    # the Notes textarea to empty silently failed to persist (the key was omitted
    # entirely, and the backend's "field absent → unchanged" contract kept the old
    # value). The fix was client-side only; these tests lock in the backend
    # contract the fix depends on so a future backend change can't reintroduce
    # this bug class silently. Unlike must_do_by/target_date, `notes` has no
    # dedicated clear_notes flag — TaskUpdate.notes is a plain Optional[str], so
    # explicit null and omission are indistinguishable at the schema level (both
    # decode to None) and BOTH leave the existing value unchanged; only a
    # non-None value (including "") writes through.
    print("\n── Tasks: Notes field semantics (PR #45 regression guard) ──")
    r = client.post("/tasks", headers=H, json={
        "title": "Notes semantics test task",
        "notes": "Initial notes",
        "label_ids": [],
    })
    assert_eq("POST notes-test task → 201", r.status_code, 201)
    notes_task = r.json()
    notes_task_id = notes_task["id"]
    assert_eq("notes round-trip on create", notes_task["notes"], "Initial notes")

    # Omitting notes from PUT body leaves the existing value unchanged.
    r = client.put(f"/tasks/{notes_task_id}", headers=H, json={"title": "Notes semantics test task (renamed)"})
    assert_eq("PUT omitting notes → 200", r.status_code, 200)
    assert_eq("notes unchanged when omitted from PUT body", r.json()["notes"], "Initial notes")

    # Explicit null for notes is indistinguishable from omission (no clear_notes
    # flag exists) — the value must be left unchanged, not cleared.
    r = client.put(f"/tasks/{notes_task_id}", headers=H, json={"notes": None})
    assert_eq("PUT notes=null → 200", r.status_code, 200)
    assert_eq("notes unchanged when explicitly sent null (no clear_notes flag)",
              r.json()["notes"], "Initial notes")

    # Explicit empty string clears notes — this is the fix PR #45 relies on:
    # the frontend must send "" (not omit the key, not send null) to clear.
    r = client.put(f"/tasks/{notes_task_id}", headers=H, json={"notes": ""})
    assert_eq("PUT notes='' → 200", r.status_code, 200)
    assert_eq("notes cleared to empty string via explicit ''", r.json()["notes"], "")

    # Re-set notes to a non-empty value, then verify a normal non-empty update works.
    r = client.put(f"/tasks/{notes_task_id}", headers=H, json={"notes": "Updated notes"})
    assert_eq("PUT notes='Updated notes' → 200", r.status_code, 200)
    assert_eq("notes updated to new non-empty value", r.json()["notes"], "Updated notes")

    client.delete(f"/tasks/{notes_task_id}", headers=H)

    # ── Tasks: notes preserves Markdown syntax verbatim (PR #59 regression guard) ──
    # PR #59 added a client-side-only Markdown preview (web: react-markdown; mobile:
    # @believer/react-native-markdown-display) rendered from the task's `notes`
    # field. The feature depends entirely on the backend treating `notes` as
    # opaque plain text — no server-side stripping/escaping/sanitizing of
    # Markdown syntax characters (headings, emphasis, links, checklists, raw
    # angle brackets, etc.). These tests lock in that invariant so a future
    # backend change (e.g. an HTML-escaping/sanitizing pass) can't silently
    # break Markdown rendering on every client. No data model or API change
    # accompanies PR #59 — this is purely a regression guard for the existing
    # `notes` contract the new feature now leans on.
    print("\n── Tasks: Notes preserves Markdown syntax verbatim (PR #59 regression guard) ──")
    markdown_notes = (
        "# Heading\n\n**bold** _italic_ ~~strikethrough~~\n\n"
        "- [ ] unchecked task\n- [x] checked task\n\n"
        "[a link](https://example.com/path?x=1&y=2) and <script>window.x=1</script>\n"
        "`inline code` and a * bullet"
    )
    r = client.post("/tasks", headers=H, json={
        "title": "Markdown notes test task",
        "notes": markdown_notes,
        "label_ids": [],
    })
    assert_eq("POST task with Markdown-syntax notes → 201", r.status_code, 201)
    md_task = r.json()
    md_task_id = md_task["id"]
    assert_eq("Markdown notes round-trip verbatim on create", md_task["notes"], markdown_notes)

    # GET must also return the exact same string, not a sanitized/escaped variant.
    r = client.get(f"/tasks/{md_task_id}", headers=H)
    assert_eq("GET task with Markdown notes → 200", r.status_code, 200)
    assert_eq("Markdown notes unchanged on GET", r.json()["notes"], markdown_notes)

    # PUT with different Markdown content also round-trips verbatim.
    updated_markdown_notes = "## Updated\n\n1. one\n2. two\n\n> a quoted line"
    r = client.put(f"/tasks/{md_task_id}", headers=H, json={"notes": updated_markdown_notes})
    assert_eq("PUT task with new Markdown-syntax notes → 200", r.status_code, 200)
    assert_eq("Markdown notes round-trip verbatim on update", r.json()["notes"], updated_markdown_notes)

    client.delete(f"/tasks/{md_task_id}", headers=H)

    ctx.task_id = task_id
