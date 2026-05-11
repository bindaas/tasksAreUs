# tasksAreUs — Architecture

## System Overview

- **Backend**: Python / FastAPI / PostgreSQL; Docker for dev, Railway for prod
- **Frontend**: React Native + Expo (iOS primary, Android secondary); Expo Go for dev, EAS Build for prod
- **Offline-first**: all data stored locally on device (SQLite); synced to backend when online via `POST /sync`
- **Multi-tenant**: every table includes `user_id`; full data isolation per user

## Identity

On first launch the app generates a UUID used as `user_id`. No login required initially. The data model and API are designed to accommodate Apple/Gmail sign-in later without breaking changes.

## Code Structure

```
backend/app/
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
```

## Key Implementation Patterns

**Schema management**: `Base.metadata.create_all()` on startup. No migrations.

**AI conversations** (`handle_conversation_message`): builds a system prompt with the user's pending tasks and all labels, then runs a Claude tool-use loop (max 8 turns) with tools `create_task`, `complete_task`, and `respond_to_user`. Loop exits when Claude calls `respond_to_user`, which also carries `suggested_questions`.

**AI beliefs** (`generate_beliefs`): single JSON-mode Claude call; response parsed for `label_suggestions` (label_id + rationale) and `time_estimate_minutes`.

For auth, soft deletes, recurring task rules, beliefs storage, sync protocol, and cost tracking see `DATA_MODEL_AND_API.MD`.

## Dev / Prod Configuration

| Setting | Dev | Prod |
|---|---|---|
| Mobile runtime | Expo Go | EAS Build |
| Backend | Docker on laptop | Railway |
| Anthropic API key | Dev key | Prod key |

## Testing

**API test script** (`tests/test_api.py`): standalone Python script; creates its own test data, exercises all endpoints (CRUD, label assignment, state transitions, recurring logic, conversational endpoints), deletes all created data at the end.

**Unit tests**: backend business logic (task lifecycle, recurring rules, belief weighting); frontend key components.
