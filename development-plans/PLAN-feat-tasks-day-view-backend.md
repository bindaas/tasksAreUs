# PLAN: feat-tasks-day-view-backend — Today/Tomorrow view API + Focused View default change

## Overview

This is PR 1 of a 3-PR epic (backend → web → mobile) that overhauls the Tasks list into four views: **Focused, Today, Tomorrow, All**. This backend PR adds the data API the new Today/Tomorrow views need, changes the Focused View's default date range, and provides a one-off script to update the single existing user's saved config. It contains no breaking changes — purely additive/default-value changes.

Companion plans: `PLAN-feat-tasks-view-redesign-web.md`, `PLAN-feat-tasks-view-redesign-mobile.md` (both depend on this PR being merged and deployed first, since they call the new endpoint).

## Requirements (from user Q&A this session)

1. New **Today** and **Tomorrow** views show **all pending tasks** (any priority, not just high-priority) whose `must_do_by` **or** `target_date` falls on that single day, across **all boards** — no per-user configurability, ever ("not editable from Settings"). **Corrected per Sneezy issue #3**: this is the same OR-across-both-fields semantic Focused View already ships (`must_do_by.in_(window) OR target_date.in_(window)`), not a computed "earliest effective date." A task with `target_date` yesterday and `must_do_by` today will appear in "Today" even though it's arguably overdue — this matches existing, documented Focused View behavior exactly, so Today/Tomorrow don't introduce a new, riskier date rule. Reusing the proven filter was chosen over building new "true effective date" logic for this PR.
2. Focused View's default `day_range` changes from `today_tomorrow` → `today` for **new** configs only (`get_or_create_config`). Existing saved configs are left alone — this project has exactly one active user, so a one-off script (not an automatic migration) updates that user's config instead.
3. The Focused View config PATCH/PUT endpoint (`PUT /focused-view/config`) is **kept** even though no client will call it after the web/mobile PRs remove the Settings UI for it — per user decision, it remains available as a dormant API.
4. No DB schema changes. Reuses the existing `focused_view_configs` table and `boards`/`tasks` tables as-is.

## API Changes

### New: `GET /day-view/tasks`

- Query param: `reference_date: date` (required — web/mobile always compute and pass today's or tomorrow's date explicitly, same pattern as `GET /focused-view/tasks?reference_date=`).
- Auth: same `get_current_user` dependency as every other task-scoped endpoint.
- Behavior: pending tasks only, **any priority**, **all boards** (no board_selection concept), whose effective date equals `reference_date`. Grouped by board, board list ordered by `Board.name.asc()`, boards with zero matching tasks omitted from the response — same conventions as `get_focused_tasks`.
- Response model: reuse the existing `FocusedViewTasksOut` / board-shape schema as-is (`{"boards": [{"board_id", "board_name", "board_color", "tasks"}]}`) — the shape is identical, no new schema needed. Import and reuse `FocusedViewTasksOut` from `schemas.py`.

No config endpoint for day-view — intentionally stateless/unconfigurable per requirement 1.

### Unchanged endpoints

- `GET /focused-view/config`, `PUT /focused-view/config`, `GET /focused-view/tasks` — all unchanged in behavior and contract. Only the *default value* used when a config row doesn't exist yet changes (see Data below).

## Implementation Approach

`app/services/focused_view_service.py` currently hardcodes `Task.is_high_priority == True` and board-selection logic inline inside `get_focused_tasks()`. To avoid duplicating that query for day-view, extract a private helper and have both call it.

**Corrected per Sneezy issues #1/#2**: the helper takes already-resolved `List[Board]` objects, not `List[str]` ids — this preserves the existing 2-query shape (`Board` query, then `Task` query) that `tests/unit/test_focused_view_service.py` already hard-codes via `db.query.side_effect = [board_mock, task_mock]`. No third query is introduced, and existing tests for `get_focused_tasks` do not need to change:

