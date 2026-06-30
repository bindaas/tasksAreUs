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

- `GET /api/v1/boards` — list the current user's non-deleted boards, ordered default-first then by creation time. Returns a `boards` array.
- `POST /api/v1/boards` — create a new board for the current user. `422` if the 10-board cap would be exceeded. `400` if the name is empty.
- `PUT /api/v1/boards/{id}` — rename a board, change its default status, or set/clear its color. Setting `is_default: true` atomically demotes the previously-default board. Setting `is_default: false` on the current default returns `400` — promote another board first. The `color` field accepts a 7-character hex string (e.g. `#6366f1`) or `null` to clear; omitting `color` entirely leaves the existing value unchanged (sentinel logic via `model_fields_set`). `BoardOut` now includes `color: Optional[str]`.
- `DELETE /api/v1/boards/{id}` — soft-delete a board. Returns `400` if it is the only board, the default board, or still has tasks or labels.

### Board UI — Web frontend (shipped — PR #34)

- **Board switcher**: A dropdown embedded in the desktop sidebar (below the "tasksAreUs" title) and the mobile web header shows the active board name. Clicking it opens a dropdown listing all boards (active board highlighted, default board marked with a star). Selecting a board switches the active board instantly; no API call is made on switch.
- **Create board inline**: A "New board" option at the bottom of the switcher dropdown opens an inline text input; submitting creates the board via `POST /boards` and immediately activates it. A `422` (board cap reached) or `400` (empty name) error is shown inline.
- **Active board state**: Tracked in `BoardContext`. Initialised to the user's default board on every app open — never persisted to localStorage. Switching boards clears any active label filters (labels from Board A are not valid in Board B).
- **Board-scoped data**: All data fetches (tasks, labels, conversation creation, reports) are scoped to the active board by passing `board_id` to API calls. Hooks (`useTasks`, `useLabels`) and pages (`TaskDetailPage`, `ChatPage`, `ReportsPage`, `SettingsPage`) re-fetch automatically when the active board changes.
- **Chat reset on board switch**: Switching boards resets the current conversation so the new chat is scoped to the new board's tasks and labels.
- **Reports re-fetch on board switch**: The Reports page re-fetches automatically when the active board changes.
- **Settings — Boards section**: A new "Boards" section appears at the top of the Settings page (above Labels). It shows all boards with inline rename, set-default (star icon), and delete actions. Delete is disabled for the default board and for the only remaining board. Adding a new board is available via a "+ Add board" button. The Labels section heading shows the active board's name to make clear which board's labels are being managed.

### Board UI — Mobile app (shipped — PR #35)

- **BoardContext**: `BoardProvider` + `useBoard()` added to the mobile app, mounted inside `AppNavigator`'s authenticated branch (wrapping the `Tab.Navigator`). Fetches boards via `GET /boards` once on mount and exposes `activeBoard`, `boards`, `setActiveBoard`, `createBoard`, `renameBoard`, `setDefaultBoard`, `deleteBoard`, and `refetch`. On fetch, `activeBoard` is preserved when the same board still exists after a mutation; otherwise it resets to the default board.
- **Board switcher in Tasks header**: The active board name is shown as a tappable title in the `TasksScreen` header. When the user has more than one board, a "▾" chevron is shown. Tapping opens an inline dropdown overlay (absolute-positioned below the header, `zIndex: 50`) listing all boards — a checkmark marks the active board and a star marks the default. Tapping a board calls `setActiveBoard()` and closes the dropdown.
- **Filter reset on board switch**: A `useEffect([activeBoard?.id])` in `TasksScreen` clears the label filter selection, text search query, and show-done toggle whenever the active board changes.
- **Board-scoped data fetches (mobile)**: All API calls now pass `activeBoard?.id` as an optional `boardId` parameter: `listTasks`, `createTask`, `listLabels`, `createLabel`, `createConversation`, and `getCompletions`. Each API helper accepts an optional `boardId` param appended to the query string or included in the request body.
- **Chat reset on board switch**: A `useEffect([activeBoard?.id])` in `ChatScreen` sets `conversationIdRef.current` to `null` and clears messages, so the next message creates a new conversation scoped to the newly active board.
- **Reports board scoping**: `ReportsScreen` passes `activeBoard?.id` to `getCompletions`; the `getCompletions` helper accepts an optional `boardId` param.
- **Settings — Boards section (mobile)**: A `BoardSection` card appears at the top of `SettingsScreen` (above Labels). It shows a board count badge (`N/10`), lists all boards with a default-star indicator, inline rename, set-default, and delete actions. Delete is guarded: the UI shows the Delete button only when more than one board exists; backend errors (e.g. board has tasks) are surfaced as inline error text. A "+ Add board" inline input (capped at 10 boards) allows creating new boards. The Labels section fetches labels scoped to the active board via `listLabels('mode', activeBoard?.id)` and `listLabels('type', activeBoard?.id)`. New labels created in Settings are created in the active board.
- **Types updated**: `Board` interface added to `mobile/src/types/index.ts`. `Task.board_id: string` and `Conversation.board_id: string` added to match the API response shape.
- **Tests**: 7 new Jest unit tests for the boards API (`mobile/src/__tests__/boards.api.test.ts`); `makeTask` factory updated in 3 existing test files to include `board_id: 'board-1'`. Total: 77 mobile unit tests pass.

