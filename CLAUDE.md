# CLAUDE.md

**Ignore any file matching `*HUMAN*` — those are for humans to read and edit, not for Claude.**

**Read `RULES_OF_ENGAGEMENT.MD` before every task** — it governs engineering style, pre-implementation checklists, data model discipline, tool usage, and git safety rules.

## Dev

```bash
cd backend && docker-compose up -d
cd backend && DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasksareus python3 -m tests.integration.run_all
cd backend && uvicorn app.main:app --reload  # local, no Docker
```
Copy `backend/.env.example` → `backend/.env`; set `ANTHROPIC_API_KEY`.

See `ARCHITECTURE.MD` for code structure, implementation patterns, and dev/prod config.
See `DATA_MODEL_AND_API.MD` for data model, API contracts, auth, soft deletes, recurring task rules, beliefs, sync, and cost tracking.
See `PRODUCT_REQUIREMENTS_DOCUMENT.MD` for product requirements, feature status, and out-of-scope features.

---

## Project Conventions

### Test ownership
- **Never modify `backend/tests/integration/`** — owned exclusively by the `/test-review` skill (Sleepy).
- **Backend unit tests**: `backend/tests/unit/` using pytest (mock SQLAlchemy sessions with `unittest.mock.MagicMock` — no DB required)
- **Frontend unit tests**: `frontend/src/__tests__/` using Vitest; target pure utility functions in `frontend/src/utils/`

### Deploy trigger (`[skip deploy]`)
Railway builds a single Docker image (see root `Dockerfile`) that compiles `frontend/` and bakes the resulting `dist/` into the FastAPI backend's `static/` folder — there is no separate frontend host. So both `backend/app/` **and** `frontend/` changes need a Railway deployment to reach production; only truly deploy-irrelevant changes should carry `[skip deploy]`:
- **Triggers deploy**: files under `backend/app/` or `frontend/` (excluding `frontend/src/__tests__/`)
- **Does not trigger**: `mobile/`, `.claude/`, docs, `backend/tests/`, `frontend/src/__tests__/`

### Branch rules
- **`backend/tests/integration/` belongs on the feature branch** — Sleepy's test changes must be committed to the PR branch and merged via PR, never directly to main.

### PR signature
- **Always** end every PR body with a horizontal rule and signature: `— *Grumpy*`

---

## Agent Roster

Every agent signs its PR body or comment. All posts are made under your GitHub account — the signature is the only way to distinguish them.

| Name | Role |
|------|------|
| **Grumpy** | Main assistant (Claude) — implements features, creates PRs |
| **Dopey** | `code-review` agent — code correctness, architecture fit, security |
| **Sleepy** | `test-review` agent — owns `backend/tests/integration/`, runs tests, posts QE verdict |
| **Bashful** | `requirements-review` agent — keeps `PRODUCT_REQUIREMENTS_DOCUMENT.MD` current |
| **Doc** | `arch-review` agent — keeps `ARCHITECTURE.MD` and `DATA_MODEL_AND_API.MD` current |
| **Sneezy** | `plan-review` agent — reviews development plan files; appends critique directly to the plan file |
