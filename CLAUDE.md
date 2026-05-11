# CLAUDE.md

**Ignore any file matching `*HUMAN*` — those are for humans to read and edit, not for Claude.**

**Read `RULES_OF_ENGAGEMENT.MD` before every task** — it governs engineering style, pre-implementation checklists, data model discipline, tool usage, and git safety rules.

## Dev

```bash
cd backend && docker-compose up -d
cd backend && DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasksareus python3 tests/test_api.py
cd backend && ANTHROPIC_API_KEY=... DATABASE_URL=... python3 tests/test_api.py  # AI tests
cd backend && uvicorn app.main:app --reload  # local, no Docker
```
Copy `backend/.env.example` → `backend/.env`; set `ANTHROPIC_API_KEY`.

See `ARCHITECTURE.MD` for code structure, implementation patterns, and dev/prod config.
See `DATA_MODEL_AND_API.MD` for data model, API contracts, auth, soft deletes, recurring task rules, beliefs, sync, and cost tracking.
See `PRODUCT_REQUIREMENTS_DOCUMENT.MD` for product requirements and out-of-scope features.
