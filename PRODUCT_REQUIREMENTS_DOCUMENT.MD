# tasksAreUs — Product Requirements

## Overview

tasksAreUs is a task management web app (React 19 + Vite, runs in the browser) with a Python/FastAPI/PostgreSQL backend. Users manage tasks through a kanban board and a conversational AI interface. The app is multi-tenant from day one, with identity bootstrapped from a device UUID stored in localStorage — no login required.

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

| Category | Values |
|---|---|
| Frequency | one-time, daily, weekly, monthly, annual |
| Mode | online, phone, outdoor, email |
| Type | household, financial, raghav, trip, medical |

Users cannot create or modify label categories or values.

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
4. **Settings** (`/settings`) — define up to 5 starter questions saved to the user's profile
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

- **High Priority Daily Limit**: numeric input (min 1) that sets the per-day cap for high-priority tasks in Today and Tomorrow columns. Defaults to 3 when unset. Reducing the limit below the current count is allowed — a warning is shown but no retroactive removal occurs. Persisted server-side via `user_settings.high_priority_daily_limit`.
- Configure up to 5 starter questions saved server-side. Questions can be added, removed, and reordered.
- Note: backend connectivity testing from the Settings screen is **not currently implemented**.

> **[ASPIRATIONAL]** — Not yet shipped. A backend connectivity test in the Settings screen was originally planned but has not been built.

---

## Reports

Users can view a history of completed tasks over a user-selected date range. The Reports page shows a date-range picker (From / To), a total completions count, and a list of completed tasks each with their completion timestamp and labels. Recurring task completions are individually recorded so history is accurate.

---

## Out of Scope (initial build)

- Authentication (Apple, Gmail) — data model placeholder only (`auth_provider`, `auth_provider_id` columns exist but are unused); no login required initially
- Custom label categories or values
- Trip as a separate entity (trip is a Type label value)
- Admin dashboard for cost tracking (note: per-call AI cost logging to the `ai_cost_log` table is implemented in the backend; only the admin-facing dashboard surface is out of scope)
- Native mobile app (iOS/Android) — the current frontend is a web app