```python
def _query_board_grouped_tasks(db, user_id, boards: List[Board], window, high_priority_only) -> List[dict]:
    # the existing query body of get_focused_tasks() (Task query + grouping/output-shaping
    # only — board resolution/ordering has already happened by the time this is called),
    # parameterized on high_priority_only (adds/omits the Task.is_high_priority == True filter)
    ...

def get_focused_tasks(db, user_id, config, reference_date):
    boards = <resolve boards from config.board_selection, as today — 1st query, unchanged>
    window = date_window(config.day_range, reference_date)
    return _query_board_grouped_tasks(db, user_id, boards, window, high_priority_only=True)

def get_day_view_tasks(db, user_id, reference_date) -> List[dict]:
    boards = db.query(Board).filter(Board.user_id == user_id, Board.is_deleted == False).order_by(Board.name.asc()).all()  # 1st query
    return _query_board_grouped_tasks(db, user_id, boards, [reference_date], high_priority_only=False)  # 2nd query, inside the helper
```

Both `get_focused_tasks` and `get_day_view_tasks` remain exactly 2 `db.query()` calls each (boards, then tasks) — same shape as today, so existing test mocks keep working unmodified. Board ordering (`Board.name.asc()`) is guaranteed by whichever caller resolves `boards` before calling the helper, not by the helper itself — stated explicitly per Sneezy's suggestion.

New router `app/routers/day_view.py`, prefix `/day-view`, mirroring the structure of `app/routers/focused_view.py`. Registered in `app/main.py` alongside the other routers.

**Default value change**: in `get_or_create_config()`, change the literal `day_range="today_tomorrow"` to `day_range="today"` on the newly-created `FocusedViewConfig(...)`. `board_selection="all"` is already the default — no change needed there.

## One-off script: `backend/scripts/reset_focused_view_config_default.py`

Follows the existing `backend/scripts/purge_test_data.py` convention (plain `psycopg2`, reads `DATABASE_URL` env var, prints affected rows, prompts `[y/N]` before writing — this is a direct DB write, not something to run unattended). **Per Sneezy nit #4**: imports and reuses the same `KEEP_USER_ID = "1f991d09-3ecd-466e-8691-9072ac180609"` constant already defined in `purge_test_data.py` (with a comment noting it's the same active user), instead of hardcoding a second, independently-drifting copy of the UUID.

```
UPDATE focused_view_configs
SET day_range = 'today', board_selection = 'all', selected_board_ids = '[]'
WHERE user_id = KEEP_USER_ID;
```

Script prints the row(s) that will change (old values) before prompting for confirmation. Run manually, once, against Railway Postgres after this PR deploys — not part of `main.py`'s startup migration block, since it's a one-time data fix for a specific known user, not a schema migration every deploy should re-apply.

## Files to Modify

**Backend**
- `app/services/focused_view_service.py` — extract `_query_board_grouped_tasks()`; add `get_day_view_tasks()`; change default `day_range` in `get_or_create_config()`
- New: `app/routers/day_view.py` — `GET /day-view/tasks?reference_date=`
- `app/main.py` — register `day_view` router
- New: `backend/scripts/reset_focused_view_config_default.py`
- `tests/unit/test_focused_view_service.py` (or new `test_day_view_service.py`) — `get_day_view_tasks()`: returns tasks of any priority for the given date across all boards, excludes other dates, excludes done/deleted tasks, groups correctly, omits empty boards; `get_or_create_config()` now defaults to `day_range="today"` for a fresh config
- New: thin router-level test for `GET /day-view/tasks` (mocked service), matching the task-links precedent of catching router-wiring gaps directly rather than relying only on service-level tests
- `backend/tests/test_api.py` — **not touched by Grumpy**; Sleepy adds integration coverage during test-review

## Test Plan

- Unit tests as listed above (mocked SQLAlchemy sessions, no DB required, per project convention)
- Manual verification: `GET /day-view/tasks?reference_date=<today>` returns both high- and normal-priority pending tasks due today across all boards; a task due tomorrow does not appear; a done or deleted task does not appear; a fresh user's `GET /focused-view/config` now returns `day_range: "today"`
- Run `reset_focused_view_config_default.py` against local Postgres in dry-run-by-eye (review printed rows) before ever running against Railway

## Deployment Order

