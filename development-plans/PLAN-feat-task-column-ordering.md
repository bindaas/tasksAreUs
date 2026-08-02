# Plan: Task Column Ordering

**Branch:** `feat-task-column-ordering` (single branch covering backend + web + mobile — see PR Structure note below)

## Scope

Add user-controlled drag-to-reorder of tasks within date-bucketed columns on the web All-view kanban board, and make that order visible everywhere the same tasks are rendered (web non-All views, mobile).

- **Orderable columns** (drag up/down to reorder): Today, Tomorrow, Day After Tomorrow, Monday, No Date. Reordering works within each priority zone (High Priority / Normal) independently — dragging across the zone border still changes `is_high_priority`, unchanged existing behavior.
- **Upcoming column**: not manually orderable. Always sorted by `target_date` ascending (literal field, not effective date — tasks with only `must_do_by` set sort to the bottom, after all dated tasks, since they have no `target_date`).
- **Overdue column**: unchanged — stays sorted `is_high_priority` desc, then effective-date asc (web) — no manual ordering, no data model involvement.
- Dropping a task into an orderable column/zone assigns it a `sort_order` based on where it was dropped (between its new neighbors).
- Whenever a task's effective date changes OR it moves to a different board, and the caller didn't explicitly supply a new `sort_order`, the task resets to the bottom of its new list (gets a fresh "now" value, which is always greater than existing values since it's real time).
- The saved `sort_order` is also honored by web's Today, Tomorrow, and Focused views (all non-All views that show orderable-column tasks) — but those views are read-only with respect to order; only All-view drag-and-drop can change it.
- **Mobile**: displays tasks in the `sort_order` set via web — no new drag-to-reorder UI/gesture work on mobile. Mobile's existing long-press drag (date-only) is unchanged and continues to work; per the reset rule above, a mobile date-drag will automatically bump the task to the bottom of its new bucket via the same backend rule, with zero mobile-side sort_order computation.

## Data Model Changes

**Table: `tasks`** — additive column, `ALTER TABLE`, backward compatible.

| Column | Type | Notes |
|---|---|---|
| `sort_order` | DOUBLE PRECISION | NOT NULL. No SQL-level `DEFAULT` clause (see below) — every ORM insert path (`task_service.create_task()`, `sync.py`'s direct `Task(...)` construction) gets a value automatically via a Python-side SQLAlchemy `Column(default=...)` callable, the same pattern already used for `id` (`_uuid()`) and timestamp columns (`_now()`). ORM column type is `sqlalchemy.dialects.postgresql.DOUBLE_PRECISION` explicitly (not generic `Float`) — corrected per Sneezy nit #7, so the fresh-DB `create_all()` DDL matches the raw-SQL `ALTER TABLE ... DOUBLE PRECISION` migration's type name exactly rather than relying on dialect-default compilation. |

**Default/reset value**: `_sort_order_default()` returns `datetime.now(timezone.utc).timestamp()` (epoch seconds, a `float`). This is also the value used whenever a task's `sort_order` is reset to "bottom of list" — since real time only moves forward, a freshly-generated default is guaranteed to sort after any previously-assigned value in the same list, without needing to query siblings first.

**Reordering (fractional indexing)**: when a task is dropped at a specific position within an orderable zone, the client computes a new `sort_order` as the midpoint between the two neighboring tasks' existing `sort_order` values (Trello-style fractional indexing) — no renumbering of other rows. Dropped at the top/bottom of a list uses `neighbor ± 1` instead of a midpoint. This is a client-side (web) computation; the server just persists whatever float it's given.

**Known, accepted limitation**: repeatedly inserting a task between the exact same two neighbors many times in a row halves the gap each time; IEEE-754 double precision (~52-bit mantissa) at epoch-seconds magnitude (~1.7×10⁹) supports roughly 45–50 such bisections before precision is exhausted. This is the standard tradeoff of client-computed float fractional indexing (used by Trello, Figma, etc.) and is not a realistic usage pattern here — flagged as accepted, not treated as a blocker.

**Migration** (idempotent, `main.py` lifespan block, alongside the existing `ALTER TABLE` statements):
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order DOUBLE PRECISION;
UPDATE tasks SET sort_order = EXTRACT(EPOCH FROM created_at) WHERE sort_order IS NULL;
ALTER TABLE tasks ALTER COLUMN sort_order SET NOT NULL;
```
Backfilling from `created_at` (rather than a single shared "now" constant) gives existing tasks a stable, distinct initial relative order (oldest-created first) instead of a mass tie, matching how the columns are populated today by other tiebreaks.

## API Changes

- `TaskOut` gains `sort_order: float`.
- `TaskUpdate` gains `sort_order: Optional[float] = None`. `None` (omitted) = "let the server decide" — either leave unchanged, or auto-reset to bottom per the rule below. A caller must pass an explicit float to place a task at a specific position.
- `TaskCreate` is **not** changed — task creation never specifies a drop position; the column default handles it.
- **`task_service.update_task()`** gains a `sort_order: Optional[float] = None` parameter and this logic, applied after all other field mutations (date/board/priority) in the function:
  - If `sort_order is not None` (caller supplied a value): set `task.sort_order = sort_order` directly — this is the drag-and-drop-to-a-position path, and it wins over the auto-reset rule below (a single drop can simultaneously change the date and land the task at a specific spot in the destination list).
  - Otherwise, if the task's effective date changed (`_effective_date` before vs. after the update) **or** its `board_id` changed: `task.sort_order = _sort_order_default()` (reset to bottom).
  - Otherwise: `sort_order` is left untouched.
  - Implementation note: `old_effective` and `board_changed` must be captured **at the very top of the function, before any mutation runs** — corrected per Sneezy nit #4; the board-move mutation is actually the *first* statement in `update_task()` today (`task_service.py:148-150`), not "partway through" as an earlier draft of this plan characterized it.
- **`routers/tasks.py`**: `update_task()` call site adds `sort_order=body.sort_order`.
- **`focused_view_service.py`**: `_query_board_grouped_tasks()` gains an `order_by_sort_order: bool` parameter.
  - `True`: `.order_by(Task.is_high_priority.desc(), Task.sort_order.asc())`.
  - `False` (unchanged): `.order_by(Task.is_high_priority.desc(), Task.updated_at.desc())`.
  - `get_focused_tasks()` calls with `order_by_sort_order=True`.
  - `get_day_view_tasks(..., overdue=False)` → `True` (Today/Tomorrow views).
  - `get_day_view_tasks(..., overdue=True)` → `False` (Overdue view, unchanged).
  - **Known, accepted characteristic**: when Focused view's `day_range` spans more than one day (`today_tomorrow`/`today_plus_two`), `_query_board_grouped_tasks` already returns one flat, date-unaware list per board (today's behavior interleaves by `updated_at` across days) — switching the tiebreak to `sort_order` preserves that same flat, cross-day interleaving; it does not introduce new mixing behavior.
- **`routers/sync.py`** (mirrors how `links` needed explicit handling — this router bypasses `task_service` and enumerates fields by hand in three places):
  1. **New-task push** (`Task(...)` construction): no change needed — `sort_order` isn't set explicitly, so the model's Python-side default fires automatically, same as it will for `id`/`created_at` today.
  2. **Existing-task push, client-wins branch**: must replicate `update_task()`'s reset-to-bottom rule, since this path never goes through `task_service`. Capture the task's effective date and `board_id` before mutation (verified safe per Sneezy — the "# Client wins" branch in `sync.py:127-147` performs no mutation before that point); after applying the incoming field changes, if either changed, set `server_task.sort_order = _sort_order_default()`. `sync.py` **imports and reuses `task_service._effective_date()`** for this comparison (decided per Sneezy gap #3, resolving the plan's earlier silence on import-vs-duplicate) — there's already precedent for a leading-underscore cross-module import in this codebase (`main.py` imports `_seed_board_labels` from `board_service`), and a single shared implementation avoids the two copies' date-tiebreak semantics (e.g. `must_do_by == target_date`) silently drifting apart. This matters concretely for **offline mobile drags**: mobile's existing long-press date-drag queues a `target_date` change locally when offline and pushes it later via `POST /sync` — without this, that queued change would land with a stale `sort_order` once synced, instead of going to the bottom of its new bucket like an online drag would.
  3. **Outgoing pull response** (`task_dicts` construction): add `"sort_order": t.sort_order` so mobile's local cache receives the current value (including whatever a web reorder most recently set) on every sync pull.
  - Sync never needs to accept an *explicit* client-supplied `sort_order` override — mobile has no reorder UI and never sends one — so no new validation function is needed here (unlike `links`, there's no untrusted-value shape to check; it's just a float, or absent).

## Sort Algorithm (web, client-side)

New file `frontend/src/utils/taskOrder.ts`:

```ts
export function computeInsertSortOrder(
  zoneTasks: Task[],       // the destination zone's tasks, already sorted ascending by sort_order
  draggedTaskId: string,   // excluded from neighbor lookup, in case it's already in this zone
  targetTaskId: string | null,  // the card being hovered over at drop time, or null (dropped on empty space)
  edge: 'above' | 'below' | null,
): number {
  const siblings = zoneTasks.filter((t) => t.id !== draggedTaskId);
  if (siblings.length === 0) return Date.now() / 1000;
  if (!targetTaskId || !edge) return siblings[siblings.length - 1].sort_order + 1; // append to end
  const idx = siblings.findIndex((t) => t.id === targetTaskId);
  if (idx === -1) return siblings[siblings.length - 1].sort_order + 1;
  const before = edge === 'above' ? siblings[idx - 1] ?? null : siblings[idx];
  const after = edge === 'above' ? siblings[idx] : siblings[idx + 1] ?? null;
  if (before && after) return (before.sort_order + after.sort_order) / 2;
  if (before) return before.sort_order + 1;
  if (after) return after.sort_order - 1;
  return Date.now() / 1000;
}
```

**Card-level drag-over tracking** (`TasksPage.tsx`): two new pieces of state alongside the existing `dragOverColumn`/`dragOverPriority` — `dragOverTaskId: string | null`, `dragOverEdge: 'above' | 'below' | null`. `TaskCard` gets a new optional prop `onCardDragOver?: (edge: 'above' | 'below') => void`, wired to the card's own `onDragOver` (only when `isDraggable && !isEditing`): compute `edge` from `e.clientY` vs. `e.currentTarget.getBoundingClientRect()` midpoint, call `e.preventDefault()`, then the callback. This continuously updates `dragOverTaskId`/`dragOverEdge` as the pointer moves over cards; the value is still current by the time the actual `onDrop` fires on the enclosing zone/column container (drop targets are unchanged — still the zone `<div>`s, not the cards).

`TaskCard` also gets a `dropIndicator?: 'above' | 'below' | null` prop for a 2px indigo border-top/border-bottom visual cue when it's the current drag-over target.

`handleDrop` gains the captured `dragOverTaskId`/`dragOverEdge` and, for orderable columns only (unchanged early-return still blocks `overdue`/`upcoming`), computes `sort_order` via `computeInsertSortOrder(zoneTasks, taskId, dragOverTaskId, dragOverEdge)` and includes it in the `updateTask()` call alongside the existing `target_date`/`is_high_priority` fields. **Corrected per Sneezy gap #2**: `zoneTasks` is *not* already available inside `handleDrop` — `highTasks`/`normalTasks` are local variables produced by `splitByPriority(colTasks)` inside the per-column JSX `.map()` render callback, a different closure `handleDrop` (a top-level function in the component) has no access to. `handleDrop` must derive it itself: `const { high, normal } = splitByPriority(columnTasks[columnKey]); const zoneTasks = priority === 'high' ? high : normal;` (`splitByPriority` is already imported from `taskPriority.ts`). Same-column, same-zone reordering (task dropped among its own siblings without changing date/priority) falls out of this naturally, since `handleDrop` already unconditionally writes `target_date` today even when it's unchanged.

**Gating note (Sneezy nit #5, accepted as-is, no code change)**: `onCardDragOver` fires whenever a card is `isDraggable && !isEditing`, which today includes Overdue/Upcoming cards (drag-*out*-able but not droppable-*into*). Hovering over one of those could render the `dropIndicator` visual cue even though `handleDrop`'s existing early-return for `overdue`/`upcoming` discards any resulting `sort_order` — cosmetic only, no data-correctness impact, not worth the extra column-key gating logic for a visual-only edge case.

**`columnTasks` sort comparator** (`TasksPage.tsx`) — branches by column instead of one shared comparator:
- `overdue`: **unchanged** — `is_high_priority` desc, then effective-date asc.
- `upcoming`: `target_date` asc (literal field; `null` sorts last).
- everything else (today/tomorrow/day_after_tomorrow/monday/nodate): `is_high_priority` desc, then `sort_order` asc.

## Files to Modify

**Backend**
- `app/models.py` — `_sort_order_default()` helper; `Task.sort_order` column (`Float`/`DOUBLE PRECISION`, `nullable=False`, `default=_sort_order_default`)
- `app/main.py` — idempotent `ALTER TABLE` + backfill + `SET NOT NULL`, in the lifespan block's "Legacy migrations" section
- `app/schemas.py` — `TaskOut.sort_order: float`; `TaskUpdate.sort_order: Optional[float] = None`
- `app/routers/tasks.py` — `sort_order=body.sort_order` added to the `svc.update_task(...)` call
- `app/services/task_service.py` — `update_task()` gains `sort_order` param + auto-reset logic (see API Changes)
- `app/services/focused_view_service.py` — `_query_board_grouped_tasks()` gains `order_by_sort_order`; `get_focused_tasks()` and `get_day_view_tasks(overdue=False)` pass `True`, `get_day_view_tasks(overdue=True)` passes `False`
- `app/routers/sync.py` — client-wins branch replicates the reset-to-bottom rule; `sort_order` added to the outgoing `task_dicts` construction
- `tests/unit/test_task_service.py` — explicit `sort_order` set; auto-reset on effective-date change; auto-reset on board move; no reset when neither changes and `sort_order` omitted; `create_task()` yields a non-null default
- `tests/unit/test_focused_view_service.py` — `_query_board_grouped_tasks` ordering under both `order_by_sort_order` values
- `tests/unit/test_tasks_router.py` — router-level test asserting `body.sort_order` reaches `task_service.update_task()` (mirrors the router-wiring-gap class of bug called out in the task-links plan)
- `tests/unit/test_sync_router.py` — sync push (client-wins) triggers the reset rule on a date change with no explicit `sort_order`; `sort_order` present in the pull-response `task_dicts`
- `backend/tests/test_api.py` — **not touched by Grumpy**; Sleepy adds integration coverage during test-review

**Frontend (web)**
- `src/api/tasks.ts` — `Task.sort_order: number`; `UpdateTaskBody.sort_order?: number`
- New: `src/utils/taskOrder.ts` — `computeInsertSortOrder()` (see Sort Algorithm)
- `src/pages/TasksPage.tsx` — `dragOverTaskId`/`dragOverEdge` state; per-column `columnTasks` comparator branching; `handleDrop` computes and sends `sort_order`
- `src/components/TaskCard.tsx` — `onCardDragOver` prop + handler; `dropIndicator` prop + visual styling
- New: `src/__tests__/taskOrder.test.ts` — `computeInsertSortOrder()`: empty zone, append-to-end, insert between two siblings, insert as first/last, dragged task excluded from its own neighbor lookup, self-hover (`targetTaskId === draggedTaskId` — added per Sneezy gap #6; falls through to the `idx === -1` "append to end" branch, an accepted non-destructive behavior that should be asserted explicitly rather than left incidental)
- `src/__tests__/taskPriority.test.ts`, `src/__tests__/taskFilters.test.ts`, `src/__tests__/tasks.api.test.ts` — added per Sneezy gap #1: each has a local `makeTask()`-style factory building full `Task` object literals with no `sort_order`, which will fail to type-check once the field is required; needs a `sort_order` default in each factory (same fix pattern as `board_id`'s addition in PR #33)

**Mobile**
- `src/types/index.ts` — `Task.sort_order: number` (read-only — mobile never writes it)
- `src/utils/taskGrouping.ts` — per-section comparator branching in `groupTasksForList()`, mirroring web minus the `monday` section (mobile's `ColumnKey` has none): today/tomorrow/day_after_tomorrow/nodate → `sort_order` asc; upcoming → `target_date` asc; overdue → **unchanged** (`updated_at` desc — mobile's own existing tiebreak, deliberately not unified with web's)
- `src/__tests__/taskGrouping.test.ts` — updated per-section sort assertions
- `src/__tests__/taskFilters.test.ts`, `src/__tests__/taskPriority.test.ts`, `src/__tests__/dayView.api.test.ts`, `src/__tests__/focusedView.api.test.ts` — added per Sneezy gap #1: same local `makeTask()`-factory-missing-`sort_order` issue as the web files above
- **No changes**: `src/screens/TasksScreen.tsx` (`DraggableTaskRow`, existing long-press drag gesture), `src/screens/FocusedView`/`DayView`-equivalents (render server order as-is), `src/api/tasks.ts` (never sends `sort_order`)

## Test Plan

- Backend unit tests (`tests/unit/`, see Files to Modify for the full list): `task_service` reset/no-reset/explicit-set logic; `focused_view_service` ordering toggle; router-level wiring for `sort_order`; sync push reset-on-date-change and pull-response inclusion
- Web unit tests (`src/__tests__/`): `computeInsertSortOrder()` edge cases
- Mobile unit tests (`src/__tests__/`): `groupTasksForList()` per-section comparator
- `test_api.py` integration coverage: added by Sleepy during test-review, not by Grumpy
- Manual verification (web): drag a task to reorder within Today's Normal zone, confirm order persists on refresh; drag across the High/Normal border, confirm both position and priority update; drag a task from Today into Tomorrow at a specific position, confirm it lands there (not appended); change a task's date via the edit form (not drag), confirm it drops to the bottom of its new column; move a task to a different board, confirm it drops to the bottom of its column on the new board; confirm Upcoming still shows tasks ordered by `target_date` with no drag affordance; confirm Overdue's order is visually unchanged from current production behavior
- Manual verification (cross-view): reorder tasks in All view, then check Today/Tomorrow/Focused views show the same order
- Manual verification (mobile): reorder tasks on web, confirm mobile's All-view list and Today/Tomorrow/Focused screens reflect the new order after a refresh/sync; drag a task's date on mobile (existing gesture), confirm it appears at the bottom of its new bucket both on mobile and back on web

## Deployment Order

1. **Backend + web** deploy as a **single unit** (single Docker image, single Railway service, per root `Dockerfile`/`railway.toml` — see `CLAUDE.md`). The change is additive (`sort_order` defaults automatically for every existing and new task) and backward compatible.
2. **Mobile** ships independently via EAS, any time after backend+web (mobile only reads `sort_order`, never writes it, and tolerates a stale local cache until its next sync).
3. Mobile update type: **OTA** (`eas update`) — TypeScript-only change (`types/index.ts`, `taskGrouping.ts`), no native modules/`app.json`/`eas.json` touched.

## PR Structure

**Single PR** for backend + web + mobile — backend and web are already one atomic deploy event regardless of PR boundaries, and mobile's slice here is small (2 source files + 1 test file, no new UI). This follows the same reasoning used in the task-links plan.

---

## Pre-Implementation Checklist

- Confidence in solution: 4/5
- Regression risk: 3/5 — touches the All-view's core sort/drag logic (used by every column), plus the shared `focused_view_service` query helper consumed by three view types; Overdue is explicitly carved out and left untouched to contain blast radius
- Data model changes: `tasks.sort_order DOUBLE PRECISION NOT NULL` (additive, backfilled from `created_at`)
- Test changes needed: see Test Plan above (backend unit ×4 files, web unit ×1 new file, mobile unit ×1 file); `test_api.py` deferred to Sleepy
- Deployment order: backend+web as one unit, then mobile independently (see Deployment Order)
- Mobile update type: OTA (`eas update`)

— *Grumpy*

---

## Grumpy's Response to Sneezy's Review

All 4 gaps and 3 nits are addressed inline in the sections above (Data Model Changes, API Changes, Sort Algorithm, Files to Modify). Summary:

| Sneezy item | Status |
|---|---|
| Gap 1 (7 test files with `sort_order`-missing `makeTask()` factories) | Addressed — all 7 added to Files to Modify (web: `taskPriority.test.ts`, `taskFilters.test.ts`, `tasks.api.test.ts`; mobile: `taskFilters.test.ts`, `taskPriority.test.ts`, `dayView.api.test.ts`, `focusedView.api.test.ts`) |
| Gap 2 (`zoneTasks` not actually in `handleDrop`'s scope) | Addressed — Sort Algorithm section corrected to derive it via `splitByPriority(columnTasks[columnKey])` inside `handleDrop` itself |
| Gap 3 (sync.py's effective-date comparison unspecified) | Addressed — decided: `sync.py` imports and reuses `task_service._effective_date()`, matching the existing cross-module private-import precedent (`main.py` → `board_service._seed_board_labels`) |
| Nit 4 (board-move mutation-order description inaccurate) | Addressed — corrected to "at the very top of the function, before any mutation runs" |
| Nit 5 (`onCardDragOver` not gated to orderable columns) | Accepted as-is, no code change — cosmetic-only, `handleDrop`'s existing early-return already protects data correctness; noted inline in Sort Algorithm section |
| Gap 6 (self-hover case in `computeInsertSortOrder` not an enumerated test) | Addressed — added as an explicit test case in the web Test Plan entry |
| Nit 7 (Float vs. DOUBLE PRECISION type ambiguity) | Addressed — pinned to `sqlalchemy.dialects.postgresql.DOUBLE_PRECISION` explicitly |

Implementation proceeds on this updated plan once approved.

---

## Sneezy's Review — 2026-08-02

**Tier:** FULL — per the spawn instructions: proposed files fall under model/schema/router/service areas (`models.py`, `schemas.py`, `routers/tasks.py`, `routers/sync.py`, `task_service.py`, `focused_view_service.py`), the plan declares a non-"none" data model change (`tasks.sort_order`), and it spans three independently-deployed components (backend, web, mobile).

**Verdict:** Changes required

### Issues

1. **[Gap] The "Files to Modify" list omits at least 7 existing frontend/mobile test files whose local `Task` fixture factories will fail to type-check once `sort_order` becomes a required field.** `Task.sort_order: number` is proposed as a non-optional field on both `frontend/src/api/tasks.ts` and `mobile/src/types/index.ts`. Verified by reading two of them directly: `frontend/src/__tests__/taskPriority.test.ts:5-22` (`function makeTask(id, is_high_priority): Task { return { id, board_id: ..., ... } }`, a full literal with no `sort_order`) and `frontend/src/__tests__/taskFilters.test.ts:6-24` (`function makeTask(overrides: Partial<Task>): Task { return { ...full literal..., ...overrides } }`) both construct complete `Task` objects that omit `sort_order` — TypeScript will reject them once the field is required. A grep for the same `board_id: '...'` literal pattern (a directly comparable precedent — `board_id` went through the exact same "add required field, must update every local factory" migration in PR #33, documented in `ARCHITECTURE.MD`: *"makeTask factory updated in 3 existing test files to include board_id: 'board-1'"*) turns up 5 more matches not accounted for anywhere in the plan: `frontend/src/__tests__/tasks.api.test.ts`, `mobile/src/__tests__/taskFilters.test.ts`, `mobile/src/__tests__/taskPriority.test.ts`, `mobile/src/__tests__/dayView.api.test.ts`, `mobile/src/__tests__/focusedView.api.test.ts`. Only `mobile/src/__tests__/taskGrouping.test.ts` (already listed) and the new `taskOrder.test.ts` are accounted for. Left as-is, this plan's implementation would break the web and mobile test suites' type-checking/build on files nobody was told to touch.

2. **[Gap] `handleDrop`'s described source for `zoneTasks` doesn't exist in that scope.** Sort Algorithm section: *"`zoneTasks` is the destination `highTasks` or `normalTasks` array already available from `columnTasks[columnKey]`."* Verified against `frontend/src/pages/TasksPage.tsx`: `highTasks`/`normalTasks` are local variables produced by `splitByPriority(colTasks)` **inside the per-column JSX `.map()` callback** (line 387), not accessible from `handleDrop`, which is a separately-defined function (lines 221–250) with no closure over that render-scope variable. `columnTasks[columnKey]` (line 177 `useMemo`) returns the **unsplit** column array (both priority zones combined) — `handleDrop` will need to call `splitByPriority(columnTasks[columnKey])` itself (the function is already imported from `taskPriority.ts`) and pick `.high`/`.normal` based on the `priority` param, not read a variable that happens to be "already available." Trivial to fix, but as written it points the implementer at something that isn't there.

3. **[Gap] `sync.py`'s "effective date changed" computation is unspecified, and the only existing implementation is a private helper in a different module.** The API Changes section says the client-wins branch must "replicate `update_task()`'s reset-to-bottom rule" but doesn't say how. `_effective_date()` (`task_service.py:25-28`, earliest-of-`must_do_by`/`target_date`) is the only implementation of this logic in the codebase and is module-private (leading underscore, used only internally by `task_service.py` today). The plan doesn't state whether `sync.py` should import it (there's precedent for this exact pattern — `main.py:61` already does `from .services.board_service import _seed_board_labels` — so it's not unprecedented) or reimplement the two-line comparison inline. Left unstated, either choice is plausible and a future edit to one copy's semantics (e.g. tie-breaking when `must_do_by == target_date`) could silently diverge from the other.

4. **[Nit] task_service.py's implementation note undersells how early `board_id` actually mutates.** The plan says *"board move mutates task.board_id in place partway through the function today"* — in the actual code (`task_service.py:148-150`), the `board_id` mutation is the **first statement in the function body**, before title/notes/date mutations (lines 157-168), not partway through anything. The instruction to capture `old_effective`/`board_changed` "before" it is still correct, but the description could lead an implementer to look for more preceding code than exists — the capture needs to happen at the very top of the function, immediately after the signature.

5. **[Nit] `onCardDragOver` isn't gated to orderable columns, only to draggability.** Every `<TaskCard>` in `TasksPage.tsx` today renders with a bare `draggable` prop (lines 472, 510, 566) regardless of column, including Overdue and Upcoming — both drag-*out*-able but not droppable-*into* (`handleDrop` early-returns for both at line 222). Since the plan wires `onCardDragOver` whenever `isDraggable && !isEditing`, hovering a dragged card over an Overdue/Upcoming card would still update `dragOverTaskId`/`dragOverEdge` and could render the new `dropIndicator` visual cue on a column where any resulting `sort_order` computation is discarded. Cosmetic only (no data-correctness impact, since `handleDrop`'s early return still fires), but worth a one-line scope-check in the implementation to avoid a misleading indicator.

6. **[Gap] `computeInsertSortOrder`'s self-hover case isn't named as a scenario, and its behavior there is not a no-op.** If a drag briefly re-enters the dragged card's own DOM node (`dragOverTaskId === draggedTaskId`), `siblings` already excludes the dragged task (per its own filter), so `idx` resolves to `-1` and the function falls through to the `idx === -1` branch — "append to end" — rather than leaving the task's position unchanged. This is likely rare (most browsers suppress `dragover` firing usefully on the reduced-opacity drag source) and non-destructive, but it's not one of the plan's enumerated test cases ("empty zone, append-to-end, insert between two siblings, insert as first/last, dragged task excluded from its own neighbor lookup") and is worth an explicit test or an explicit accepted-behavior note.

7. **[Nit] Column type is stated ambiguously as "Float/DOUBLE PRECISION."** In Postgres, a bare `FLOAT` and `DOUBLE PRECISION` are the same underlying 8-byte storage type (`FLOAT` with no precision normalizes to double precision in the catalog), so this isn't a correctness risk, but the plan doesn't commit to a specific SQLAlchemy type. Recommend `sqlalchemy.dialects.postgresql.DOUBLE_PRECISION` explicitly, so the ORM column's DDL (fresh-DB `create_all()` path) matches the raw-SQL `ALTER TABLE ... DOUBLE PRECISION` migration's type name exactly, rather than relying on generic `Float()`'s dialect-default compilation.

### Unverified assumptions

- **"~45–50 such bisections before precision is exhausted"** (Data Model Changes, Known limitation) — the actual bisection count before a double's ULP is reached depends heavily on the *initial* gap between the two neighbors being repeatedly bisected, which in turn depends on how far apart in wall-clock time the two tasks last had their `sort_order` reset. Working the IEEE-754 math backward: at epoch-seconds magnitude (~1.77×10⁹, exponent 30), the ULP is ≈2.4×10⁻⁷s. An initial gap of ~1 day yields ≈38 bisections to exhaust; ~1 year yields ≈47; ~1 hour yields ≈32. The plan's "45-50" figure is plausible for neighbors whose `sort_order` values were last set roughly a year apart, but is on the high side for same-day resets (~20-25 bisections). This doesn't change the plan's own conclusion (accepted, not a realistic usage pattern, not a blocker either way) — flagged only because the specific number can't be verified as a general constant from the code alone.
- **Task_service.update_task()'s control-flow claim** ("board move mutates task.board_id in place partway through the function today") — checked against `task_service.py:148-198`; found to be inaccurate in framing (board_id mutation is the *first* statement in the function, not partway through) though the actionable guidance built on it ("capture before it runs") still holds. See Issue #4.
- **sync.py's mutation-order assumption** — the plan implicitly assumes the client-wins branch (`sync.py:127-147`) allows capturing pre-mutation `board_id`/dates before any field is touched. Verified **true**: the "# Client wins" comment at line 127 precedes every mutation in that branch, so capturing `server_task.board_id` and `_effective_date(server_task.must_do_by, server_task.target_date)` at that point works cleanly — no control-flow obstacle exists here, unlike the `task_service.py` case above.
- **Focused view's "flat, date-unaware list" characteristic** — verified against `frontend/src/components/BoardGroupedTasks.tsx` and `FocusedView.tsx`: neither performs any client-side date-based re-grouping or re-sorting of `board.tasks`; `BoardGroupedTasks` renders the array in API-returned order (only `filterBoards` narrows it, it doesn't resort). The plan's claim holds — switching the backend tiebreak to `sort_order` doesn't introduce any new interleaving behavior the frontend wasn't already exposed to.
- **Recurring-task auto-creation interaction with `sort_order`** (raised as a review question, not a plan claim) — verified **not applicable**: recurrence logic was fully removed in PR #30/#31 per `DATA_MODEL_AND_API.MD` and confirmed in `task_service.py:201-214` — `complete_task()` always returns `(task, None)`, no follow-on task is ever created. There is no code path for this to affect.
- **The "no SQL-level DEFAULT" design's safety against non-ORM insert paths** — verified: the only two places that construct `Task(...)` rows are `task_service.create_task()` and `routers/sync.py`'s new-task branch, both plain SQLAlchemy ORM constructors that receive the Python-side `default=_sort_order_default` callable at flush time. `backend/tests/test_api.py` contains no raw `INSERT`/`db.execute(text(...))` against `tasks`. The one raw-SQL insert path in the repo (`backend/scripts/sync_local_to_railway.py`'s `bulk_insert`, used for local→Railway data sync) selects `SELECT * FROM tasks` and inserts the full column list it fetched, so it would carry `sort_order` through automatically once both databases have the column — not a gap, but also not mentioned in the plan (acceptable, this is an ops script outside the app's request path).

### Suggestions

- Add the 7 test files named in Issue #1 to "Files to Modify," with a one-line note that each local `makeTask`-style factory needs a `sort_order` default (matching the precedent already set for `board_id` in PR #33).
- Correct the `task_service.py` implementation note in the API Changes section to say the capture must happen "at the top of the function, before any mutation" rather than characterizing the board move as happening "partway through."
- Spell out in the Sort Algorithm section that `handleDrop` derives `zoneTasks` via `splitByPriority(columnTasks[columnKey])` (already imported), not via a variable it inherits from the render loop.
- State explicitly whether `sync.py` should import `task_service._effective_date` or duplicate the earliest-of-two-dates comparison inline — either is fine, but pick one so the two implementations don't drift.
- Consider adding a test case to `taskOrder.test.ts` for `targetTaskId === draggedTaskId` (self-hover), asserting the accepted fallback behavior explicitly rather than leaving it as incidental.

— *Sneezy*
