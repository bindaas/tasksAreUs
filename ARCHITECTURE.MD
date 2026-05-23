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
    main.py          # FastAPI + lifespan (create_all, seed labels)
    config.py        # pydantic-settings (DATABASE_URL, ANTHROPIC_API_KEY, cost rates)
    database.py      # engine, SessionLocal, get_db()
    models.py        # ORM models + LABEL_SEED
    schemas.py       # Pydantic v2 schemas
    dependencies.py  # get_current_user_id() — reads X-User-ID header
    routers/         # one file per resource, mounted at /api/v1
    services/
      task_service.py  # complete_task(), recurring logic
      ai_service.py    # Claude calls (beliefs + conversations)
  tests/test_api.py    # standalone: creates data, tests all endpoints, cleans up

frontend/
  src/
    api/
      client.ts        # base fetch wrapper — attaches X-User-ID to every request
      users.ts         # POST /users (no auth header)
      tasks.ts
      labels.ts
      conversations.ts
      settings.ts
      reports.ts
    components/
      Layout.tsx        # nav shell: sidebar on desktop, bottom bar on mobile
      LabelBadge.tsx    # colored chip by category (frequency/mode/type)
      TaskCard.tsx      # task row with inline complete/delete
      TaskForm.tsx      # create/edit form with label picker
    hooks/
      useUser.ts        # device UUID + user_id bootstrap from localStorage
      useTasks.ts
      useLabels.ts
    pages/
      TasksPage.tsx     # task list with pending/done toggle and label filters
      TaskDetailPage.tsx  # create (/tasks/new) and edit (/tasks/:id)
      ChatPage.tsx      # AI conversation with suggested-question chips
      ReportsPage.tsx   # completions by date range
      SettingsPage.tsx  # starter questions editor
    App.tsx
    main.tsx
  vite.config.ts        # proxies /api → http://localhost:8000 in dev
```

## Key Implementation Patterns

**Schema management**: `Base.metadata.create_all()` on startup. No migrations.

**API proxy**: Vite dev server proxies `/api` to `http://localhost:8000`, so the frontend makes same-origin requests and CORS is not an issue in development.

**AI conversations** (`handle_conversation_message`): builds a system prompt with the user's pending tasks and all labels, then runs a Claude tool-use loop (max 8 turns) with tools `create_task`, `complete_task`, and `respond_to_user`. Loop exits when Claude calls `respond_to_user`, which also carries `suggested_questions`.

**AI beliefs** (`generate_beliefs`): single JSON-mode Claude call; response parsed for `label_suggestions` (label_id + rationale) and `time_estimate_minutes`.

For auth, soft deletes, recurring task rules, beliefs storage, sync protocol, and cost tracking see `DATA_MODEL_AND_API.MD`.

## Dev

```bash
# Backend
cd backend && docker-compose up -d
# or without Docker:
cd backend && uvicorn app.main:app --reload

# Frontend
cd frontend && npm run dev   # http://localhost:5173
```

## Testing

**API test script** (`tests/test_api.py`): standalone Python script; creates its own test data, exercises all endpoints (CRUD, label assignment, state transitions, recurring logic, conversational endpoints), deletes all created data at the end.
