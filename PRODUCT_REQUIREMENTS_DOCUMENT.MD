# tasksAreUs — Product Requirements

## Overview

tasksAreUs is a task management app with a Python/FastAPI/PostgreSQL backend, a React 19 + Vite web frontend, and a React Native + Expo mobile client. Users manage tasks through a kanban board and a conversational AI interface. The app is multi-tenant from day one. Identity is Firebase-only: the backend auto-creates a user row on first authenticated request; no device registration or migration step is needed.

---

## Boards

Each user can have up to **10 boards** (server-side cap: `MAX_BOARDS_PER_USER = 10`). Boards are the top-level organizational unit — tasks, labels, and conversations each belong to exactly one board.

**Default board**: Every user has exactly one default board. For new users it is created automatically on first access (any endpoint hit) and named **"General tasks"**. Existing users received a "General tasks" board via startup migration (PR #33) — all their existing tasks, labels, and conversations were assigned to it.

**Board isolation**: Labels and tasks are strictly board-scoped. A label from Board A cannot be applied to a task in Board B. The AI (both belief generation and conversational interface) only sees tasks and labels belonging to the conversation's board.

**Label seeding**: When a new board is created for a new user, mode and type labels (9 entries total) are seeded into that board. Label uniqueness is enforced per board: `(board_id, category, value)` — not per user.

**Backward compatibility**: All pre-existing endpoints accept requests that omit `board_id`. The server resolves the missing value to the user's default board, so old mobile and web clients continue to work without changes.

### Board API (shipped — PR #33)

- `GET /api/v1/boards` — list the current user's non-deleted boards, ordered default-first then by creation time. Returns a `boards` array. As of PR #37, `ensure_board_seeded()` is called at the top of this endpoint — a brand-new user gets their default "General tasks" board and 9 default labels created on the first `GET /boards` call (previously seeding was only triggered by task/label endpoints via `resolve_board_id`).
- `POST /api/v1/boards` — create a new board for the current user. `422` if the 10-board cap would be exceeded. `400` if the name is empty.
- `PUT /api/v1/boards/{id}` — rename a board, change its default status, or set/clear its color. Setting `is_default: true` atomically demotes the previously-default board. Setting `is_default: false` on the current default returns `400` — promote another board first. The `color` field accepts a 7-character hex string (e.g. `#6366f1`) or `null` to clear; omitting `color` entirely leaves the existing value unchanged (sentinel logic via `model_fields_set`). `BoardOut` now includes `color: Optional[str]`.
- `DELETE /api/v1/boards/{id}` — soft-delete a board. Returns `400` if it is the only board, the default board, or still has tasks or labels.

### Board UI — Web frontend (shipped — PR #34)

- **Board switcher — removed, replaced by board tabs (PR #41)**: The always-visible `BoardSwitcher.tsx` dropdown (previously embedded in the desktop sidebar below the "tasksAreUs" title, and in the mobile web header) was deleted. Board switching on the web is now done via **board tabs** on the Tasks page, visible only when the All view is selected (see "Task List / Kanban Board"). This is an explicit, user-confirmed tradeoff: re-scoping Settings' board-scoped Labels editor to a different board now requires Tasks → All → pick a board tab → Settings, rather than switching from any page via the old always-visible dropdown.
- **Create board inline**: Still available from the Settings → Boards section via a "+ Add board" button (inline text input; submitting creates the board via `POST /boards` and immediately activates it; a `422` (board cap reached) or `400` (empty name) error is shown inline). The switcher-dropdown "New board" option described in earlier PRs no longer exists, since the switcher itself was removed in PR #41.
- **Active board state**: Tracked in `BoardContext`. Initialised to the user's default board on every app open — never persisted to localStorage. Switching boards clears any active label filters (labels from Board A are not valid in Board B).
- **Board-scoped data**: All data fetches (tasks, labels, reports) are scoped to the active board by passing `board_id` to API calls. Hooks (`useTasks`, `useLabels`) and pages (`TaskDetailPage`, `ReportsPage`, `SettingsPage`) re-fetch automatically when the active board changes. (`ChatPage`'s board-scoping is moot on web as of PR #41 — see the Chat Page aspirational note above.)
- **Reports re-fetch on board switch**: The Reports page re-fetches automatically when the active board changes.
- **Settings — Boards section**: A new "Boards" section appears at the top of the Settings page (above Labels). It shows all boards with inline rename, set-default (star icon), and delete actions. Delete is disabled for the default board and for the only remaining board. Adding a new board is available via a "+ Add board" button. The Labels section heading shows the active board's name to make clear which board's labels are being managed.

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

**FocusedTaskCard component** (`frontend/src/components/FocusedTaskCard.tsx`): Compact card with a 4px left colored border (`boardColor`). Displays: title (up to 2 lines, ellipsis), high-priority badge (amber "★ High"), date chip using `getEffectiveDate` (red if overdue), label badges from `task.labels` (mode=green, type=purple). Click navigates to `/tasks/${task.id}`. No drag-and-drop. Labels are rendered directly from `task.labels` — no separate label prop needed.

**Label filter chips shown only in the All view (updated PR #41)**: Label filter chips, text search, and the loading/error banners are all gated on `viewMode === 'all'` — none of them appear in Focused, Today, or Tomorrow.

**New frontend API module** (`frontend/src/api/focusedView.ts`): Exports `FocusedViewConfig` and `FocusedBoard` interfaces plus `getFocusedViewConfig()`, `updateFocusedViewConfig()`, and `getFocusedViewTasks(referenceDate?)`.

**New unit tests**: 2 new tests in `frontend/src/__tests__/boards.api.test.ts` covering `updateBoard` with a hex color and with `null` (clear).

### Focused View UI — Mobile app (shipped — PR #38)

**Color swatches in Settings → Boards**: Each board row in Settings → Boards gets a horizontal row of 8 pre-defined color swatches (20×20 circles from a fixed 8-color palette: `['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6']`) plus a "None" swatch (gray circle with ✕) at position 0. Tapping a swatch sets that board's color via `setColorBoard`; tapping the active swatch (or the "None" swatch) clears the color to `null`. The active swatch is highlighted with a border ring and shadow. No native color-picker module is required — the 8-swatch palette is OTA-deployable and uses the same palette as the web's `FocusedView.tsx` fallback.

**Focused View config section in SettingsScreen**: A `FocusedViewConfigSection` component appears between the Boards section and the Labels section. Loads config via `getFocusedViewConfig()` on mount. Fields: board selection radio (All boards / Selected boards); board checkboxes visible only when "Selected boards" is chosen (sourced from `useBoard()` directly); day range radio (Today only / Today + tomorrow / Today + 2 days). Has its own Save button that calls `updateFocusedViewConfig` with all three fields required (`board_selection`, `selected_board_ids`, `day_range` — matching the backend contract). Inline error and success banners; independent `busy` and `error` state local to this component.

**View mode toggle in TasksScreen header**: A two-button pill toggle ("All" | "Focus") appears in the TasksScreen header when "Show done" is off. The Collapse/Expand button and the filter (☰) button are hidden in focused mode. Switching to "Show done" resets the view mode to "All" (detailed). `filterOpen` is reset to `false` when switching to focused mode. A `focusedViewKey` counter is incremented on each `useFocusEffect` when `viewMode === 'focused'`, forcing `FocusedView` to remount and re-fetch fresh data on every tab re-focus (prevents stale data after changing focused view config in Settings).

**`FocusedView` component** (inline in `TasksScreen`, rendered when view mode is "Focus" and "Show done" is off): Fetches `GET /focused-view/tasks?reference_date=YYYY-MM-DD` on mount using `dateOnly(new Date())` for local-timezone correctness. Shows a loading spinner while fetching; inline error banner with Retry on failure; empty state ("No focused tasks for this period") with a Refresh button when no qualifying tasks exist. Renders board sections in a `ScrollView` — tasks stacked vertically in a single column (appropriate for phone widths). Each board section header shows a colored dot (board color or palette fallback), board name, and task count badge. Board color comes from `board.board_color` or falls back to the 8-color palette indexed by board position.

**`FocusedTaskCard` component**: Compact card with a 4px colored left border (`borderLeftColor: boardColor`). Displays: title (2-line clamp with ellipsis), high-priority "★ High" badge (amber) when `is_high_priority` is true, effective date chip using `getEffectiveDate` (red if overdue, gray otherwise), label badges from `task.labels` (mode=green, type=purple). Tapping the card calls `onPress(id)`, which opens `TaskFormScreen` in edit mode via the same `handleEditPress` handler used by `DraggableTaskRow`. No drag-and-drop.

**New mobile API module** (`mobile/src/api/focusedView.ts`): Exports `FocusedViewConfig` and `FocusedBoard` interfaces plus `getFocusedViewConfig()`, `updateFocusedViewConfig()` (all three fields required), and `getFocusedViewTasks(referenceDate?)`.

**Tests**: 2 new tests in `mobile/src/__tests__/boards.api.test.ts` for `updateBoard` with hex color and with `null` (9 tests total in that file); new `mobile/src/__tests__/focusedView.api.test.ts` with 7 tests covering all three API functions. Total: 86 mobile unit tests pass.

**Deployment**: OTA only — all JS/TS changes, no native modules, no `app.json` or `eas.json` changes.

---

## Day View

The Day View shows all pending tasks (any priority, not just high-priority) across all boards for a single calendar day. It is used as the backing data for Today and Tomorrow views (PR 2-3 of the 3-PR epic). Unlike Focused View, there is no configuration — Day View simply returns tasks due on the specified date.

### Data Model

Day View uses the same `focused_view_configs` table for its future per-view configuration (when views expand beyond just Focused and Day). Currently, only Focused View configuration is stored.

### Day View API (shipped — PR #40)

- `GET /api/v1/day-view/tasks?reference_date=YYYY-MM-DD` — returns all pending tasks (any `is_high_priority` value) with `must_do_by` or `target_date` equal to the specified `reference_date`, grouped by board (same response shape as Focused View: `{ "boards": [{ "board_id", "board_name", "board_color", "tasks": [TaskOut, ...] }, ...] }`). Boards are ordered alphabetically by name; within each board, tasks are sorted by `updated_at` descending. Boards with zero qualifying tasks are omitted. The `reference_date` query parameter is required (no default); omitting it returns `422`.

### Day View UI — Web frontend (shipped — PR #41)

The Tasks page's **Today** and **Tomorrow** views render the Day View. Selecting either fetches `GET /day-view/tasks?reference_date=` for today or tomorrow (respectively) and renders the results using the same board-grouped card layout as Focused View (`BoardGroupedTasks.tsx`, extracted from `FocusedView.tsx` and shared by both Day View and Focused View). Loading spinner while fetching; inline error banner with Retry on failure; empty state ("No tasks for this period") with a Refresh button when no qualifying tasks exist. There is no configuration for Day View — it always shows all-priority, all-board tasks for the single selected day.

> **[ASPIRATIONAL]** — Not yet shipped. Mobile Day View UI (Today/Tomorrow views in the mobile Tasks screen) is PR 3 of the 3-PR epic and has not been implemented yet.

---

## Task Model

### Core Fields
- **Title**: short description of the task
- **Notes**: optional longer description
- **Must-do-by date**: hard deadline
- **Target date**: aspirational completion date (e.g. "I want to return library books by Friday, but they're due Sunday")
- **State**: Pending or Done
- **High priority**: boolean flag. High priority is only meaningful for tasks whose effective date (earliest of `must_do_by` and `target_date`) falls on today or tomorrow. **`getEffectiveDate` correctly returns the minimum of the two dates when both are set (fixed in PR #20 for both web and mobile clients).** The backend auto-resets it to `false` whenever the effective date falls outside that window. At most **N high-priority tasks** are allowed per day (where N is the user-configured **High Priority Daily Limit**, defaulting to 3, minimum 1); the API returns 422 when the limit would be exceeded.

### Links (shipped — PR #39)

A task can have up to **3 links**, each with a required URL and a required short description (up to 200 characters). A URL must start with `http://` or `https://` (up to 2048 characters) — other schemes (e.g. `javascript:`, `data:`, `mailto:`) are rejected, both by client-side validation before submit and by the API.

- **Task Form**: an "+ Add link" control adds a description + URL row pair (disabled once 3 links are present); each row can be removed independently. Saving is blocked with an inline error if a row has only one of URL/description filled in, or if a URL doesn't start with `http://`/`https://`; fully-blank rows are silently skipped. Saving a task always sends the full current link list to the API — removing all links and saving clears them.
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
| Mode | online, phone, outdoor, email (defaults) | Yes — per-user; users can add, rename, and delete | Yes |
| Type | household, financial, child, trip, medical (defaults) | Yes — per-user; users can add, rename, and delete | Yes |

**Label ownership rules (shipped — PR #15, corrected in PR #16, updated PR #30, updated PR #31, updated PR #33):**
- **All labels are per-board** — `labels.user_id` and `labels.board_id` are both `NOT NULL`. There are no global seed rows in the DB. A user's default board is seeded with **Mode and Type labels only** (9 entries total) on first access (as of PR #33, seeding is triggered by `resolve_board_id`/`ensure_board_seeded`; as of PR #37, also triggered by `GET /boards` directly — so the web frontend's `BoardContext`, which calls `GET /boards` on mount before any task or label endpoint, now creates the default board and labels for new users).
- **Label uniqueness is per-board**: the constraint is `(board_id, category, value)` — the same label value can exist independently in two different boards belonging to the same user.
- **Frequency** labels have been fully removed (PR #31): all frequency label rows were deleted from the DB by the SQL migration, `CategoryEnum.frequency` was removed from Python, and `GET /labels?category=frequency` now returns 400 (unknown category). Frequency labels cannot be created, edited, or deleted via the API and are not shown in Settings.
- **Mode** and **Type** labels are per-user, per-board, and fully configurable: users can add, rename, and delete them.
- Users cannot create or modify label *categories* — the two active categories (Mode, Type) are fixed.
- The default Type value was renamed from `raghav` to `child` (applied via startup migration in PR #15).
- Seeding is driven by the `LABEL_SEED` constant in `models.py`; the `seed_board_labels()` helper lives in `services/label_service.py`. The seeding sentinel checks for any non-deleted boards (zero boards = new user) via `ensure_board_seeded()` in `services/board_service.py`.

**Frequency label removal — fully complete (PR #29 + PR #30 + PR #31 + PR #32):**
- `frequency` has been removed from all TypeScript `Label.category` unions in the frontend (`frontend/src/api/tasks.ts`) and mobile (`mobile/src/types/index.ts`) (PR #29 for UI surfaces, PR #32 for the `Label` interface itself).
- All label filter panels, label pickers (TaskForm / TaskFormScreen), label ordering arrays, color maps, and grouped-state initializers on both web and mobile no longer include `frequency` (PR #29).
- Backend recurrence logic removed (PR #30): `FREQUENCY_VALUES`, `_get_frequency_label()`, and `_next_due_date()` deleted from `task_service.py`; frequency labels no longer seeded for new users.
- **DB migration complete (PR #31)**: All frequency label rows deleted from the `labels` table (beliefs FK references nulled; `task_labels` join rows deleted). `frequency` dropped from the Postgres `categoryenum` enum type. `CategoryEnum.frequency` removed from Python. `GET /labels?category=frequency` returns 400 (unknown category). `POST /labels` with `category=frequency` returns 400. No frequency data remains in the DB.
- **Type cleanup complete (PR #32)**: `recurrence_group_id` removed from the `Task` TypeScript interface in both frontend (`frontend/src/api/tasks.ts`) and mobile (`mobile/src/types/index.ts`). The dead `.filter((l) => l.category !== 'frequency')` guard removed from `TaskCard.tsx`. Test fixture factories updated accordingly. `Label.category` union is now `'mode' | 'type'` throughout the TypeScript codebase.

**New label management API endpoints (shipped — PR #15, updated PR #31, updated PR #33):**
- `POST /api/v1/labels` — create a new Mode or Type label for the current user in the specified board (or the default board if `board_id` is omitted). `400` if unknown/non-configurable category. `409` if a duplicate exists within that board. Strips whitespace.
- `PUT /api/v1/labels/{id}` — rename a Mode or Type label owned by the current user (403 if wrong owner, 400 if non-configurable category, 409 if duplicate name within the same board)
- `DELETE /api/v1/labels/{id}` — delete a Mode or Type label owned by the current user (403 if wrong owner, 400 if non-configurable category)

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

### Conversational Interface
The primary interaction mode on mobile. (On the web frontend, the Chat UI was removed in PR #41 pending a rebuild — see "Chat Page" under Frontend for detail; the endpoints below are unaffected and still serve the mobile Chat screen.) Each conversation is tied to a specific board (via `board_id` on the `conversations` table). The AI only sees tasks and labels belonging to that board — there is no cross-board leakage. Supported input styles:

1. **Journal-style entries** — freeform natural language:
   - "I need to return books to the library tomorrow" → creates a task with a due date
   - "I did laundry today" → finds the matching pending task and marks it Done
   - The AI determines whether to create or complete a task

2. **Questions** about the user's tasks:
   - "What tasks do I need to do this week?"
   - "What online tasks can I do in the next hour?"
   - Date-based queries match on both `must_do_by` and `target_date` — tasks are not omitted from AI context just because they only have a `target_date`.

3. Every response must include one or more **suggested follow-up questions** that the app can actually answer and that don't repeat what was just answered.

`POST /conversations` accepts an optional `board_id`; omitting it defaults the conversation to the user's default board. The conversation's `board_id` is included in the `ConversationOut` response (shipped — PR #33).

---

## Frontend

- React 19 + Vite + TypeScript + Tailwind CSS; runs in the browser
- `npm run dev` for local development (Vite dev server proxies `/api` to `http://localhost:8000`)

### Pages / Tabs

1. **Tasks** (default `/`) — four session-only views selectable via a pill toggle, in this order: **Focused** (default), **Today**, **Tomorrow**, **All** (the kanban board). Current view and active board are encoded in the URL (`?view=&board=`), so returning from Task Detail restores exactly where the user was. There is no "Show done" toggle on this page and no way to browse completed tasks from it (shipped — PR #41; see "Task List / Kanban Board" below for full detail).
2. **Reports** (`/reports`) — completed tasks for a user-chosen date range. As of PR #41, this is the **only** place to view completed tasks on the web frontend (the Tasks page no longer has a completed-tasks view).
3. **Settings** (`/settings`) — manage per-user labels (Mode and Type), configure the High Priority Daily Limit, define up to 5 starter questions, and manage the account (sign in / sign out). The Focused View config editor was removed from this page in PR #41 (backend endpoints remain live; see "Focused View" section).
4. **Task Detail** (`/tasks/:id`, `/tasks/new`) — create or edit a task with full field and label editing, including a board picker (shipped — PR #41; see "Task Form" below)

> **[ASPIRATIONAL]** — Not yet shipped on the web frontend. A dedicated **Chat** page/tab (`/chat`) previously existed but its UI was removed in PR #41 (`ChatPage.tsx`, its nav entry, and `frontend/src/api/conversations.ts` deleted) as part of the Tasks-view redesign. The backend conversational endpoints are untouched and the mobile Chat screen is unaffected. A future PR is expected to rebuild the web Chat UI.

### Task List / Kanban Board

**Four-view redesign (shipped — web PR #41):** The Tasks page header reads "Tasks Are Us - `<View>`" (Focused/Today/Tomorrow) or "Tasks Are Us - `<Board name>`" (All). The "tasksAreUs" nav branding and the always-visible board-switcher dropdown were removed from the sidebar/mobile header; board switching is now done via **board tabs** shown only under the All view. The four views are:

- **Focused** (default) — the existing high-priority, config-driven Focused View (see "Focused View" section).
- **Today** / **Tomorrow** — the Day View: all pending tasks (any priority) due that single day, across all boards, grouped by board (see "Day View" section).
- **All** — the kanban board described below, scoped to a single board at a time via board tabs.

**Board tabs** appear directly below the view toggle, only when All is selected. Selecting a tab switches the same shared active-board state used elsewhere in the app (e.g. Settings' Labels editor). Outside the All view there is no board picker on this page — creating a task instead defaults to the user's default (starred) board (see "Task Form" below).

**No completed-task browsing on this page:** The "Show done" / pending toggle was removed entirely in PR #41. Once a task is completed it is no longer visible anywhere on the web Tasks page in any of the four views — completing a task removes it from view for the remainder of the session with no way to see it again except via the Reports page. This was an explicit, user-confirmed product decision (not a gap): the "Show done/pending" removal and "no replacement view for completed tasks in this PR" were called out as an accepted requirement during planning (`development-plans/PLAN-feat-tasks-view-redesign-web.md`) and were not raised as a concern in either round of plan review.

**All view (kanban board):**
- Pending tasks are shown in a **6-column kanban board**: Overdue | Today | Tomorrow | Day After Tomorrow | Upcoming | No Date. Tasks whose effective date is in the past appear in the leftmost **Overdue** column (red accent), not in Today. The **Overdue** column is hidden entirely when it contains no tasks.
- **Overdue**, **Today**, and **Tomorrow** columns each split into two zones separated by a labeled divider: a high-priority zone (above the line) and a normal-priority zone (below the line). The high-priority cap does not apply within Overdue — tasks carry their existing priority; the cap re-engages when a task is dragged to Today or Tomorrow. Dropping a task *into* the Overdue column is blocked. When a column has more high-priority tasks than the configured limit, the column header shows a ⚠ N/M warning in amber. The **Day After Tomorrow** column has no high-priority zone split — it renders as a simple column (like Upcoming and No Date).
- **Drag-and-drop** between columns always updates `target_date` only via `PUT /tasks/:id` — `must_do_by` is never modified by a drag. Dragging to Day After Tomorrow sets `target_date` to today+2; dragging to No Date clears `target_date` only (preserving `must_do_by`). **Dropping into the Overdue or Upcoming columns is blocked** — both are read-only drop targets (Upcoming shows a "Read-only" placeholder; no highlight appears on hover). Dragging into the high zone sets `is_high_priority = true`; into the normal zone or Day After Tomorrow/No Date, it resets to `false`. The frontend enforces the user-configured high-priority limit before making the API call; the backend enforces it independently.
- **Label filter chips** are shown above the board (Mode / Type categories only — Frequency category hidden as of PR #29), only in the All view. Filter state persists across navigation via React context.
- **Text search** (All view only) filters tasks by title and notes simultaneously (case-insensitive). Search and label filters compose with AND semantics.
- When navigating to New Task while a label filter is active, those labels are pre-checked in the form.
- **Task cards** show: title, high-priority badge (orange "High") when applicable, `must_do_by` date in red with "Overdue ·" prefix when past, `target_date` in gray (hidden when equal to `must_do_by`), label badges in Mode → Type order (Frequency badges removed from UI as of PR #29; tasks with existing frequency labels render without a frequency badge), and up to 3 links (shipped — PR #39; shown as their description — hovering reveals the full URL via a native tooltip, clicking opens it in a new tab). Inline edit (title + labels), inline complete, and inline delete are available directly on cards.

### Task Form (Create / Edit)

- Fields: Title (required), Notes, Must do by (date), Target date (date), High priority checkbox (visible only when at least one date field is set to today or tomorrow), Labels, Links (up to 3, shipped — PR #39).
- High priority checkbox disappears and submits as `false` for all other dates.
- Both date fields show an **× clear button** when a date is set, allowing one-click removal. In edit mode, clearing a date sends an explicit `null` to the backend so the field is actually cleared (not silently omitted).
- **Links (shipped — PR #39)**: an "+ Add link" control (disabled at 3 links) adds a description + URL row; each row has its own remove button. See "Links" under Task Model for validation rules.
- **Board picker (shipped — PR #41)**: a Board `<select>` dropdown lists all of the user's boards. Creating a task from the Focused/Today/Tomorrow views (where no board tab is visible) defaults the dropdown to the user's default (starred) board; creating from the All view defaults it to the currently selected board tab. Either default can be overridden before saving. Editing an existing task and selecting a different board moves the task (labels are cleared server-side — see "Move Task Between Boards"); an inline warning ("Moving to a different board will clear this task's labels.") appears once the selection differs from the task's current board.

### Chat Page

> **[ASPIRATIONAL]** — Not yet shipped on the web frontend. The web Chat page/UI (formerly `/chat`) was removed in PR #41 as part of the Tasks-view redesign; the description below reflects the mobile Chat screen (unaffected) and the still-live backend conversational endpoints. A future PR is expected to rebuild the web Chat UI.

- Suggested follow-up questions from the AI are shown as clickable chips after each assistant response; clicking a chip sends it as the next message.

### Settings Page

- **Boards section (shipped — PR #34, updated PR #37)**: Appears at the top of Settings, above Labels. Shows all boards with: a color swatch (a circle showing the current hex color, or gray if unset — clicking opens a hidden native `<input type="color">`; color auto-saves with a 300ms debounce via `setColorBoard` in `BoardContext`; a `×` button (visible only when a color is set) clears the color); inline rename; a star icon to set the default board (the current default's star is amber and non-clickable); a Delete button (disabled for the default board or the only board — server errors such as "board has tasks" are surfaced inline); and a "+ Add board" button to create a new board. The Labels section heading shows the active board name to make clear which board's labels are being managed.
- **Focused View config section — removed from web Settings (PR #41)**: The web Settings editor for Focused View config (board selection, day range) shipped in PR #37 was deleted as part of the Tasks-view redesign, along with the now-unused `getFocusedViewConfig`/`updateFocusedViewConfig` frontend calls. The backend `GET`/`PUT /focused-view/config` endpoints remain live and unchanged — nothing in the web frontend calls them anymore; the mobile Settings screen still has its own config editor (see "Focused View UI — Mobile app"). Users can no longer change their Focused View board-selection/day-range config from the web app.
- **Labels section (shipped — PR #15, updated PR #34)**: Appears below Boards, above High Priority Limit and Starter Questions. Shows **Mode** and **Type** subsections scoped to the **active board**. Each label has Edit and Delete buttons; each subsection has an Add button to create new values. Labels created here are added to the active board. Frequency labels are not shown here (they are not editable). Changes take effect immediately in TaskForm label pickers and on task cards.
- **High Priority Daily Limit**: numeric input (min 1) that sets the per-day cap for high-priority tasks in Today and Tomorrow columns. Defaults to 3 when unset. Reducing the limit below the current count is allowed — a warning is shown but no retroactive removal occurs. Persisted server-side via `user_settings.high_priority_daily_limit`.
- Configure up to 5 starter questions saved server-side. Questions can be added, removed, and reordered.
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
The mobile app has four bottom tabs, mirroring the web app's four primary pages:

| Tab | Equivalent web route | Status |
|-----|----------------------|--------|
| Tasks | `/` | **Shipped — PR #20** |
| Chat | `/chat` | **Shipped — PR #22** |
| Reports | `/reports` | **Shipped — PR #24** |
| Settings | `/settings` | **Shipped — PR #23** |

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

### Tasks Screen (shipped — PR #20, updated PR #21, updated PR #26, updated PR #27)

The Tasks tab is fully implemented as a `SectionList` grouped by date proximity:

- **Grouped sections**: Overdue (red header) → Today → Tomorrow → Day After Tomorrow → Upcoming → No Date; empty sections are hidden.
- **Collapse / expand sections (shipped — PR #26)**: Each section header is tappable to collapse or expand it. Today and Overdue start expanded on first load; all other sections start collapsed. When collapsed, the task count is shown in parentheses after the section title (e.g. "Tomorrow (3)"). An "Expand" / "Collapse" text button in the screen header toggles all sections at once.
- **Task row**: title, effective-date chip, high-priority amber top bar + amber star badge, label badges (mode=green, type=purple — frequency badges removed from UI as of PR #29), and up to 3 link chips (shipped — PR #39; shown as their description — tapping a chip opens the URL directly, no hover step on touch). Tapping a task row opens it in the task form in edit mode; tapping a link chip opens the link instead. Completed tasks shown via the filter panel appear faded (reduced opacity) with a strikethrough title and without the high-priority bar or star.
- **Filter panel (shipped — PR #26)**: A `☰` icon in the screen header opens a collapsible filter panel. The icon turns indigo when any filter is active. The panel provides:
  - **Text search**: filters tasks by title and notes simultaneously (case-insensitive, live filtering) — same AND semantics as the web client.
  - **Label chips**: grouped by category (Mode / Type — Frequency chips removed as of PR #29) with the same category colors as task badges; tap to toggle; multiple selections compose with AND logic.
  - **"Show completed" switch**: when on, re-fetches all tasks (not just pending); completed tasks appear in their date sections faded with a strikethrough title and no complete button.
  - **"Clear filters" link**: visible when any filter is active; resets text search, label selection, and show-completed toggle.
- **Drag-and-drop between sections (shipped — PR #27, updated PR #28)**: Long-press (500ms) any pending task to enter drag mode. A ghost card lifts and follows the finger. Section headers highlight in indigo as valid drop targets. On drop, sets `target_date` only — matching web behavior; `must_do_by` is never modified by drag. Drop targets and their resulting `target_date` values: Today → today, Tomorrow → tomorrow, Day After Tomorrow → today+2, No Date → null. **Dropping onto the Overdue or Upcoming sections is silently rejected** — neither section highlights during a drag; the task stays put. Scroll is disabled while a drag is active. Done tasks are not draggable. The high-priority limit (from user settings) is enforced for Today/Tomorrow drops of already-high-priority tasks — an Alert is shown and the drop is cancelled if the limit would be exceeded. The optimistic update reverts on API error. The list auto-scrolls when the finger is within 80px of the top or bottom edge.
- **Complete**: check button → `completeTask()` → optimistic remove + background re-fetch (picks up the next recurring occurrence automatically). The complete button is hidden for completed tasks shown via "Show completed".
- **Delete**: trash button → confirmation dialog → `deleteTask()` → optimistic remove.
- **"+" button**: tapping the indigo "+" button in the Tasks header opens the task form in create mode. When one or more label filters are active, those labels are pre-selected in the new task form (shipped — PR #28). Edit mode is unaffected — the form always reflects the task's own labels when editing.
- **Loading state**: full-screen spinner on first load.
- **Error state**: friendly message + Retry button.
- **Pull-to-refresh**: `RefreshControl` wired to the current fetch mode (pending-only or all tasks depending on "Show completed").
- **Focus refresh**: `useFocusEffect` re-fetches tasks and labels on every tab focus (stays fresh after web-app edits and Settings label changes).
- **Empty state**: "No pending tasks" when no tasks exist; "No tasks match your filters" when filters are active and yield no results.

New files shipped in PR #20:
- `mobile/src/utils/taskGrouping.ts` — pure `groupTasksForList(tasks, referenceDate?)` → `SectionList` sections
- `mobile/src/__tests__/taskGrouping.test.ts` — 11 unit tests covering all section keys and edge cases

### Task Form — Create / Edit (shipped — PR #21)

`TaskFormScreen` is a slide-up modal (`pageSheet` presentation) used for both creating and editing tasks on mobile. It is surfaced from `TasksScreen` via a `Modal` component — no stack navigator change was needed.

**Fields:**
- **Title** (required) — auto-focuses in create mode
- **Notes** — multiline text input
- **Must do by** — date picker field with × clear button
- **Target date** — date picker field with × clear button
- **High priority** — checkbox visible only when at least one date is set to today or tomorrow (same eligibility rule as the web form). The checkbox is hidden and submits as `false` for all other dates. `isFormHighPriorityEligible` guards against overdue dates: both conditions must hold — the date must be `>= today` **and** `<= tomorrow`.
- **Labels** — grouped by Mode → Type (Frequency section removed as of PR #29); tap to toggle; matches web form colour coding (mode=green, type=purple)
- **Links (shipped — PR #39)** — up to 3 description + URL row pairs; an "+ Add link" button (disabled at 3) adds a row, each row has its own remove button. Same validation as web: both fields required per non-blank row, URL must start with `http://` or `https://`. See "Links" under Task Model for full rules.

**Behaviour:**
- **Create mode** ("New Task" header): opened by the "+" button; title field is auto-focused; saves via `POST /api/v1/tasks`.
- **Edit mode** ("Edit Task" header): opened by tapping a task row; form pre-populated with existing field values; saves via `PUT /api/v1/tasks/:id`. Clearing a date field sends an explicit `null` to the backend so the field is actually cleared.
- **Native date picker**: `@react-native-community/datetimepicker` — iOS shows an inline calendar; Android shows a system modal dialog.
- **422 handling**: if the backend returns 422 (high-priority limit reached), a user-friendly `Alert` is shown and the high-priority checkbox is automatically unchecked.
- **Cancel**: dismisses the modal without changes.
- After a successful save, the task list silently re-fetches to reflect the change.

New file shipped in PR #21:
- `mobile/src/screens/TaskFormScreen.tsx` — 380-line create/edit form component

**API client improvement (PR #21):** `mobile/src/api/client.ts` now exports an `ApiError` class (extends `Error`) carrying the HTTP `status` code. All `apiFetch` errors are thrown as `ApiError` instances, enabling callers to branch on specific status codes (e.g. 422).

### Chat Screen (shipped — PR #22)

`ChatScreen` is a fully working conversational AI interface replacing the earlier placeholder.

**Behaviour:**
- **Lazy conversation creation**: `POST /conversations` fires on the first message send, not on screen mount. No conversation is created if the user never types.
- **Optimistic user message**: the user's message bubble appears immediately with a temporary ID; it is replaced with the confirmed message once the API responds.
- **Typing indicator**: an `ActivityIndicator` spinner inside an assistant bubble is shown while awaiting the AI response.
- **Suggested follow-up chips**: rendered below each assistant message; tapping a chip sends it immediately as the next message.
- **Multiline input**: `TextInput` expands up to 120pt tall, then scrolls internally. The send button is disabled while the input is empty or a send is in flight (prevents double-send).
- **Keyboard handling**: `KeyboardAvoidingView` with `padding` behaviour on iOS and `height` on Android keeps the input field above the software keyboard.
- **Error handling**: an inline dismissible error banner is shown on send failure; the optimistic message is removed (rolled back) on error.
- **Auto-scroll**: `ScrollView.scrollToEnd` fires on `onContentSizeChange` to keep the latest message visible.
- **Empty state**: a 💬 icon is shown before any messages exist. If the user has configured starter questions, they appear as indigo chips ("What would you like to know?") that can be tapped to send immediately; if no starter questions are configured, a plain "Ask me about your tasks" prompt is shown instead (shipped — PR #23).
- **Board-scoped conversations (shipped — PR #35)**: `createConversation(boardId?)` passes the active board's ID when starting a new conversation. A `useEffect([activeBoard?.id])` resets `conversationIdRef` and clears messages whenever the active board changes, ensuring the next message creates a fresh conversation scoped to the new board.

New files shipped in PR #22:
- `mobile/src/utils/chatUtils.ts` — pure utility functions extracted for testability: `buildOptimisticMessage`, `confirmMessages`, `rollbackMessage`
- `mobile/src/__tests__/chatUtils.test.ts` — 9 Jest unit tests covering message-state transitions

### Settings Screen (shipped — PR #23)

`SettingsScreen` is a fully scrollable screen replacing the earlier placeholder. It uses `KeyboardAvoidingView` + `ScrollView` to handle on-screen keyboards gracefully.

**Sections:**

- **Labels**: Mode and Type subsections, each showing the user's personal label list. Each label has inline rename (tap to edit, submit to save, Cancel to abort) and Delete (with confirmation alert). Each subsection has an "+ Add" button to create a new label. Frequency labels are not shown here (they are immutable). Changes take effect immediately against the live API.
- **High Priority Daily Limit**: stepper with − and + buttons (clamped to minimum 1) showing the current limit numerically. Persisted server-side along with starter questions via the Save button.
- **Starter Questions**: up to 5 text inputs. Questions can be added (up to 5), edited inline, and removed individually. A counter shows `(N/5)` in the section header. Saved server-side via `PUT /settings` when the user taps "Save Settings".
- **Save Settings button**: persists High Priority Limit and Starter Questions together in a single `PUT /settings` call. Shows a "Settings saved" confirmation banner for 3 seconds on success.
- **Boards section (shipped — PR #35)**: Inserted at the top of `SettingsScreen` (above Connection and Labels). See "Board UI — Mobile app" section above for full detail.
- **Connection section (shipped — PR #25)**: Shown below Boards (above Labels). Displays an environment badge — green "Production" when `EXPO_PUBLIC_API_URL` starts with `https://`, yellow "Development" otherwise — and the resolved API base URL. A "Test Connection" button pings `GET /api/v1/health` (unauthenticated) and reports either "Connected Xms" or "Failed: <error message>".
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

- Custom label *categories* (the two active categories — Mode, Type — are fixed for all users; Frequency has been fully removed as of PR #31)
- Editing or deleting Frequency label values — moot; all frequency data has been removed from the DB (PR #31)
- Trip as a separate entity (trip is a Type label value)
- Admin dashboard for cost tracking (note: per-call AI cost logging to the `ai_cost_log` table is implemented in the backend; only the admin-facing dashboard surface is out of scope)
- ~~Native mobile app (iOS/Android)~~ — **now in scope**: React Native + Expo mobile client is being built (PR #18 scaffolded the project; feature screens follow in subsequent PRs)

---

*Last updated by — *Bashful* after PR #41 (web: four-view Tasks page — Focused/Today/Tomorrow/All — replacing the Detailed/Focused toggle and the Show done/pending toggle; board tabs replace the always-visible board switcher; Day View UI shipped on web; board picker added to Task Form; web Chat UI and web Focused View Settings editor removed pending a future rebuild, both marked aspirational)*
