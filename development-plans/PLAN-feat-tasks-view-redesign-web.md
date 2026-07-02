# PLAN: feat-tasks-view-redesign-web — Four-view Tasks page, drop Chat UI, drop Show done/pending

## Overview

This is PR 2 of a 3-PR epic (backend → **web** → mobile). Depends on `feat-tasks-day-view-backend` (PLAN-feat-tasks-day-view-backend.md) being merged and deployed first — the new Today/Tomorrow views call `GET /day-view/tasks`, which does not exist until that PR ships.

Reworks the web Tasks page around four views — **Focused, Today, Tomorrow, All** (in that order, Focused is default) — removes the Chat feature's UI (backend untouched, later PR), removes the Show done/pending toggle, replaces the left-nav board dropdown with board tabs (shown only under the All view), removes the "tasksAreUs" nav branding, and renames the page header to "Tasks Are Us - `<View>`" / "Tasks Are Us - `<Board>`".

## Requirements (from user Q&A this session)

1. **Show done/pending**: removed entirely. Once a task is completed it is no longer visible anywhere in the web UI. No replacement view for completed tasks in this PR.
2. **Chat**: fully delete the UI — `ChatPage.tsx`, its nav entry, and the frontend `api/conversations.ts` client. Backend `conversations` router/models/AI service are untouched (later PR rebuilds the integration).
3. **Focused View Settings editor**: removed from `SettingsPage.tsx`. The now-unused frontend `getFocusedViewConfig`/`updateFocusedViewConfig` calls are removed from the Settings page; kept as dead code is not desired, but the backend endpoints stay live (per the backend plan) — simply nothing in this frontend calls them anymore. `api/focusedView.ts`'s config functions are deleted as dead code; `getFocusedViewTasks` stays (still used by the Focused view itself).
4. **Today/Tomorrow**: all-priority, all-board, single-day views (per backend plan), visually similar to Focused (board-grouped cards).
5. **View order & labels**: Focused, Today, Tomorrow, All — "All" replaces the "Detailed" label on the existing kanban view (no behavior change to the kanban itself). Default view: Focused.
6. **Board tabs**: replace the left-nav/mobile-header board dropdown (`BoardSwitcher.tsx`) entirely. New tab row appears directly below the view buttons, **only when the All view is selected**. Selecting a board tab updates the same shared `BoardContext` that `activeBoard` already uses everywhere (Settings' per-board Labels editor, etc.) — no separate board picker is added to Settings. **User-confirmed tradeoff (in response to Sneezy issue #4)**: re-scoping Settings' Labels editor to a different board now requires Tasks → All → pick a board tab → Settings — a multi-step workflow change from today's always-visible dropdown. Explicitly accepted, not fixed in this PR.
7. **App name**: remove the "tasksAreUs" `<h1>` from `Layout.tsx`'s desktop sidebar and mobile header. Nothing replaces it there — branding moves into the dynamic page header (next point).
8. **Page header**: "My Tasks" is replaced with `"Tasks Are Us - Focused"` / `"Tasks Are Us - Today"` / `"Tasks Are Us - Tomorrow"` / `"Tasks Are Us - <current board name>"` (the last form only when All is selected).
9. **State persistence across task edit**: current view and active board are encoded in the URL (`?view=today&board=<id>`) via `useSearchParams`, so returning from the task detail/edit screen restores the same view/board.
10. **New task board default + board picker (added after first Sneezy pass, resolves Sneezy issue #1)**: creating a task while in Focused/Today/Tomorrow (no board tabs visible) defaults to the user's default (starred) board — user-confirmed decision. Creating from All defaults to the currently selected board tab (`activeBoard`), same as today. **Both the Create Task and Edit Task forms gain a board `<select>` dropdown** listing all of the user's boards, letting the user override that default on create, or move an existing task to a different board on edit. Moving a task's board clears its labels server-side (see the backend plan's "Move Task Between Boards" section) — the edit form shows an inline note when the selected board differs from the task's current board, warning that labels will be cleared.

## Data / API Changes

None — this PR is presentation-only. It consumes the existing `GET /focused-view/tasks` and the new `GET /day-view/tasks` (from the backend PR).

## Files to Modify

**Removed**
- `src/pages/ChatPage.tsx` (deleted)
- `src/api/conversations.ts` (deleted)
- `FocusedViewConfigEditor` function and its usage inside `src/pages/SettingsPage.tsx` (deleted, along with the `focusedConfig` state/fetch)
- `getFocusedViewConfig` / `updateFocusedViewConfig` in `src/api/focusedView.ts` (deleted — dead code once the Settings editor is gone)
- `src/components/BoardSwitcher.tsx` (deleted — superseded by board tabs)

**Layout / nav**
- `src/components/Layout.tsx` — remove `<h1>tasksAreUs</h1>` (both desktop `aside` and mobile `header`); remove `<BoardSwitcher />` usage in both places; remove the `Chat` entry from `NAV_ITEMS` and the now-unused `ChatIcon()` function
- `src/App.tsx` — remove the `/chat` route and `ChatPage` import

**Tasks page — the bulk of the change**
- `src/pages/TasksPage.tsx`:
  - Replace `viewMode: 'detailed' | 'focused'` with `viewMode: 'focused' | 'today' | 'tomorrow' | 'all'`, default `'focused'`, driven by `useSearchParams` (`?view=`) instead of local `useState` alone — reading/writing the URL is the source of truth, local state mirrors it for render convenience
  - Remove `showDone` state, the "Show done/pending" button, the `Completed Tasks` header branch, and the flat done-tasks list rendering branch
  - Remove the `!showDone` guards that are now unconditional (label filter chips, FAB, etc. always show — no done branch left)
  - `viewMode === 'all'` renders the existing kanban board unchanged (was `'detailed'`)
  - `viewMode === 'focused'` renders `<FocusedView />` unchanged
  - New: `viewMode === 'today'` / `'tomorrow'` render a new shared `<DayView referenceDate={...} />` component
  - New board tabs row: rendered only when `viewMode === 'all'`, directly below the 4-way view toggle; clicking a tab calls `useBoard().setActiveBoard(board)` and updates the URL `?board=` param
  - Header: `Tasks Are Us - {VIEW_LABELS[viewMode]}` for focused/today/tomorrow, `Tasks Are Us - {activeBoard?.name}` for all
  - On mount / view or board param change, sync `BoardContext`'s `activeBoard` from the URL `board` param if present and valid (so a deep link to `?view=all&board=<id>` restores that board). **Corrected per Sneezy issue #3**: this effect must be gated on `boards.length > 0` (`useBoard()`'s `boards` array is empty until `BoardProvider`'s async `fetchBoards()` resolves, per `BoardContext.tsx:28-51`) — otherwise a mount-time read of `?board=` can run before boards have loaded and silently no-op, leaving `activeBoard` on the default board despite a valid URL param.
  - FAB's target board for a new task: `activeBoard?.id` when `viewMode === 'all'` (unchanged); the user's **default (starred) board** — looked up from `boards.find(b => b.is_default)`, not `activeBoard` — when `viewMode` is `'focused' | 'today' | 'tomorrow'`. Passed to `TaskDetailPage` as an initial-board hint (e.g. a `?board=` param on the `/tasks/new` navigation, or router state) so the create form's dropdown (below) opens pre-selected to the right board.
- New: `src/components/BoardTabs.tsx` — small tab-button row, styled consistently with the existing detailed/focused pill toggle; reads `boards`/`activeBoard` from `useBoard()`
- New: `src/components/DayView.tsx` — fetches `GET /day-view/tasks?reference_date=` for the given date, renders the same board-grouped card layout as Focused
- **Extract shared rendering**: `src/components/FocusedView.tsx`'s board-grouping/card-list JSX (lines ~68–90) is factored into a new `src/components/BoardGroupedTasks.tsx` that takes `boards: FocusedBoard[]` and renders it; `FocusedView.tsx` becomes: fetch from `/focused-view/tasks` → render `<BoardGroupedTasks boards={boards} />`. `DayView.tsx` does the analogous fetch-from-`/day-view/tasks` → render `<BoardGroupedTasks boards={boards} />`. This is a genuine 2×-reuse extraction (Focused + Today + Tomorrow all need identical board-grouped-card rendering), not a premature abstraction.
- `src/api/focusedView.ts` — no changes needed beyond the deletions noted above; `getFocusedViewTasks` stays as-is
- New: `src/api/dayView.ts` — `getDayViewTasks(referenceDate: string): Promise<{ boards: FocusedBoard[] }>`, mirrors `getFocusedViewTasks`

**Task edit → return to same view/board**
- `src/pages/TaskDetailPage.tsx` — change `navigate('/')` to `navigate(-1)` in `handleSubmit`, `handleComplete`, and `handleDelete` (currently only `onCancel` does this). This is the concrete fix that makes "come back to the same view/board" work — browser history already carries the full `?view=&board=` query string, `navigate('/')` was discarding it. Known pre-existing limitation, unchanged by this PR (per Sneezy nit #5): a hard refresh or a direct deep-link straight to `/tasks/:id` leaves no prior "list" entry in the SPA history stack, so `navigate(-1)` can land somewhere unexpected — this already exists for the current `onCancel` behavior and isn't a new bug class introduced here.
- `src/pages/TaskDetailPage.tsx` — **fix per Sneezy issue #2**: `handleSubmit`'s high-priority-limit check currently fetches `listTasks('pending', activeBoard?.id)`, scoped to whatever board happens to be active rather than the task's actual board. Since Today/Tomorrow are now explicitly cross-board, this mismatch becomes far more likely to trigger. Fix while this code is already being touched: for an existing task, fetch using `task.board_id` instead of `activeBoard?.id`; for a new task, use whichever board is currently selected in the new board dropdown (updates when the dropdown selection changes, not just on mount).
- `src/components/TaskForm.tsx` — **new**: gains a `boards: Board[]` prop and internal `boardId` state (default: `initialValues?.board_id` on edit, or a new `defaultBoardId` prop on create — passed down by `TaskDetailPage` from the FAB's initial-board hint above). Renders a board `<select>` dropdown. `board_id` is always included in the submitted `CreateTaskBody`/`UpdateTaskBody` payload. On edit, when the selected board differs from `initialValues?.board_id`, shows an inline note: "Moving to a different board will clear this task's labels."
- `src/api/tasks.ts` — **fix per Sneezy second-pass blocker #1**: `CreateTaskBody` and `UpdateTaskBody` are hand-maintained TypeScript interfaces (`tasks.ts:32-40`, `42-54`), entirely separate from the backend's Pydantic `TaskUpdate` schema — adding `board_id` on the backend does **not** add it here. Both interfaces need `board_id?: string` added explicitly, or `TaskForm.tsx`'s `data.board_id = boardId` assignment won't type-check.
- `src/pages/TaskDetailPage.tsx` — passes `boards` (from `useBoard()`) and the initial-board hint down to `<TaskForm />`. **Fix per Sneezy second-pass blocker #2**: `handleSubmit`'s create branch currently calls `createTask(data as CreateTaskBody, activeBoard?.id)` (line 76). `createTask(body, boardId?)` spreads the explicit `boardId` argument *after* `...body`, so it always wins over anything set inside `body` — meaning the form's board-dropdown selection would be silently overwritten by `activeBoard?.id` on every create. Fix: drop the second argument entirely — `createTask(data as CreateTaskBody)` — and rely solely on `data.board_id`, which `TaskForm` now always sets (defaulted per Requirement 10, overridable via the dropdown). The **update** path needs no equivalent fix: `updateTask(id, body)` has no second `boardId` parameter, so once `UpdateTaskBody` gains the field and `TaskForm` sets it, the value flows through as-is (Sneezy second-pass gap #3).
- New Vitest case (or extension of an existing one) asserting `createTask()`/`updateTask()` actually serialize a caller-supplied `board_id`, and specifically that removing the second `boardId` argument from the create call site doesn't regress — this is exactly the class of wiring bug that's easy to silently reintroduce.

**Settings**
- `src/pages/SettingsPage.tsx` — remove the entire "Focused View" section (heading, description, `<FocusedViewConfigEditor />`) and its `focusedConfig` state/fetch/import. Boards and Labels sections are unchanged (they already work off `activeBoard` from the shared context, which board tabs now drive).

## Test Plan

- `src/__tests__/` (Vitest, pure utility functions per project convention): if any new pure logic is introduced (e.g. a `viewLabel(viewMode, activeBoard)` header-text helper), add a unit test for it
- New Vitest case for `src/api/tasks.ts`'s `createTask`/`updateTask` (per Sneezy second-pass suggestion): asserts a caller-supplied `board_id` is serialized in the request body, and specifically that `createTask()` called with no second `boardId` argument doesn't lose `body.board_id` — guards against reintroducing the override bug fixed above
- Manual verification (dev server, per project UI-change convention):
  - Default view on load is Focused; header reads "Tasks Are Us - Focused"
  - Switching to Today/Tomorrow shows all-priority tasks due that day across all boards; switching to All shows the existing kanban unchanged, now labeled "All"
  - Board tabs appear only under All, switching a tab updates both the kanban's tasks and the Settings page's Labels scope
  - Editing a task from any view/board combination and saving/canceling/deleting returns to that exact view/board (not reset to Focused)
  - Creating a task from Focused/Today/Tomorrow defaults the board dropdown to the default board; creating from All defaults to the selected board tab; overriding the dropdown creates the task in the chosen board
  - Editing a task and changing its board dropdown selection moves the task and clears its labels; the inline warning appears before saving
  - A deep link to `/?view=all&board=<id>` (pasted directly, not navigated to in-app) correctly selects that board's tab once boards finish loading
  - "tasksAreUs" no longer appears in the sidebar/mobile header; Chat nav entry and `/chat` route are gone (404s to `/` via existing catch-all route)
  - Settings page no longer shows a Focused View section; Labels/Boards sections still work
  - Completing a task removes it from view with no way to see it again in this session
- `backend/tests/test_api.py` — unaffected (no backend changes in this PR); Sleepy's normal test-review pass still runs on the PR as usual

## Deployment Order

1. Requires `feat-tasks-day-view-backend` merged **and deployed to Railway** first — `DayView.tsx`/`api/dayView.ts` call an endpoint that doesn't exist otherwise.
2. This PR touches only `frontend/` — per `CLAUDE.md`'s deploy-trigger convention, the commit(s) carry `[skip deploy]` and will not force an immediate Railway redeploy. Because backend+web ship as one Docker image (per `Dockerfile`), these changes will go live the next time *any* backend-touching commit deploys, or via a manual deploy trigger if the user wants this live sooner. Flagging this explicitly since it's a real gap between "merged" and "live" that the user should be aware of for a user-facing change this size.
3. Mobile PR is independent of this one (both depend only on the backend PR, not on each other) and can ship in either order relative to this one.

## PR Structure

Single PR, frontend/web only.

---

## Sneezy's Review — 2026-07-02

**Verdict:** Changes required

### Issues

1. **[Risk]** Removing `BoardSwitcher` entirely (`src/components/BoardSwitcher.tsx`, embedded in `Layout.tsx:2,79-96`) and restricting board switching to tabs shown "only when All view is selected" (Requirement 6) removes the *only* way to change `activeBoard` while in Focused/Today/Tomorrow. Per this plan's own note, the FAB is unconditional once `showDone` is removed ("the `!showDone` guards that are now unconditional ... FAB ... always show"), and `TaskDetailPage.tsx:76` creates new tasks via `createTask(data, activeBoard?.id)`. So a user working in Today/Tomorrow/Focused (which by design span multiple boards) has no way to choose which board a new task lands in — it silently goes to whichever board happens to be `activeBoard` (initialized to the default board on load per `BoardContext.tsx:34-41`, only changeable via a tab under All). This is a real functional regression from today's behavior, where `BoardSwitcher` is always visible independent of view mode. Not called out anywhere in the plan's requirements or Test Plan.
2. **[Risk]** `TaskDetailPage.tsx:39-41` computes `highPriorityWarning` from `listTasks('pending', activeBoard?.id)` — i.e. scoped to `activeBoard?.id`, **not** `task.board_id`. This is a pre-existing latent bug (already possible today via the cross-board Focused View), but this redesign makes it materially worse: (a) Today/Tomorrow are explicitly cross-board by requirement, so editing a task from those views is now very likely to trigger this mismatch; (b) with `BoardSwitcher` removed entirely, the user has no way left to manually correct `activeBoard` to match the task's actual board. Not mentioned anywhere in the plan.
3. **[Gap]** "On mount / view or board param change, sync `BoardContext`'s `activeBoard` from the URL `board` param if present and valid" doesn't account for `BoardProvider`'s async `fetchBoards()` (`BoardContext.tsx:28-51`) — `boards` starts as `[]` and populates only after a `GET /boards` round-trip completes. A `useEffect` that reads `?board=` and validates against `boards` on mount could easily run before boards have loaded and silently no-op, leaving `activeBoard` on the default board despite a valid `?board=` param in the URL. The plan should specify gating this sync on `boards.length > 0` (or an equivalent "loaded" signal).
4. **[Gap]** Settings' board-scoped Labels editor (`SettingsPage.tsx:756-781`, heading interpolates `activeBoard.name`) can currently be re-scoped from any page via the always-visible `BoardSwitcher`. After this PR, the *only* way to change which board's labels Settings shows is: navigate to Tasks → switch to All → click a board tab → navigate to Settings. The plan states board tabs "update the same shared BoardContext... no separate board picker is added to Settings" but never flags this multi-step, non-obvious workflow change for explicit user sign-off, despite `RULES_OF_ENGAGEMENT.MD`'s "surface edge cases proactively" guidance.
5. **[Nit]** The `navigate(-1)` rationale ("browser history already carries the full `?view=&board=` query string") holds for the common in-app case (list → detail → back) and mirrors the existing `onCancel` behavior (`TaskDetailPage.tsx:160`), so this isn't a new bug class. Worth stating explicitly, though: a hard refresh or a direct deep-link to `/tasks/:id` leaves the SPA history stack with no prior "list" entry, so `navigate(-1)` could land somewhere unexpected. This risk is pre-existing for Cancel and is now extended to Submit/Complete/Delete by this plan.

### Unverified assumptions

- "the shape is identical, no new schema needed" for day-view reuse of `FocusedViewTasksOut` — confirmed accurate against `backend/app/schemas.py:281-289`.
- The plan's description of `TasksPage.tsx`'s current state (`viewMode`, `showDone`, FAB gating, label-chip guards, kanban rendering) was verified line-by-line against the actual file and is accurate.
- `Layout.tsx` needing `<h1>tasksAreUs</h1>` removed "in both desktop `aside` and mobile `header`" — confirmed accurate (`Layout.tsx:79`, `Layout.tsx:93`).
- Deploy-trigger mechanics ("commit(s) carry `[skip deploy]` and will not force an immediate Railway redeploy") — the convention is documented in `CLAUDE.md` and is consistent with the combined-image `Dockerfile`/`railway.toml` (verified: one Docker image serves both), but no workflow file or `railway.toml` watch-path config enforcing path-based skip exists in this repo; the actual skip mechanism, if any, is external and unverifiable here.
- The companion backend plan's day-view date-filtering semantics (OR-of-dates vs. true "effective date") — see the backend plan's Sneezy review for the specific concern. This plan only consumes that endpoint's contract, so it isn't at fault either way, but the manual Test Plan item "switching to Today/Tomorrow shows all-priority tasks due that day" should be re-verified once the backend semantics are confirmed, since edge-case tasks (`target_date` in the past, `must_do_by` today, or vice versa) may show up in a day bucket that doesn't match the plan's own "effective date" wording.

### Suggestions

- Add a `viewLabel(viewMode, activeBoard)` pure helper (as the Test Plan hints) with dedicated Vitest coverage — cheap and directly testable.
- Consider a lightweight "Creating in: <board name>" affordance near the FAB when board tabs are hidden (Focused/Today/Tomorrow), so users aren't surprised by which board a new task lands in.
- Explicitly note in the plan that the `activeBoard`-scoped HP-limit warning (Issue #2) is a pre-existing, now-amplified issue, so it can be triaged (fixed now vs. filed as follow-up) rather than discovered later.

— *Sneezy*

---

## Grumpy's Response to Sneezy's Review

| Sneezy item | Status |
|---|---|
| Issue 1 (no board picker outside All) | Addressed — new Requirement 10: board `<select>` on both Create and Edit forms, plus a sensible default-board-outside-All rule (user-confirmed) |
| Issue 2 (HP warning scoped to activeBoard, not task's board) | Addressed — `TaskDetailPage.tsx` fix specified: use `task.board_id` for existing tasks, the live dropdown selection for new tasks |
| Issue 3 (URL→BoardContext sync race with async fetchBoards) | Addressed — sync effect now explicitly gated on `boards.length > 0` |
| Issue 4 (Settings board-scoping workflow gets multi-step) | Addressed as an explicit, user-confirmed tradeoff — not fixed, called out directly in Requirement 6 |
| Nit 5 (navigate(-1) deep-link edge case) | Addressed — documented as a pre-existing limitation shared with the current `onCancel` behavior, not a new bug |

Implementation proceeds on this updated plan.

---

## Sneezy's Second Review — Move Task Between Boards — 2026-07-02

**Verdict:** Changes required

### Issues

1. **[Blocker]** The plan's claim that `board_id` is "always included in the submitted `CreateTaskBody`/`UpdateTaskBody` payload (both already accept `board_id` per the backend plan's schema change)" is false. Confirmed by reading `frontend/src/api/tasks.ts` in full: `CreateTaskBody` (lines 32-40) and `UpdateTaskBody` (lines 42-54) have no `board_id` field. The "backend plan's schema change" referenced is `TaskUpdate.board_id` in `backend/app/schemas.py` — a **Pydantic** schema, entirely separate from these **TypeScript** interfaces, which are hand-maintained and not generated from the backend. As written, `TaskForm.tsx`'s described submit logic (setting `data.board_id = boardId` on a `CreateTaskBody | UpdateTaskBody` union) will not type-check. `frontend/src/api/tasks.ts` is not listed anywhere in this plan's Files to Modify for the board-move feature.
2. **[Blocker]** Even once `board_id?: string` is added to both interfaces, the **create** path has a silent-override bug the plan does not address. `createTask(body, boardId?)` (`tasks.ts:77-82`) does `JSON.stringify(boardId ? { ...body, board_id: boardId } : body)` — the explicit second `boardId` argument is spread *after* `...body`, so it always wins over any `board_id` set inside `body`. `TaskDetailPage.tsx:76` currently calls `createTask(data as CreateTaskBody, activeBoard?.id)`. Unless this call site changes to stop passing `activeBoard?.id` (or passes the form's selected board instead), a user's board-dropdown selection on **Create** will be silently overwritten by whatever `activeBoard` happens to be, defeating the entire feature for new tasks. The plan's `TaskDetailPage.tsx` bullet only mentions passing `boards` and an initial-board hint down to `TaskForm` — it never mentions changing this `createTask()` call. Notably, the companion mobile plan explicitly identifies and fixes this exact issue ("`createTask(body, boardId)` ... passes the picker's selection instead of always `activeBoard?.id`") — the web plan has no equivalent line.
3. **[Gap]** For the **update** path, `updateTask(id: string, body: UpdateTaskBody)` (`tasks.ts:84-89`) has no second `boardId` parameter at all and just `JSON.stringify(body)`s whatever it's given — so unlike the create-path override bug, once `UpdateTaskBody` gains `board_id` and `TaskForm` sets it on `data`, no further call-site change is needed for edits. This narrows the fix needed for Edit to just the type addition (see Issue 1), but the plan should still say so explicitly rather than asserting (incorrectly) that no work is needed here at all.

### Unverified assumptions

- **Confirmed accurate**: `Board` (`frontend/src/api/boards.ts:3-11`) does have `is_default: boolean`, so the FAB's `boards.find(b => b.is_default)` default-board lookup described in Requirement 10 is implementable exactly as written.
- **Confirmed accurate**: `BoardContext.tsx` exposes `boards: Board[]` (confirmed field in `BoardContextValue`, `BoardContext.tsx:6`) alongside `activeBoard`, so `TaskDetailPage.tsx` passing `boards` down to `<TaskForm />` (as the plan describes) is straightforward with no additional context plumbing needed.
- **Confirmed accurate (first-pass fixes hold)**: `TasksPage.tsx` and `TaskDetailPage.tsx` are both still in their pre-redesign state (2-way `viewMode`, `activeBoard?.id`-scoped HP-warning fetch at `TaskDetailPage.tsx:40`, `createTask(data as CreateTaskBody, activeBoard?.id)` at line 76) — i.e. exactly the "before" state the plan's Requirement 9/10 and Issue-2 fix describe, confirming those parts of the plan are still applicable and not already superseded by other changes.
- Not independently re-verified in this pass (already covered adequately by the first-pass review and not affected by the board-move addition): the deploy-trigger/`[skip deploy]` mechanics, and the day-view date-filtering semantics from the companion backend plan.

### Suggestions

- Add `frontend/src/api/tasks.ts` to Files to Modify, with the specific change: add `board_id?: string` to both `CreateTaskBody` and `UpdateTaskBody`.
- Add an explicit fix for `TaskDetailPage.tsx:76`'s `createTask(data as CreateTaskBody, activeBoard?.id)` call — e.g. change the second argument to the form's selected board id (or drop it entirely and rely solely on `data.board_id` once TaskForm always sets it), mirroring the mobile plan's equivalent fix.
- Once these are fixed, add a Vitest case (or extend an existing one) asserting that `createTask`/`updateTask` actually serialize the caller-supplied `board_id` and that the explicit second argument doesn't clobber a `body.board_id` that differs from `activeBoard?.id` — this is precisely the kind of wiring bug that's easy to reintroduce silently.

— *Sneezy*

---

## Grumpy's Response to Second Review

Both blockers and the gap addressed inline: `src/api/tasks.ts` added to Files to Modify (`board_id?: string` on both body types); `TaskDetailPage.tsx:76`'s `createTask(data as CreateTaskBody, activeBoard?.id)` call fixed to drop the overriding second argument and rely on `data.board_id`; the update path's gap closed by stating explicitly that no call-site change is needed there, only the type addition. A new Vitest case covering this wiring is added to the Test Plan. Verdict was "Changes required" — both blockers are now resolved; implementation proceeds on this updated plan.