---

## Focused View

The Focused View shows only high-priority tasks from a user-configured set of boards and day range, presented as a card grid grouped by board. It is a session-only toggle alongside the existing Detailed View (kanban) — the toggle resets to Detailed on next load.

### Behavior

- Shows tasks where `is_high_priority = true` AND (`must_do_by` OR `target_date`) falls within the configured day range.
- Overdue tasks are **not** shown — the Focused View is forward-looking only. Overdue tasks remain visible in Detailed View.
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

### Focused View API (shipped — PR #36, backend only)

- `GET /api/v1/focused-view/config` — returns the user's config, creating the default lazily via upsert if none exists.
- `PUT /api/v1/focused-view/config` — updates `board_selection`, `day_range`, and optionally `selected_board_ids`. Validates: `board_selection` must be `all` or `selected`; `day_range` must be one of the three valid values; when `board_selection = selected`, `selected_board_ids` must be non-empty and all IDs must belong to the caller. Returns `400` for any violation.
- `GET /api/v1/focused-view/tasks` — returns `is_high_priority=true` pending tasks grouped by board, filtered to the configured day range. Accepts optional `?reference_date=YYYY-MM-DD` query parameter (avoids server-side timezone issues; defaults to `date.today()` when omitted). Response shape: `{ "boards": [{ "board_id", "board_name", "board_color", "tasks": [TaskOut, ...] }, ...] }`.

### Focused View UI — Web frontend (aspirational — PR 2 not yet shipped)

Configuration UI in Settings (below the default board picker). Session toggle between Detailed and Focused view. Responsive card grid layout.

### Focused View UI — Mobile app (aspirational — PR 3 not yet shipped)

Settings configuration and a Focused View screen. Delivered as OTA update (JS/TS only).

---

## Task Model

