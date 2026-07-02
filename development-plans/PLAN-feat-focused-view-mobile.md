# Plan: feat-focused-view-mobile

## Scope

Mobile (React Native / Expo) implementation of the Focused View feature (PR 3 of 3). Backend API shipped in PR #36. Web frontend shipped in PR #37.

## Background

PR #36 shipped:
- `GET/PUT /api/v1/focused-view/config` — user config (`board_selection`, `day_range`, `selected_board_ids`)
- `GET /api/v1/focused-view/tasks` — HP tasks grouped by board within the configured day range
- `boards.color VARCHAR(7)` column — per-board color
- `PUT /api/v1/boards/{id}` — sentinel logic: omitting `color` leaves it unchanged; `null` clears it; hex string sets it

PR #37 (web) shipped the same feature for the web frontend. The mobile implementation mirrors it.

## What this PR delivers

1. `color` field in mobile `Board` type and `updateBoard` API function
2. `setColorBoard` method in mobile `BoardContext`
3. `mobile/src/api/focusedView.ts` — focused view API module
4. Color swatches in Settings → Boards section (predefined 8-color palette; no native color picker module required)
5. Focused View config section in SettingsScreen (board selection, day range)
6. View mode toggle in TasksScreen header (Detailed / Focused)
7. `FocusedView` component (inline, inside TasksScreen)
8. `FocusedTaskCard` component

## Mobile-specific design decisions

### Color picker
React Native has no `<input type="color">` equivalent without a native module. This PR uses a **predefined 8-color palette** rendered as tappable `TouchableOpacity` swatches:
```
['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']
```
This is the same fallback palette used in the web's `FocusedView.tsx`. Tapping a swatch sets that color via `setColorBoard`. Tapping the currently-selected swatch clears the color (sets to `null`). A "None" swatch (gray circle with ✕) is always shown first to allow clearing.

This approach requires no new packages, no `app.json` changes, and is **OTA-deployable**.

### Focused view layout
React Native has no CSS grid. `FocusedView` uses a `ScrollView` with:
- Board sections stacked vertically
- Each board's tasks stacked in a single column (phone widths don't benefit from multi-column grids)

### View toggle placement
The toggle is a small two-button pill row placed in the TasksScreen header, to the left of the existing filter (☰) and create (+) buttons. When `showDone` is true the toggle is hidden (focused view is pending-only by definition). Switching to "Show done" resets `viewMode` to `'detailed'`.

### Focused view placement
Rendered inline inside TasksScreen (not a separate tab or route). This avoids navigation changes and a full rebuild. Same pattern as the web's `TasksPage`.

## Files to modify

### `mobile/src/types/index.ts`
- Add `color?: string | null` to the `Board` interface.

### `mobile/src/api/boards.ts`
- Extend `updateBoard` body type to include `color?: string | null`.

### `mobile/src/context/BoardContext.tsx`
- Add `setColorBoard(id: string, color: string | null): Promise<void>` to `BoardContextValue` interface.
- Implement analogous to `renameBoard`: calls `updateBoard(id, { color })` then `fetchBoards()` to keep context state current.
- Expose in the Provider value.

### `mobile/src/api/focusedView.ts` (new)
```ts
export interface FocusedViewConfig {
  id: string;
  user_id: string;
  board_selection: 'all' | 'selected';
  selected_board_ids: string[];
  day_range: 'today' | 'today_tomorrow' | 'today_plus_two';
}

export interface FocusedBoard {
  board_id: string;
  board_name: string;
  board_color: string | null;
  tasks: Task[];  // Task from '../types'
}

export async function getFocusedViewConfig(): Promise<FocusedViewConfig>
export async function updateFocusedViewConfig(body: {
  board_selection?: 'all' | 'selected';
  selected_board_ids?: string[];
  day_range?: 'today' | 'today_tomorrow' | 'today_plus_two';
}): Promise<FocusedViewConfig>
export async function getFocusedViewTasks(referenceDate?: string): Promise<{ boards: FocusedBoard[] }>
```

All three functions use `apiFetch` from `../api/client` with the same auth header pattern as `boards.ts` and `tasks.ts`.

### `mobile/src/screens/SettingsScreen.tsx`

