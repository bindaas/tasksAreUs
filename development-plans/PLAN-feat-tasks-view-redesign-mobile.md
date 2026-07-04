# PLAN: feat-tasks-view-redesign-mobile — Four-view Tasks screen, drop Chat UI, drop Show completed

## Overview

This is PR 3 of a 3-PR epic (backend → web → **mobile**). Depends on `feat-tasks-day-view-backend` (PLAN-feat-tasks-day-view-backend.md) being merged and deployed first — the new Today/Tomorrow views call `GET /day-view/tasks`, which does not exist until that PR ships. Independent of the web PR (both depend only on backend).

Mirrors the web redesign on mobile: four views (Focused, Today, Tomorrow, All — default Focused), drops the Chat tab's UI, drops the "Show completed" toggle, replaces the board-switcher dropdown with board tabs (shown only under All), and replaces the board-name header with "Tasks Are Us - `<View>`" / "Tasks Are Us - `<Board>`".

**Scope update (2026-07-03):** web shipped a follow-on PR (#42, "editable task details in all views, sticky nav state, board-neutral settings") on top of the redesign this plan already covers. Since mobile's PR 3/3 hasn't started implementation, PR #42's mobile equivalent is folded into this same plan rather than left for a separate follow-up — see the new "Mobile Equivalent of Web PR #42" section below, added after the original Files to Modify/Test Plan content.

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
- **Extract shared rendering**: `src/components/FocusedView.tsx`'s board-grouping/card-list JSX (lines ~73–96) factored into a new `src/components/BoardGroupedTasks.tsx` (`{ boards, onEditPress, onRefresh }` props — **`onRefresh` added per Sneezy's 2026-07-04 second-pass review**, reconciling this bullet with the "Mobile Equivalent of Web PR #42" section's inline-quick-edit work below, which requires the same component to thread `onRefresh` through to each `FocusedTaskCard`); `FocusedView.tsx` becomes fetch-then-render via the shared component, `DayView.tsx` does the analogous fetch-from-day-view-then-render. Same 2×-reuse justification as the web plan.
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

## Mobile Equivalent of Web PR #42 (added 2026-07-03)

Web PR #42 shipped web-only. This section captures the mobile equivalent of each of its changes, folded into this plan since mobile PR 3/3 hasn't started implementation yet.

### Inline quick-edit on Focused/Today/Tomorrow

Web extracted its existing All-view inline editor (`TaskCard.tsx`) into a shared `TaskQuickEdit` component and reused it on `FocusedTaskCard.tsx` (Focused/Today/Tomorrow). Mobile has no inline editor anywhere yet — `DraggableTaskRow`'s edit button (`TasksScreen.tsx:853`, `onEditPress={handleEditPress}`) opens the full `TaskFormScreen` modal, and mobile's `FocusedTaskCard.tsx` currently has no edit affordance at all.

**Scope decision (unconfirmed — asked the user, no response received, proceeding with the recommended default): add inline quick-edit to Focused/Today/Tomorrow only**, mirroring exactly what PR #42 changed on web. All view keeps its existing modal-based edit — that web/mobile divergence predates PR #42 and isn't its job to fix. Revisit if full parity across all four views is wanted instead.

- New: `src/components/TaskQuickEdit.tsx` — RN port of the web component: title `TextInput`, mode/type label toggle chips (reuses this plan's existing `labelsByCategory` grouping pattern), Save/Cancel row calling `updateTask(task.id, { title, label_ids })`. Accepts an optional `labels` prop (board-scoped labels already on hand); when omitted, fetches via `listLabels(undefined, task.board_id)` — needed because `FocusedTaskCard`/`DayView` group tasks across boards and don't hold one board-scoped label list.
- `src/components/FocusedTaskCard.tsx` — add `isEditing` state and a pencil-icon button; swap the card body for `<TaskQuickEdit>` when editing. Gains an `onRefresh: () => void` prop so `FocusedView.tsx`/`DayView.tsx` can pass their existing refetch callback through (both already refetch after other mutations — this is prop-threading, not new fetch logic). Tap-to-open-detail must be suppressed while `isEditing` (mirrors web's `onClick={() => { if (!isEditing) navigate(...) }}` — RN equivalent: guard the row's `onPress`).
- `src/components/BoardGroupedTasks.tsx` (new, per this plan's existing "Extract shared rendering" bullet) — thread `onRefresh` down to each `FocusedTaskCard`.

### Sticky view/board state across tabs

Web PR #42 added `ViewContext` + URL-param sync so the selected view/board survives navigating to Reports/Settings/Task Detail and back — needed because React Router unmounts route components on navigation. **Mobile needs no equivalent change.** `AppNavigator.tsx`'s `Tab.Navigator` (bottom tabs) does not unmount inactive tab screens by default, so `TasksScreen`'s local `viewMode`/`activeBoard` (from `BoardContext`, mounted above the tab navigator per this plan's existing State Persistence note) already survive switching to Reports/Settings and back — same reasoning as the existing note about the edit Modal, extended to tab navigation. No code changes needed; add a verification bullet to the Test Plan.

### Board-scoped Settings Labels picker

Web replaced Settings' implicit `activeBoard`-driven Labels section with a local `labelsBoardId` dropdown, decoupled from the app-wide active board (self-heals to `activeBoard ?? boards[0]` if the previously-selected board is deleted or otherwise no longer present). Mobile's `SettingsScreen.tsx` currently drives its Labels section directly off `activeBoard` (`SettingsScreen.tsx:613, 665-666, 682`) — the same pre-PR42 pattern web had.

- `src/screens/SettingsScreen.tsx`:
  - Add local `labelsBoardId` state, self-healing whenever it's `undefined` or no longer present in `boards` (set to `activeBoard?.id ?? boards[0].id`) — same self-heal condition as the web fix
  - Replace the three `activeBoard?.id` reads (labels fetch ×2, `createLabel`) with `labelsBoardId`
  - **Fix per Sneezy's 2026-07-04 second-pass risk #2**: the labels-fetching `useEffect` (lines 658–679) is keyed on `[activeBoard?.id]` (line 679). This dependency array must change to `[labelsBoardId]` (or the effect otherwise restructured to key off `labelsBoardId` independently of the settings fetch) — otherwise selecting a different board in the new Labels picker sets `labelsBoardId` without ever re-triggering the fetch, so the Mode/Type lists shown would stay pinned to whatever board was active on last mount/`activeBoard` change. The picker would appear to do nothing.
  - Add a board picker for the Labels section, shown only when `boards.length > 1` (matches web). RN has no native `<select>` — reuse this codebase's existing open/close panel-of-buttons pattern already used for the board-switcher dropdown being removed from `TasksScreen.tsx:726-751`, rather than introducing a new picker paradigm.

### TaskForm cleanup

Web reordered `TaskForm.tsx` (Notes → Links → Dates → ... → Labels, dropping a duplicate labels-summary block) and enlarged the Notes textarea (`rows={3}` → `rows={7}`). Mobile's `TaskFormScreen.tsx` has no duplicate-labels-summary to remove (never had one), but needs the same reordering and Notes sizing:

- `src/screens/TaskFormScreen.tsx`:
  - Move the "Links" block (currently after Labels, `TaskFormScreen.tsx:420-466` — corrected per Sneezy's 2026-07-04 second-pass nit #3, was cited as 420-458 which clips mid-way through the remove-button `TouchableOpacity`) to directly follow the "Notes" block (currently `TaskFormScreen.tsx:264-277`, corrected from 263-275), before the "Dates" row
  - Notes `TextInput`: `numberOfLines={3}` → `numberOfLines={6}`, `minHeight: 80` → `minHeight: 160` (proportional to web's `rows={3}`→`rows={7}`)

### Not ported

- Web's board-tabs right-alignment (`BoardTabs.tsx`, CSS-only `justify-end`) — cosmetic, no RN layout equivalent called for. Mobile's new `BoardTabs.tsx` (per this plan's existing Files to Modify) can use whatever alignment fits the RN layout.

### Test Plan additions

- Tapping the pencil icon on a Focused/Today/Tomorrow card opens inline quick-edit; Save persists title/label changes and refreshes the list; Cancel discards; tapping elsewhere on the card while editing does not navigate away
- Switching to the Reports or Settings tab and back to Tasks preserves the previously selected view and board (sticky-nav regression check, extending this plan's existing Modal-based check to tab navigation)
- Settings' Labels board picker only appears with 2+ boards; changing it does not change the app-wide active board (Tasks screen's board tabs stay unaffected); deleting the board currently selected in the picker falls back to the default/first board without erroring
- Changing the Labels board picker's selection actually re-fetches and displays the newly-selected board's Mode/Type label lists (added per Sneezy's 2026-07-04 second-pass gap #4 — regression check for the `useEffect` dependency-array fix above)
- Notes field is visibly taller (6 lines) and Links appears directly below Notes, above Must-do-by/Target date

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

---

## Folding in PR #45 (web notes bug + card parity) — added 2026-07-04

Web PR #45 (`PLAN-fix-focused-card-parity-and-notes-bug.md`, merged) fixed two web-only bugs: a notes-persistence bug in `TaskForm.tsx`, and a Links/Complete/Delete parity gap between `TaskCard.tsx` (All view) and `FocusedTaskCard.tsx` (Focused/Today/Tomorrow). That plan's "Mobile follow-up" section originally claimed mobile was unaffected because "`FocusedTaskCard.tsx` doesn't exist yet" — **this was wrong**, caught by Dopey's code review of PR #45. `mobile/src/components/FocusedTaskCard.tsx` already shipped via `PLAN-feat-focused-view-mobile.md`, with the identical parity gap, and `mobile/src/screens/TaskFormScreen.tsx` has the identical notes bug. Both are real, currently-shipped issues on mobile, folded into this plan since it hasn't started implementation and already touches both files.

### Notes bug (mirrors web's fix exactly)

`mobile/src/screens/TaskFormScreen.tsx:165` (edit path) and `:174` (create path) both read:
```ts
if (notes.trim()) body.notes = notes.trim();
```
Same bug as web's pre-fix `TaskForm.tsx:157`: clearing the Notes field to empty omits the key from the body entirely, and `updateTask`/`createTask` (`mobile/src/api/tasks.ts`) leave the server-side value untouched when the field is absent — the save appears to succeed but the notes change is silently dropped.

**Fix**: remove both conditionals; always set `body.notes = notes.trim();` in both branches. This is on top of whatever board-picker changes this plan already makes to the same `handleSubmit`-equivalent function (`TaskFormScreen.tsx`'s save handler, per the "Board picker on Create/Edit" section above) — same file, same function, no conflict.

### FocusedTaskCard.tsx parity (folds into the existing "Inline quick-edit" work)

This plan's "Mobile Equivalent of Web PR #42" section already adds a pencil-icon Edit affordance to `FocusedTaskCard.tsx` (via `TaskQuickEdit.tsx`, mobile's port of web's inline editor) — mobile's `FocusedTaskCard.tsx` currently has no Edit, Links, Complete, or Delete at all (confirmed by reading the current file in full: it renders only the priority badge, title, effective date, and labels). Web's `TaskCard.tsx`/`FocusedTaskCard.tsx` gap was Links/Complete/Delete only, since web already had Edit; mobile is starting from zero on all four, so this plan's existing Edit work and this fold-in's Links/Complete/Delete work land together as one coherent change to the same file.

- `src/components/FocusedTaskCard.tsx` — in addition to the pencil/`TaskQuickEdit` swap already planned:
  - Add a Links section, same rendering as mobile's existing All-view row (`TasksScreen.tsx`'s `TaskRow`, lines 116–131: `task.links.length > 0` → mapped list, each link openable, tap does not trigger card navigation; lines 132-134 are the sibling wrapper close and the start of the unrelated Complete/Delete button `View` — not part of the Links block)
  - Add Complete and Delete buttons, calling `completeTask`/`deleteTask` (`mobile/src/api/tasks.ts`) then `onRefresh()`, same try/catch/`Alert.alert` error pattern as `TasksScreen.tsx`'s existing `handleComplete`/`handleDeletePress`. **Delete shows the same destructive-confirmation dialog** as `TasksScreen.tsx`'s `handleDeletePress` (lines 405-422, `Alert.alert('Delete task?', ..., [Cancel, Delete])`) before calling the API — not just the error-alert pattern. Tapping Delete on a Focused/Today/Tomorrow card must not delete immediately with no confirmation.
  - Gains `onRefresh: () => void` prop — already planned in this section for the quick-edit wiring, so Complete/Delete reuse the same prop, no new plumbing
  - **Interaction with `isEditing`**: Links/Complete/Delete (and the priority badge) are hidden while the card is in `isEditing`/quick-edit mode, same as the rest of the card body — the entire non-edit body is swapped for `<TaskQuickEdit>`, so there's nothing extra to gate here beyond the swap this plan's "Inline quick-edit" section already specifies.
- **Not attempting a shared-component extraction on mobile** (unlike web's `TaskCardBody.tsx`) — **correction of a factual error caught by Sneezy's 2026-07-04 review**: the original rationale here claimed `DraggableTaskRow` (`TasksScreen.tsx:185-247`) was "tightly coupled to drag-gesture state," making a shared extraction risky. That's wrong — `DraggableTaskRow` is a thin `GestureDetector`/`Animated.View` wrapper with no presentational JSX of its own; all the actual card content (title, priority badge, effective date, labels, links, Complete/Delete) lives in `TaskRow` (`TasksScreen.tsx:71-154`), whose props are `{ task, onComplete, onDeletePress, onEditPress }` — zero drag-related props or state. `TaskRow` itself has no drag coupling to thread no-ops through.
  - The real reason to skip extraction: `TaskRow` and `FocusedTaskCard.tsx` diverge in actual layout/style, not just data — board-color left border strip, priority-badge-as-pill vs. inline star, `isDone` dimming, `LabelBadge`'s `mr-1 mb-1` spacing vs. `FocusedTaskCard`'s `flex-wrap gap-4`. This is the same category of divergence web's `TaskCardBody.tsx` had to parameterize (layout, dateDisplay, priorityBadge, renderLabels) to make a shared component work, not a fundamentally different situation from web's.
  - **Open question (unresolved — needs a decision before/at implementation time)**: Sneezy suggested a narrower shared extraction is available and lower-risk than either full duplication or a whole-card-body component — just the Links row and the Complete/Delete button row are near-identical between `TaskRow` and this section's planned `FocusedTaskCard.tsx` additions (e.g. `TaskLinksRow`, `TaskActionButtons`). This plan currently defaults to direct/duplicated implementation (same choice web made before PR #45), but a narrow extraction of just those two pieces would reduce future drift between the two card types. **Decide at implementation start**: duplicate as currently planned, or extract `TaskLinksRow`/`TaskActionButtons` first and have both `TaskRow` and `FocusedTaskCard.tsx` consume them.

### Files to Modify (additions)

- `src/screens/TaskFormScreen.tsx` — add the notes-bug fix (remove the two `if (notes.trim())` guards) alongside this plan's existing board-picker changes to the same file
- `src/components/FocusedTaskCard.tsx` — add Links/Complete/Delete alongside this plan's existing Edit/`TaskQuickEdit` changes to the same file

### Test Plan additions

- Editing a task's notes to empty on mobile and saving actually clears it (regression check mirroring web's PR #45 test)
- Focused/Today/Tomorrow cards on mobile show Links (tap doesn't navigate to detail) and have working Complete/Delete buttons, matching All view
- Tapping Delete on a Focused/Today/Tomorrow card shows the same confirm dialog as All view before deleting; Cancel leaves the task untouched
- Links/Complete/Delete/priority badge are hidden while a Focused/Today/Tomorrow card is in inline-edit mode, reappearing on Save/Cancel

---

## Sneezy's Review — 2026-07-04

**Tier:** LIGHT — stated reason confirmed: this addition only touches `mobile/src/screens/TaskFormScreen.tsx` and `mobile/src/components/FocusedTaskCard.tsx`, both presentation-only, no model/schema/router/API-contract files, no data-model change, OTA-only deployment (unchanged from the rest of this plan). No escalation trigger found — `completeTask`/`deleteTask`/`updateTask` are consumed as-is with no signature changes, so no wide blast radius either. Scope of this review is limited to the new "Folding in PR #45" section (lines 213–246); the sections above it (including the "Mobile Equivalent of Web PR #42" section) were left untouched per instructions — see note under Unverified assumptions about that section's actual review status.

**Verdict:** Approved with concerns

### Issues

1. **[Gap]** The "Not attempting a shared-component extraction" rationale (lines 235) misattributes the drag-gesture coupling to the wrong component. Confirmed by reading `TasksScreen.tsx` in full: `DraggableTaskRow` (lines 185–247) is a thin gesture wrapper — its own JSX is just a `GestureDetector`/`Animated.View` around `<TaskRow .../>` — while all the actual presentational JSX (title, priority badge, effective date, labels, links, Complete/Delete buttons) lives in `TaskRow` (lines 71–154), whose props are only `{ task, onComplete, onDeletePress, onEditPress }` — **zero drag-related props or state**. So the component that would actually need to be shared with `FocusedTaskCard.tsx` (`TaskRow`'s body) has no drag coupling to thread no-ops through; the plan's stated reason for skipping extraction doesn't hold up on inspection. The conclusion (don't extract) may still be right, but for a different, unstated reason: real layout/style divergence between `TaskRow` and `FocusedTaskCard.tsx` (board-color left border strip, priority-badge-as-pill vs inline star, `isDone` dimming, `LabelBadge`'s `mr-1 mb-1` vs `FocusedTaskCard`'s `flex-wrap gap-4`) — which is a legitimate echo of "web's TaskCardBody... easy to get wrong" concern the plan already cites, just misfiled under the wrong cause.
2. **[Risk]** The Delete button's confirmation behavior is unspecified. `TasksScreen.tsx`'s `handleDeletePress` (lines 405–422) shows a destructive-confirmation `Alert.alert('Delete task?', ...)` with Cancel/Delete before calling `apiDeleteTask`; the plan's bullet only says Complete/Delete should use "the same try/catch/`Alert.alert` error pattern" — which names the *error*-alert convention but doesn't say whether the confirm-before-delete step is also being ported. If it's dropped, tapping Delete on a Focused/Today/Tomorrow card would delete immediately with no confirmation, an accidental/irreversible-data-loss regression relative to every other delete affordance in the app (All view's row, and presumably web's `TaskCard.tsx`).
3. **[Gap]** No stated interaction between this section's Complete/Delete/Links additions and the existing (separately-added, see note below) `isEditing`/`TaskQuickEdit` swap on the same file. Both sections modify the same card body; the plan doesn't say whether Complete/Delete/Links stay visible while a card is in inline-edit mode or are hidden along with the rest of the "swapped" body. Worth an explicit decision since both changes land in the same PR.
4. **[Nit]** The cited Links-block line range ("`TasksScreen.tsx`'s inline task row, ~line 116-134") is slightly off. Confirmed by reading the file: the `task.links.length > 0 && (...)` block is lines 116–131; lines 132–134 close the sibling `flex-1 mr-3` wrapper and open the unrelated Complete/Delete button `View`. Marked "~" so this is minor, but worth tightening since the range currently bleeds into the next section.

### Unverified assumptions

- The section states this fold-in "folds into the existing 'Mobile Equivalent of Web PR #42' work already planned for `FocusedTaskCard.tsx`." That PR #42 section (lines 93–137) is dated "added 2026-07-03," which is *after* both prior Sneezy passes in this file (both dated 2026-07-02) — so, contrary to this review's framing that "the rest of the plan... has already been reviewed twice," that specific section has not itself been through a Sneezy pass yet. Per this review's scope I did not audit it, but flag that its assumptions (the `onRefresh` prop shape, the `onPress` tap-guard while `isEditing`, `TaskQuickEdit`'s label-fetch fallback) are unverified by any review so far, and this new section builds directly on top of them.
- "Web's `TaskCard.tsx`/`FocusedTaskCard.tsx` gap was Links/Complete/Delete only, since web already had Edit" — not independently re-verified against the web repo/plan in this pass (out of scope for this mobile-focused light review); taken on the plan's citation of `PLAN-fix-focused-card-parity-and-notes-bug.md`.
- The claimed "same try/catch/Alert.alert error pattern" is confirmed accurate for the *error-handling* portion of `handleComplete`/`handleDeletePress` (`TasksScreen.tsx:376-384, 405-422`), but as noted in Issue 2, whether the destructive-confirmation dialog is also intended to be ported is not confirmed either way by the plan text.

### Suggestions

- Re-word the "not extracting" rationale to cite the real divergence (left-border board color, badge styling, `isDone` dimming, label-chip spacing) rather than drag-gesture coupling, since `TaskRow` — the component that would actually be shared — carries no drag props.
- Consider a narrower shared extraction than a whole-card-body component: just the Links row and the Complete/Delete button row are near-identical between `TaskRow` and this section's planned `FocusedTaskCard.tsx` additions, and would be a much lower-risk shared piece (e.g. `TaskLinksRow`, `TaskActionButtons`) than either full duplication or a whole-body extraction.
- Add one line to the plan making explicit whether Delete on `FocusedTaskCard.tsx` shows the same confirm dialog as `TasksScreen.tsx`, and add a corresponding Test Plan bullet either way.
- Add one line making explicit whether Complete/Delete/Links are hidden or remain visible while a card is in `isEditing`/quick-edit mode, and a Test Plan bullet for it.

— *Sneezy*

---

## Grumpy's Response to Sneezy's 2026-07-04 Review

| Sneezy item | Status |
|---|---|
| Gap 1 (misattributed drag-gesture rationale) | Addressed — corrected to cite the real `TaskRow`/`FocusedTaskCard.tsx` layout divergence (border strip, badge styling, `isDone` dimming, label-chip spacing); the narrower-extraction alternative Sneezy suggested is recorded as an explicit open question below rather than decided unilaterally |
| Risk 2 (Delete confirmation unspecified) | Addressed — plan now states Delete shows the same `Alert.alert` confirm dialog as `TasksScreen.tsx`'s `handleDeletePress`, plus a Test Plan bullet |
| Gap 3 (Complete/Delete/Links vs. `isEditing`) | Addressed — plan now states these are hidden during inline-edit (whole body swap, same as the rest of the card), plus a Test Plan bullet |
| Nit 4 (Links line-range off by a few lines) | Addressed — corrected to lines 116–131, with the 132-134 boundary explained |

## Open Questions

Carried forward for a decision before or at implementation start — not blocking the PR #45 merge, since none of these affect web or the already-merged PR:

1. **Narrow extraction vs. duplication for mobile's Links/action-button rendering** (see "Not attempting a shared-component extraction on mobile" above): duplicate the Links/Complete/Delete rendering directly in `FocusedTaskCard.tsx` (current default, mirrors web's pre-PR#45 approach), or extract `TaskLinksRow`/`TaskActionButtons` shared by `TaskRow` and `FocusedTaskCard.tsx` first, per Sneezy's suggestion.
2. **Whether the "Mobile Equivalent of Web PR #42" section (lines 93–137, added 2026-07-03) needs its own Sneezy pass.** It has never been reviewed — both prior reviews are dated 2026-07-02 (before that section existed), and the 2026-07-04 review was explicitly scoped to only the "Folding in PR #45" section. This section's assumptions (the `onRefresh` prop shape, the `isEditing` tap-guard, `TaskQuickEdit`'s label-fetch fallback) are what the PR #45 fold-in builds directly on top of.

---

## Sneezy's Review — 2026-07-04 (second pass, same day)

**Tier:** FULL — no tier was stated in the spawn instructions for this pass, so FULL was used per default protocol. Mechanically re-checking the gate anyway: every file this section touches (`FocusedTaskCard.tsx`, new `TaskQuickEdit.tsx`, `SettingsScreen.tsx`, `TaskFormScreen.tsx`, `BoardGroupedTasks.tsx`) is presentation-only — no model/schema/router/API-contract file, no stated data-model change, OTA/single-component deployment — so a mechanically-computed gate would have landed on LIGHT. No blast-radius surprise was found during the read that would have forced an escalation; FULL was simply the safer default given the ambiguity, and the four project docs were read in full accordingly.

**Scope:** Limited to "## Mobile Equivalent of Web PR #42" (lines 93–137) — the one section in this file that had never been reviewed. All citations below were independently re-verified against the current (pre-implementation) source in `mobile/src/`, not taken on the plan's word.

**Verdict:** Approved with concerns

### Issues

1. **[Gap]** `BoardGroupedTasks.tsx`'s prop signature is stated inconsistently across two parts of this same plan. The original "Extract shared rendering" bullet (Files to Modify, line 58) declares it as `({ boards, onEditPress })` — no `onRefresh`. This section's Inline-quick-edit work (line 105) requires the same component to "thread `onRefresh` down to each `FocusedTaskCard`." Confirmed by reading the current `mobile/src/components/FocusedView.tsx` in full: its board-grouping JSX (lines 73–96, matching the plan's "~73–96" citation) calls `<FocusedTaskCard key={task.id} task={task} boardColor={color} onPress={onEditPress} />` with no `onRefresh` anywhere yet, and `load()` (lines 18–29) is the only candidate refetch function available to pass through. The web equivalent (`ARCHITECTURE.MD`'s `BoardGroupedTasks.tsx` entry) confirms `onRefresh` was added to the *web* component in PR #42 — i.e. the mobile plan's line-58 bullet was written before the PR #42 fold-in and was never updated to match. Whoever implements this needs `BoardGroupedTasks.tsx`'s real prop signature to be `{ boards, onEditPress, onRefresh }`; as written, the plan gives two different, uncoordinated answers for the same new file.
2. **[Risk]** `SettingsScreen.tsx`'s label-loading effect is missed. Confirmed by reading the current file: the `useEffect` at lines 658–679 fetches `getSettings()` and both `listLabels('mode'|'type', activeBoard?.id)` calls together in one `Promise.all`, keyed on `[activeBoard?.id]` (line 679). This section's bullet says to "replace the three `activeBoard?.id` reads (labels fetch ×2, `createLabel`) with `labelsBoardId`" (line 117) but never says the effect's dependency array must also change. If the reads are swapped in-place but the array is left as `[activeBoard?.id]`, then picking a different board in the new Labels board picker sets `labelsBoardId` — a state independent of `activeBoard` by design — without ever re-running the effect that actually fetches labels. The picker would appear to do nothing: the Mode/Type lists shown would stay pinned to whatever board was active when the screen last mounted or `activeBoard` last changed, not the board the user just selected. This is a concrete, verifiable gap, not a stylistic one — the whole point of decoupling `labelsBoardId` from `activeBoard` is defeated if the fetch stays keyed on the latter.
3. **[Nit]** Two `TaskFormScreen.tsx` line-range citations in the "TaskForm cleanup" bullet (lines 125–126) are off by a few lines, in the same style as line-range nits caught in earlier passes of this file. Confirmed by reading the current file: the Notes block is cited as "263-275" but actually runs 264–277 (comment through the closing `</View>`); the Links block is cited as "420-458" but actually runs 420–466 — line 458 lands mid-way through the remove-button `TouchableOpacity`, not at the block's end. Doesn't change what needs to move, but worth tightening since an implementer using these as cut boundaries could clip the closing tags.
4. **[Gap]** The Test Plan additions for this section (lines 132–137) verify that the Labels board picker is independent of the app-wide active board and that deleting the selected board triggers a fallback, but there is no bullet verifying that changing the picker's selection actually re-fetches and displays the newly-selected board's Mode/Type labels. That is precisely the behavior Issue 2 puts at risk — worth adding once the dependency-array fix lands, so a regression here would be caught by the stated test plan rather than only by manual inspection.

### Unverified assumptions

- `DraggableTaskRow`'s edit wiring (cited as `TasksScreen.tsx:853`, `onEditPress={handleEditPress}`) — **confirmed accurate**: line 853 of the current file is exactly that prop assignment inside the `SectionList`'s `renderItem`.
- The three `SettingsScreen.tsx` label-read citations (lines 613, 665–666, 682) — **confirmed accurate**: line 613 is `const { activeBoard } = useBoard();`, lines 665–666 are the two `listLabels('mode'|'type', activeBoard?.id)` calls, line 682 is `const label = await createLabel(cat, value, activeBoard?.id);` — all exactly as cited.
- "`AppNavigator.tsx`'s `Tab.Navigator` (bottom tabs) does not unmount inactive tab screens by default" — **confirmed accurate**: read `AppNavigator.tsx` in full; no `unmountOnBlur` or `lazy` override is set on any `Tab.Screen` (lines 91–110), so default React Navigation bottom-tabs behavior (mount once, keep alive on blur) applies. The claim that this makes a mobile `ViewContext`-equivalent unnecessary holds up.
- `TaskQuickEdit`'s planned fetch call, `listLabels(undefined, task.board_id)` — **confirmed the signature supports this**: `mobile/src/api/labels.ts:4`, `listLabels(category?: LabelCategory, boardId?: string)`, both params optional. `updateTask(task.id, { title, label_ids })` also type-checks cleanly against the current `UpdateTaskBody` (`mobile/src/types/index.ts:52-62`) — both fields are optional, and omitting `links` correctly leaves it unchanged per the type's own doc comment.
- Not independently verified (no code exists yet to check against): whether the outer `TouchableOpacity`'s `onPress` guard (`if (!isEditing) onPress(task.id)`) correctly suppresses navigation when the user taps inside the swapped-in `TaskQuickEdit` body (its own nested `TextInput`/Save/Cancel touchables). Standard React Native touch-responder behavior (innermost interactive element captures the touch) suggests this will work as intended, but `TaskQuickEdit.tsx` doesn't exist yet, so this couldn't be checked directly. Already covered by this plan's own Test Plan (line 134: "tapping elsewhere on the card while editing does not navigate away"), so the risk is mitigated by manual verification either way.
- "Reuses this plan's existing `labelsByCategory` grouping pattern" — there are in fact two slightly different existing implementations of this pattern in the codebase (`TaskFormScreen.tsx:196-203`, a `reduce` keyed by arbitrary category string, vs. `TasksScreen.tsx:359-367`, a `useMemo` keyed specifically to `'mode'|'type'`). The plan doesn't say which one `TaskQuickEdit.tsx` should mirror — low stakes since both produce an equivalent grouping, but worth a one-line pick during implementation rather than an implicit choice.

### Suggestions

- Reconcile `BoardGroupedTasks.tsx`'s prop signature in the "Extract shared rendering" bullet (line 58) to explicitly include `onRefresh`, matching what this section's Inline-quick-edit work requires — otherwise the two bullets read as contradictory specs for the same new file.
- Add an explicit line to the "Board-scoped Settings Labels picker" bullet stating that `SettingsScreen.tsx`'s label-loading `useEffect` dependency array must change from `[activeBoard?.id]` to include `labelsBoardId` (or be restructured so label fetching keys off `labelsBoardId` independently of the settings fetch), so the picker actually does something once wired up.
- Add a Test Plan bullet confirming that changing the Labels board picker's selection updates the displayed Mode/Type label lists to match the newly-selected board (not just that it leaves the app-wide active board untouched).
- Correct the `TaskFormScreen.tsx` Notes/Links line-range citations to 264–277 and 420–466 respectively.

— *Sneezy*

---

## Grumpy's Response to Sneezy's 2026-07-04 Second-Pass Review

| Sneezy item | Status |
|---|---|
| Gap 1 (`BoardGroupedTasks.tsx` prop signature inconsistent — `onRefresh` missing from the "Extract shared rendering" bullet) | Addressed — bullet now states `{ boards, onEditPress, onRefresh }` |
| Risk 2 (`SettingsScreen.tsx` label-fetch `useEffect` still keyed on `[activeBoard?.id]`, picker would be silently non-functional) | Addressed — bullet now explicitly requires the dependency array to change to `[labelsBoardId]` |
| Nit 3 (`TaskFormScreen.tsx` Notes/Links line-range citations off) | Addressed — corrected to 264–277 and 420–466 |
| Gap 4 (no Test Plan bullet for label-list re-fetch on picker change) | Addressed — bullet added |

Open Question #2 (whether this section needed its own Sneezy pass) is now resolved — it has been reviewed. Open Question #1 (narrow extraction vs. duplication) remains open; see Open Questions above.
