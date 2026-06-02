# tasksAreUs — Architecture

## System Overview

- **Backend**: Python / FastAPI / PostgreSQL; Docker for dev
- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS; runs in the browser
- **Multi-tenant**: every table includes `user_id`; full data isolation per user

## Identity

On first load the frontend generates a UUID stored in `localStorage` as `device_uuid`, then calls `POST /users` to obtain a `user_id` (also stored in `localStorage`). No login screen. The data model and API are designed to accommodate Apple/Gmail sign-in later without breaking changes.

## Code Structure

```
backend/
  app/
    main.py          # FastAPI + lifespan (create_all, ALTER TABLE for is_high_priority + high_priority_daily_limit, seed labels)
    config.py        # pydantic-settings (DATABASE_URL, ANTHROPIC_API_KEY, CLAUDE_MODEL, cost rates)
    database.py      # engine, SessionLocal, get_db()
    models.py        # ORM models + LABEL_SEED
    schemas.py       # Pydantic v2 schemas
    dependencies.py  # get_current_user_id() — reads X-User-ID header
    routers/         # one file per resource, mounted at /api/v1
      users.py       # POST /users
      labels.py      # GET /labels
      tasks.py       # CRUD + complete endpoint
      beliefs.py     # beliefs generate/list/update
      conversations.py  # conversations + messages
      reports.py     # GET /reports/completions
      settings.py    # GET/PUT /settings
      sync.py        # POST /sync
    services/
      task_service.py  # create_task(), update_task(), complete_task(), recurring logic, high-priority limit; _get_high_priority_limit() reads user settings
      ai_service.py    # Claude calls (beliefs + conversations); _format_task_line() helper
  tests/
    test_api.py      # standalone integration test: creates data, tests all endpoints, cleans up
    unit/
      test_task_service.py  # pytest unit tests for task_service (no DB — mocked)
      test_ai_service.py    # pytest unit tests for ai_service helpers
  scripts/
    purge_test_data.py  # DB maintenance: remove test-generated rows
    recover_data.py     # DB maintenance: recover soft-deleted records

frontend/
  src/
    api/
      client.ts        # base fetch wrapper — attaches X-User-ID to every request; parses FastAPI error detail
      users.ts         # POST /users (no auth header)
      tasks.ts         # CRUD, complete; Task interface includes is_high_priority
      labels.ts
      conversations.ts
      settings.ts
      reports.ts
    components/
      Layout.tsx        # nav shell: sidebar on desktop, bottom bar on mobile
      LabelBadge.tsx    # colored chip by category (frequency/mode/type)
      TaskCard.tsx      # task card with inline complete/delete; shows "High" badge when is_high_priority
      TaskForm.tsx      # create/edit form with label picker and high-priority checkbox
    context/
      FilterContext.tsx  # React context holding selected label IDs; persists across navigation
    hooks/
      useUser.ts        # device UUID + user_id bootstrap from localStorage
      useTasks.ts
      useLabels.ts
      useSettings.ts    # fetches GET /settings; exposes highPriorityDailyLimit (default 3)
    pages/
      TasksPage.tsx     # 6-column kanban (Overdue/Today/Tomorrow/Day After Tomorrow/Upcoming/No Date) with drag-drop, search, label filters; Overdue column hidden when empty
      TaskDetailPage.tsx  # create (/tasks/new) and edit (/tasks/:id)
      ChatPage.tsx      # AI conversation with suggested-question chips
      ReportsPage.tsx   # completions by date range
      SettingsPage.tsx  # starter questions editor + High Priority Daily Limit numeric input
    utils/
      taskDateUtils.ts  # date helpers: getColumn(), getDropDate(), getEffectiveDate(), formatDate(); ColumnKey covers 'overdue'|'today'|'tomorrow'|'day_after_tomorrow'|'upcoming'|'nodate'
      taskFilters.ts    # filterTasks() — applies label and text search filters
      taskPriority.ts   # isHighPriorityEligible(), splitByPriority(), canAddHighPriority(highTasks, droppedTask, limit)
    __tests__/
      taskDateUtils.test.ts
      taskFilters.test.ts
      taskPriority.test.ts
    App.tsx
    main.tsx
  vite.config.ts        # proxies /api → http://localhost:8000 in dev; VITE_API_TARGET for Docker
```

## Key Implementation Patterns

**Schema management**: `Base.metadata.create_all()` on startup. No migrations.

