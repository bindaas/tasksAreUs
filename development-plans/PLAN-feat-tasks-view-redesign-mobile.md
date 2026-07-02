# PLAN: feat-tasks-view-redesign-mobile — Four-view Tasks screen, drop Chat UI, drop Show completed

## Overview

This is PR 3 of a 3-PR epic (backend → web → **mobile**). Depends on `feat-tasks-day-view-backend` (PLAN-feat-tasks-day-view-backend.md) being merged and deployed first — the new Today/Tomorrow views call `GET /day-view/tasks`, which does not exist until that PR ships. Independent of the web PR (both depend only on backend).

Mirrors the web redesign on mobile: four views (Focused, Today, Tomorrow, All — default Focused), drops the Chat tab's UI, drops the "Show completed" toggle, replaces the board-switcher dropdown with board tabs (shown only under All), and replaces the board-name header with "Tasks Are Us - `<View>`" / "Tasks Are Us - `<Board>`".

## Requirements (from user Q&A this session, mobile-specific answer)

Mobile has no literal "tasksAreUs" text anywhere except `LoginScreen.tsx` (out of scope — login is unaffected). The user confirmed mobile should **mirror web exactly**: the Tasks screen's current board-name-with-dropdown header (`activeBoard?.name ?? 'Tasks'` + `▾`) is replaced by "Tasks Are Us - `<View/Board>`", and board switching moves into tabs shown only under the All view — the dropdown arrow and its panel are removed entirely.

Other requirements mirror the web plan 1:1 (see `PLAN-feat-tasks-view-redesign-web.md` for full rationale): Show-completed removed with no replacement view; Chat UI fully deleted (backend untouched); Today/Tomorrow are all-priority/all-board/single-day; view order Focused → Today → Tomorrow → All, default Focused; board tabs only under All, driving the same shared `BoardContext`.

