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
- **High priority**: boolean flag. High priority is only meaningful for tasks whose effective date (earliest of `must_do_by` and `target_date`) falls on today or tomorrow. **`getEffectiveDate` correctly returns the minimum of the two dates when both are set (fixed in PR #20 for both web and mobile clients).** The backend auto-resets it to `false` whenever the effective date falls outside that window. At most **N high-priority tasks** are allowed per day (where N is the user-configured **High Priority Daily Limit**, defaulting to 3, minimum 1); the API returns 422 when the limit would be exceeded.

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

### Tasks Screen (shipped — PR #20, updated PR #21)

The Tasks tab is fully implemented as a `SectionList` grouped by date proximity:

- **Grouped sections**: Overdue (red header) → Today → Tomorrow → Day After Tomorrow → Upcoming → No Date; empty sections are hidden.
- **Task row**: title, effective-date chip, high-priority amber top bar + amber star badge, label badges (frequency=blue, mode=green, type=purple). Tapping a task row opens it in the task form in edit mode.
- **Complete**: check button → `completeTask()` → optimistic remove + background re-fetch (picks up the next recurring occurrence automatically).
- **Delete**: trash button → confirmation dialog → `deleteTask()` → optimistic remove.
- **"+" button**: tapping the indigo "+" button in the Tasks header opens the task form in create mode.
- **Loading state**: full-screen spinner on first load.
- **Error state**: friendly message + Retry button.
- **Pull-to-refresh**: `RefreshControl` wired to `listTasks('pending')`.
- **Focus refresh**: `useFocusEffect` re-fetches on every tab focus (stays fresh after web-app edits).
- **Empty state**: "No pending tasks" message shown when there are no pending tasks.

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
- **Labels** — grouped by Mode → Type → Frequency; tap to toggle; matches web form colour coding (frequency=blue, mode=green, type=purple)

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
- **Connection section (shipped — PR #25)**: Shown at the top of the screen (above Labels). Displays an environment badge — green "Production" when `EXPO_PUBLIC_API_URL` starts with `https://`, yellow "Development" otherwise — and the resolved API base URL. A "Test Connection" button pings `GET /api/v1/health` (unauthenticated) and reports either "Connected Xms" or "Failed: <error message>".
- **Account section**: see Authentication section above.

### Reports Screen (shipped — PR #24)

`ReportsScreen` is a fully implemented reports view replacing the earlier "Coming in PR 6" placeholder.

**Behaviour:**
- **Date-range picker**: From and To text inputs accepting ISO `YYYY-MM-DD` format. Defaults to the last 7 days (today−6 through today) on first render. Uses local-timezone date arithmetic so the defaults are always correct regardless of UTC offset.
- **Go button**: Lazy fetch — no request is made on mount. The user adjusts the date range first, then taps Go to run the report. The button is disabled while a request is in flight or either date field is empty.
- **Pre-fetch state**: An illustrated "Set a date range and tap Go" prompt is shown before the first fetch.
- **Loading spinner**: `ActivityIndicator` is shown while the request is in flight.
- **Summary bar**: After a successful fetch, shows "N completion(s)" (singular/plural) in the header area.
- **Completions list**: Scrollable list of `CompletionRow` cards, each showing: task title (up to 2 lines), formatted completion timestamp (locale date + time), and label badges sorted Mode → Type → Frequency.
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

- Custom label *categories* (the three categories — Frequency, Mode, Type — are fixed for all users)
- Editing or deleting Frequency label values (one-time, daily, weekly, monthly, annual are fixed globally)
- Trip as a separate entity (trip is a Type label value)
- Admin dashboard for cost tracking (note: per-call AI cost logging to the `ai_cost_log` table is implemented in the backend; only the admin-facing dashboard surface is out of scope)
- ~~Native mobile app (iOS/Android)~~ — **now in scope**: React Native + Expo mobile client is being built (PR #18 scaffolded the project; feature screens follow in subsequent PRs)

---

*Last updated by — *Bashful* after PR #25 (feat: EAS production build + Settings connection status)*