### Core Fields
- **Title**: short description of the task
- **Notes**: optional longer description
- **Must-do-by date**: hard deadline
- **Target date**: aspirational completion date (e.g. "I want to return library books by Friday, but they're due Sunday")
- **State**: Pending or Done
- **High priority**: boolean flag. High priority is only meaningful for tasks whose effective date (earliest of `must_do_by` and `target_date`) falls on today or tomorrow. **`getEffectiveDate` correctly returns the minimum of the two dates when both are set (fixed in PR #20 for both web and mobile clients).** The backend auto-resets it to `false` whenever the effective date falls outside that window. At most **N high-priority tasks** are allowed per day (where N is the user-configured **High Priority Daily Limit**, defaulting to 3, minimum 1); the API returns 422 when the limit would be exceeded.

### Labels
A task can have zero or more labels in fixed system-defined categories. A task may have **multiple labels within the same category** (e.g. both `online` and `email` under Mode).

| Category | Values | Editable? | UI Visible? |
|---|---|---|---|
| Frequency | one-time, daily, weekly, monthly, annual | No — Frequency is no longer a valid category in the API (PR #31); all DB rows deleted by SQL migration | **No** — hidden from all UI surfaces as of PR #29; no longer seeded as of PR #30; all DB rows deleted and enum value dropped as of PR #31 |
| Mode | online, phone, outdoor, email (defaults) | Yes — per-user; users can add, rename, and delete | Yes |
| Type | household, financial, child, trip, medical (defaults) | Yes — per-user; users can add, rename, and delete | Yes |

**Label ownership rules (shipped — PR #15, corrected in PR #16, updated PR #30, updated PR #31, updated PR #33):**
- **All labels are per-board** — `labels.user_id` and `labels.board_id` are both `NOT NULL`. There are no global seed rows in the DB. A user's default board is seeded with **Mode and Type labels only** (9 entries total) on first access to any endpoint (as of PR #33, seeding is triggered by `resolve_board_id`/`ensure_board_seeded`, not only by `GET /labels`).
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
The primary interaction mode. Each conversation is tied to a specific board (via `board_id` on the `conversations` table). The AI only sees tasks and labels belonging to that board — there is no cross-board leakage. Supported input styles:

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

1. **Task List** (default `/`) — kanban board of pending tasks across six columns (Overdue, Today, Tomorrow, Day After Tomorrow, Upcoming, No Date). The Overdue column is hidden when empty. Completed tasks shown as a flat list via "Show done" toggle.
2. **Chat** (`/chat`) — conversational AI interface for task creation, completion, and task-related questions
3. **Reports** (`/reports`) — completed tasks for a user-chosen date range
4. **Settings** (`/settings`) — manage per-user labels (Mode and Type), configure the High Priority Daily Limit, define up to 5 starter questions, and manage the account (sign in / sign out)
5. **Task Detail** (`/tasks/:id`, `/tasks/new`) — create or edit a task with full field and label editing

### Task List / Kanban Board

- Pending tasks are shown in a **6-column kanban board**: Overdue | Today | Tomorrow | Day After Tomorrow | Upcoming | No Date. Tasks whose effective date is in the past appear in the leftmost **Overdue** column (red accent), not in Today. The **Overdue** column is hidden entirely when it contains no tasks.
- **Overdue**, **Today**, and **Tomorrow** columns each split into two zones separated by a labeled divider: a high-priority zone (above the line) and a normal-priority zone (below the line). The high-priority cap does not apply within Overdue — tasks carry their existing priority; the cap re-engages when a task is dragged to Today or Tomorrow. Dropping a task *into* the Overdue column is blocked. When a column has more high-priority tasks than the configured limit, the column header shows a ⚠ N/M warning in amber. The **Day After Tomorrow** column has no high-priority zone split — it renders as a simple column (like Upcoming and No Date).
- **Drag-and-drop** between columns always updates `target_date` only via `PUT /tasks/:id` — `must_do_by` is never modified by a drag. Dragging to Day After Tomorrow sets `target_date` to today+2; dragging to No Date clears `target_date` only (preserving `must_do_by`). **Dropping into the Overdue or Upcoming columns is blocked** — both are read-only drop targets (Upcoming shows a "Read-only" placeholder; no highlight appears on hover). Dragging into the high zone sets `is_high_priority = true`; into the normal zone or Day After Tomorrow/No Date, it resets to `false`. The frontend enforces the user-configured high-priority limit before making the API call; the backend enforces it independently.
- **Label filter chips** are shown above the board (Mode / Type categories only — Frequency category hidden as of PR #29). Filter state persists across navigation via React context.
- **Text search** filters tasks by title and notes simultaneously (case-insensitive). Search and label filters compose with AND semantics.
- When navigating to New Task while a label filter is active, those labels are pre-checked in the form.
- **Task cards** show: title, high-priority badge (orange "High") when applicable, `must_do_by` date in red with "Overdue ·" prefix when past, `target_date` in gray (hidden when equal to `must_do_by`), and label badges in Mode → Type order (Frequency badges removed from UI as of PR #29; tasks with existing frequency labels render without a frequency badge). Inline edit (title + labels), inline complete, and inline delete are available directly on cards.

### Task Form (Create / Edit)

- Fields: Title (required), Notes, Must do by (date), Target date (date), High priority checkbox (visible only when at least one date field is set to today or tomorrow), Labels.
- High priority checkbox disappears and submits as `false` for all other dates.
- Both date fields show an **× clear button** when a date is set, allowing one-click removal. In edit mode, clearing a date sends an explicit `null` to the backend so the field is actually cleared (not silently omitted).

### Chat Page

- Suggested follow-up questions from the AI are shown as clickable chips after each assistant response; clicking a chip sends it as the next message.

### Settings Page

- **Boards section (shipped — PR #34)**: Appears at the top of Settings, above Labels. Shows all boards with: inline rename; a star icon to set the default board (the current default's star is amber and non-clickable); a Delete button (disabled for the default board or the only board — server errors such as "board has tasks" are surfaced inline); and a "+ Add board" button to create a new board. The Labels section heading shows the active board name to make clear which board's labels are being managed.
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
- **Task row**: title, effective-date chip, high-priority amber top bar + amber star badge, label badges (mode=green, type=purple — frequency badges removed from UI as of PR #29). Tapping a task row opens it in the task form in edit mode. Completed tasks shown via the filter panel appear faded (reduced opacity) with a strikethrough title and without the high-priority bar or star.
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

*Last updated by — *Bashful* after PR #36 (focused view backend PR 1/3: focused_view_configs table, board color field, GET/PUT /focused-view/config, GET /focused-view/tasks; also corrected MAX_BOARDS_PER_USER from 5 to 10 per commit 72fd1b3)*