**New task board default + board picker (added after first Sneezy pass, resolves Sneezy issue #4)**: creating a task while `viewMode` is Focused/Today/Tomorrow (no board tabs visible) defaults to the user's default (starred) board — user-confirmed decision, mirrors web. Creating from All defaults to the currently selected board tab (`activeBoard`), same as today. Both the Create and Edit task forms (`TaskFormScreen.tsx`, one screen handles both per `isEditMode`) gain a board picker letting the user override that default on create, or move an existing task to a different board on edit — mirrors the web plan's `TaskForm.tsx` change exactly, including the "moving boards clears labels" server-side behavior and the inline warning note.

## State persistence note (mobile-specific)

Unlike web, mobile's task edit flow (`TaskFormScreen`) is already rendered as a `<Modal>` **inside** `TasksScreen` (see `mobile/src/screens/TasksScreen.tsx` lines 812–824) — it is not a separate route/screen. `TasksScreen` never unmounts during an edit, so as long as `viewMode`/board selection live in `TasksScreen`'s own component state (as `viewMode` already does today), "return to the same view/board after editing" is satisfied by construction — no URL-equivalent persistence mechanism is needed on mobile. This just needs verifying, not building.

## Data / API Changes

None — this PR is presentation-only. Consumes the existing `GET /focused-view/tasks` and the new `GET /day-view/tasks` (from the backend PR).

## Files to Modify

**Removed**
- `src/screens/ChatScreen.tsx` (deleted)
- `src/api/conversations.ts` (deleted)
- `src/utils/chatUtils.ts` (deleted)
- `src/__tests__/chatUtils.test.ts` (deleted — tests a file that no longer exists)

**Navigation**
- `src/navigation/AppNavigator.tsx` — remove the `Chat` `Tab.Screen`, its `ChatScreen` import, and `Chat` from `RootTabParamList`

**Settings**
- `src/screens/SettingsScreen.tsx` — remove the Focused View config editor section (mobile equivalent of `FocusedViewConfigEditor`) and its config fetch/state, mirroring the web Settings change. Backend config endpoints stay live but unused by any client after this PR.
- `src/api/focusedView.ts` — delete `getFocusedViewConfig`/`updateFocusedViewConfig` (dead code once the Settings section is gone); keep `getFocusedViewTasks`
- `src/__tests__/focusedView.api.test.ts` — **fix per Sneezy blocker #1**: the file imports `getFocusedViewConfig`/`updateFocusedViewConfig` at the top (line 6) and has dedicated `describe('getFocusedViewConfig', ...)` (lines 22-36) and `describe('updateFocusedViewConfig', ...)` (lines 38-66) blocks — 4 of 7 tests. Deleting those exports without touching this file breaks the import and fails all 7 tests, not just the 4 that reference them. This PR removes the import and both `describe` blocks from the file, keeping only the `getFocusedViewTasks` coverage (and the new `getDayViewTasks` test, below). This is a mobile unit test file (`mobile/src/__tests__/`), not the protected `backend/tests/test_api.py` — Grumpy edits it directly.

**Tasks screen — the bulk of the change**
- `src/screens/TasksScreen.tsx`:
  - Remove `showDone`/`showDoneRef` state, the "Show completed" `Switch` in the filter panel, and the `toggleShowDone`/related branches in `clearFilters`/`hasActiveFilters`
  - Replace `viewMode: 'detailed' | 'focused'` with `viewMode: 'focused' | 'today' | 'tomorrow' | 'all'`, default `'focused'`; the existing 2-way pill (`detailed`/`focused` → labeled "All"/"Focus") becomes a 4-way pill (Focused/Today/Tomorrow/All)
  - Remove the board-switcher dropdown: `boardSwitcherOpen` state, the `▾` arrow, and the dropdown `View` block (lines ~726–751)
  - New board tabs row: rendered only when `viewMode === 'all'`, placed below the view pill; tapping a tab calls `setActiveBoard(board)` (existing `useBoard()` context, unchanged)
  - Header `Text` changes from `activeBoard?.name ?? 'Tasks'` to `Tasks Are Us - {viewLabel}` (focused/today/tomorrow) or `Tasks Are Us - {activeBoard?.name}` (all)
  - `viewMode === 'all'` renders the existing `SectionList` unchanged (was `'detailed'`)
  - `viewMode === 'focused'` renders `<FocusedView key={focusedViewKey} onEditPress={handleEditPress} />` unchanged
  - New: `viewMode === 'today'` / `'tomorrow'` render a new shared `<DayView referenceDate={...} onEditPress={handleEditPress} />` component; extend the existing `useFocusEffect`'s `focusedViewKey` remount-bump to also force-refresh Today/Tomorrow on tab re-focus (same reasoning as the existing comment: "Settings changes should be reflected without needing a manual Retry" — applies equally to board-tab changes)
  - **Fix per Sneezy risk #2**: `TasksScreen.tsx:832`'s `<View ... style={{ display: viewMode === 'focused' ? 'none' : 'flex' }}>` (wrapping the `SectionList`) must change to `display: viewMode === 'all' ? 'flex' : 'none'` — otherwise the full pending-tasks `SectionList` renders simultaneously underneath `DayView` whenever `viewMode` is `'today'`/`'tomorrow'`, producing duplicate/overlapping task lists.
  - **Fix per Sneezy gap #3**: two other conditionals are keyed on the literal `'detailed'` string and are easy to miss since they're not near the main view-rendering block — `TasksScreen.tsx:666` (Expand/Collapse button, `{viewMode === 'detailed' && (...)}`) and `TasksScreen.tsx:704` (filter `☰` button, same pattern). Both must change to `viewMode === 'all'` or Expand/Collapse and the filter icon silently disappear once the literal string is renamed.
  - Full inventory of every `viewMode === 'detailed'` / `'focused'` comparison site to update (per Sneezy suggestion, so none are missed during implementation): lines 666, 704, 827 (approx. — the pill-toggle labels/array), 832, plus wherever `viewMode` is initialized/typed.
- New: `src/components/BoardTabs.tsx` — RN tab-button row, styled consistently with the existing view pill; reads `boards`/`activeBoard` from `useBoard()`
- New: `src/components/DayView.tsx` — fetches `GET /day-view/tasks?reference_date=`, renders the same board-grouped card layout as `FocusedView.tsx`
- **Extract shared rendering**: `src/components/FocusedView.tsx`'s board-grouping/card-list JSX (lines ~73–96) factored into a new `src/components/BoardGroupedTasks.tsx` (`{ boards, onEditPress }` props); `FocusedView.tsx` becomes fetch-then-render via the shared component, `DayView.tsx` does the analogous fetch-from-day-view-then-render. Same 2×-reuse justification as the web plan.
- New: `src/api/dayView.ts` — `getDayViewTasks(referenceDate: string): Promise<{ boards: FocusedBoard[] }>`, mirrors `getFocusedViewTasks`

**Board picker on Create/Edit (fix per Sneezy risk #4)**
- `src/screens/TaskFormScreen.tsx` — gains a board picker (create and edit share this one screen via `isEditMode`). Create: defaults to the user's default board when opened from Focused/Today/Tomorrow, or `activeBoard` when opened from All (mirrors `TasksScreen`'s FAB/+ button context, passed in as a prop). Edit: defaults to the task's current `board_id`. `createTask(body, boardId)` (line ~177) passes the picker's selection instead of always `activeBoard?.id`; sent when the picker's selection differs from the task's current board. Shows the same inline "moving to a different board will clear this task's labels" note as web when the selection changes on edit.
- **`src/types/index.ts`** (added per Sneezy second-pass nit #1) — `UpdateTaskBody` is defined here (lines 52-62), not in `api/tasks.ts` (which only imports the type). Gains `board_id?: string`. No further call-site change needed for the update path: `updateTask(id, body)` (`api/tasks.ts:23-28`) has no second `boardId` argument to worry about overriding, unlike `createTask` — once the type carries the field and the screen sets it, it flows straight through `JSON.stringify(body)`.

## Test Plan

- `src/__tests__/`: `boards.api.test.ts` is unaffected and should still pass. `focusedView.api.test.ts` **is affected** (corrected per Sneezy blocker #1) — its `getFocusedViewConfig`/`updateFocusedViewConfig` import and both corresponding `describe` blocks are removed, leaving only `getFocusedViewTasks` coverage; delete `chatUtils.test.ts` alongside `chatUtils.ts`; add a thin test for `getDayViewTasks` (mirrors `focusedView.api.test.ts`'s remaining pattern) if that file asserts request shape rather than live network calls
- Manual verification on a simulator/device (per project UI-change convention — this touches gesture-heavy drag/drop code paths indirectly via `TasksScreen`, so a real run-through matters):
  - Default view on load is Focused; header reads "Tasks Are Us - Focused"
  - Today/Tomorrow show all-priority tasks due that day across all boards; All shows the existing section list unchanged
  - Board tabs appear only under All; switching a tab updates the section list and Settings' Labels scope
  - Editing a task (via the Modal) from any view/board and saving/canceling/deleting/completing returns to that same view/board — confirms the "no URL, but screen never unmounts" reasoning holds in practice
  - Board-switcher dropdown arrow is gone from the header; Chat tab is gone from the bottom tab bar
  - "Show completed" switch is gone from the filter panel; completing a task removes it from view with no way to see it again in this session
  - Today/Tomorrow do not show the pending-tasks section list bleeding through underneath them (Sneezy risk #2 regression check)
  - Expand/Collapse and the filter (☰) icon still appear correctly under the All view (Sneezy gap #3 regression check)
  - Creating a task from Focused/Today/Tomorrow defaults to the default board; creating from All defaults to the selected board tab; the picker allows overriding either
  - Editing a task and changing its board picker selection moves the task and clears its labels; the inline warning appears before saving
- `backend/tests/test_api.py` — unaffected (no backend changes in this PR)

## Deployment Order

1. Requires `feat-tasks-day-view-backend` merged **and deployed to Railway** first.
2. Mobile update type: **OTA** (`eas update`) — all changes are JS/TS only; no native modules, `app.json`, or `eas.json` changes.
3. Independent of the web PR — can ship before or after it, since mobile and web are separate release channels and neither depends on the other, only on the backend PR.

## PR Structure

Single PR, mobile only.

---

## Sneezy's Review — 2026-07-02

**Verdict:** Changes required

### Issues

1. **[Blocker]** The Test Plan states "existing `boards.api.test.ts` and `focusedView.api.test.ts` are unaffected and should still pass," but Files to Modify explicitly proposes deleting `getFocusedViewConfig`/`updateFocusedViewConfig` from `src/api/focusedView.ts`. Confirmed: `mobile/src/__tests__/focusedView.api.test.ts:6` imports exactly those two functions (`import { getFocusedViewConfig, updateFocusedViewConfig, getFocusedViewTasks } from '../api/focusedView';`) and has dedicated `describe('getFocusedViewConfig', ...)` (lines 22-36) and `describe('updateFocusedViewConfig', ...)` (lines 38-66) blocks exercising them — 4 of the file's 7 tests. Deleting those exports breaks the top-of-file import, which fails the **entire test file** (all 7 tests), not just the 4 that reference them directly. This directly contradicts the plan's own Test Plan claim and must be resolved — either the exports stay (contradicting "delete... dead code once the Settings section is gone") or the plan needs to explicitly delete/rewrite the corresponding `describe` blocks in the test file alongside the API module change.
2. **[Risk]** `TasksScreen.tsx:832` — `<View ref={listContainerRef} style={{ flex: 1, display: viewMode === 'focused' ? 'none' : 'flex' }}>` wraps the `SectionList`. This conditional today only hides the section list for `'focused'` mode. The plan's Files to Modify section never mentions this specific line, but once `viewMode` gains `'today'`/`'tomorrow'` values, this gate must also change (e.g. hide for any of `'focused' | 'today' | 'tomorrow'`, show only for `'all'`) or the full pending-tasks `SectionList` will render simultaneously underneath the new `DayView` component whenever `viewMode` is `'today'`/`'tomorrow'`, producing overlapping/duplicate task lists on screen. This is a concrete, verifiable omission.
3. **[Gap]** Similarly, `TasksScreen.tsx:666` (`{viewMode === 'detailed' && (...Expand/Collapse button...)}`) and `TasksScreen.tsx:704` (`{viewMode === 'detailed' && (...filter ☰ button...)}`) are both keyed on the literal `'detailed'` value. The plan describes the pill toggle becoming 4-way and `viewMode === 'all'` rendering the SectionList "unchanged (was `'detailed'`)," but doesn't explicitly call out that these two other `'detailed'`-keyed conditionals also need updating to `'all'` — otherwise Expand/Collapse and the filter icon silently disappear for the renamed All view once the literal string changes.
4. **[Risk]** Same root cause as the companion web plan's board-tab regression: removing the board-switcher dropdown (`TasksScreen.tsx:726-751`, confirmed exact line range) and moving board switching to tabs shown only under `'all'` removes any way to pick a target board while creating a task from Focused/Today/Tomorrow. Confirmed `TaskFormScreen.tsx:177` calls `createTask(body, activeBoard?.id)`, so the same "silently creates into a stale/arbitrary board" regression applies on mobile. Not addressed in the plan.
5. **[Nit]** The State persistence note's core claim is verified accurate and does not need changes: `viewMode` is local `useState` in `TasksScreen.tsx:272`, and the edit form is rendered as a `<Modal>` child of `TasksScreen` (`TasksScreen.tsx:812-824`, confirmed exact line range) rather than a separate navigator route, so `TasksScreen` never unmounts during an edit. `activeBoard` similarly survives because it lives in `BoardContext`, mounted above the tab navigator in `AppNavigator.tsx:83`. This part of the plan is sound — no persistence bug found.

### Unverified assumptions

- "Mobile has no literal 'tasksAreUs' text anywhere except `LoginScreen.tsx`" — not independently verified in this review (`LoginScreen.tsx` was not read). Plausible given the header pattern confirmed at `TasksScreen.tsx:658-663` (`activeBoard?.name ?? 'Tasks'`), but should be grepped before implementation to be certain no other screen has hardcoded branding.
- `FocusedTaskCard`'s "★ High" badge (`mobile/src/components/FocusedTaskCard.tsx:38-42`) is driven purely by `task.is_high_priority`, independent of which view renders it — confirmed this is **not** a gotcha for Today/Tomorrow's mixed-priority task lists; the badge correctly shows/hides per task regardless of view. The audit concern flagged for this review does not surface an actual bug here.
- OTA-only deployment claim ("no native modules, `app.json`, or `eas.json` changes") — plausible given the described changes are all JS/TS (new components, screen edits, one new API module), but `eas.json`/`app.json` contents were not read in this review to independently confirm.

### Suggestions

- Since Today/Tomorrow will show mixed-priority tasks with no priority-based sort (the backend's `get_day_view_tasks`, per the companion backend plan, orders by `updated_at DESC` same as Focused View), consider whether high-priority tasks should sort first so the "★ High" badge doesn't get visually buried in a longer list. Same suggestion applies to the web plan.
- Add an explicit inventory of every `viewMode === 'detailed'` / `viewMode === 'focused'` literal-string comparison site in `TasksScreen.tsx` to the plan's Files to Modify bullet — there are at least four (lines 666, 704, 827, 832, plus the pill-toggle array itself) — so the refactor doesn't miss one during implementation.
- Cross-reference only, no action needed here: if the backend PR's day-view semantics end up meaning "OR across `must_do_by`/`target_date`" rather than a true "effective date" (see the backend plan's Sneezy review), no mobile code changes are required either way since this plan only consumes the endpoint's contract.

— *Sneezy*

---

## Grumpy's Response to Sneezy's Review

| Sneezy item | Status |
|---|---|
| Blocker 1 (`focusedView.api.test.ts` breaks) | Addressed — plan now explicitly removes the affected import and both `describe` blocks from the test file alongside the API module change |
| Risk 2 (`SectionList` display toggle not updated for new viewMode values) | Addressed — explicit fix specified for `TasksScreen.tsx:832` |
| Gap 3 (`'detailed'`-keyed conditionals at lines 666, 704 missed) | Addressed — both called out explicitly, plus a full inventory of every `viewMode` comparison site to update |
| Risk 4 (no board picker outside All) | Addressed — new board picker on `TaskFormScreen.tsx` (create + edit), mirroring the web plan, with the same default-board-outside-All rule (user-confirmed) |
| Nit 5 (state persistence reasoning) | No change needed — confirmed sound by Sneezy |

Implementation proceeds on this updated plan.

---

## Sneezy's Second Review — Move Task Between Boards — 2026-07-02

**Verdict:** Approved with concerns

### Issues

1. **[Nit]** `UpdateTaskBody` is defined in `mobile/src/types/index.ts:52-62`, not in `mobile/src/api/tasks.ts` (which just imports the type — confirmed `mobile/src/api/tasks.ts:2`: `import type { Task, CreateTaskBody, UpdateTaskBody, ... } from '../types';`). The plan's "Board picker on Create/Edit" bullet says `UpdateTaskBody` "gains `board_id?: string`" but doesn't name `mobile/src/types/index.ts` as a file to modify anywhere in Files to Modify — only `TaskFormScreen.tsx` is listed there. Low severity because `updateTask(id, body)` (`mobile/src/api/tasks.ts:23-28`) just does `JSON.stringify(body)` with no second `boardId` argument to worry about overriding (unlike the web plan's analogous `createTask` call, which has a real override bug — see the web plan's second-pass review) — so once the type gains the field and `TaskFormScreen` sets it on `body`, no further code change is required. Still worth naming the file explicitly so it isn't missed during implementation.

### Unverified assumptions

- **Confirmed correct — this is the one place mobile's plan does something the web plan's equivalent section fails to do**: the plan's stated fix, "`createTask(body, boardId)` (line ~177) passes the picker's selection instead of always `activeBoard?.id`," is necessary and sufficient. Confirmed by reading `TaskFormScreen.tsx:177` in full: `await createTask(body, activeBoard?.id);` in the current (pre-implementation) source. `createTask(body, boardId?)` (`mobile/src/api/tasks.ts:16-21`) does `JSON.stringify(boardId ? { ...body, board_id: boardId } : body)` — the explicit second argument overrides anything in `body`, exactly as on web — so if this call site isn't changed to pass the picker's selection instead of `activeBoard?.id`, the create-board-picker feature would be silently defeated the same way the web plan's Create path currently is. The mobile plan correctly anticipates and fixes this; it is called out explicitly rather than left implicit.
- **Confirmed accurate (first-pass fix holds)**: the `focusedView.api.test.ts` fix is coherent against the actual file. Read in full: the import at line 6 (`import { getFocusedViewConfig, updateFocusedViewConfig, getFocusedViewTasks } from '../api/focusedView';`), `describe('getFocusedViewConfig', ...)` at lines 22-36, and `describe('updateFocusedViewConfig', ...)` at lines 38-66 are exactly as the plan describes. Removing the two named exports from the import and deleting both `describe` blocks leaves a syntactically complete file with only the `describe('getFocusedViewTasks', ...)` block (lines 68-93) remaining — no dangling references.
- **Confirmed accurate**: `Board` (`mobile/src/types/index.ts:1-9`) has `is_default: boolean`, so the mobile default-board lookup for the FAB (mirroring web's `boards.find(b => b.is_default)`) is implementable as described, with `boards` available from `useBoard()` per `BoardContext.tsx` (per `ARCHITECTURE.MD`'s description of the mobile `BoardContext`).
- Not independently re-verified in this pass (unaffected by the board-move addition and already covered by the first-pass review): the exact line numbers for the board-switcher dropdown removal (`TasksScreen.tsx:726-751`) and the `'detailed'`/`'focused'` literal-comparison sites (lines 666, 704, 832) — these were already confirmed accurate in Sneezy's first-pass review and this plan's implementation has not started, so there is no reason to expect drift, but this second pass did not re-read `TasksScreen.tsx` end-to-end to reconfirm.

### Suggestions

- Add `mobile/src/types/index.ts` explicitly to the "Board picker on Create/Edit" Files-to-Modify bullet, alongside `TaskFormScreen.tsx`.
- Since the create-path override bug is real on web but correctly avoided here, consider a short one-line cross-reference in this plan noting *why* mobile's `createTask(body, boardId)` signature makes this safe (explicit second argument) whereas web's does not — useful context for whoever implements both PRs, so the fix isn't accidentally "backported" incorrectly or assumed unnecessary on web.

— *Sneezy*

---

## Grumpy's Response to Second Review

Addressed: `src/types/index.ts` added explicitly to the "Board picker on Create/Edit" Files-to-Modify bullet for the `UpdateTaskBody.board_id` addition. Cross-reference note: unlike web's `createTask(data as CreateTaskBody, activeBoard?.id)` (fixed in the web plan to drop the second argument), mobile's `TaskFormScreen.tsx:177` call is fixed by *changing* the second argument to the picker's selection rather than dropping it — mobile's `createTask(body, boardId)` requires a `boardId`, so the fix there is "pass the right one," not "stop passing one." Verdict was "Approved with concerns" — implementation proceeds on this updated plan.