1. Single component (backend only) — no frontend/mobile coupling in this PR itself. Deploys as part of the combined backend+web Railway image (per `Dockerfile`, backend and web frontend build into one image/one service), triggered because it touches `backend/app/`.
2. After this deploys to Railway, run `reset_focused_view_config_default.py` once against the Railway `DATABASE_URL` to fix the existing user's config.
3. The web and mobile PRs (separate plans) depend on this endpoint existing in production before their Today/Tomorrow views will function — they must not be deployed/released ahead of this one.

## PR Structure

Single PR, backend only. Commit message does **not** get `[skip deploy]` (touches `backend/app/`).

---

## Additional Scope (added after first Sneezy pass, per user follow-up): Move Task Between Boards

New requirement from the user: since new tasks created outside the All view now silently default to the user's default board (see the web/mobile plans' "New task board" decision), the user also wants **an explicit board picker on the Create Task and Edit Task forms** on both platforms — including the ability to move an *existing* task to a different board via Edit. This was previously out of scope ("Tasks cannot be moved between boards — future work" per `PLAN-feat-multi-board.md`); it is now in scope for this epic.

### Data model / integrity decision

Labels are board-scoped (`Label.board_id`, enforced by `_resolve_labels()` in `task_service.py`). Moving a task to a different board makes its existing labels invalid for the new board (a label from board A has no meaning on a task now in board B). **Decision: moving a task's board unconditionally clears its labels**, regardless of whether the caller also sends a new `label_ids` list in the same request. This is enforced server-side in `update_task()`, not left to client discipline, so web, mobile, and sync all get it for free and can't drift.

### API Changes (addition)

- `TaskUpdate` gains `board_id: Optional[str] = None` — plain optional field, `None` = unchanged (same convention as `title`/`notes`, **not** the full-replace convention `links` uses).
- `PUT /tasks/{task_id}` router passes `board_id=body.board_id` through to `svc.update_task(...)`.
- `update_task()` service gains a `board_id: Optional[str] = None` param:
  ```python
  if board_id is not None and board_id != task.board_id:
      board_svc.get_board_or_404(db, board_id, task.user_id)  # 404s if not owned / deleted
      task.board_id = board_id
      db.query(TaskLabel).filter(TaskLabel.task_id == task.id).delete()
  if label_ids is not None:
      db.query(TaskLabel).filter(TaskLabel.task_id == task.id).delete()  # idempotent if already cleared above
      labels = _resolve_labels(db, label_ids, task.user_id, task.board_id)  # uses the NEW board_id
      ...
  ```
  Placed before the existing `label_ids is not None` block so `_resolve_labels` always resolves against the current (possibly just-changed) `task.board_id`.
- `TaskCreate.board_id` is unchanged (already exists, already resolved via `board_svc.resolve_board_id`) — the web/mobile create-form dropdown just makes the existing field visible/editable in the UI instead of implicitly defaulting.

### sync.py wiring (verified against the actual "client wins" update branch, `routers/sync.py:103-125`)

- Add `if t_data.get("board_id"): server_task.board_id = t_data["board_id"]` inside the "client wins" branch, **before** `label_updates[task_id] = t_data.get("label_ids", [])` is set (line 125). No extra handling needed beyond that: unlike the REST API, sync's `label_updates` loop (`routers/sync.py:130-140`) already unconditionally rewrites every synced task's labels on every client-wins update (`t_data.get("label_ids", [])`, defaulting to `[]` if omitted) and already filters by `Label.board_id == task_obj.board_id` read *after* the board_id write — so once `board_id` is updated first, the existing label-revalidation logic automatically drops labels invalid for the new board. This is a smaller sync change than the `links` field needed in the task-links PR precedent, specifically because sync's existing label-replace behavior happens to already be board-id-aware.
- No change needed to the new-task branch (`routers/sync.py:77-101`) — it already resolves `board_id` from `t_data.get("board_id")` for brand-new tasks.
- No change needed to the pull-response construction (`routers/sync.py:194`) — `"board_id": t.board_id` is already included in the outbound dict.

### Files to Modify (addition)