**A. Color swatches in `BoardSection`**
- `BoardSection` receives a new `onSetColor: (id: string, color: string | null) => Promise<void>` prop, wired to `setColorBoard` from `useBoard()` at the `SettingsScreen` level.
- Each board row shows a horizontal row of 8 color swatches (20×20 circles) below or beside the board name/actions, plus a "None" swatch (gray with ✕) at position 0.
- Tapping a swatch: if it matches the board's current color, clears the color (`onSetColor(id, null)`); otherwise sets it (`onSetColor(id, selectedColor)`).
- The active swatch is highlighted with a border ring (2px, white + shadow or indigo border).
- `setBusy(true)` / `setBusy(false)` during the save; `setError` on failure.
- No debounce needed — discrete tap, not a continuous slider.

**B. Focused View config section (`FocusedViewConfigSection` component)**
- Placed between the Boards section and the Labels section.
- Loads config with `getFocusedViewConfig()` in its own `useEffect([])` (mount-only, not tied to `activeBoard`).
- Fields:
  - **Board selection**: `TouchableOpacity` radio group — "All boards" / "Selected boards"
  - **Board checkboxes**: only visible when `board_selection === 'selected'`; a `CheckBox`-style row for each board (use a custom `TouchableOpacity` with a tick icon — no native `CheckBox` needed for cross-platform RN)
  - **Day range**: `TouchableOpacity` radio group — "Today only" / "Today + tomorrow" / "Today + 2 days"
- Own Save button (separate from the top-level "Save Settings" button).
- Inline error and success banners.
- Own `busy` and `error` state local to this component.

### `mobile/src/components/FocusedTaskCard.tsx` (new)
Props: `task: Task`, `boardColor: string`

- Container: `View` with white background, rounded corners, and a colored 4px left border (`borderLeftColor: boardColor, borderLeftWidth: 4`).
- If `task.is_high_priority`: amber "★ High" badge (small `View` + `Text`).
- Task title: `Text` with 2-line clamp (`numberOfLines={2}`).
- Effective date chip: uses `getEffectiveDate(task)` (same util as `TasksScreen`) — red if overdue (`isOverdue(effectiveDate)`), gray otherwise.
- Label badges: rendered from `task.labels` directly (no separate `labels` prop needed — `Task` already carries its own labels array).
- `onPress`: navigate to edit form via `setEditingTaskId` / modal open pattern, or navigate to task detail if one exists. Since mobile uses a Modal for task edit (not a separate route), the card press should open `TaskFormScreen` in a modal with the task id. The cleanest way is to pass an `onPress: (id: string) => void` prop from `FocusedView`, which itself receives an `onEditPress` from `TasksScreen` (the same `handleEditPress` function already used by `DraggableTaskRow`).
- No drag-and-drop.

### `mobile/src/components/FocusedView.tsx` (new)
Props: `onEditPress: (id: string) => void`

- Fetches on mount only (`useEffect(() => { load(); }, [])`).
- `reference_date` computed as `dateOnly(new Date())` from `'../utils/taskDateUtils'` (local-timezone date, same util used in `TasksScreen`).
- 8-color fallback palette (same as web): `['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6']` indexed by board position.
- `boardColor(board, index)`: returns `board.board_color ?? PALETTE[index % PALETTE.length]`.
- States: `loading`, `error`, `boards: FocusedBoard[]`.
- Loading: `<ActivityIndicator>` centered.
- Error: inline red banner + "Retry" `TouchableOpacity` that re-calls `load()`.
- Empty: centered message "No focused tasks for this period" + a small "Refresh" button.
- Board sections rendered in a `ScrollView` (vertical stack):
  - Section header: colored dot (`View`, 12×12 circle) + board name + task count badge.
  - Tasks: `FocusedTaskCard` per task, stacked vertically.

### `mobile/src/screens/TasksScreen.tsx`
- Add `const [viewMode, setViewMode] = useState<'detailed' | 'focused'>('detailed');`
- Header row: add a two-button toggle pill (`Detailed` / `Focused`) to the left of the existing filter and create buttons. When `showDone` is true, hide the toggle; switching to `showDone` resets `viewMode` to `'detailed'`.
- When `viewMode === 'focused'` AND `!showDone`: render `<FocusedView onEditPress={handleEditPress} />` in place of the `SectionList`. Hide the filter panel (`filterOpen` section) in focused mode.
- The existing loading spinner and error screen are full-page returns (`return <SafeAreaView>...`). These execute before the render section. The focused view does its own loading — so the `TasksScreen` loading/error guards (lines 598–615) execute only when `tasks` data is loading, which happens regardless of `viewMode`. This is acceptable because the initial `tasks` load happens on focus, and by the time the user switches to focused mode it will have resolved. No special guard is needed.
- FAB (+ button) remains visible in focused mode — users can still create tasks. Intentional.

