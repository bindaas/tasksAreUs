# tasksAreUs — Product Requirements

## Overview

tasksAreUs is a task management app with a Python/FastAPI/PostgreSQL backend, a React 19 + Vite web frontend, and a React Native + Expo mobile client. Users manage tasks through a kanban board and a conversational AI interface. The app is multi-tenant from day one. Identity is Firebase-only: the backend auto-creates a user row on first authenticated request; no device registration or migration step is needed.

---

## Task Model

### Core Fields
- **Title**: short description of the task
- **Notes**: optional longer description
- **Must-do-by date**: hard deadline
- **Target date**: aspirational completion date (e.g. "I want to return library books by Friday, but they're due Sunday")
- **State**: Pending or Done
- **High priority**: boolean flag. High priority is only meaningful for tasks whose effective date (earliest of `must_do_by` and `target_date`) falls on today or tomorrow. The backend auto-resets it to `false` whenever the effective date falls outside that window. At most **N high-priority tasks** are allowed per day (where N is the user-configured **High Priority Daily Limit**, defaulting to 3, minimum 1); the API returns 422 when the limit would be exceeded.

### Labels
A task can have zero or more labels in fixed system-defined categories. A task may have **multiple labels within the same category** (e.g. both `online` and `email` under Mode).

| Category | Values | Editable? |
|---|---|---|
| Frequency | one-time, daily, weekly, monthly, annual | No — per-user but fixed; users cannot add, rename, or delete |
| Mode | online, phone, outdoor, email (defaults) | Yes — per-user; users can add, rename, and delete |
| Type | household, financial, child, trip, medical (defaults) | Yes — per-user; users can add, rename, and delete |