- `app/schemas.py` — `TaskUpdate.board_id: Optional[str] = None`
- `app/routers/tasks.py` — `update_task()` passes `board_id=body.board_id`
- `app/services/task_service.py` — `update_task()` gains `board_id` param + label-clear-on-move logic (above). **Per Sneezy second-pass nit #2**: also add `from ..services import board_service as board_svc` to this file's imports (matching the exact relative-import form `routers/tasks.py` already uses) — `task_service.py` doesn't currently import `board_service`, and `get_board_or_404` needs it. No circular-import risk (`board_service.py` only imports `.models`/`.label_service`).
- `app/routers/sync.py` — one-line addition in the "client wins" branch (above)
- `tests/unit/test_task_service.py` — new tests: moving `board_id` clears existing labels even when `label_ids` is not sent; moving to a board owned by another user (or a deleted board) 404s; moving `board_id` while also sending new `label_ids` resolves labels against the new board, not the old one; `board_id` unchanged when omitted
- **`tests/unit/test_tasks_router.py`** (added per Sneezy second-pass gap #1) — this file already exists and already has a `TestUpdateTaskLinksWiring` class (mocked `app.routers.tasks.svc`, asserting `kwargs["links"]` reaches `mock_svc.update_task.call_args` when the router function is called directly) for exactly this bug class — a field that validates via Pydantic but silently never reaches the service. Add an equivalent `TestUpdateTaskBoardIdWiring` asserting `body.board_id` reaches `svc.update_task(...)`.
- New sync test (in whichever file already covers `routers/sync.py` — check for an existing `test_sync.py`/router test file, or add one) — pushing a `board_id` change for an existing task moves it and clears labels not valid for the new board, mirroring the task-links PR's precedent of a dedicated push/pull round-trip test

---

## Sneezy's Review — 2026-07-02

**Verdict:** Changes required

### Issues

1. **[Risk]** `app/services/focused_view_service.py:103-155` (`get_focused_tasks`) — the proposed extraction of `_query_board_grouped_tasks(db, user_id, board_ids, window, high_priority_only)` is under-specified in a way that risks breaking the existing 16-test suite in `tests/unit/test_focused_view_service.py`. Several tests hard-code the assumption that `get_focused_tasks` makes exactly **two** sequential `db.query()` calls, e.g. `db.query.side_effect = [board_mock, task_mock]` (confirmed at ~line 218 and repeated ~lines 300-303 of that test file). The pseudocode signature takes `board_ids: List[str]`, which means the helper cannot reproduce `board_name`/`board_color`/alphabetical ordering for the output without re-querying `Board` by those ids — a **third** `db.query()` call. That desynchronizes the existing `side_effect` lists and will silently hand the wrong mock to the wrong `.filter()/.order_by()/.all()` chain, breaking tests that appear to have nothing to do with day-view. The plan's test bullet only mentions *adding* tests for `get_day_view_tasks`/the new config default — it doesn't flag that the refactor itself will likely force rewrites of the existing `get_focused_tasks` mocking scaffolding.
2. **[Gap]** Related to #1: the helper's exact query behavior is unstated. Either (a) it re-queries `Board` internally (extra query, needs the test rewrite above), or (b) callers must pass boards pre-ordered/pre-resolved and the helper trusts that ordering (fragile — nothing enforces callers order `board_ids` alphabetically). The plan should pick one and say so explicitly. Consider having the helper accept the already-resolved `List[Board]` objects instead of `List[str]` ids — this avoids the double query and keeps the current 2-query shape the existing tests assume.
3. **[Risk]** Requirement 1 states Today/Tomorrow show tasks "whose effective date (`must_do_by` or `target_date`, earlier of the two) falls on that single day" — but the Implementation Approach commits to reusing `get_focused_tasks`'s existing filter, `or_(Task.must_do_by.in_(window), Task.target_date.in_(window))` (`focused_view_service.py:133-136`), for the shared helper. That's an **OR across both fields**, not a "minimum of the two" computation. Example: a task with `target_date` = yesterday (past) and `must_do_by` = today — the true effective date is yesterday (overdue), but the OR-query matches on `must_do_by == today` and the task would appear in "Today" anyway, contradicting the plan's own requirement wording. This exact OR semantic is already the *documented, shipped* behavior of Focused View (`DATA_MODEL_AND_API.MD`: "tasks that have `must_do_by` or `target_date` falling within..."), so reusing it isn't unprecedented — but the plan's Requirement 1 promises "effective date" semantics the implementation doesn't deliver. This needs an explicit product decision before implementation, since it's directly consumed by both downstream PRs' Today/Tomorrow views.
4. **[Nit]** `backend/scripts/reset_focused_view_config_default.py` doesn't reference the existing `KEEP_USER_ID` constant already used in `backend/scripts/purge_test_data.py:10` (`"1f991d09-3ecd-466e-8691-9072ac180609"`), which appears to be the same "one active user" this plan refers to. Reusing that constant (or explicitly confirming it's the same user) avoids a second hardcoded UUID silently drifting from the first over time.