**API proxy**: Vite dev server proxies `/api` to `http://localhost:8000`, so the frontend makes same-origin requests and CORS is not an issue in development.

**AI conversations** (`handle_conversation_message`): builds a system prompt with the user's pending tasks (up to 100) and all labels, then runs a Claude tool-use loop (max 8 turns) with tools `create_task`, `complete_task`, and `respond_to_user`. Loop exits when Claude calls `respond_to_user`, which also carries `suggested_questions`. Task context is formatted by `_format_task_line()`, which includes both `must_do_by` and `target_date` when set.

**AI beliefs** (`generate_beliefs`): single JSON-mode Claude call; response parsed for `label_suggestions` (label_id + rationale) and `time_estimate_minutes`.

**High-priority tasks**: `is_high_priority` is only valid when the task's effective date (earliest of `must_do_by` / `target_date`) is today, tomorrow, or in the past (overdue). Auto-reset to `false` on any update that moves the date outside that window. The daily cap is user-configurable via `user_settings.high_priority_daily_limit` (default 3, min 1); `_get_high_priority_limit()` in `task_service.py` reads it on each create/update, falling back to 3. HTTP 422 is raised when the cap is exceeded. The cap does not apply within the Overdue column — tasks retain their existing priority there, but the cap re-engages when a task is dragged to Today or Tomorrow. When a column exceeds the limit, the column header shows an amber ⚠ N/M high badge (warning only — no retroactive enforcement).

**Null-clearing on update**: `PUT /tasks/{task_id}` uses Pydantic `model_fields_set` to distinguish "field not provided" from "field explicitly set to null". `clear_must_do_by` and `clear_target_date` flags are passed to `update_task` to allow clearing date fields to null. The `TaskForm` component sends an explicit `null` when a previously-set date is cleared via the × button, ensuring the backend actually clears the field.

**Overdue column**: Tasks whose effective date is strictly in the past are assigned to the `overdue` column bucket (`ColumnKey = 'overdue' | 'today' | 'tomorrow' | 'day_after_tomorrow' | 'upcoming' | 'nodate'`). The Overdue column uses a red accent style and is **hidden entirely when it contains no tasks**. Dropping tasks *into* the Overdue column is blocked; tasks can only drag *out* to other columns. `getDropDate('overdue')` returns `null` (same as `nodate`). `isHighPriorityEligible` returns `true` for `overdue` so existing high-priority flags are preserved.

**Day After Tomorrow column**: `getColumn()` detects tasks whose effective date falls on today+2 and assigns them to the `day_after_tomorrow` bucket. `getDropDate('day_after_tomorrow')` returns today+2. `isHighPriorityEligible` returns `false` for `day_after_tomorrow` — the HP split is intentionally limited to today and tomorrow only.

For auth, soft deletes, recurring task rules, beliefs storage, sync protocol, and cost tracking see `DATA_MODEL_AND_API.MD`.

## Dev

```bash
# Full stack (Docker): db + api + frontend + pgAdmin
cd backend && docker-compose up -d
# API at http://localhost:8000, frontend at http://localhost:5173, pgAdmin at http://localhost:5050

# Backend only (no Docker):
cd backend && uvicorn app.main:app --reload

# Frontend only (no Docker):
cd frontend && npm run dev   # http://localhost:5173
```

Copy `backend/.env.example` → `backend/.env`; set `ANTHROPIC_API_KEY`. pgAdmin credentials are also configured in `.env`.

## Testing

**API integration tests** (`tests/test_api.py`): standalone Python script; creates its own test data, exercises all endpoints (CRUD, label assignment, state transitions, recurring logic, high-priority limit, conversational endpoints), deletes all created data at the end. Run with:
```bash
cd backend && DATABASE_URL=... python3 tests/test_api.py
```

**Backend unit tests** (`tests/unit/`): pytest-based, no DB required (mock SQLAlchemy sessions). Cover `task_service` (create, update, complete, recurring, high-priority limit) and `ai_service` helpers (`_format_task_line`). Run with:
```bash
cd backend && python3 -m pytest tests/unit/ -v
```

**Frontend unit tests** (`src/__tests__/`): Vitest. Cover `taskDateUtils` (including overdue and day_after_tomorrow column logic), `taskFilters`, and `taskPriority` utilities (56 tests). Run with:
```bash
cd frontend && npx vitest run
```