**Label ownership rules (shipped — PR #15, corrected in PR #16):**
- **All labels are per-user** — `labels.user_id` is `NOT NULL`. There are no global seed rows in the DB. Each user gets their own independent copy of all three categories (Frequency, Mode, Type) on first access.
- **Frequency** labels are seeded per-user and cannot be edited or deleted by the user (they are not shown in Settings). They serve as the sentinel for "has this user been seeded?" — a missing frequency label triggers full re-seeding.
- **Mode** and **Type** labels are per-user and fully configurable: users can add, rename, and delete them.
- Users cannot create or modify label *categories* — the three categories (Frequency, Mode, Type) are fixed.
- The default Type value was renamed from `raghav` to `child` (applied via startup migration in PR #15).
- Seeding is driven by the `LABEL_SEED` constant in `models.py`; the `ensure_seeded()` / `seed_user_labels()` helpers live in `services/label_service.py`.

**New label management API endpoints (shipped — PR #15):**
- `POST /api/v1/labels` — create a new Mode or Type label for the current user (400 if Frequency, 409 if duplicate, strips whitespace)
- `PUT /api/v1/labels/{id}` — rename a Mode or Type label owned by the current user (403 if wrong owner, 400 if Frequency, 409 if duplicate name)
- `DELETE /api/v1/labels/{id}` — delete a Mode or Type label owned by the current user (403 if wrong owner, 400 if Frequency)

### Task Lifecycle

**One-time tasks** (Frequency = one-time or no Frequency label):
- States: Pending → Done; no follow-on task created

**Recurring tasks** (Frequency = daily / weekly / monthly / annual):
- When marked Done, a new task is created for the next due date
- If missed (past due, not completed), no additional tasks are created — only **one pending instance** at a time
- Completion history is preserved so reports accurately show what was done and when

---

## AI Features

### Beliefs
The AI generates suggestions that users validate, following an RLHF-style feedback loop:
- **Suggested labels**: AI suggests which labels to apply given the task title/notes
- **Estimated time**: AI estimates how long the task will take

Users accept or reject each belief. Accepted beliefs carry more weight in future suggestions than pending or rejected ones.

### Conversational Interface
The primary interaction mode. Supported input styles:

1. **Journal-style entries** — freeform natural language:
   - "I need to return books to the library tomorrow" → creates a task with a due date
   - "I did laundry today" → finds the matching pending task and marks it Done
   - The AI determines whether to create or complete a task

2. **Questions** about the user's tasks:
   - "What tasks do I need to do this week?"
   - "What online tasks can I do in the next hour?"
   - Date-based queries match on both `must_do_by` and `target_date` — tasks are not omitted from AI context just because they only have a `target_date`.

3. Every response must include one or more **suggested follow-up questions** that the app can actually answer and that don't repeat what was just answered.

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
- **Drag-and-drop** between columns always updates `target_date` only via `PUT /tasks/:id` — `must_do_by` is never modified by a drag. Dragging to Day After Tomorrow sets `target_date` to today+2; dragging to Upcoming sets `target_date` to 7 days from today; dragging to No Date clears `target_date` only (preserving `must_do_by`). Dragging into the high zone sets `is_high_priority = true`; into the normal zone or Day After Tomorrow/Upcoming/No Date, it resets to `false`. The frontend enforces the user-configured high-priority limit before making the API call; the backend enforces it independently.
- **Label filter chips** are shown above the board (Mode / Type / Frequency categories). Filter state persists across navigation via React context.
- **Text search** filters tasks by title and notes simultaneously (case-insensitive). Search and label filters compose with AND semantics.
- When navigating to New Task while a label filter is active, those labels are pre-checked in the form.
- **Task cards** show: title, high-priority badge (orange "High") when applicable, `must_do_by` date in red with "Overdue ·" prefix when past, `target_date` in gray (hidden when equal to `must_do_by`), and label badges in Mode → Type → Frequency order. Inline edit (title + labels), inline complete, and inline delete are available directly on cards.

### Task Form (Create / Edit)

- Fields: Title (required), Notes, Must do by (date), Target date (date), High priority checkbox (visible only when at least one date field is set to today or tomorrow), Labels.
- High priority checkbox disappears and submits as `false` for all other dates.
- Both date fields show an **× clear button** when a date is set, allowing one-click removal. In edit mode, clearing a date sends an explicit `null` to the backend so the field is actually cleared (not silently omitted).

### Chat Page

- Suggested follow-up questions from the AI are shown as clickable chips after each assistant response; clicking a chip sends it as the next message.

### Settings Page

- **Labels section (shipped — PR #15)**: Appears at the top of Settings, above High Priority Limit and Starter Questions. Shows **Mode** and **Type** subsections with the user's personal label set. Each label has Edit and Delete buttons; each subsection has an Add button to create new values. Frequency labels are not shown here (they are not editable). Changes take effect immediately in TaskForm label pickers and on task cards.
- **High Priority Daily Limit**: numeric input (min 1) that sets the per-day cap for high-priority tasks in Today and Tomorrow columns. Defaults to 3 when unset. Reducing the limit below the current count is allowed — a warning is shown but no retroactive removal occurs. Persisted server-side via `user_settings.high_priority_daily_limit`.
- Configure up to 5 starter questions saved server-side. Questions can be added, removed, and reordered.
- Note: backend connectivity testing from the Settings screen is **not currently implemented**.

> **[ASPIRATIONAL]** — Not yet shipped. A backend connectivity test in the Settings screen was originally planned but has not been built.

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
- **Phase 3 (shipped)**: Removed legacy `X-User-ID` fallback path from the backend; removed `useUser.ts` shim. Bearer token is now the only accepted auth path for production traffic.
- **Phase 4 (shipped — PR #17)**: Removed all device-based identity infrastructure.
- **Test-auth bypass (shipped — PR #19, dev/CI tooling only)**: A `TEST_AUTH_BYPASS=true` env var (never set in production) allows integration tests to authenticate by passing an `X-User-ID` header instead of a real Firebase Bearer token. This is not a user-facing feature — it exists solely so `test_api.py` can run without a live Firebase project. The production auth contract (Bearer token required) is unchanged. Dropped `device_uuid` column from `users` table. Deleted `POST /users` (device registration) and `POST /users/migrate` endpoints, along with `UserCreate`, `MigrateRequest`, and `MigrateOut` schemas, `frontend/src/api/users.ts`, and historical migration scripts (`migrate_user_data.py`, `recover_data.py`). Firebase auto-create in `get_current_user` is now the sole user-creation path.

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
| Tasks | `/` | Placeholder — full implementation in a later PR |
| Chat | `/chat` | Placeholder — full implementation in a later PR |
| Reports | `/reports` | Placeholder — full implementation in a later PR |
| Settings | `/settings` | Placeholder — full implementation in a later PR |

### Authentication (shipped — PR #18)
Mobile auth follows the same Firebase-only identity model as the web frontend, with mobile-specific implementation details:

- **Anonymous auto-sign-in**: On first launch (or after any non-deliberate sign-out) the app calls `signInAnonymously()` automatically — zero friction.
- **Google Sign-In**: Uses `expo-auth-session` browser redirect flow. In Expo Go, the Expo Go redirect URI (`exp://[local-ip]:8081`) must be added to Google Cloud Console → Authorized redirect URIs.
- **Magic link**: `sendSignInLinkToEmail` with `handleCodeInApp: true`. The email link carries the `tasksareus://` deep-link URL. **Known limitation**: in Expo Go, the email link opens in the system browser and cannot redirect back into the app; the UI notes this explicitly. Full magic-link sign-in (auto-redirect) works only in standalone builds.
- **Cross-device magic link**: If the link is opened on a different device than where it was requested, the app prompts the user to confirm their email address before completing sign-in.
- **LoginScreen**: Shown only after a deliberate sign-out; offers Google and magic-link options.
- **SettingsScreen → Account section**: Shows "Anonymous user" or the signed-in user's display name / email, plus a Sign out button. Full label management, High Priority Limit, and starter questions configuration follow in a later PR.
- **Deliberate sign-out flag**: A module-level boolean (resets on app force-quit) prevents the auto-anonymous-sign-in from firing after an explicit sign-out.
- **API client** (`mobile/src/api/client.ts`): Calls `auth.currentUser?.getIdToken()` asynchronously; attaches `Authorization: Bearer <token>` on every request to `EXPO_PUBLIC_API_URL/api/v1`.

### Utility Code
Pure utility functions (`taskDateUtils`, `taskFilters`, `taskPriority`) and TypeScript types are copied from `frontend/src/` rather than extracted into a shared module. This is a deliberate no-monorepo decision — no shared package or workspace linking is used.

### Environment / Config
`mobile/.env.example` documents all required environment variables: Firebase project config, Google OAuth client IDs (web, iOS, Android), and `EXPO_PUBLIC_API_URL`.

---

## Out of Scope (initial build)

- Custom label *categories* (the three categories — Frequency, Mode, Type — are fixed for all users)
- Editing or deleting Frequency label values (one-time, daily, weekly, monthly, annual are fixed globally)
- Trip as a separate entity (trip is a Type label value)
- Admin dashboard for cost tracking (note: per-call AI cost logging to the `ai_cost_log` table is implemented in the backend; only the admin-facing dashboard surface is out of scope)
- ~~Native mobile app (iOS/Android)~~ — **now in scope**: React Native + Expo mobile client is being built (PR #18 scaffolded the project; feature screens follow in subsequent PRs)