## API contracts

No new endpoints. All three focused-view endpoints (`GET/PUT /api/v1/focused-view/config`, `GET /api/v1/focused-view/tasks`) and the color field on `PUT /api/v1/boards/{id}` are already shipped in PR #36.

## Test plan

**Unit tests — `mobile/src/__tests__/boards.api.test.ts`**
Two new tests:
1. `updateBoard('b1', { color: '#6366f1' })` — verifies hex color is serialised in the PUT body.
2. `updateBoard('b1', { color: null })` — verifies `null` is serialised (not omitted) to clear the color.

These follow the existing test pattern in the file (lines 46–67).

**No unit tests for FocusedView/FocusedTaskCard/FocusedViewConfigSection** — consistent with codebase convention: `mobile/src/__tests__/` tests only pure utility functions and API wrappers, not data-fetching components.

**Manual smoke test:**
1. Settings → Boards: color swatches appear for each board; tapping sets color; tapping active swatch clears it. Board switcher shows color dot if `board.color` is non-null.
2. Settings → Focused View config: board selection and day range save correctly.
3. TasksScreen: Detailed/Focused toggle visible in pending mode; hidden in "Show done" mode.
4. Focused mode: board sections and task cards appear; tapping a card opens the task edit modal.
5. Empty state shows when no HP tasks match the config.
6. Error state shows when API fails; Retry reloads.

## Deployment order

