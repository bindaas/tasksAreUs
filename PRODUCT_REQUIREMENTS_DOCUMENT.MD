# tasksAreUs — Product Requirements

## Overview

tasksAreUs is a task management app with a Python/FastAPI/PostgreSQL backend, a React 19 + Vite web frontend, and a React Native + Expo mobile client. Users manage tasks through a kanban board and a conversational AI interface. The app is multi-tenant from day one. Identity is Firebase-only: the backend auto-creates a user row on first authenticated request; no device registration or migration step is needed.

---

## Boards

Each user can have up to **10 boards** (server-side cap: `MAX_BOARDS_PER_USER = 10`). Boards are the top-level organizational unit — tasks, labels, and conversations each belong to exactly one board.

**Default board**: Every user has exactly one default board. For new users it is created automatically on first access (any endpoint hit) and named **"General tasks"**. Existing users received a "General tasks" board via startup migration (PR #33) — all their existing tasks, labels, and conversations were assigned to it.

**Board isolation**: Labels and tasks are strictly board-scoped. A label from Board A cannot be applied to a task in Board B. The AI (both belief generation and conversational interface) only sees tasks and labels belonging to the conversation's board.

**Label seeding**: When a new board is created for a new user, type labels (5 entries total) are seeded into that board. Label uniqueness is enforced per board: `(board_id, category, value)` — not per user.

**Backward compatibility**: All pre-existing endpoints accept requests that omit `board_id`. The server resolves the missing value to the user's default board, so old mobile and web clients continue to work without changes.

### Board API (shipped — PR #33)

- `GET /api/v1/boards` — list the current user's non-deleted boards, ordered default-first then by creation time. Returns a `boards` array. As of PR #37, `ensure_board_seeded()` is called at the top of this endpoint — a brand-new user gets their default "General tasks" board and 9 default labels created on the first `GET /boards` call (previously seeding was only triggered by task/label endpoints via `resolve_board_id`).
- `POST /api/v1/boards` — create a new board for the current user. `422` if the 10-board cap would be exceeded. `400` if the name is empty.
- `PUT /api/v1/boards/{id}` — rename a board, change its default status, or set/clear its color. Setting `is_default: true` atomically demotes the previously-default board. Setting `is_default: false` on the current default returns `400` — promote another board first. The `color` field accepts a 7-character hex string (e.g. `#6366f1`) or `null` to clear; omitting `color` entirely leaves the existing value unchanged (sentinel logic via `model_fields_set`). `BoardOut` now includes `color: Optional[str]`.
- `DELETE /api/v1/boards/{id}` — soft-delete a board. Returns `400` if it is the only board, the default board, or still has tasks or labels.

### Board UI — Web frontend (shipped — PR #34)

- **Board switcher — removed, replaced by board tabs (PR #41)**: The always-visible `BoardSwitcher.tsx` dropdown (previously embedded in the desktop sidebar below the "tasksAreUs" title, and in the mobile web header) was deleted. Board switching on the web is now done via **board tabs** on the Tasks page, visible only when the All view is selected (see "Task List / Kanban Board"). This was an explicit, user-confirmed tradeoff at the time: re-scoping Settings' board-scoped Labels editor to a different board required Tasks → All → pick a board tab → Settings, rather than switching from any page via the old always-visible dropdown. **This tradeoff was superseded in PR #42**: Settings' Labels section now has its own independent board selector (see "Settings Page" below), so it no longer depends on the board tabs at all.
- **Create board inline**: Still available from the Settings → Boards section via a "+ Add board" button (inline text input; submitting creates the board via `POST /boards` and immediately activates it; a `422` (board cap reached) or `400` (empty name) error is shown inline). The switcher-dropdown "New board" option described in earlier PRs no longer exists, since the switcher itself was removed in PR #41.
- **Active board state**: Tracked in `BoardContext`. Initialised to the user's default board on every app open — never persisted to localStorage. Switching boards clears any active label filters (labels from Board A are not valid in Board B).
- **Board-scoped data**: All data fetches (tasks, reports) are scoped to the active board by passing `board_id` to API calls. Hooks (`useTasks`) and pages (`TaskDetailPage`, `ReportsPage`) re-fetch automatically when the active board changes. (`ChatPage`'s board-scoping is moot on web as of PR #41 — see the Chat Page aspirational note above.) **As of PR #42, Settings' Labels editor is the one exception** — it fetches labels for a board chosen via its own independent selector, not the active board (see "Settings Page" below); `useLabels` itself still defaults to the active board for other callers (e.g. the All-view kanban board's label filter chips).
- **Reports re-fetch on board switch**: The Reports page re-fetches automatically when the active board changes.
- **Settings — Boards section**: A new "Boards" section appears at the top of the Settings page (above Labels). It shows all boards with inline rename, set-default (star icon), and delete actions. Delete is disabled for the default board and for the only remaining board. Adding a new board is available via a "+ Add board" button. As of PR #42, the Labels section below it is board-neutral — see "Settings Page" under Frontend for detail.

### Board UI — Mobile app (shipped — PR #35)

- **BoardContext**: `BoardProvider` + `useBoard()` added to the mobile app, mounted inside `AppNavigator`'s authenticated branch (wrapping the `Tab.Navigator`). Fetches boards via `GET /boards` once on mount and exposes `activeBoard`, `boards`, `setActiveBoard`, `createBoard`, `renameBoard`, `setDefaultBoard`, `deleteBoard`, `refetch`, and `setColorBoard` (calls `updateBoard(id, { color })` then `fetchBoards()` — added in PR #38). On fetch, `activeBoard` is preserved when the same board still exists after a mutation; otherwise it resets to the default board.
- **Board switcher in Tasks header**: The active board name is shown as a tappable title in the `TasksScreen` header. When the user has more than one board, a "▾" chevron is shown. Tapping opens an inline dropdown overlay (absolute-positioned below the header, `zIndex: 50`) listing all boards — a checkmark marks the active board and a star marks the default. Tapping a board calls `setActiveBoard()` and closes the dropdown.
- **Filter reset on board switch**: A `useEffect([activeBoard?.id])` in `TasksScreen` clears the label filter selection, text search query, and show-done toggle whenever the active board changes.
- **Board-scoped data fetches (mobile)**: All API calls now pass `activeBoard?.id` as an optional `boardId` parameter: `listTasks`, `createTask`, `listLabels`, `createLabel`, `createConversation`, and `getCompletions`. Each API helper accepts an optional `boardId` param appended to the query string or included in the request body.
- **Chat reset on board switch**: A `useEffect([activeBoard?.id])` in `ChatScreen` sets `conversationIdRef.current` to `null` and clears messages, so the next message creates a new conversation scoped to the newly active board.
- **Reports board scoping**: `ReportsScreen` passes `activeBoard?.id` to `getCompletions`; the `getCompletions` helper accepts an optional `boardId` param.
- **Settings — Boards section (mobile)**: A `BoardSection` card appears at the top of `SettingsScreen` (above Labels). It shows a board count badge (`N/10`), lists all boards with a default-star indicator, inline rename, set-default, and delete actions. Delete is guarded: the UI shows the Delete button only when more than one board exists; backend errors (e.g. board has tasks) are surfaced as inline error text. A "+ Add board" inline input (capped at 10 boards) allows creating new boards. The Labels section fetches labels scoped to the active board via `listLabels('mode', activeBoard?.id)` and `listLabels('type', activeBoard?.id)`. New labels created in Settings are created in the active board.
- **Types updated**: `Board` interface added to `mobile/src/types/index.ts`. `Task.board_id: string` and `Conversation.board_id: string` added to match the API response shape. `color: string | null` added to the `Board` interface (PR #38).
- **Tests**: 7 new Jest unit tests for the boards API (`mobile/src/__tests__/boards.api.test.ts`); `makeTask` factory updated in 3 existing test files to include `board_id: 'board-1'`. Total: 77 mobile unit tests pass (86 as of PR #38).

---

## Focused View

The Focused View shows only high-priority tasks from a user-configured set of boards and day range, presented as a card grid grouped by board. On the web frontend it is one of four session-only views (Focused, Today, Tomorrow, All) selectable via a pill toggle in the Tasks page header — Focused is the default view on every page load (shipped — PR #41; see "Task List / Kanban Board").

### Behavior

- Shows tasks where `is_high_priority = true` AND (`must_do_by` OR `target_date`) falls within the configured day range.
- Overdue tasks are **not** shown — the Focused View is forward-looking only. Overdue tasks remain visible in the kanban board (the web All view; the mobile Detailed view).
- Tasks are grouped alphabetically by board name. Within each board group, tasks are sorted by `updated_at` descending.
- Boards with zero qualifying tasks are silently omitted from the response.
- Each board group is color-coordinated using the user-configurable `boards.color` hex value (null = UI assigns a default from a fixed palette).
- Cards are tap-to-open only — no drag-and-drop.

### Data Model (shipped — PR #36)

**New table: `focused_view_configs`** — one row per user, enforced by `UNIQUE(user_id)`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users (CASCADE), indexed, UNIQUE |
| `board_selection` | VARCHAR | `all` or `selected` |
| `selected_board_ids` | JSONB | Array of board UUID strings; ignored when `board_selection = all` |
| `day_range` | VARCHAR | `today`, `today_tomorrow`, or `today_plus_two` |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

Default config (created lazily on first GET, upsert-safe): `board_selection = all`, `day_range = today_tomorrow`, `selected_board_ids = []`.

**Modified table: `boards`** — `color VARCHAR(7)` column added via startup migration `ALTER TABLE boards ADD COLUMN IF NOT EXISTS color VARCHAR(7)`.

### Focused View API (shipped — PR #36, backend only; default changed in PR #40)

- `GET /api/v1/focused-view/config` — returns the user's config, creating the default lazily via upsert if none exists. **Default config (PR #40 change)**: `board_selection = all`, `day_range = "today"` (changed from `"today_tomorrow"` in PR #40; existing users migrated via one-off script), `selected_board_ids = []`.
- `PUT /api/v1/focused-view/config` — updates `board_selection`, `day_range`, and optionally `selected_board_ids`. Validates: `board_selection` must be `all` or `selected`; `day_range` must be one of the three valid values; when `board_selection = selected`, `selected_board_ids` must be non-empty and all IDs must belong to the caller. Returns `400` for any violation.
- `GET /api/v1/focused-view/tasks` — returns `is_high_priority=true` pending tasks grouped by board, filtered to the configured day range. Accepts optional `?reference_date=YYYY-MM-DD` query parameter (avoids server-side timezone issues; defaults to `date.today()` when omitted). Response shape: `{ "boards": [{ "board_id", "board_name", "board_color", "tasks": [TaskOut, ...] }, ...] }`.

### Focused View UI — Web frontend (shipped — PR #37)

**Color picker in Board settings**: Each board row in Settings → Boards gets a color swatch (a circle showing the current hex color, gray if unset). Clicking it opens a hidden native `<input type="color">`. Changes auto-save with a 300ms debounce via `setColorBoard` in `BoardContext`, which calls `PUT /boards/{id}` with the hex value and re-fetches boards. A `×` button (visible only when a color is set) calls `setColorBoard(id, null)` to clear it. `BoardContext` now exposes `setColorBoard(id: string, color: string | null): Promise<void>` (analogous to `renameBoard`).

**Focused View config section in Settings — removed (PR #41)**: The "Focused View" section that appeared below Boards and above Labels (board selection radio, board checkboxes, day range radio, its own Save button calling `updateFocusedViewConfig`) was deleted from the web `SettingsPage.tsx` in PR #41. See "Settings Page" below for detail. The backend config endpoints are unaffected.

**View toggle in TasksPage header — superseded (PR #41)**: The original session-only "Detailed" | "Focused" pill toggle was replaced by a four-way **Focused | Today | Tomorrow | All** pill toggle (Focused still the default). The "Show done" concept no longer exists on this page, so there is nothing for the toggle to reset on. See "Task List / Kanban Board" above for full detail.

**FocusedView component** (`frontend/src/components/FocusedView.tsx`): Rendered in place of the kanban board when view mode is "focused" and pending mode is active. Fetches `GET /focused-view/tasks?reference_date=YYYY-MM-DD` on mount only (`useEffect(() => { ... }, [])`), using `dateOnly(new Date())` for the local-timezone date. Does not refetch on active-board change (focused view is config-driven server-side). Shows loading spinner while fetching; inline error banner with Retry button on failure; empty state ("No focused tasks for this period") when no qualifying tasks exist. Tasks displayed as a responsive card grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) grouped by board, each group headed by a color-coded row using `board_color` from the API or a fixed 8-color palette (`['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6']`) indexed by board position.

**Board collapse/expand (shipped — PR #53)**: Each board group has a collapsible header with a ▾/▸ chevron. Clicking the board header toggles collapse — when collapsed, the task grid is hidden but the header row (color dot, board name, task count) remains visible as a summary. A "Collapse all / Expand all" button in the top-right of the view lets the user toggle all boards at once. Collapse state is session-only (in-memory, never persisted), scoped per-view (collapsing a board in Focused view does not affect its state in Today or Tomorrow), survives in-app navigation (e.g. opening a task detail and returning), and resets on a full page reload. All boards start expanded on every fresh page load.

**FocusedTaskCard component** (`frontend/src/components/FocusedTaskCard.tsx`): Compact card with a 4px left colored border (`boardColor`). Displays: title (up to 2 lines, ellipsis), high-priority badge (amber "★ High"), date chip using `getEffectiveDate` (red if overdue), label badges from `task.labels` (mode=green, type=purple), and up to 3 links (shipped — PR #45; shown as their description, tapping opens the URL in a new tab). Click navigates to `/tasks/${task.id}` (unless in edit mode). No drag-and-drop. Labels are rendered directly from `task.labels` — no separate label prop needed. **Inline quick-edit (added PR #42)**: a pencil icon in the bottom action row toggles an in-place editable form (title + label toggles) via the shared `TaskQuickEdit` component — the same quick-edit already available on All-view task cards. The bottom action row also includes Complete and Delete buttons (added PR #45) for parity with TaskCard. Saving re-fetches the parent view (Focused or Day View, since this card is also used by Day View — see below) via an `onRefresh` callback.

**Label filter chips shown only in the All view (updated PR #41); text search extended to all views (PR #56)**: Label filter chips and the loading/error banners are gated on `viewMode === 'all'` — they only appear in the All view. Text search, however, filters tasks in every view (Overdue, Focused, Today, Tomorrow, All) as of PR #56 — see "Text search" under "Task List / Kanban Board" below.

**New frontend API module** (`frontend/src/api/focusedView.ts`): Exports `FocusedViewConfig` and `FocusedBoard` interfaces plus `getFocusedViewConfig()`, `updateFocusedViewConfig()`, and `getFocusedViewTasks(referenceDate?)`.

**New unit tests**: 2 new tests in `frontend/src/__tests__/boards.api.test.ts` covering `updateBoard` with a hex color and with `null` (clear).

### Focused View UI — Mobile app (shipped — PR #38, updated PR #46)

**Color swatches in Settings → Boards**: Each board row in Settings → Boards gets a horizontal row of 8 pre-defined color swatches (20×20 circles from a fixed 8-color palette: `['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6']`) plus a "None" swatch (gray circle with ✕) at position 0. Tapping a swatch sets that board's color via `setColorBoard`; tapping the active swatch (or the "None" swatch) clears the color to `null`. The active swatch is highlighted with a border ring and shadow. No native color-picker module is required — the 8-swatch palette is OTA-deployable and uses the same palette as the web's `FocusedView.tsx` fallback.

**Focused View config section in SettingsScreen — removed (PR #46)**: The mobile Settings editor for Focused View config (board selection, day range) was removed as part of the Tasks-view redesign. The backend `GET`/`PUT /focused-view/config` endpoints remain live and unchanged — nothing in the mobile frontend calls them anymore.

**View mode toggle in TasksScreen header (updated PR #46)**: A four-button pill toggle (**Focused** | **Today** | **Tomorrow** | **All**) appears in the TasksScreen header. Focused is the default. The Collapse/Expand button and the filter (☰) button are visible only in All view. A `focusedViewKey` counter is incremented on each `useFocusEffect`, forcing FocusedView/DayView to remount and re-fetch fresh data on every tab re-focus.

**`FocusedView` component** (rendered when `viewMode === 'focused'`): Fetches `GET /focused-view/tasks?reference_date=YYYY-MM-DD` on mount using `dateOnly(new Date())` for local-timezone correctness. Shows a loading spinner while fetching; inline error banner with Retry on failure; empty state ("No focused tasks for this period") with a Refresh button when no qualifying tasks exist. Renders board sections in a `ScrollView` — tasks stacked vertically in a single column (appropriate for phone widths). Each board section header shows a colored dot (board color or palette fallback), board name, and task count badge. Board color comes from `board.board_color` or falls back to the 8-color palette indexed by board position.

**Board collapse/expand (shipped — PR #53)**: Each board header is tappable and shows a ▾/▸ chevron. Tapping toggles collapse — when collapsed, the task list is hidden but the header row (dot, name, count) remains visible as a summary. A "Collapse all / Expand all" button above the board list lets the user toggle all boards at once. Collapse state is session-only (in-memory, never persisted), scoped per-view (collapsing a board in Focused view does not affect its state in Today or Tomorrow), survives tab switches to Reports/Settings and back (the `TasksScreen` component is not unmounted by React Navigation's tab changes), and resets on a full app reload. All boards start expanded on every app launch.

**`DayView` component (new, PR #46, board collapse added PR #53)**: Fetches `GET /day-view/tasks?reference_date=YYYY-MM-DD` for Today or Tomorrow. Same structure and UX as FocusedView (loading/error/empty states, board-grouped rendering via shared `BoardGroupedTasks`), but shows all pending tasks (any priority) for the selected calendar day. Supports the same per-board collapse/expand with ▾/▸ chevron and "Collapse all / Expand all" button, with session-only per-view collapse state (independent for Today and Tomorrow, reset on app reload).

**`FocusedTaskCard` component (updated PR #46)**: Compact card with a 4px colored left border (`borderLeftColor: boardColor`). Displays: high-priority "★ High" badge (amber) when applicable, title, effective date chip using `getEffectiveDate`, label badges, and up to 3 link chips. Now uses a shared `TaskCardBody` component for its title/date/labels/links/actions rendering, with layout set to `'stacked'`. Inline quick-edit (added PR #42 on web, PR #46 on mobile) toggles an in-place `TaskQuickEdit` form (title + label toggles); tapping the Edit icon in the action row opens it. Complete and Delete buttons are also available in the action row (added PR #45 on web, PR #46 on mobile). Tapping anywhere on a non-editing card still opens `TaskFormScreen` in edit mode (unless `isEditing` is true, which suppresses the tap).

**`TaskCardBody` component (new, PR #46)**: A shared presentational component (RN port of the web component of the same name) used by both `TaskRow` (All view, inline layout) and `FocusedTaskCard` (Focused/Today/Tomorrow, stacked layout). Parameterized by `layout` (`'inline' | 'stacked'`), date-display mode (`'split'` or `'effective'`), priority-badge style (`'static'` — `'toggle'` is not used on mobile), and a labels render-prop. Owns Title/Date/Labels/Links/priority-indicator/Edit/Complete/Delete rendering, gated by `task.state === 'pending'` for the action row.

**`BoardGroupedTasks` component (new, PR #46)**: A shared rendering component for both FocusedView and DayView. Iterates over board groups and renders each via `FocusedTaskCard`.

**`TaskQuickEdit` component (new, PR #46)**: RN port of the web quick-edit component. Shown inline when `isEditing` is true on `FocusedTaskCard`. Renders: title `TextInput`, label chips grouped by category (Mode/Type only) with toggle interaction, and Save/Cancel row. Accepts an optional `labels` prop (board-scoped labels already on hand); when omitted, fetches via `listLabels(undefined, task.board_id)` — needed because FocusedTaskCard/DayView group tasks across boards.

**New mobile API module** (`mobile/src/api/focusedView.ts`, updated PR #46): Exports `FocusedBoard` interface (still used by both Focused View and Day View) plus `getFocusedViewTasks(referenceDate?)`. Config functions removed.

**New mobile API module** (`mobile/src/api/dayView.ts`, new PR #46): Exports `getDayViewTasks(referenceDate)` to fetch Day View tasks.

**Tests**: Existing `mobile/src/__tests__/focusedView.api.test.ts` refactored to cover only `getFocusedViewTasks` (config functions removed). New `mobile/src/__tests__/dayView.api.test.ts` with tests for `getDayViewTasks`. Deleted `mobile/src/__tests__/chatUtils.test.ts`. Total: 84 mobile unit tests pass (all 8 suites passing).

**Deployment**: OTA only — all JS/TS changes, no native modules, no `app.json` or `eas.json` changes.

---

## Day View

The Day View shows all pending tasks (any priority, not just high-priority) across all boards for a specific date or date range. It is used as the backing data for Today, Tomorrow, and Overdue views. Unlike Focused View, there is no configuration — Day View simply returns tasks matching the caller's date filter.

### Data Model

Day View uses the same `focused_view_configs` table for its future per-view configuration (when views expand beyond just Focused and Day). Currently, only Focused View configuration is stored.

### Day View API (shipped — PR #40, Overdue param added PR #55)

- `GET /api/v1/day-view/tasks?reference_date=YYYY-MM-DD` — returns all pending tasks (any `is_high_priority` value) matching a date filter, grouped by board (same response shape as Focused View: `{ "boards": [{ "board_id", "board_name", "board_color", "tasks": [TaskOut, ...] }, ...] }`). Boards are ordered alphabetically by name; within each board, tasks are sorted by `updated_at` descending. Boards with zero qualifying tasks are omitted. The `reference_date` query parameter is required (no default); omitting it returns `422`.
  - When `overdue=false` (default) — returns tasks with `must_do_by` or `target_date` equal to `reference_date` (used by Today and Tomorrow views).
  - When `overdue=true` (PR #55) — returns tasks whose effective date (earliest of `must_do_by`/`target_date`) is strictly before `reference_date` (used by Overdue view).

### Day View UI — Web frontend (shipped — PR #41, board collapse added PR #53, Overdue view added PR #55)

The Tasks page's **Today**, **Tomorrow**, and **Overdue** views render the Day View. Today and Tomorrow fetch `GET /day-view/tasks?reference_date=` for the respective date (with `overdue=false`, the default); Overdue fetches `GET /day-view/tasks?reference_date=today&overdue=true`. All three render results using the same board-grouped card layout as Focused View (`BoardGroupedTasks.tsx`, extracted from `FocusedView.tsx` and shared by all day-based views), including the same `FocusedTaskCard` cards — so the inline quick-edit added in PR #42 is available here too. Loading spinner while fetching; inline error banner with Retry on failure; empty state (e.g., "No overdue tasks", "No tasks for this period") with a Refresh button when no qualifying tasks exist. Day View is unconfigured — it always shows all-priority, all-board tasks for the specified date filter.

Each board group uses the same collapsible header design as Focused View (▾/▸ chevron, "Collapse all / Expand all" button), with session-only per-view collapse state (independent for Today, Tomorrow, and Overdue; reset on page reload).


---

## Task Model

### Core Fields
- **Title**: short description of the task
- **Notes**: optional longer description
- **Must-do-by date**: hard deadline
- **Target date**: aspirational completion date (e.g. "I want to return library books by Friday, but they're due Sunday")
- **State**: Pending or Done
- **High priority**: boolean flag. High priority is only meaningful for tasks whose effective date (earliest of `must_do_by` and `target_date`) falls on today, tomorrow, day-after-tomorrow, or Monday (if today is Friday). **`getEffectiveDate` correctly returns the minimum of the two dates when both are set (fixed in PR #20 for both web and mobile clients).** The backend auto-resets it to `false` whenever the effective date falls outside that window. At most **N high-priority tasks** are allowed per day (where N is the user-configured **High Priority Daily Limit**, defaulting to 3, minimum 1); the API returns 422 when the limit would be exceeded. Each calendar day (Today, Tomorrow, Day After Tomorrow, Monday) has its own independent limit enforcement as of PR #54.

### Links (shipped — PR #39, auto-ready rows and open-in-new-tab PR #52)

A task can have up to **3 links**, each with a required URL and a required short description (up to 200 characters). A URL must start with `http://` or `https://` (up to 2048 characters) — other schemes (e.g. `javascript:`, `data:`, `mailto:`) are rejected, both by client-side validation before submit and by the API.

- **Task Form**: A blank, ready-to-fill row always appears at the end of the links list while under the 3-link cap. When the user fills in both the URL and description for that row, a new blank row automatically appends (if the cap allows). There is no "+ Add link" button — the form handles row appending automatically. Each row can be removed independently. Saving is blocked with an inline error if a row has only one of URL/description filled in, or if a URL doesn't start with `http://`/`https://`; fully-blank rows are silently skipped. Saving a task always sends the full current link list to the API — removing all links and saving clears them. Each link with a valid URL displays an open-in-new-tab icon (web: SVG icon on hover, mobile: "↗" text) that opens the link in a new tab/app without navigating away from the form.
- **Task cards / rows** show each link by its description, not the raw URL. On web, hovering over a link reveals the full URL via a native tooltip and clicking opens it in a new tab. On mobile, tapping a link chip opens the URL directly — there is no hover step on touch, so the description is the only text shown.
- Links are **not yet supported by the AI conversational interface or belief generation** — tasks created via chat always have an empty links list; the AI does not read, suggest, or manage links.
- Links round-trip through offline sync on both platforms.

### Move Task Between Boards (shipped — PR #40)

A task can be moved from one board to another via `PUT /tasks/{id}` by providing a `board_id` field. **When a task is moved to a different board, its labels are unconditionally cleared** — this is necessary because labels are strictly board-scoped (a label from Board A has no meaning in Board B). The `board_id` field uses full-replace semantics: omitting it leaves the task's board unchanged (matching the behavior of `label_ids` and `links`); providing any value — including the current board — triggers the move logic. When `board_id` equals the task's current board, no change occurs and labels are preserved.

- **Label clearing behavior**: When a task moves to a new board, all labels are deleted server-side regardless of whether `label_ids` is included in the same request. If `label_ids` is also provided in the request, they are resolved against the **destination board's** labels (not the origin board). If none of the provided label IDs exist on the destination board, the request returns `422`.
- **API**: `PUT /tasks/{id}` with body `{ "board_id": "new-board-uuid" }` (and optionally other fields).
- **Sync**: Tasks pushed to `/sync` with a `board_id` that differs from their current board undergo the same move + label-clear logic.
- **Backward compat**: Stale clients that omit `board_id` in sync payloads continue to work — tasks stay on their current board.

### Labels
A task can have zero or more labels in fixed system-defined categories. A task may have **multiple labels within the same category** (e.g. both `online` and `email` under Mode).

| Category | Values | Editable? | UI Visible? |
|---|---|---|---|
| Frequency | one-time, daily, weekly, monthly, annual | No — Frequency is no longer a valid category in the API (PR #31); all DB rows deleted by SQL migration | **No** — hidden from all UI surfaces as of PR #29; no longer seeded as of PR #30; all DB rows deleted and enum value dropped as of PR #31 |
| Mode | online, phone, outdoor, email | No — Mode is no longer a valid category as of PR #51; all Mode labels deleted from database by startup migration; cannot be created via API (400 error) | **No** — Mode labels deleted from all boards (PR #51); no longer seeded or user-editable |
| Type | household, financial, child, trip, medical (defaults) | Yes — per-user; users can add, rename, and delete | Yes |

**Label ownership rules (shipped — PR #15, corrected in PR #16, updated PR #30, updated PR #31, updated PR #33, updated PR #51):**
- **All labels are per-board** — `labels.user_id` and `labels.board_id` are both `NOT NULL`. There are no global seed rows in the DB. A user's default board is seeded with **Type labels only** (5 entries total) on first access (as of PR #33, seeding is triggered by `resolve_board_id`/`ensure_board_seeded`; as of PR #37, also triggered by `GET /boards` directly — so the web frontend's `BoardContext`, which calls `GET /boards` on mount before any task or label endpoint, now creates the default board and labels for new users).
- **Label uniqueness is per-board**: the constraint is `(board_id, category, value)` — the same label value can exist independently in two different boards belonging to the same user.
- **Frequency** labels have been fully removed (PR #31): all frequency label rows were deleted from the DB by the SQL migration, `CategoryEnum.frequency` was removed from Python, and `GET /labels?category=frequency` now returns 400 (unknown category). Frequency labels cannot be created, edited, or deleted via the API and are not shown in Settings.
- **Mode** labels have been fully removed (PR #51): all Mode label rows were deleted from the database by a startup migration, the PostgreSQL `categoryenum` type was updated to drop the `'mode'` value, and `GET /labels?category=mode` / `POST /labels` with `category=mode` now return 400 (unknown/non-configurable category). Mode labels cannot be created, edited, or deleted via the API and are not shown in Settings.
- **Type** labels are per-user, per-board, and fully configurable: users can add, rename, and delete them. This is the only remaining configurable label category.
- Users cannot create or modify label *categories* — the one active category (Type) is fixed.
- The default Type value was renamed from `raghav` to `child` (applied via startup migration in PR #15).
- Seeding is driven by the `LABEL_SEED` constant in `models.py`; the `seed_board_labels()` helper lives in `services/label_service.py`. The seeding sentinel checks for any non-deleted boards (zero boards = new user) via `ensure_board_seeded()` in `services/board_service.py`.

**Frequency label removal — fully complete (PR #29 + PR #30 + PR #31 + PR #32):**
- `frequency` has been removed from all TypeScript `Label.category` unions in the frontend (`frontend/src/api/tasks.ts`) and mobile (`mobile/src/types/index.ts`) (PR #29 for UI surfaces, PR #32 for the `Label` interface itself).
- All label filter panels, label pickers (TaskForm / TaskFormScreen), label ordering arrays, color maps, and grouped-state initializers on both web and mobile no longer include `frequency` (PR #29).
- Backend recurrence logic removed (PR #30): `FREQUENCY_VALUES`, `_get_frequency_label()`, and `_next_due_date()` deleted from `task_service.py`; frequency labels no longer seeded for new users.
- **DB migration complete (PR #31)**: All frequency label rows deleted from the `labels` table (beliefs FK references nulled; `task_labels` join rows deleted). `frequency` dropped from the Postgres `categoryenum` enum type. `CategoryEnum.frequency` removed from Python. `GET /labels?category=frequency` returns 400 (unknown category). `POST /labels` with `category=frequency` returns 400. No frequency data remains in the DB.
- **Type cleanup complete (PR #32)**: `recurrence_group_id` removed from the `Task` TypeScript interface in both frontend (`frontend/src/api/tasks.ts`) and mobile (`mobile/src/types/index.ts`). The dead `.filter((l) => l.category !== 'frequency')` guard removed from `TaskCard.tsx`. Test fixture factories updated accordingly. `Label.category` union is now `'mode' | 'type'` throughout the TypeScript codebase.

**New label management API endpoints (shipped — PR #15, updated PR #31, updated PR #33, updated PR #51):**
- `POST /api/v1/labels` — create a new Type label for the current user in the specified board (or the default board if `board_id` is omitted). `400` if unknown/non-configurable category (Mode and Frequency categories are not configurable as of PR #51). `409` if a duplicate exists within that board. Strips whitespace.
- `PUT /api/v1/labels/{id}` — rename a Type label owned by the current user (403 if wrong owner, 400 if non-configurable category, 409 if duplicate name within the same board). Mode labels cannot be renamed (they were deleted in PR #51).
- `DELETE /api/v1/labels/{id}` — delete a Type label owned by the current user (403 if wrong owner, 400 if non-configurable category). Mode labels cannot be deleted (they were deleted in PR #51).

### Task Lifecycle

All tasks follow a single lifecycle: Pending → Done. Completing a task via `POST /tasks/{id}/complete` always returns `next_task: null` (shipped — PR #30).

**Recurrence logic removed (PR #30):** The backend no longer creates follow-on tasks when a task is marked done. `FREQUENCY_VALUES`, `_get_frequency_label()`, and `_next_due_date()` have been deleted from `task_service.py`. This makes recurrence behavior consistent with the UI-level removal of the Frequency label category (PR #29).

**DB migration complete (PR #31):** All frequency label rows have been deleted from the DB, `CategoryEnum.frequency` removed from Python, and `frequency` dropped from the Postgres enum. The `recurrence_group_id` column has also been dropped from the `tasks` table — it is absent from `TaskOut` schema, `GET /tasks` responses, `POST /sync` push and pull payloads, and the `GET /tasks` query parameter list. Stale mobile clients that still send `recurrence_group_id` in sync payloads are handled gracefully (the field is silently ignored).

**Board column added (PR #33):** `board_id` is now included in all `TaskOut` responses (`GET /tasks`, `POST /tasks`, `PUT /tasks/{id}`, etc.) and in sync pull payloads. `POST /tasks` and sync push accept an optional `board_id`; omitting it defaults to the user's default board. The sync pull response now includes a `boards` array containing any boards updated since `last_synced_at`. Stale clients that omit `board_id` in sync push task objects have their tasks automatically assigned to the user's default board.

**Type cleanup complete (PR #32):** `recurrence_group_id` has been removed from the `Task` TypeScript interface in both frontend and mobile clients, matching the backend schema. `Label.category` is now narrowed to `'mode' | 'type'` (the `'frequency'` variant has been removed from all TypeScript type declarations).

---

## AI Features

### Beliefs
The AI generates suggestions that users validate, following an RLHF-style feedback loop:
- **Suggested labels**: AI suggests which labels to apply given the task title/notes
- **Estimated time**: AI estimates how long the task will take

Users accept or reject each belief. Accepted beliefs carry more weight in future suggestions than pending or rejected ones.

---

## Frontend

- React 19 + Vite + TypeScript + Tailwind CSS; runs in the browser
- `npm run dev` for local development (Vite dev server proxies `/api` to `http://localhost:8000`)

### Pages / Tabs

1. **Tasks** (default `/`) — four session-only views selectable via a pill toggle, in this order: **Focused** (default), **Today**, **Tomorrow**, **All** (the kanban board). Current view is tracked in a session-only `ViewContext` and the active board in `BoardContext`; both are also encoded in the URL (`?view=&board=`). Because the contexts sit above the router, the selected view and board now survive navigating away to **Reports, Settings, or Task Detail and back** — not just Task Detail as before — while the URL encoding still restores the correct view/board on a hard reload or a shared/bookmarked link (shipped — PR #41; sticky cross-page state added PR #42). There is no "Show done" toggle on this page and no way to browse completed tasks from it (see "Task List / Kanban Board" below for full detail).
2. **Reports** (`/reports`) — completed tasks for a user-chosen date range. As of PR #41, this is the **only** place to view completed tasks on the web frontend (the Tasks page no longer has a completed-tasks view).
3. **Settings** (`/settings`) — manage per-user Type labels, configure the High Priority Daily Limit, and manage the account (sign in / sign out). Mode labels were removed in PR #51 (all existing Mode labels deleted from the database; the API now returns 400 for any Mode label operations). The Focused View config editor was removed from this page in PR #41 (backend endpoints remain live; see "Focused View" section).
4. **Task Detail** (`/tasks/:id`, `/tasks/new`) — create or edit a task with full field and label editing, including a board picker (shipped — PR #41; see "Task Form" below)

### Task List / Kanban Board

**Five-view redesign (shipped — web PR #41, Overdue view added PR #55):** The Tasks page header reads "Tasks Are Us - `<View>`" (Overdue/Focused/Today/Tomorrow) or "Tasks Are Us - `<Board name>`" (All). The "tasksAreUs" nav branding and the always-visible board-switcher dropdown were removed from the sidebar/mobile header; board switching is now done via **board tabs** shown only under the All view. The five views are (Overdue shown only when overdue tasks exist):

- **Overdue** (conditional, PR #55) — shows all pending tasks across all boards whose effective date (earliest of `must_do_by`/`target_date`) is strictly before today. Rendered only when at least one overdue task exists in any board. Selected as the default view on page load when overdue tasks exist; otherwise Focused is the default. Positioned first in the pill toggle before Focused.
- **Focused** — the existing high-priority, config-driven Focused View (see "Focused View" section).
- **Today** / **Tomorrow** — the Day View: all pending tasks (any priority) due that single day, across all boards, grouped by board (see "Day View" section).
- **All** — the kanban board described below, scoped to a single board at a time via board tabs.

**Board tabs** appear directly below the view toggle, right-aligned (PR #42), only when All is selected. Selecting a tab switches the shared active-board state used elsewhere in the app (e.g. task-creation defaults). Outside the All view there is no board picker on this page — creating a task instead defaults to the user's default (starred) board (see "Task Form" below). Note: as of PR #42, Settings' Labels editor no longer follows this shared active-board state — it has its own independent board selector (see "Settings Page" below).

**Text search — all views (repositioned and extended PR #56)**: A search box (magnifying-glass icon, placeholder "Search tasks…") appears in its own row, right-aligned, directly above the board-tabs row — previously it lived in the header row and only appeared in the All view. It now filters tasks by title and notes (case-insensitive) in all five views: Overdue, Focused, Today, Tomorrow, and All. In Overdue/Focused/Today/Tomorrow, boards with no matching tasks are dropped from the board-grouped card list entirely; if the search excludes every task, a "No tasks match this search" message replaces the board list (and the Collapse all/Expand all toggle is hidden alongside it, since there is nothing left to collapse). In the All view, search continues to compose with the label filter chips via AND semantics.

**No completed-task browsing on this page:** The "Show done" / pending toggle was removed entirely in PR #41. Once a task is completed it is no longer visible anywhere on the web Tasks page in any of the four views — completing a task removes it from view for the remainder of the session with no way to see it again except via the Reports page. This was an explicit, user-confirmed product decision (not a gap): the "Show done/pending" removal and "no replacement view for completed tasks in this PR" were called out as an accepted requirement during planning (`development-plans/PLAN-feat-tasks-view-redesign-web.md`) and were not raised as a concern in either round of plan review.

**All view (kanban board):**
- Pending tasks are shown in a **6+ column kanban board**: Overdue | Today | Tomorrow | Day After Tomorrow | [Monday (if Friday)] | Upcoming | No Date. Tasks whose effective date is in the past appear in the leftmost **Overdue** column (red accent), not in Today. The **Overdue** column is hidden entirely when it contains no tasks.
- **Column headers with date/day display (PR #54)**: Date columns (Today, Tomorrow, Day After Tomorrow, Monday if Friday) show the calendar date and day-of-week in their headers (e.g., "Today (July 27, Monday)"). Overdue, Upcoming, and No Date columns show static titles. A timezone bug where Day After Tomorrow displayed the same date as Tomorrow, and the Friday-only Monday column displayed Sunday's date instead of Monday's, was fixed in PR #56 — both now show the correct date.
- **High-priority/normal-priority split with collapsible zones (PR #54)**: **Overdue**, **Today**, **Tomorrow**, **Day After Tomorrow**, and **Monday** (if today is Friday) columns each split into two zones separated by a labeled divider: a high-priority zone (above the line, collapsible via chevron toggle) and a normal-priority zone (below the line, always visible). The high-priority cap does not apply within Overdue — tasks carry their existing priority; the cap re-engages when a task is dragged to Today or Tomorrow. Dropping a task *into* the Overdue column is blocked. When a column has more high-priority tasks than the configured limit, the column header shows a ⚠ N/M warning in amber. Each date column enforces the high-priority limit independently — the same `high_priority_daily_limit` setting applies per day, not globally across all columns.
- **Collapsible high-priority zones (PR #54; icon and click target updated PR #56)**: High-priority zones in Today, Tomorrow, Day After Tomorrow, and Monday columns display a collapsible header — an amber strip with a triangle icon (changed from a chevron in PR #56) and the "High Priority" label. Clicking anywhere on the strip (not just the icon) toggles collapse/expand — the icon remains a real `<button>` for keyboard users, so Tab+Enter/Space still works. When collapsed, the high-priority zone and its divider are hidden; when expanded, both are visible. The normal-priority zone always remains visible, regardless of the high-priority zone's state. Collapse state is **session-only** (stored in React state, never persisted) and resets to expanded on every page reload. Each column's collapse state is independent.
- **Monday column (if Friday, PR #54)**: When today is Friday, an additional **Monday** column appears after Day After Tomorrow (displaying "Monday (July 31, Monday)" with the actual date and day). The Monday column supports the same high-priority/normal-priority split and collapsible header as other date columns. It has its own independent high-priority limit. The column disappears immediately after Friday ends (no manual dismissal needed); tasks already assigned to Monday remain on Monday in the backend.
- **Drag-and-drop** between columns always updates `target_date` only via `PUT /tasks/:id` — `must_do_by` is never modified by a drag. Dragging to Day After Tomorrow sets `target_date` to today+2; dragging to Monday sets `target_date` to Monday (when today is Friday); dragging to No Date clears `target_date` only (preserving `must_do_by`). **Dropping into the Overdue or Upcoming columns is blocked** — both are read-only drop targets (Upcoming shows a "Read-only" placeholder; no highlight appears on hover). Dragging into the high zone sets `is_high_priority = true`; into the normal zone or Day After Tomorrow/Monday/No Date, it resets to `false`. The frontend enforces the user-configured high-priority limit before making the API call; the backend enforces it independently.
- **Label filter chips** are shown above the board (Mode / Type categories only — Frequency category hidden as of PR #29), only in the All view, right-aligned and sorted alphabetically by label value (updated PR #56). Filter state persists across navigation via React context.
- **Text search** — see "Text search — all views" above (PR #56 extended it beyond the All view). Within this view, search composes with the label filter chips via AND semantics.
- When navigating to New Task while a label filter is active, those labels are pre-checked in the form.
- **Task cards** show: title, high-priority badge (orange "High") when applicable, `must_do_by` date in red with "Overdue ·" prefix when past, `target_date` in gray (hidden when equal to `must_do_by`), label badges in Mode → Type order (Frequency badges removed from UI as of PR #29; tasks with existing frequency labels render without a frequency badge), and up to 3 links (shipped — PR #39; shown as their description — hovering reveals the full URL via a native tooltip, clicking opens it in a new tab). Inline edit (title + labels) via a shared `TaskQuickEdit` component (also used by Focused/Today/Tomorrow cards as of PR #42), inline complete, and inline delete are available directly on cards.

### Task Form (Create / Edit)

- Fields: Title (required), Notes, Must do by (date), Target date (date), High priority checkbox (visible only when at least one date field is set to today or tomorrow), Labels, Links (up to 3, shipped — PR #39).
- High priority checkbox disappears and submits as `false` for all other dates.
- Both date fields show an **× clear button** when a date is set, allowing one-click removal. In edit mode, clearing a date sends an explicit `null` to the backend so the field is actually cleared (not silently omitted).
- **Links (shipped — PR #39, auto-ready rows and open-in-new-tab PR #52)**: A blank row always appears at the end (while under the 3-link cap), ready for the user to start typing without an explicit "+ Add" step. When the user fills a row, a new blank row auto-appends. Each row has its own remove button. Links with valid URLs show an open-in-new-tab icon to open in a new tab without leaving the form. See "Links" under Task Model for validation rules.
- **Board picker (shipped — PR #41)**: a Board `<select>` dropdown lists all of the user's boards. Creating a task from the Focused/Today/Tomorrow views (where no board tab is visible) defaults the dropdown to the user's default (starred) board; creating from the All view defaults it to the currently selected board tab. Either default can be overridden before saving. Editing an existing task and selecting a different board moves the task (labels are cleared server-side — see "Move Task Between Boards"); an inline warning ("Moving to a different board will clear this task's labels.") appears once the selection differs from the task's current board. In edit mode, switching the dropdown re-scopes the Labels section to the new board's labels (shown as an inline "Loading labels…" placeholder while they load) without discarding the dropdown selection or any other in-progress field edits — the form stays mounted across the switch (fixed — PR #48; previously the labels refetch briefly unmounted the whole form, reverting the dropdown to the task's original board and wiping unsaved edits).
- **Form layout cleanup (PR #42)**: The "+ Add Link" control now appears immediately after Notes (previously it appeared after Labels), and the Notes textarea is taller. The redundant read-only label chips that used to render below the label picker (duplicating the picker's own selected/highlighted state) were removed.
- **Save button state (fixed — PR #48)**: After a successful edit save, "Save Changes" returns to its normal enabled state once the success banner appears, and stays clickable for a subsequent edit (previously it stayed disabled/stuck on "Saving…" indefinitely after every successful edit, even though the save itself succeeded and persisted).
- **Navigation on save (shipped — PR #52)**: After a successful save (create or edit), the page navigates back to the previous location (Tasks view, Reports, Settings, etc.) instead of remaining on the form. There is no transient success banner.

### Settings Page

- **Boards section (shipped — PR #34, updated PR #37)**: Appears at the top of Settings, above Labels. Shows all boards with: a color swatch (a circle showing the current hex color, or gray if unset — clicking opens a hidden native `<input type="color">`; color auto-saves with a 300ms debounce via `setColorBoard` in `BoardContext`; a `×` button (visible only when a color is set) clears the color); inline rename; a star icon to set the default board (the current default's star is amber and non-clickable); a Delete button (disabled for the default board or the only board — server errors such as "board has tasks" are surfaced inline); and a "+ Add board" button to create a new board.
- **Focused View config section — removed from web Settings (PR #41)**: The web Settings editor for Focused View config (board selection, day range) shipped in PR #37 was deleted as part of the Tasks-view redesign, along with the now-unused `getFocusedViewConfig`/`updateFocusedViewConfig` frontend calls. The backend `GET`/`PUT /focused-view/config` endpoints remain live and unchanged — nothing in the web frontend calls them anymore; the mobile Settings screen still has its own config editor (see "Focused View UI — Mobile app"). Users can no longer change their Focused View board-selection/day-range config from the web app.
- **Labels section (shipped — PR #15, updated PR #34, made board-neutral PR #42, updated PR #51)**: Appears below Boards, above High Priority Limit. Shows a **Type** subsection scoped to a board chosen **independently of the app's globally active board** (Mode labels were removed in PR #51 — all existing Mode labels deleted from database, no longer editable): a dropdown selector appears next to the "Labels" heading whenever the user has more than one board (defaulting to the currently active board on load, and self-healing to the active board or first board if the selected one is deleted), letting the user pick which board's labels to view/edit here without changing the board selected elsewhere in the app (e.g. the Tasks page's board tabs). When the user has only one board, no selector is shown. Each Type label has Edit and Delete buttons; the subsection has an Add button to create new values. Labels created here are added to the selected board. Frequency and Mode labels are not shown here (they are not editable). Changes take effect immediately in TaskForm label pickers and on task cards.
- **High Priority Daily Limit**: numeric input (min 1) that sets the per-day cap for high-priority tasks in Today and Tomorrow columns. Defaults to 3 when unset. Reducing the limit below the current count is allowed — a warning is shown but no retroactive removal occurs. Persisted server-side via `user_settings.high_priority_daily_limit`.
- **Connection section (shipped — PR #25)**: Shown at the bottom of Settings (below the Save Settings button). Displays an environment badge — green "Production" when the app is served over HTTPS, yellow "Development" otherwise — and the resolved API base URL. A "Test Connection" button pings `GET /api/v1/health` (unauthenticated) and reports either "Connected Xms" (with measured round-trip latency) or "Failed: <error message>". Implemented on both the web frontend and the mobile app.

---

## Reports

Users can view a history of completed tasks over a user-selected date range. The Reports page shows a date-range picker (From / To), a total completions count, and a list of completed tasks each with their completion timestamp and labels. Recurring task completions are individually recorded so history is accurate.

---

## Authentication

Firebase Authentication is the only identity mechanism. All device-based auth infrastructure (`device_uuid`, `POST /users`, `POST /users/migrate`) has been removed. The backend auto-creates a user row on first authenticated request.

- **Phase 1 (shipped — PR #12)**: Backend only. The backend accepts `Authorization: Bearer <firebase_id_token>` on all endpoints. Three new columns added to `users`: `firebase_uid` (unique, indexed), `email`, `display_name`. The `auth_provider` column is now populated with the Firebase sign-in provider string.
- **Phase 2 (shipped — PR #13)**: Frontend login UI using Firebase JS SDK. The browser sends `Authorization: Bearer <firebase_id_token>`. Key behaviours:
  - **Anonymous sign-in**: On first load the app calls `signInAnonymously()` automatically — zero friction, same UX as before.
  - **Named sign-in**: Users can upgrade from anonymous to a named account via Google (OAuth popup) or email magic link. Named sign-in is only exposed when the user explicitly signs out; anonymous is never a user-facing choice.
  - **LoginPage**: Shown only after an explicit sign-out; offers Google and magic-link options.
  - **Settings → Account section**: Anonymous users see upgrade options (Google / email); named users see their display name / email and a Sign out button.
  - **`client.ts`**: Calls `auth.currentUser?.getIdToken()` asynchronously; attaches `Authorization: Bearer` header on every request.
- **Phase 3 (shipped)**: Removed legacy `X-User-ID` fallback path from the backend; removed `useUser.ts` shim. Bearer token is now the only accepted auth path.
- **Phase 4 (shipped — PR #17)**: Removed all device-based identity infrastructure. Dropped `device_uuid` column from `users` table. Deleted `POST /users` (device registration) and `POST /users/migrate` endpoints, along with `UserCreate`, `MigrateRequest`, and `MigrateOut` schemas, `frontend/src/api/users.ts`, and historical migration scripts (`migrate_user_data.py`, `recover_data.py`). Firebase auto-create in `get_current_user` is now the sole user-creation path.

Sign-in providers supported: Google (OAuth popup) and email magic link. Apple sign-in may be added via Firebase in a future phase (not yet configured).

---

---

## Mobile App

A React Native + Expo managed-workflow client (`mobile/`) ships alongside the web frontend. Both clients share the same `/api/v1` backend; there is no mobile-specific API surface.

### Tech Stack
- **Framework**: React Native with Expo SDK 54 (managed workflow — no custom dev client required for development)
- **Language**: TypeScript
- **Styling**: NativeWind v4 (Tailwind CSS for React Native), configured via Metro and Babel
- **Navigation**: React Navigation v7 — bottom tab navigator
- **Auth**: Firebase JS SDK v10 with `@react-native-async-storage/async-storage` for persistence (compatible with Expo Go)
- **Google OAuth**: `expo-auth-session` (browser-based redirect flow, not a native popup — works in Expo Go)
- **Deep-link scheme**: `tasksareus://` for magic link sign-in in standalone builds

### Navigation / Tabs
The mobile app has three bottom tabs, mirroring the web app's primary pages:

| Tab | Equivalent web route | Status |
|-----|----------------------|--------|
| Tasks | `/` | **Shipped — PR #20** |
| Reports | `/reports` | **Shipped — PR #24** |
| Settings | `/settings` | **Shipped — PR #23** |

**Chat tab removed (PR #46)**: The Chat tab was removed from mobile as part of the Tasks-view redesign. The backend conversational endpoints remain live. A future PR is expected to rebuild the mobile Chat UI (the web Chat UI was similarly removed in PR #41 pending a rebuild).

### Authentication (shipped — PR #18)
Mobile auth follows the same Firebase-only identity model as the web frontend, with mobile-specific implementation details:

- **Anonymous auto-sign-in**: On first launch (or after any non-deliberate sign-out) the app calls `signInAnonymously()` automatically — zero friction.
- **Google Sign-In**: Uses `expo-auth-session` browser redirect flow. In Expo Go, the Expo Go redirect URI (`exp://[local-ip]:8081`) must be added to Google Cloud Console → Authorized redirect URIs.
- **Magic link**: `sendSignInLinkToEmail` with `handleCodeInApp: true`. The email link carries the `tasksareus://` deep-link URL. **Known limitation**: in Expo Go, the email link opens in the system browser and cannot redirect back into the app; the UI notes this explicitly. Full magic-link sign-in (auto-redirect) works only in standalone builds.
- **Cross-device magic link**: If the link is opened on a different device than where it was requested, the app prompts the user to confirm their email address before completing sign-in.
- **LoginScreen**: Shown only after a deliberate sign-out; offers Google and magic-link options.
- **SettingsScreen → Account section**: Shows "Anonymous user" or the signed-in user's display name / email, plus a Sign out button. Anonymous users are offered Google sign-in and email sign-in options to upgrade to a named account. Full label management, High Priority Limit, and starter questions configuration are now also available (shipped — PR #23).
- **Deliberate sign-out flag**: A module-level boolean (resets on app force-quit) prevents the auto-anonymous-sign-in from firing after an explicit sign-out.
- **API client** (`mobile/src/api/client.ts`): Calls `auth.currentUser?.getIdToken()` asynchronously; attaches `Authorization: Bearer <token>` on every request to `EXPO_PUBLIC_API_URL/api/v1`.

### Tasks Screen (shipped — PR #20, updated PR #21, updated PR #26, updated PR #27, updated PR #46, Overdue view added PR #55, header reflow PR #56)

The Tasks tab supports five session-only views (Overdue, Focused, Today, Tomorrow, All), selectable via a pill toggle in the screen header. The Overdue pill is rendered only when overdue tasks exist; otherwise four views are shown. The header reads "Tasks Are Us - `<View>`" (Overdue/Focused/Today/Tomorrow) or "Tasks Are Us - `<Board>`" (All). Overdue is the default view on page load when overdue tasks exist; otherwise Focused is the default.

**All view (kanban board)**:
The All view is a `SectionList` grouped by date proximity:

- **Grouped sections**: Overdue (red header) → Today → Tomorrow → Day After Tomorrow → Upcoming → No Date; empty sections are hidden.
- **Collapse / expand sections (shipped — PR #26)**: Each section header is tappable to collapse or expand it. Today and Overdue start expanded on first load; all other sections start collapsed. When collapsed, the task count is shown in parentheses after the section title (e.g. "Tomorrow (3)"). An "Expand" / "Collapse" text button in the screen header toggles all sections at once (visible only in All view).
- **Board tabs (shipped — PR #46)**: Board tabs appear directly below the view toggle, visible only when All view is selected. Selecting a tab switches the shared active-board state. Creating a task while in All view defaults the board picker to the currently selected tab.
- **Task row**: title, effective-date chip, high-priority amber top bar + amber star badge, label badges (mode=green, type=purple — frequency badges removed from UI as of PR #29), up to 3 link chips (shipped — PR #39; shown as their description — tapping a chip opens the URL directly, no hover step on touch), and an Edit button (added PR #46) for parity with task cards in other views. Tapping a task row or the Edit button opens it in the task form in edit mode; tapping a link chip opens the link instead.
- **Complete/Delete actions (shipped — PR #46)**: Inline Complete and Delete buttons are available on all task rows.
- **Filter panel (shipped — PR #26, updated PR #46)**: A `☰` icon in the screen header opens a collapsible filter panel. The icon turns indigo when any filter is active (visible only in All view). The panel provides:
  - **Text search**: filters tasks by title and notes simultaneously (case-insensitive, live filtering) — same AND semantics as the web client.
  - **Label chips**: grouped by category (Mode / Type — Frequency chips removed as of PR #29) with the same category colors as task badges; tap to toggle; multiple selections compose with AND logic.
  - **"Clear filters" link**: visible when any filter is active; resets text search and label selection.
- **Drag-and-drop between sections (shipped — PR #27, updated PR #28)**: Long-press (500ms) any pending task to enter drag mode. A ghost card lifts and follows the finger. Section headers highlight in indigo as valid drop targets. On drop, sets `target_date` only — matching web behavior; `must_do_by` is never modified by drag. Drop targets and their resulting `target_date` values: Today → today, Tomorrow → tomorrow, Day After Tomorrow → today+2, No Date → null. **Dropping onto the Overdue or Upcoming sections is silently rejected** — neither section highlights during a drag; the task stays put. Scroll is disabled while a drag is active. The high-priority limit (from user settings) is enforced for Today/Tomorrow drops of already-high-priority tasks — an Alert is shown and the drop is cancelled if the limit would be exceeded. The optimistic update reverts on API error. The list auto-scrolls when the finger is within 80px of the top or bottom edge.

**Overdue, Focused, Today, Tomorrow views**:
These views show day-specific and priority-specific tasks. Tasks are grouped by board and displayed as cards with inline quick-edit capability:

- **Overdue view (PR #55)**: Shows all pending tasks across all boards whose effective date (earliest of `must_do_by`/`target_date`) is strictly before today, grouped by board. Rendered only when at least one overdue task exists. Uses the shared `DayView` component.
- **Focused view**: Shows only high-priority tasks from all boards for the configured day range. See "Focused View UI — Mobile app" section above for full detail.
- **Today / Tomorrow views (shipped — PR #46)**: Show all pending tasks (any priority) across all boards for that single calendar day, grouped by board. Same as Focused view but without the priority filter. Uses the shared `DayView` component.
- **Board-grouped rendering (shipped — PR #46)**: Tasks are grouped by board, each group headed by a color-coded board name and task count. Tasks within each board are sorted by `updated_at` descending.
- **Task cards (shipped — PR #46)**: Compact cards with stacked layout (title, effective date, labels, links, actions below). Inline quick-edit is available via a shared `TaskQuickEdit` component (same as web). Complete and Delete buttons (added PR #45 on web, PR #46 on mobile) are available directly on cards. Tapping anywhere on a non-editing card still opens the full `TaskFormScreen` modal (unless the card is in inline-edit mode, which suppresses the tap).
- **Loading/error/empty states**: Loading spinner while fetching; inline error banner with Retry button on failure; empty state with Refresh button when no qualifying tasks exist.
- **No completed-task browsing**: Completed tasks are never shown on the Tasks screen in any view; the "Show completed" toggle removed entirely in PR #46. Once a task is completed it is no longer visible except via the Reports page.

**Common header and controls:**
- **Two-row header (updated PR #56)**: The header is split into two rows to give the view-mode pills room to breathe. Row 1 holds the screen title and the "+" create button. Row 2 (directly below) holds the view-mode pill toggle on the left, and — All view only — the Collapse/Expand button and the filter toggle (☰) grouped on the right. Previously all of these shared a single row, which pushed the rightmost pill (e.g. "All") off-screen once a fifth pill (Overdue) was added. Board tabs continue to render in their own row below, unaffected by this change.
- **"+" button**: tapping the indigo "+" button in the Tasks header opens the task form in create mode. When one or more label filters are active (All view only), those labels are pre-selected in the new task form (shipped — PR #28). Edit mode is unaffected — the form always reflects the task's own labels when editing. When creating a task from Focused/Today/Tomorrow views (no board tabs), the form defaults to the user's default (starred) board; when creating from All view, it defaults to the currently selected board tab.
- **Pull-to-refresh**: `RefreshControl` wired to the current view's fetch mode.
- **Focus refresh**: `useFocusEffect` re-fetches data on every tab focus (stays fresh after web-app edits and Settings label changes).
- **Empty state**: "No pending tasks" when no tasks exist; "No tasks match your filters" when filters are active and yield no results (All view only).

New files shipped in PR #20:
- `mobile/src/utils/taskGrouping.ts` — pure `groupTasksForList(tasks, referenceDate?)` → `SectionList` sections
- `mobile/src/__tests__/taskGrouping.test.ts` — 11 unit tests covering all section keys and edge cases

### Task Form — Create / Edit (shipped — PR #21, updated PR #46)

`TaskFormScreen` is a slide-up modal (`pageSheet` presentation) used for both creating and editing tasks on mobile. It is surfaced from `TasksScreen` via a `Modal` component — no stack navigator change was needed.

**Fields:**
- **Title** (required) — auto-focuses in create mode
- **Notes** — multiline text input; unconditionally trimmed on save to fix a prior bug where blank notes were silently omitted (PR #46)
- **Links (shipped — PR #39, reordered PR #46, auto-ready rows and open-in-new-tab PR #52)** — up to 3 description + URL row pairs; a blank row always appears at the end (while under the 3-link cap), ready for the user to start typing without an explicit "+ Add" step. When the user fills a row, a new blank row auto-appends. Each row has its own remove button. Links with valid URLs show an open-in-new-tab icon ("↗" text) that opens the URL via the system app without leaving the form. Same validation as web: both fields required per non-blank row, URL must start with `http://` or `https://`. Moved to appear immediately after Notes (previously after Labels). See "Links" under Task Model for full rules.
- **Must do by** — date picker field with × clear button
- **Target date** — date picker field with × clear button
- **High priority** — checkbox visible only when at least one date is set to today or tomorrow (same eligibility rule as the web form). The checkbox is hidden and submits as `false` for all other dates. `isFormHighPriorityEligible` guards against overdue dates: both conditions must hold — the date must be `>= today` **and** `<= tomorrow`.
- **Board picker (shipped — PR #46)** — a set of board-name pills; tapping one selects that board for the task. When creating a task from Focused/Today/Tomorrow views (no board tabs), the form defaults to the user's default (starred) board; when creating from the All view, it defaults to the currently selected board tab. In edit mode, the form shows the task's current board; selecting a different board displays an inline warning ("Moving to a different board will clear this task's labels.") and clears the selected labels (server-side behavior when a task is moved between boards).
- **Labels** — grouped by Mode → Type (Frequency section removed as of PR #29); tap to toggle; matches web form colour coding (mode=green, type=purple). Board-scoped — labels are fetched for the selected board and change whenever the board is switched.

**Behaviour:**
- **Create mode** ("New Task" header): opened by the "+" button; title field is auto-focused; saves via `POST /api/v1/tasks` to the selected board.
- **Edit mode** ("Edit Task" header): opened by tapping a task row; form pre-populated with existing field values; saves via `PUT /api/v1/tasks/:id`. Clearing a date field sends an explicit `null` to the backend so the field is actually cleared. Moving a task to a different board updates the `board_id` field and unconditionally clears labels (server-side: labels are resolved against the destination board).
- **Native date picker**: `@react-native-community/datetimepicker` — iOS shows an inline calendar; Android shows a system modal dialog.
- **422 handling**: if the backend returns 422 (high-priority limit reached), a user-friendly `Alert` is shown and the high-priority checkbox is automatically unchecked.
- **Cancel**: dismisses the modal without changes.
- After a successful save, the task list silently re-fetches to reflect the change.
- **Label dependency fix (PR #46)**: Labels are now keyed on the actual selected board ID, not the stale active-board context, ensuring labels are always fetched from the correct board.

New file shipped in PR #21:
- `mobile/src/screens/TaskFormScreen.tsx` — 380-line create/edit form component

**API client improvement (PR #21):** `mobile/src/api/client.ts` now exports an `ApiError` class (extends `Error`) carrying the HTTP `status` code. All `apiFetch` errors are thrown as `ApiError` instances, enabling callers to branch on specific status codes (e.g. 422).

### Settings Screen (shipped — PR #23, updated PR #46)

`SettingsScreen` is a fully scrollable screen replacing the earlier placeholder. It uses `KeyboardAvoidingView` + `ScrollView` to handle on-screen keyboards gracefully.

**Sections:**

- **Boards section (shipped — PR #35)**: Inserted at the top of `SettingsScreen`. See "Board UI — Mobile app" section above for full detail.
- **Labels section (shipped — PR #15, updated PR #34, made board-scoped PR #46, updated PR #51)**: Type subsection only, showing the user's personal label list scoped to a board chosen **independently of the app's globally active board** (Mode labels were removed in PR #51 — all existing Mode labels deleted from database, no longer editable). When the user has more than one board, a dropdown selector appears next to the "Labels" heading, letting the user pick which board's labels to view/edit here without changing the board selected elsewhere in the app (e.g. the Tasks page's board tabs). The selector defaults to the currently active board on load and self-heals to the active board (or first board) if the selected board is deleted. Each Type label has inline rename (tap to edit, submit to save, Cancel to abort) and Delete (with confirmation alert). The Type subsection has an "+ Add" button to create a new label. Frequency and Mode labels are not shown here (they are not editable/immutable). Changes take effect immediately against the live API. Labels created here are added to the selected board.
- **Focused View config section — removed (PR #46)**: The mobile Settings editor for Focused View config (board selection, day range) was removed as part of the Tasks-view redesign. The backend `GET`/`PUT /focused-view/config` endpoints remain live and unchanged.
- **High Priority Daily Limit**: stepper with − and + buttons (clamped to minimum 1) showing the current limit numerically. Persisted server-side via the Save button.
- **Save Settings button**: persists High Priority Limit in a single `PUT /settings` call. Shows a "Settings saved" confirmation banner for 3 seconds on success.
- **Connection section (shipped — PR #25)**: Shown below Labels. Displays an environment badge — green "Production" when `EXPO_PUBLIC_API_URL` starts with `https://`, yellow "Development" otherwise — and the resolved API base URL. A "Test Connection" button pings `GET /api/v1/health` (unauthenticated) and reports either "Connected Xms" or "Failed: <error message>".
- **Account section**: see Authentication section above.

### Reports Screen (shipped — PR #24)

`ReportsScreen` is a fully implemented reports view replacing the earlier "Coming in PR 6" placeholder.

**Behaviour:**
- **Date-range picker**: From and To text inputs accepting ISO `YYYY-MM-DD` format. Defaults to the last 7 days (today−6 through today) on first render. Uses local-timezone date arithmetic so the defaults are always correct regardless of UTC offset.
- **Go button**: Lazy fetch — no request is made on mount. The user adjusts the date range first, then taps Go to run the report. The button is disabled while a request is in flight or either date field is empty.
- **Pre-fetch state**: An illustrated "Set a date range and tap Go" prompt is shown before the first fetch.
- **Loading spinner**: `ActivityIndicator` is shown while the request is in flight.
- **Summary bar**: After a successful fetch, shows "N completion(s)" (singular/plural) in the header area.
- **Completions list**: Scrollable list of `CompletionRow` cards, each showing: task title (up to 2 lines), formatted completion timestamp (locale date + time), and label badges sorted Mode → Type (Frequency removed from sort order and rendering as of PR #29).
- **Empty state**: Illustrated "No completions in this range" when `total === 0`.
- **Dismissable error banner**: Shown inline on network or API failure; user can tap Dismiss to clear it.

**Backend boundary fix (PR #24):** The `GET /reports/completions` endpoint's `to_date` filter was changed from `completed_at <= to_date` to `completed_at < to_date + 1 day`. This ensures that tasks completed at any time on the `to_date` calendar day are included; previously, PostgreSQL's implicit cast of a bare DATE to midnight excluded tasks completed after 00:00 on the `to_date`.

### Utility Code
Pure utility functions (`taskDateUtils`, `taskFilters`, `taskPriority`, `chatUtils`) and TypeScript types are copied from `frontend/src/` rather than extracted into a shared module. This is a deliberate no-monorepo decision — no shared package or workspace linking is used.

### Environment / Config
`mobile/.env.example` documents all required environment variables: Firebase project config, Google OAuth client IDs (web, iOS, Android), and `EXPO_PUBLIC_API_URL`.

**EAS Build (shipped — PR #25):** `mobile/eas.json` configures two EAS build profiles: `development` (dev-client build, reads `EXPO_PUBLIC_API_URL` from `.env`) and `production` (ad-hoc distribution, bakes in `https://tasksareus-production.up.railway.app` as `EXPO_PUBLIC_API_URL` at build time). The production binary installs directly from an EAS build URL — no TestFlight or App Store required.

---

## Out of Scope (initial build)

- Custom label *categories* (the one active category — Type — is fixed for all users; Frequency has been fully removed as of PR #31; Mode has been fully removed as of PR #51)
- Editing or deleting Frequency label values — moot; all frequency data has been removed from the DB (PR #31)
- Trip as a separate entity (trip is a Type label value)
- Admin dashboard for cost tracking (note: per-call AI cost logging to the `ai_cost_log` table is implemented in the backend; only the admin-facing dashboard surface is out of scope)
- ~~Native mobile app (iOS/Android)~~ — **now in scope**: React Native + Expo mobile client is being built (PR #18 scaffolded the project; feature screens follow in subsequent PRs)

---

*Last updated by — *Bashful* after PR #56 (feat: extend text search to all five Tasks-page views (web) via a new `filterBoards` helper and repositioned search box, right-align/alphabetize label filter chips (web), reflow the mobile Tasks-screen header into two rows to stop the "All" pill clipping off-screen (mobile only), and fix two high-priority-divider UX issues (triangle icon, whole-strip-clickable) plus two Day-After-Tomorrow/Monday column date-display bugs (web only)). Previous update after PR #55 (feat: add Overdue view — new session-only pill-toggle view positioned before Focused, rendered only when overdue tasks exist, selected as default view when they do; uses `/day-view/tasks?overdue=true` endpoint). Previous update after PR #52 (feat: improve task edit form — nav-back-on-save (web only), auto-ready link rows (web + mobile), open-in-new-tab icons for valid URLs (web + mobile); removed "+ Add link" button in favor of auto-appending blank rows; added comprehensive unit tests for the new `withReadyLinkRow()` function). Previous update after PR #51 (chore: remove Mode label category — startup migration deletes all Mode labels from database, updates PostgreSQL ENUM type to only include 'type', logs completion; API now rejects POST /labels with category=mode or category=frequency with 400; only Type labels are configurable; backend temporarily keeps Mode in CategoryEnum Python enum to avoid ORM crashes). Previous update after PR #50 (chore: removed chat/conversations API end-to-end — deleted `/conversations` router and backend conversational endpoints, `Conversation`/`Message` models, `starter_questions` setting from all platforms, and related DB tables via startup migration). Previous update after PR #48 (web: fixed two Task Detail Form bugs — switching the Board dropdown mid-edit no longer unmounts and resets the form, and "Save Changes" no longer gets stuck on "Saving…" after a successful edit). Previous update after PR #46 (mobile: Tasks-view redesign with 4-way view mode — Focused/Today/Tomorrow/All; Day View UI shipped; Chat tab and Focused View config editor removed from mobile). Previous update after PR #42 (web: quick-edit extended to Focused/Today/Tomorrow cards; Settings' Labels made board-neutral)*
