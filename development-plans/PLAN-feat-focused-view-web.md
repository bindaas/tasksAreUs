# Plan: feat-focused-view-web

## Scope

Web frontend for the Focused View feature (PR 2 of 3). Backend API is fully shipped (PR #36). Mobile is PR 3 (not in scope here).

## Background

PR #36 shipped:
- `GET/PUT /api/v1/focused-view/config` — user config (board_selection, day_range, selected_board_ids)
- `GET /api/v1/focused-view/tasks` — HP tasks grouped by board within the configured day range
- `boards.color VARCHAR(7)` column — per-board color
- `PUT /api/v1/boards/{id}` already accepts `color` via sentinel logic (omitting color leaves it unchanged; null clears it; hex string sets it)

## What this PR delivers

1. Color picker in Board settings (Settings page → Boards section)
2. Focused View config section in Settings page (below Boards)
3. Session-only Detailed/Focused toggle in TasksPage header
4. `FocusedView` component (card grid grouped by board)
5. `FocusedTaskCard` component (compact card, click-to-open task detail)

## Files to modify

### `frontend/src/api/boards.ts`
- Add `color?: string | null` to the `Board` interface
- Update `updateBoard` signature to accept `color?: string | null` in the body param

### `frontend/src/api/focusedView.ts` (new)
Types and API functions:
```ts
interface FocusedViewConfig {
  id: string;
  user_id: string;
  board_selection: 'all' | 'selected';
  selected_board_ids: string[];
  day_range: 'today' | 'today_tomorrow' | 'today_plus_two';
}

interface FocusedBoard {
  board_id: string;
  board_name: string;
  board_color: string | null;
  tasks: Task[];
}

getFocusedViewConfig(): Promise<FocusedViewConfig>
updateFocusedViewConfig(body: { board_selection, day_range, selected_board_ids }): Promise<FocusedViewConfig>
getFocusedViewTasks(referenceDate?: string): Promise<{ boards: FocusedBoard[] }>
```

### `frontend/src/pages/SettingsPage.tsx`
Two additions:

**A. Color picker in BoardEditor**
- Each board row gets a color swatch (a 20×20 circle showing current color, or gray if null).
- Clicking it opens a native `<input type="color">` (invisible, positioned over the swatch).
- Changing color auto-saves immediately via an `onSetColor(id, color | null)` prop on `BoardEditor`.
- A small `×` button beside the swatch (only visible when color is set) calls `onSetColor(id, null)` to clear.
- `BoardContext` gets a new `setColorBoard(id: string, color: string | null): Promise<void>` method (analogous to `renameBoard`) that calls `updateBoard(id, { color })` then `fetchBoards()` to keep context state current. This is wired to `onSetColor` in `SettingsPage`.

**B. Focused View Config section**
- Appears below the Boards section, above Labels.
- Loads config on mount via `getFocusedViewConfig()` (separate from the settings load in `useEffect([activeBoard?.id])`).
- Fields:
  - **Board selection**: radio group — "All boards" or "Selected boards"
  - **Boards** (only visible when "selected"): checkboxes listing all boards by name
  - **Day range**: radio group — "Today only" / "Today + tomorrow" / "Today + 2 days"
- Save button for this section only (calls `updateFocusedViewConfig`).
- Inline error + success banners.

### `frontend/src/pages/TasksPage.tsx`
- Add `const [viewMode, setViewMode] = useState<'detailed' | 'focused'>('detailed');`
- Add toggle in the header row (right side, next to "Show done" / "Show pending"): two pill buttons "Detailed" / "Focused".
- Toggle is session-only — no localStorage persistence. Resets to "Detailed" on page reload.
- When `viewMode === 'focused'` AND `!showDone`: render `<FocusedView />` instead of the kanban board. The label filter chips are hidden in focused mode (focused view has its own filtering logic server-side). The existing `{!showDone && (...)}` chip guard must be extended to `{!showDone && viewMode !== 'focused' && (...)}` to achieve this.
- When `viewMode === 'focused'` AND `showDone`: disable focused mode (show pending tasks) — or simply hide the toggle when "Show done" is active. Decision: hide the toggle when `showDone` is true (focused view only makes sense for pending tasks).

### `frontend/src/components/FocusedView.tsx` (new)
- Fetches `GET /focused-view/tasks?reference_date=YYYY-MM-DD` on mount only (`useEffect(() => { ... }, [])`).
  - `reference_date` is computed as `dateOnly(new Date())` from `taskDateUtils.ts` to use local-timezone date.
  - Does NOT refetch on `activeBoard` change — the focused view is config-driven server-side, not board-scoped. A Retry button handles error recovery and manual refresh.
- Shows a loading spinner while fetching.
- Shows an empty state ("No focused tasks for this period") when the response has no boards.
- For each board group:
  - A header row with a colored left-border or background accent (derived from `board_color` or from a fixed palette: `['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6']` indexed by board position in the response).
  - A responsive grid of `FocusedTaskCard` components.
- On error, shows inline error message + Retry button.

### `frontend/src/components/FocusedTaskCard.tsx` (new)
- Props: `task: Task`, `boardColor: string` (no `labels` prop — badges rendered from `task.labels` directly, since `TaskOut` already carries its own labels array).
- Displays: title (up to 2 lines, ellipsis), high-priority badge (amber "★ High"), date chip (must_do_by or target_date, whichever is earliest), label badges from `task.labels`.
- A left colored border using `boardColor`.
- Click: `navigate(\`/tasks/${task.id}\`)`.
- No drag-and-drop.

## API contracts (no changes needed)

All backend routes already exist and are documented in DATA_MODEL_AND_API.MD. The only frontend-API contract addition is:
- `PUT /boards/{id}` body now accepts `color?: string | null` — already supported by the backend sentinel logic.

## Test plan

- No new pure utility functions extracted → no new unit test files needed.
- `frontend/src/__tests__/boards.api.test.ts`: add two tests for `updateBoard` with `color`:
  - `updateBoard('id', { color: '#6366f1' })` — verifies hex color is serialised in the body.
  - `updateBoard('id', { color: null })` — verifies null is serialised (not omitted) to clear the color.
- Manual smoke test in browser:
  1. Settings → Boards: color swatch shows, picking a color saves it; `×` clears it; board switcher and focused view cards reflect the color.
  2. Settings → Focused View config: can switch between All/Selected, pick boards, pick day range, save.
  3. TasksPage: Detailed/Focused toggle visible when pending view is active; hidden in "Show done" mode.
  4. Focused view shows board-grouped cards; clicking a card opens task detail.
  5. Changing active board in board switcher while in focused view re-fetches.

## Deployment order

Frontend-only change. Backend already deployed. Safe to deploy independently.
Every commit on this branch must include `[skip deploy]` in the commit message — CLAUDE.md requires this for any commit that does not touch `backend/app/`.

## Assumptions

1. Auto-save color on `<input type="color">` change (no explicit Save). This matches the "immediate feedback" pattern used in label delete/rename. Color mutations go through `setColorBoard` in `BoardContext` to keep context state current.
2. Focused view toggle hidden in "Show done" mode (focused view is forward-looking, pending-only by definition).
3. Fixed color palette for null `board_color`: 8 indigo/amber/green/red/blue/purple/pink/teal colors, indexed by board's position in the response.
4. The Focused View config section has its own Save button (separate from High Priority Limit + Starter Questions save).
5. `FocusedView` fetches on mount only. The focused view config is server-side — the active board switcher does not scope what focused view returns. A Retry button allows manual refresh.
6. FAB ("+") remains visible in focused mode — users can still create tasks. This is an explicit UX decision, not an oversight.
7. No frontend unit tests for FocusedView components (they fetch data; testing them would require mocking `apiFetch`, which is more integration-style than what's in `__tests__/`). The existing pattern is to only unit-test pure utility functions.

---

## Sneezy's Review — 2026-06-30

**Verdict:** Approved with concerns

### Issues

1. **[Risk] `[skip deploy]` tag is required but the plan says it is not.** `CLAUDE.md` states: "Any commit with no backend application changes must include `[skip deploy]` in the commit message to prevent a Railway deployment." This PR touches only `frontend/` — a frontend-only commit. The plan's claim "No `[skip deploy]` needed — only `frontend/` files change (which don't trigger Railway backend deploy)" misreads the rule. The "Does not trigger" list describes which paths warrant `[skip deploy]`; it is the `[skip deploy]` tag itself that prevents the deploy from firing. Without it, the commit will trigger a pointless Railway backend redeploy. Every doc-only or mobile-only commit in the git log (e.g. `341a5e1`, `02c5d37`, `d6e14c5`) includes `[skip deploy]`; the pattern is consistent.

2. **[Gap] `BoardContext` has no color mutation method and the plan leaves the integration path unresolved.** `frontend/src/context/BoardContext.tsx` exposes `renameBoard`, `setDefaultBoard`, and `deleteBoard` — each wraps `updateBoard` and then calls `fetchBoards()` to keep the context current. The plan says color auto-save calls `updateBoard(id, { color: value })` immediately, and vaguely says "`onRename` prop is reused for color — or we add `onSetColor(id, color | null)` to `BoardEditor`." Neither path is committed to, and neither path currently exists in the codebase. Without a corresponding `setColorBoard(id, color | null)` method in `BoardContext` that also calls `fetchBoards()`, the `boards` list in context will show stale colors after an auto-save — which matters if `BoardSwitcher` or other components ever read `board.color`. The analogous `renameBoard` path (`frontend/src/context/BoardContext.tsx` line 65) is the correct pattern to follow.

3. **[Gap] `FocusedTaskCard` receives `labels: Label[]` as a prop but the prop is unnecessary.** `GET /focused-view/tasks` returns full `TaskOut` objects; each task already carries its own `task.labels` array (confirmed in `frontend/src/api/tasks.ts` — `Task.labels: Label[]`). `FocusedTaskCard` has no inline edit mode, so a board-level label list serves no purpose. The prop appears to be copied from `TaskCard`'s signature, which needs the full label list for its edit picker. Keeping the prop in `FocusedTaskCard` adds dead weight and could mislead a future reader into thinking labels need to be fetched separately.

4. **[Risk] `FocusedView` refetch on `activeBoard` change is semantically incorrect.** The plan's own Assumption 5 acknowledges that "switching the active board in the board switcher does NOT filter what the focused view shows." Yet the plan still ties `FocusedView`'s `useEffect` to `activeBoard?.id`. This means every board switch while in focused mode triggers a network round-trip that returns identical data. It also creates a false impression for future maintainers that the focused view is board-scoped. The cleaner design is to fetch on mount only and provide a Retry button for error recovery. Spurious refetches are fine now but will become confusing when someone adds board-scoped focused view logic later.

5. **[Gap] `reference_date` computation is unspecified.** The plan says `FocusedView` fetches `GET /focused-view/tasks?reference_date=YYYY-MM-DD` but never states how the date string is derived client-side. `frontend/src/utils/taskDateUtils.ts` exports `dateOnly(date: Date): string` which returns a local-timezone date in `YYYY-MM-DD` format (the same helper used in `TasksPage`). The implementer should use `dateOnly(new Date())` to avoid UTC vs. local time drift. This should be stated explicitly in the plan.

6. **[Gap] FAB visibility in focused mode is not addressed.** In `TasksPage`, the floating "+" button is rendered unconditionally when `!showDone` (line 413 of `TasksPage.tsx`). Focused mode is defined as `viewMode === 'focused'` AND `!showDone`, so the FAB will be visible during focused mode. The plan does not state whether this is intentional. Showing the FAB is arguably correct (users can still create tasks), but it should be an explicit design decision, not an oversight.

7. **[Nit] Test commitment is too weak.** The plan says `boards.api.test.ts` "may need a test for the `color` field if it currently asserts the shape." Reviewing the file (`frontend/src/__tests__/boards.api.test.ts` lines 51–68): `updateBoard` is tested for `name` and `is_default` but not for `color`. "May need" is non-committal. A test for `updateBoard('id', { color: '#6366f1' })` verifying the body is serialised correctly, and a test for `{ color: null }`, should be committed to explicitly.

8. **[Nit] Label filter chip condition needs explicit extension in `TasksPage`.** The plan says "label filter chips are hidden in focused mode." Currently `TasksPage` guards the chip block with `{!showDone && (...)}` (line 175). Since focused mode is only active when `showDone` is false, this existing check does NOT hide chips in focused mode. The implementer must add `&& viewMode !== 'focused'` to that guard. The plan states the desired behaviour but does not call out that a new condition must be added to existing code.

### Unverified assumptions

- **"PR #36 shipped the focused view backend in full."** Confirmed against `ARCHITECTURE.MD` (focused_view.py router, focused_view_service.py), `DATA_MODEL_AND_API.MD` (focused_view_configs table, board color column, all three API endpoints documented), and `PRODUCT_REQUIREMENTS_DOCUMENT.MD` (Focused View Data Model section marked as "shipped — PR #36").

- **"`PUT /api/v1/boards/{id}` already accepts `color` via sentinel logic."** Confirmed: `DATA_MODEL_AND_API.MD` documents the sentinel behaviour (`model_fields_set` + `_UNSET`) and `ARCHITECTURE.MD` confirms `BoardUpdate` has a `field_validator` for hex format. `frontend/src/api/boards.ts` `updateBoard` body param currently only types `name?` and `is_default?` — the `color` field is not yet in the TypeScript type, consistent with the plan's intent to add it.

- **"No `[skip deploy]` needed."** NOT confirmed. This is factually wrong per `CLAUDE.md`. See Issue 1 above.

- **"Auto-save color matches the 'immediate feedback' pattern used in label delete/rename."** Partially confirmed. Labels use `deleteLabel`/`updateLabel` directly (not through `BoardContext`), which is a valid precedent. However, those calls don't need to refresh `BoardContext` because label state is local to `SettingsPage`. Color is part of `Board`, which IS held in `BoardContext`. The analogy holds for UX intent but not for the infrastructure required. See Issue 2.

- **"No frontend unit tests needed for FocusedView components."** Confirmed as consistent with codebase convention: `frontend/src/__tests__/` contains only pure-utility tests (`taskDateUtils`, `taskFilters`, `taskPriority`, `client.ts`, `boards` API). Data-fetching components are not unit-tested. The plan is correct here.

### Suggestions

1. Add `setColorBoard(id: string, color: string | null): Promise<void>` to `BoardContextValue` and `BoardProvider` — analogous to `renameBoard` — calling `updateBoard(id, { color })` then `fetchBoards()`. Wire `onSetColor` as a new prop to `BoardEditor`. This resolves Issue 2 cleanly and keeps all board mutations consistent.

2. Remove `activeBoard` from `FocusedView`'s `useEffect` dependency list. Fetch on mount only (`useEffect(() => { ... }, [])`). If the user changes the focused-view server config and wants fresh data, they can use the Retry button. This resolves Issue 4.

3. Drop the `labels: Label[]` prop from `FocusedTaskCard` and render label badges directly from `task.labels`. This resolves Issue 3.

4. State explicitly in the plan that `reference_date` is computed as `dateOnly(new Date())` from `taskDateUtils.ts`. This resolves Issue 5.

— *Sneezy*

---

## Grumpy's Response to Sneezy — 2026-06-30

| # | Sneezy item | Resolution |
|---|---|---|
| 1 | `[skip deploy]` required | **Fixed.** Deployment order section corrected; every commit will include `[skip deploy]`. |
| 2 | `BoardContext` missing `setColorBoard` | **Fixed.** Added `setColorBoard(id, color \| null)` to context and provider; `onSetColor` prop added to `BoardEditor`. |
| 3 | `FocusedTaskCard` redundant `labels` prop | **Fixed.** Prop removed; labels rendered from `task.labels` directly. |
| 4 | `FocusedView` wrong refetch on `activeBoard` | **Fixed.** Fetch on mount only; Retry button for error recovery. |
| 5 | `reference_date` unspecified | **Fixed.** Explicitly `dateOnly(new Date())` from `taskDateUtils.ts`. |
| 6 | FAB in focused mode unaddressed | **Addressed.** FAB intentionally kept visible (Assumption 6). |
| 7 | Weak test commitment for `color` | **Fixed.** Two concrete `updateBoard` color tests committed to in Test plan. |
| 8 | Label chip guard incomplete | **Fixed.** Guard extended to `{!showDone && viewMode !== 'focused' && ...}` in the file plan. |