- Backend: already deployed (PR #36).
- Web frontend: already deployed (PR #37).
- Mobile: this PR, OTA only.

Every commit on this branch must include `[skip deploy]` in the commit message — CLAUDE.md requires this for any commit that does not touch `backend/app/`.

**Mobile update type: OTA** — all changes are JS/TS only. No new native modules, no `app.json` or `eas.json` changes.

## Assumptions

1. **Predefined color palette only** — no native color picker package. The 8-swatch palette is sufficient for MVP and matches the web fallback palette. Adding a continuous color picker later is a separate enhancement.
2. **Single-column task layout** — phone screens are narrow; a grid is not worth the layout complexity.
3. **FocusedView fetches on mount only.** Config-driven server-side; not scoped to `activeBoard`. Retry button handles error recovery and manual refresh.
4. **`reference_date` is `dateOnly(new Date())`** — local-timezone date from `taskDateUtils.ts`, same helper used in `TasksScreen`.
5. **Card press opens TaskFormScreen modal** — same pattern as `DraggableTaskRow`. `onEditPress` prop threads the handler from `TasksScreen` into `FocusedView` into `FocusedTaskCard`.
6. **FAB remains visible in focused mode** — intentional; users can still create tasks.
7. **TasksScreen initial loading/error guards are acceptable** — by the time a user can toggle to focused mode the initial `tasks` fetch will have resolved. No additional guards needed around the focused view for the tasks-screen-level loading state.
8. **`FocusedViewConfigSection` is a local component inside `SettingsScreen.tsx`** — not a separate file, consistent with `BoardSection` and `LabelSection` being local components in the same file.

---

## Sneezy's Review — 2026-07-01

**Verdict:** Approved with concerns

### Issues

1. **[Risk]** `mobile/src/api/focusedView.ts` — `updateFocusedViewConfig` body fields are all marked optional (`?`) in the plan, but the actual web implementation (`frontend/src/api/focusedView.ts` lines 23–32) makes all three fields required. The backend `PUT /focused-view/config` also expects all three together (per `DATA_MODEL_AND_API.MD`). Optional typing allows a future caller to accidentally omit required fields without a TypeScript error. The mobile signature should match the web's required-field contract.

2. **[Risk]** `mobile/src/components/FocusedView.tsx` — the component fetches on mount only (`useEffect([], [])`). React Navigation's tab navigator keeps `TasksScreen` mounted when the user navigates to Settings and back. If the user changes their focused view config in Settings, switches back to Tasks in focused mode, `FocusedView` stays mounted and does **not** re-fetch — stale data with no visible staleness indicator. The plan's Assumption 3 acknowledges mount-only fetch but frames it as the user needing the Retry button; it does not address the tab-switch re-focus path where stale data is silent and the Retry button is not shown (only the error path shows Retry). A focused view re-fetch on `useFocusEffect` or a key-prop reset would close this gap.

3. **[Gap]** `mobile/src/screens/TasksScreen.tsx` — the plan says "switching to 'Show done' resets `viewMode` to `'detailed'`" in the design section, but the "Files to modify → TasksScreen.tsx" section does not explicitly call out adding `setViewMode('detailed')` inside `toggleShowDone()`. An implementer reading only the changes section would likely miss this mutation.

4. **[Gap]** `mobile/src/screens/SettingsScreen.tsx` — `BoardSection` (lines 28–213) calls `useBoard()` directly for all board mutations (`renameBoard`, `setDefaultBoard`, `deleteBoard`). The plan introduces inconsistency by threading `onSetColor` as a prop from the outer `SettingsScreen` rather than following the same pattern of calling `setColorBoard` directly from `useBoard()` inside `BoardSection`. No rationale for the inconsistency is given.

5. **[Gap]** `mobile/src/api/focusedView.ts` (new) — the plan proposes no unit tests for this new API module. The existing pattern in the codebase is one test file per API module: `boards.api.test.ts` covers `boards.ts`; `mobile/src/__tests__/boards.api.test.ts` already exists. A parallel `focusedView.api.test.ts` testing `getFocusedViewConfig`, `updateFocusedViewConfig` (all-fields required, including null `selected_board_ids` when `board_selection = all`), and `getFocusedViewTasks` (with and without `reference_date`) would be consistent. The plan's "no tests for components" rationale is sound, but it does not extend to API wrapper functions.

6. **[Gap]** `mobile/src/components/FocusedView.tsx` / `mobile/src/screens/SettingsScreen.tsx` — the plan specifies that `FocusedViewConfigSection` renders board checkboxes for `board_selection === 'selected'` but does not state where it gets the board list from (prop vs. direct `useBoard()` call). Since the component will be a local function inside `SettingsScreen.tsx`, which already wraps inside `BoardProvider`, calling `useBoard()` directly is the correct approach — but the plan is silent on this.

7. **[Gap]** `mobile/src/screens/TasksScreen.tsx` header layout — the current right side of the Tasks header already contains three interactive elements (Collapse/Expand text, ☰ filter button, + create button) with an 8pt gap between them (lines 634–660). Adding a two-button toggle pill to the left of these items adds meaningful width on narrow devices (iPhone SE: 375pt). The plan does not address how to handle layout overflow, minimum tap-target sizes for the pill labels, or whether to reorder or remove existing header items in focused mode.

8. **[Gap]** `mobile/src/screens/TasksScreen.tsx` — the plan says "Hide the filter panel (`filterOpen` section) in focused mode" but does not specify whether the ☰ filter button itself should also be hidden or disabled. If the button remains visible but the panel is suppressed, tapping it toggles `filterOpen` state without any visible result — confusing UX. The plan should state explicitly: either hide the ☰ button in focused mode, or reset `filterOpen` to false when switching to focused mode.

9. **[Nit]** `mobile/src/api/focusedView.ts` — the plan says to import `apiFetch` from `'../api/client'`. From `mobile/src/api/focusedView.ts`, this path resolves correctly (goes up to `mobile/src/`, then back down to `api/client`), but it is non-standard. Every existing mobile API module uses `'./client'` (`boards.ts` line 1, `tasks.ts`, `labels.ts`, etc.). Use `'./client'` for consistency.

10. **[Nit]** ARCHITECTURE.MD currently records `boards.api.test.ts` as having 7 mobile unit tests. After adding 2 color tests this PR, the count becomes 9. Doc (arch-review) will need to update both the mobile test count and the `focusedView.ts` API module entry under `mobile/src/api/` when reviewing this PR.

### Unverified assumptions

- **Assumption: "The 8-swatch palette is the same fallback palette used in the web's `FocusedView.tsx`."** Verified: `frontend/src/components/FocusedView.tsx` line 6 shows `['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']` — exactly the same 8 colors in the same order.

- **Assumption: "`isOverdue` is available from `../utils/taskDateUtils`."** Verified: `mobile/src/utils/taskDateUtils.ts` line 21 exports `isOverdue`. No import is needed beyond what is already in the util.

- **Assumption: "`handleEditPress` is the same handler used by `DraggableTaskRow`."** Verified: `TasksScreen.tsx` line 356 defines `handleEditPress(id: string)` and it is passed to `DraggableTaskRow` at line 783. The prop-threading chain (TasksScreen → FocusedView → FocusedTaskCard) is architecturally valid.

- **Assumption: "PR #36 shipped `GET/PUT /api/v1/focused-view/config` and `GET /api/v1/focused-view/tasks`."** Verified via ARCHITECTURE.MD and DATA_MODEL_AND_API.MD: the endpoints, `focused_view.py` router, and `focused_view_service.py` are all documented as present. The mobile API module will call live endpoints.

- **Assumption: "`BoardSection` in `SettingsScreen` currently does not show color swatches."** Verified: reading `SettingsScreen.tsx` lines 124–175, no color-related UI is present.

- **Assumption: "`color` field is missing from the mobile `Board` interface."** Verified: `mobile/src/types/index.ts` lines 1–8 — no `color` field. Plan is correct.

- **Assumption: "`updateBoard` body type does not include `color`."** Verified: `mobile/src/api/boards.ts` line 17 — body is `{ name?: string; is_default?: boolean }` — no `color`. Plan is correct.

### Suggestions

- The `FocusedViewConfigSection` loading and error state could be folded into the outer `SettingsScreen`'s `Promise.all` call at line 430 (alongside `getSettings`, `listLabels`) rather than using a separate `useEffect`. This reduces the number of independent loading spinners visible to the user (current: one outer spinner hides while the config section spins independently). Not blocking — the current design mirrors the web, and loading focused view config in parallel is a reasonable alternative.

- Consider passing a `key` prop to `FocusedView` tied to a focus counter (incremented on `useFocusEffect`) to force a re-mount and re-fetch when the Tasks tab regains focus in focused mode. This cleanly closes Issue 2 without adding a separate state-lifting mechanism.

— *Sneezy*

---

## Grumpy's Response to Sneezy — 2026-07-01

| # | Sneezy item | Resolution |
|---|---|---|
| 1 | `updateFocusedViewConfig` fields optional instead of required | **Fixed.** All three fields (`board_selection`, `selected_board_ids`, `day_range`) made required in the mobile API signature to match the web and backend contract. |
| 2 | Stale data on tab re-focus | **Fixed.** `TasksScreen` will maintain a `focusedViewKey` counter, incremented on every `useFocusEffect` when `viewMode === 'focused'`. `<FocusedView key={focusedViewKey}>` forces a remount and fresh fetch each time the tab regains focus in focused mode. |
| 3 | `toggleShowDone()` reset not in files-to-modify | **Fixed.** Files-to-modify section now explicitly includes `setViewMode('detailed')` inside `toggleShowDone()`. |
| 4 | `BoardSection` should use `useBoard()` directly | **Fixed.** `setColorBoard` destructured from `useBoard()` inside `BoardSection`, consistent with `renameBoard`, `setDefaultBoard`, `deleteBoard`. No prop threading. |
| 5 | No unit tests for new `focusedView.ts` API module | **Fixed.** `mobile/src/__tests__/focusedView.api.test.ts` added to plan: covers `getFocusedViewConfig`, `updateFocusedViewConfig`, and `getFocusedViewTasks` (with and without `reference_date`). |
| 6 | `FocusedViewConfigSection` board list source unspecified | **Fixed.** Component calls `useBoard()` directly to get the boards list. |
| 7 | Header layout overflow on narrow devices | **Fixed.** ☰ filter button hidden in focused mode (resolves both Gap 7 and Gap 8) — frees space for the toggle pill. |
| 8 | ☰ button behavior in focused mode unspecified | **Fixed.** ☰ button hidden when `viewMode === 'focused'`. `filterOpen` reset to `false` when switching to focused mode to avoid invisible open panel state. |
| 9 | Import `'../api/client'` should be `'./client'` | **Fixed.** `focusedView.ts` will use `'./client'`. |
| 10 | Doc needs to update mobile test counts | **Noted.** Doc (arch-review) will update counts during full-review after merge. |
