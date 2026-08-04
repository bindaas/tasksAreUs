# Plan: Fix Archive view usability (tabs, task details, reopen, tag order)

**Branch:** `fix-archive-view-usability`
**Status:** Awaiting user approval to proceed

## User report

Four issues in the web UI's Archive view:
1. Not all board tabs are visible — the "All boards" button can't be seen at all.
2. No way to open a completed task's details from Archive (unlike the regular task list).
3. From Task details, there's no way to mark a completed task as incomplete again.
4. From Task details, the user should be able to edit a completed task's other fields.
5. Tags on Archive completion cards aren't in alphabetical order.

Plus one additional item found during investigation and approved by the user for inclusion: the same tab-overflow bug (#1) also exists in `BoardTabs.tsx`, the board-tab bar on the regular Tasks page.

## Root causes

**#1 — Tabs/All button invisible (`ArchiveBoardTabs.tsx`, `BoardTabs.tsx`)**

Both components render their tab row as:
```tsx
<div className="flex justify-end gap-1.5 overflow-x-auto mb-4 -mx-1 px-1">
```
`justify-end` right-anchors the flex content. Once the tabs overflow the container width, the earliest tabs — including "All boards", which is first in the DOM — are pushed off the *start* edge. A scrollable container's `scrollLeft` can't go negative, so content overflowing the start edge is not just hard to find, it's unreachable by scrolling.

**Revised per Sneezy's review + user decision:** a plain `justify-start` swap would fix the overflow case but flip every user (including the common case of few-enough-boards-to-fit) from the intentional right-alignment documented in `ARCHITECTURE.MD`/`PRODUCT_REQUIREMENTS_DOCUMENT.MD` (PR #42) to left-packed. Instead, use the `min-width: 100%; width: max-content` technique to get both behaviors from one `justify-end`: split the current single flex `<div>` into an outer scroll container (`overflow-x-auto`, block-level) and an inner flex row (`flex justify-end gap-1.5 min-w-full w-max`). When content fits, `min-w-full` forces the inner row to be at least as wide as the outer container, so `justify-end` right-aligns the tabs within that space — unchanged from today. When content overflows, `w-max` lets the inner row grow to its natural (content) width, `justify-end` becomes a no-op since the row is now exactly content-sized, and the outer container's scrollable range correctly starts at the content's actual start — fixing the original bug.

**#2 — No navigation from Archive to Task details**

`CompletionCard` (in `ArchiveBoardGroups.tsx`) and the duplicated inline card markup in `ArchivePage.tsx`'s flat-list branch are static `<div>`s with no click handler. The regular task list (`TaskCard.tsx:76`, `FocusedTaskCard.tsx:40`) navigates via `navigate(\`/tasks/${task.id}\`)` on click — Archive cards need the same.

**#3 — No "mark incomplete" capability**

There is no reverse of `POST /tasks/{id}/complete` anywhere in the system. `TaskDetailPage.tsx` only renders the action-buttons section (Mark Complete / Delete) when `task.state === 'pending'` — for a `done` task, no actions are shown at all. Needs a new backend endpoint + service function, and a new button.

Recurrence is not a concern here — `next_task` generation was fully removed in PR #30/#31 per `DATA_MODEL_AND_API.MD`; `complete_task()` always returns `next_task: null`, so there's no follow-on task to reconcile when reopening.

**#4 — Editing a completed task's other fields**

This already works today at the code level: `TaskForm` / `TaskDetailPage` / `updateTask` don't gate anything on `task.state`, and `PUT /tasks/{id}` (router + `update_task()` service) has no state restriction either. The only reason it's felt broken is #2 — there was never a way to reach the detail page for a completed task. Once #2 and #3 land (the latter adding a visible action button for `done` tasks), this requirement is satisfied with no additional code beyond what #2/#3 already add.

**#5 — Tags not alphabetical**

`reports_service._to_completion_item()` returns `task.labels` in DB relationship order (insertion order), and both Archive rendering spots map over that order as-is. Existing convention elsewhere in the codebase (`TaskForm.tsx:409`, `TasksPage.tsx:345`, `TaskQuickEdit.tsx:94`, `SettingsPage.tsx:641`) sorts labels client-side via `.slice().sort((a, b) => a.value.localeCompare(b.value))`. Same fix, applied to the two Archive render sites.

## Fix

**Frontend-only (#1, #2, #4, #5):**
- `ArchiveBoardTabs.tsx` / `BoardTabs.tsx`: split the tab row into an outer `overflow-x-auto` container and an inner `flex justify-end gap-1.5 min-w-full w-max` row (see Root causes #1 above) — preserves PR #42's right-alignment when tabs fit, fixes the overflow/unreachable-start-edge bug when they don't.
- `ArchiveBoardGroups.tsx` (`CompletionCard`): add `onClick={() => navigate(\`/tasks/${item.task_id}\`)}`, sort `item.labels` alphabetically before rendering `LabelBadge`s.
- `ArchivePage.tsx` (flat-list branch, used when a single board is selected): same click handler and same label sort, applied to its inline card markup independently (not refactored to share `CompletionCard` — the two render paths are already independent today and merging them is a larger-footprint change than this fix calls for).

**Backend + frontend (#3, closes #4's remaining gap):**
- `backend/app/schemas.py`: no new schema needed — response reuses `TaskOut`.
- `backend/app/services/task_service.py`: new `reopen_task(db, task) -> Task`:
  - `422` (`HTTPException`) if `task.state != StateEnum.done` ("Task is not completed"), mirroring `complete_task()`'s existing guard shape.
  - Sets `state = StateEnum.pending`, `completed_at = None`.
  - Resets `sort_order = _sort_order_default()` — same convention `update_task()` already applies when a task's effective date changes, so a reopened task lands sensibly in its column instead of retaining a stale pre-completion sort position.
  - `is_high_priority` is left untouched, and unlike `update_task()`, `reopen_task()` deliberately does **not** call `_is_hp_eligible_date()` to auto-reset it. This is safe today specifically because `_is_hp_eligible_date()` (task_service.py:31-43) treats every date `<= today + 1` as eligible — i.e. eligibility can only ever expand as real time passes, never contract, so a task that was eligible when it went `done` cannot have silently become ineligible while sitting completed. A code comment in `reopen_task()` will state this coupling explicitly so a future change to that window's shape doesn't silently reintroduce the gap unnoticed (per Sneezy Issue 1).
  - Reopening also does not re-run the daily high-priority-limit check (`_count_high_priority_for_date`) — enforcing it here would let a reopen action fail with a 422 the user can't resolve without first editing the task, which is worse UX than accepting a possible transient over-limit that the user can fix via a normal edit afterward, same as how `complete_task()` never re-validates priority either.
  - Bumps `updated_at`, commits, refreshes, returns the task.
- `backend/app/routers/tasks.py`: new `POST /tasks/{task_id}/reopen`, `response_model=TaskOut`, same auth/lookup pattern as `complete_task()` (`svc.get_task_or_404` then delegate to the service function).
- `frontend/src/api/tasks.ts`: add `reopenTask(id: string): Promise<Task>` calling `POST /tasks/${id}/reopen`.
- `frontend/src/pages/TaskDetailPage.tsx`: extend the action-buttons section (currently gated on `task.state === 'pending'`) with a parallel branch for `task.state === 'done'` showing a "Mark as Incomplete" button that calls `reopenTask` then `navigate(-1)`, following the same `saving`/error-handling pattern as `handleComplete`/`handleDelete`. Delete is intentionally not added to the `done` branch — out of scope, not requested.

## Files to modify

- `frontend/src/components/ArchiveBoardTabs.tsx`
- `frontend/src/components/BoardTabs.tsx`
- `frontend/src/components/ArchiveBoardGroups.tsx`
- `frontend/src/pages/ArchivePage.tsx`
- `frontend/src/pages/TaskDetailPage.tsx`
- `frontend/src/api/tasks.ts`
- `backend/app/routers/tasks.py`
- `backend/app/services/task_service.py`
- `backend/tests/unit/test_task_service.py` — additions covering `reopen_task()`: happy path (state/completed_at/sort_order reset), the 422-on-already-pending guard, and (per Sneezy Issue 3) an explicit case asserting `is_high_priority=True` survives a reopen unchanged even when the task's date is already at/over the daily high-priority cap — pinning down that the no-recheck behavior is intentional, not incidental.
- `backend/tests/unit/test_tasks_router.py` — per Sneezy's Nit (Issue 5), a small addition asserting `get_task_or_404` is called before `reopen_task` in the new route, mirroring `complete_task`'s existing lookup-then-delegate ordering test.

## Data model changes

None. No schema/column changes — reopen only mutates existing `state`, `completed_at`, `sort_order`, `updated_at` columns via `ALTER`-free ORM writes.

## API / contract changes

One new endpoint: `POST /tasks/{task_id}/reopen` → `TaskOut`. Purely additive (new route, new frontend caller); no existing endpoint's request/response shape changes. No backward-compatibility window needed since nothing existing depends on this path.

## Test plan

- New backend unit test for `reopen_task()` in `backend/tests/unit/` (see Files to modify).
- `backend/tests/test_api.py` is owned exclusively by `/test-review` (Sleepy) — not modified here; if the user runs a full review pass afterward, Sleepy will add integration coverage for the new endpoint then.
- Frontend: no pure-utility function is introduced (label sorting is inline, following the existing inline-sort convention rather than extracting a shared utility, to match how the other four call sites in this codebase already do it), so no new Vitest coverage is a natural fit under current convention (Vitest suite targets `frontend/src/utils/` only).
- Manual verification in-browser:
  1. Archive page with enough boards to overflow the tab row — confirm "All boards" and every board tab are reachable (scroll or otherwise visible), on both Archive and the regular Tasks page's `BoardTabs`.
  2. Click a completion card in both the grouped ("all boards") and single-board Archive views — confirm it navigates to `/tasks/:id` and the form loads correctly.
  3. From a completed task's detail page, click "Mark as Incomplete" — confirm it returns to pending, disappears from Archive's date range (since `completed_at` is cleared), and reappears in the normal Tasks board view.
  4. Edit a completed task's title/notes/labels/dates and save — confirm it persists (already-working path per #4's analysis, verify no regression).
  5. Confirm Archive completion card tags render alphabetically, both in the flat single-board list and inside grouped board sections.

## Deployment order

Single component — Railway bakes frontend + backend into one Docker image (per `CLAUDE.md`), so there's no cross-service deploy-order or backward-compatibility window to manage here.

## Mobile update type

Not applicable — no mobile files touched.

---

## Sneezy's Review — 2026-08-03

**Tier:** FULL — `backend/app/routers/tasks.py` and `backend/app/services/task_service.py` are router/service (API-contract) files, and the plan adds a new endpoint (`POST /tasks/{task_id}/reopen`), correctly triggering the mechanical full-tier gate per `RULES_OF_ENGAGEMENT.MD`. Confirmed correct on inspection — no re-escalation needed, but also no de-escalation: this is a genuine, if narrow, data-model-adjacent change (it resurrects a `done` task's priority flag without re-validating the invariant the rest of `task_service.py` enforces on every other mutation).

**Verdict:** Approved with concerns

### Issues

1. **[Risk]** `task_service.py` — `reopen_task()`'s safety argument for leaving `is_high_priority` untouched is incomplete. `update_task()` (lines 177-179) runs `_is_hp_eligible_date()` **unconditionally on every call**, regardless of whether `is_high_priority` was explicitly passed — any edit to any field re-validates eligibility and silently resets `is_high_priority` to `false` if the effective date has drifted out of the window. The plan's `reopen_task()` does not call this check at all, which is an asymmetry with the one other place a task's fields get mutated in bulk. I independently verified this asymmetry is not currently exploitable: `_is_hp_eligible_date()` (task_service.py:31-43) returns `True` for literally any date `<= today + 1`, i.e. *all* past dates qualify — so as real time advances past a task's static `must_do_by`/`target_date` while it sits `done`, the date only moves further into "eligible" territory (or stays eligible), never out of it. There is no reachable sequence of events today that flips a previously-eligible task to ineligible purely by the passage of time. But the plan doesn't demonstrate this — it just asserts "left untouched" without acknowledging update_task's unconditional check exists, so a future reader (or a future change to `_is_hp_eligible_date`'s window shape) has no documented reason to know this was deliberately reasoned through rather than overlooked. Worth a one-line note in the plan and/or a code comment in `reopen_task()` making this explicit.
2. **[Risk]** `ArchiveBoardTabs.tsx:18` / `BoardTabs.tsx:11` — the root-cause diagnosis (`justify-end` + `overflow-x: auto` makes start-of-list content unreachable because `scrollLeft` can't go negative) is correct and well-known. However, both `ARCHITECTURE.MD` (`BoardTabs.tsx` entry: "right-aligned under the view toggle as of PR #42") and `PRODUCT_REQUIREMENTS_DOCUMENT.MD` ("Board tabs... appear directly below the view toggle, right-aligned (PR #42)") document right-alignment as an intentional, previously-reviewed design decision, not an accident. A blanket `justify-end` → `justify-start` swap fixes the overflow case but silently regresses the common case — any user with few enough boards that the tab row doesn't overflow (which, given `MAX_BOARDS_PER_USER` defaults and most users likely having 1-4 boards, is probably the majority case) will now see the tab row left-packed instead of right-aligned, with no user confirmation that this tradeoff is acceptable. The plan doesn't mention this as a tradeoff at all — per `RULES_OF_ENGAGEMENT.MD`'s "surface edge cases proactively" rule, this should at minimum be called out as an explicit, accepted visual change, or better, fixed with a technique that preserves right-alignment when content fits and only start-anchors when it overflows (e.g. wrapping the tab row in `width: max-content; margin-left: auto` on a non-scrolling parent, or a JS/CSS overflow-detection toggle). This is not a functional bug, but it is a real, unacknowledged design regression in the common case for the sake of fixing the rare case.
3. **[Gap]** Test plan (Files to modify, last bullet) — the proposed unit test covers "state/completed_at/sort_order reset" and the 422 guard, but doesn't explicitly call out asserting that `is_high_priority` survives a reopen unchanged (including a case where the daily cap is already at/over the limit for that date, to prove the no-recheck behavior is intentional and covered, not just incidental). Given Issue 1 above, this is exactly the invariant this plan is making a judgment call about — it should have a test pinned to it, not just be implied by "not passing `is_high_priority` as a param."
4. **[Gap]** The plan's Fix section never discusses what happens if the task's board was soft-deleted while the task sat `done` (a scenario the plan explicitly could have hit, since `DELETE /boards/{id}` only blocks deletion when the board "has pending tasks" per `DATA_MODEL_AND_API.MD`'s prose). I checked this directly: `board_service.delete_board()` (`board_service.py:196-204`) queries `Task.board_id == board.id, Task.is_deleted == False` with **no `state` filter** — so a board with any non-deleted task, `done` or `pending`, cannot be soft-deleted today. The scenario is therefore unreachable, and the plan's silence on it doesn't cause a bug. But note the doc/code mismatch this surfaces: `DATA_MODEL_AND_API.MD`'s "board has pending tasks" error-case description is inaccurate — the guard is broader than documented. Not this plan's bug to fix, but worth flagging to Doc (arch-review) separately since it's adjacent to this PR's territory.
5. **[Nit]** No router-level unit test is proposed for the new `POST /tasks/{task_id}/reopen` endpoint itself (only a `task_service.reopen_task()` test). This is defensible — `test_tasks_router.py`'s existing convention (verified by reading it) specifically guards against Pydantic-validates-but-never-threaded wiring bugs, and the reopen endpoint has no request body/fields to drop, so that bug class doesn't apply. Still, a two-line test asserting `get_task_or_404` is called before `reopen_task` (mirroring `complete_task`'s shape) would cheaply guard the auth/lookup ordering the plan claims to mirror.

### Unverified assumptions

- All line citations in the plan were checked against current source and are accurate: `TaskCard.tsx:76` and `FocusedTaskCard.tsx:40` both match `onClick={() => { if (!isEditing) navigate(...) }}` verbatim. `ArchiveBoardTabs.tsx`/`BoardTabs.tsx`'s `justify-end` line (both line ~11/18) matches. `reports_service._to_completion_item()` (reports_service.py:39-45) confirmed to return `task.labels` with no explicit sort (the `Task.labels` relationship in `models.py:113` has no `order_by`), consistent with the plan's "DB relationship order" claim.
- Confirmed via direct read that `TaskForm.tsx` and `TaskDetailPage.tsx` have **zero** references to `task.state` anywhere in their render/submit logic — the only state-gated UI in `TaskDetailPage.tsx` is the existing Mark Complete/Delete button block (currently `task.state === 'pending'`, line ~232). `update_task()`/`PUT /tasks/{id}` (task_service.py, tasks.py router) likewise have no state check. Requirement #4's "already works today at the code level" claim holds up completely.
- Confirmed `backend/tests/unit/test_task_service.py` and `test_tasks_router.py` both mock the SQLAlchemy session via `unittest.mock.MagicMock`, matching the plan's stated convention, and that `complete_task()`'s guard shape (`if task.state == StateEnum.done: raise HTTPException(422, ...)`) is what the plan proposes mirroring for `reopen_task()`'s inverse guard.
- Not independently verified (no browser available): the actual visual outcome of the `justify-end`→`justify-start` swap across a range of board counts. The CSS mechanism is sound reasoning (confirmed by reading the DOM structure), but Issue 2's regression claim should be confirmed visually during manual testing (test plan step 1) — specifically with 1-2 boards, not just the overflow case the plan's own test step describes.

### Suggestions

- For Issue 2, consider `justify-start` plus a wrapper technique (e.g. `w-max ml-auto` on the tab-button group, or measuring scrollWidth vs clientWidth to toggle the class) so short tab rows stay right-anchored while long ones remain scrollable from the start — preserves both the PR #42 design intent and the overflow fix.
- For Issue 1, add a one-line code comment in `reopen_task()` (or the plan text) stating explicitly that `_is_hp_eligible_date`'s "any date `<= today+1` is eligible" shape is what makes skipping the auto-reset check safe today, so a future change to that window's boundaries doesn't silently reintroduce the gap without anyone noticing the coupling.
- Consider whether `reopen_task()` should bump `sort_order` via the same `_sort_order_default()` call used elsewhere, or whether a reopened task landing at the *very* bottom of pending (below tasks that were never touched) versus a fresher "just edited" position matters product-wise — not a defect, just worth a sentence confirming this was a deliberate choice (it reads as one, just not stated as explicitly as the sort_order rationale for date/board changes elsewhere).

— *Sneezy*

## Response to Sneezy's Review

1. **[Risk] `is_high_priority` eligibility-check asymmetry** — Addressed. Root-cause and Fix sections above now state explicitly why skipping `_is_hp_eligible_date()` is safe today (eligibility windows can only expand with time, never contract), and `reopen_task()` will carry a code comment making the coupling explicit for future readers.
2. **[Risk] `justify-end`→`justify-start` regresses PR #42's intentional right-alignment for the common (non-overflowing) case** — Addressed per user decision (see conversation): switched to the `min-width: 100%; width: max-content` technique, which preserves right-alignment when tabs fit and only start-anchors/scrolls when they overflow. Root causes and Fix sections updated accordingly.
3. **[Gap] Test plan didn't pin down `is_high_priority` surviving reopen** — Addressed. Files to modify now explicitly calls out a test case for `is_high_priority=True` surviving reopen even when already at/over the daily cap.
4. **[Gap] Board soft-delete-while-completed scenario undiscussed** — No plan change needed: Sneezy independently verified this is unreachable today (`board_service.delete_board()` blocks deletion for a board with *any* non-deleted task, not just pending ones, despite `DATA_MODEL_AND_API.MD` describing the guard as pending-only). The doc/code mismatch this surfaces is out of scope for this PR — will flag it to Doc (arch-review) separately rather than fix it here.
5. **[Nit] No router-level test for the new endpoint's lookup ordering** — Addressed. Files to modify now includes a small `test_tasks_router.py` addition asserting `get_task_or_404` runs before `reopen_task`.