### Unverified assumptions

- "This project has exactly one active user" — plausible and consistent with `purge_test_data.py`'s single-`KEEP_USER_ID` design, but not verifiable from a static code read alone (no DB access in this review).
- "[skip deploy]... not applicable here since this touches `backend/app/`" — the *convention* is documented in `CLAUDE.md` and is consistent with the combined-image `Dockerfile`/`railway.toml` (verified: frontend is built into `backend/static/` and served by the same FastAPI service, so there is genuinely one deployable unit). However, no GitHub Actions workflow or `railway.toml` `watchPaths` config exists in the repo that actually implements path-based deploy skipping — the enforcement mechanism (if any) lives outside the repo (e.g. Railway dashboard config) and could not be verified.
- The claim that `FocusedViewTasksOut`/`FocusedViewBoardGroup` shapes are identical and reusable for day-view — confirmed accurate against `app/schemas.py:281-289`.
- "No DB schema changes... reuses the existing `focused_view_configs` table and `boards`/`tasks` tables as-is" — confirmed correct; `must_do_by`, `target_date`, `is_high_priority`, `board_id`, `state`, `is_deleted` on `Task` are all that's needed to express reference-date + all-boards + any-priority filtering. No new column or table required.

### Suggestions

- Resolve the "OR of two date fields" vs. "true effective/earliest date" ambiguity in Requirement 1 explicitly before implementation, and state the chosen semantics in the plan text so Dopey/Sleepy can verify the shipped behavior against it later.
- State explicitly whether the day-view boards query needs `order_by(Board.name.asc())` up front, or whether that's solely the extracted helper's responsibility — the current pseudocode is ambiguous about where ordering is guaranteed.
- Consider adding a one-line note in the plan cross-referencing that the web and mobile PRs' Today/Tomorrow views will inherit whatever date-filtering semantics land here — worth flagging so those PRs' manual test plans know what to actually verify.

— *Sneezy*

---

## Grumpy's Response to Sneezy's Review

| Sneezy item | Status |
|---|---|
| Issue 1 (helper breaks 2-query test scaffolding) | Addressed — helper now takes `List[Board]`, preserving the exact 2-query shape; Implementation Approach section rewritten |
| Issue 2 (query behavior underspecified) | Addressed — same fix as #1; board ordering responsibility stated explicitly (caller's, via `Board.name.asc()`) |
| Issue 3 (OR-vs-effective-date semantics) | Addressed — Requirement 1 reworded to accurately describe the OR-across-both-fields behavior being reused, rather than promising a "true effective date" computation this PR doesn't build |
| Nit 4 (hardcoded UUID drift) | Addressed — script now imports/reuses `purge_test_data.py`'s `KEEP_USER_ID` constant |

Also folded in this session: a new **Move Task Between Boards** capability (see "Additional Scope" section above), requested by the user after the first Sneezy pass, in response to Sneezy's web/mobile-plan finding that removing the board switcher left no way to choose a board outside the All view.

Implementation proceeds on this updated plan.

---

## Sneezy's Second Review — Move Task Between Boards — 2026-07-02

**Verdict:** Approved with concerns

### Issues

1. **[Gap]** No router-level "wiring" test is proposed for `board_id` threading through `PUT /tasks/{task_id}` → `svc.update_task()`. This is exactly the bug class `tests/unit/test_tasks_router.py` was created to catch — confirmed that file exists today and already has `TestUpdateTaskLinksWiring` (asserts `kwargs["links"]` reaches `mock_svc.update_task.call_args` when `TaskUpdate(links=...)` is passed to the router function directly, mocking `app.routers.tasks.svc`). The plan's own day-view section explicitly invokes this precedent ("matching the task-links precedent of catching router-wiring gaps directly rather than relying only on service-level tests") for the new day-view router, but the "Move Task Between Boards" section's Files to Modify list only touches `tests/unit/test_task_service.py` (service-level) and a new sync test — it never proposes an equivalent `TestUpdateTaskWiring`-style test asserting `body.board_id` actually reaches `svc.update_task(...)`. Without it, a bug where `board_id` validates via Pydantic but is silently dropped before reaching the service (the exact "validates but never persists" class this pattern exists to catch) would go undetected by unit tests.
2. **[Nit]** The pseudocode's `board_svc.get_board_or_404(db, board_id, task.user_id)` call requires `app/services/task_service.py` to import `board_service` (e.g. `from . import board_service as board_svc`), which it does not currently do (confirmed: `task_service.py`'s only intra-package import is `from ..models import ...`). No circular-import risk — `board_service.py` imports only from `.models` and `.label_service`, not from `task_service.py` — so this is safe, but the Files to Modify bullet for `app/services/task_service.py` doesn't mention the new import, which is easy to forget when implementing from the plan alone.

### Unverified assumptions

- **Confirmed accurate**: the sync.py wiring claim's line numbers and logic. `routers/sync.py:125` is exactly `label_updates[task_id] = t_data.get("label_ids", [])` inside the "client wins" branch; the label_updates loop is at lines 130-140 and does re-query `Task` via `db.query(Task).filter(Task.id == task_id).first()` (line 133) — since this happens *after* `db.flush()` at line 127, a `server_task.board_id = t_data["board_id"]` write added before line 125 would be visible to that re-query, exactly as the plan claims. The new-task branch (lines 77-101) already resolves `board_id` via `t_data.get("board_id") or board_svc.get_default_board_id(...)` (line 78). The pull-response dict at line 194 already includes `"board_id": t.board_id`. No part of this claim required correction.
- **Confirmed accurate**: `board_svc.get_board_or_404(db, board_id, user_id)` exists in `app/services/board_service.py:93-101` with exactly the signature and 404-on-not-owned/deleted behavior the plan assumes.
- **Confirmed accurate (first-pass fixes hold)**: the current, un-refactored `app/services/focused_view_service.py:103-155` (`get_focused_tasks`) still matches the "before" state the plan describes (this PR has not yet been implemented) and `tests/unit/test_focused_view_service.py:206-219` still hard-codes the exact `db.query.side_effect = [board_mock, task_mock]` two-call scaffolding Sneezy's first pass flagged. The revised `_query_board_grouped_tasks(db, user_id, boards: List[Board], ...)` design (taking already-resolved `Board` objects rather than ids) is consistent with preserving that 2-query shape for both `get_focused_tasks` and the new `get_day_view_tasks`.
- **Confirmed accurate**: `KEEP_USER_ID = "1f991d09-3ecd-466e-8691-9072ac180609"` is indeed defined in `backend/scripts/purge_test_data.py:10`, so the plan's reuse-not-duplicate fix for the reset script is implementable exactly as described.

### Suggestions

- Add a `TestUpdateTaskBoardIdWiring`-style test to `tests/unit/test_tasks_router.py` alongside the new `test_task_service.py` tests, mirroring `TestUpdateTaskLinksWiring` — cheap, and closes the one real gap in an otherwise solid, already-well-verified design.
- Explicitly add `from . import board_service as board_svc` (or the project's actual relative-import convention — check how `routers/tasks.py` imports it: `from ..services import board_service as board_svc`) to the `app/services/task_service.py` Files to Modify bullet so the import isn't an implementation-time surprise.

— *Sneezy*

---

## Grumpy's Response to Second Review

Both items addressed inline: `tests/unit/test_tasks_router.py` gains `TestUpdateTaskBoardIdWiring` (mirroring `TestUpdateTaskLinksWiring`); `task_service.py`'s Files to Modify bullet now explicitly names the `from ..services import board_service as board_svc` import. Verdict was "Approved with concerns" — implementation proceeds on this updated plan.
