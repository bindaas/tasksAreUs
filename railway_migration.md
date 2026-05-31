# Railway Production Deployment

## Code changes required

| File | Change |
|---|---|
| `Dockerfile` (root, new) | Multi-stage: Node 22 builds frontend → Python 3.12 serves API + static files |
| `.dockerignore` (root, new) | Excludes `node_modules`, `.env`, `__pycache__`, `.git` |
| `railway.toml` (root, new) | Points Railway at root `Dockerfile`; sets healthcheck at `/api/v1/health` |
| `backend/app/main.py` | Mount `static/` as SPA at `/` when dir exists (no-op in local dev) |

All four changes are already on disk and committed to `main`.

---

## Railway setup steps

### 1. Create the project
- [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → select `tasksAreUs`

### 2. Add PostgreSQL
- Inside the project: New → Database → Add PostgreSQL
- Railway creates a managed `Postgres` service and exposes `${{Postgres.DATABASE_URL}}`

### 3. Configure environment variables on the app service
```
ANTHROPIC_API_KEY = sk-ant-...
DATABASE_URL      = ${{Postgres.DATABASE_URL}}
```
`CLAUDE_MODEL` is optional — defaults to `claude-sonnet-4-6`.

### 4. Deploy
- Railway auto-builds on push to `main` (reads `railway.toml` → uses root `Dockerfile`)
- Build takes ~2–3 min (Node frontend build + pip install)
- Health check hits `/api/v1/health` — green = ready

### 5. Custom domain (optional)
- Settings → Networking → Generate Domain (free `*.railway.app`) or add your own

---

## Data migration (local → Railway)

Railway's Postgres is empty on first deploy. Run this once to copy your local data.

### Prerequisites
- App deployed and healthy on Railway (health check green)
- `psql` and `pg_dump` installed locally (`brew install libpq` on Mac if missing)
- Railway's **public** Postgres URL — find it in Railway dashboard → Postgres service → **Connect** tab → `DATABASE_PUBLIC_URL`
  - Looks like: `postgresql://postgres:<password>@<host>.railway.app:5432/railway`

### Steps

```bash
# 1. Dump local database (schema + data, no owner/privilege metadata)
pg_dump --no-owner --no-privileges \
  postgresql://postgres:postgres@localhost:5432/tasksareus \
  > tasksareus_backup.sql

# 2. Wipe Railway's auto-created schema (app startup may have already created tables)
psql $RAILWAY_DATABASE_PUBLIC_URL \
  --command="DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 3. Restore
psql $RAILWAY_DATABASE_PUBLIC_URL < tasksareus_backup.sql
```

Replace `$RAILWAY_DATABASE_PUBLIC_URL` with the actual URL from step above (or export it first: `export RAILWAY_DATABASE_PUBLIC_URL=postgresql://...`).

### User ID note

User `id` is a random UUID and is the foreign key for all tasks, beliefs, settings, etc. A `pg_dump` + restore preserves the exact `id` — your data stays intact. **Do not skip the migration and rely on re-login**: the app would create a new `id` for your `device_uuid` and none of your existing tasks would be associated with it.

### System test user

No migration needed. `test_api.py` creates the system test user (`device_uuid = 00000000-0000-0000-0000-000000000000`) automatically via `POST /users` on first run — that endpoint is idempotent and will just create a fresh entry on Railway.

---

## Running tests against Railway

`test_api.py` already supports both local and Railway via env vars:

```bash
# Local (defaults)
cd backend
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasksareus \
  python3 tests/test_api.py

# Railway
cd backend
BASE_URL=https://<your-app>.railway.app/api/v1 \
DATABASE_URL=postgresql://postgres:<password>@<host>.railway.app:5432/railway \
  python3 tests/test_api.py
```

`DATABASE_URL` must point to the same Postgres the app is using — the tests connect directly to clean up test data after each run. Use `DATABASE_PUBLIC_URL` from the Railway dashboard (same URL used for migration above).

---

## How it works in prod

Single Railway service handles everything. The multi-stage Docker build compiles the React app and copies `dist/` into `static/` inside the Python image. FastAPI serves `/api/v1/*` routes first; anything else falls through to `StaticFiles(html=True)` which serves `index.html` for SPA routing.

Local dev is unchanged — `static/` doesn't exist in `backend/` so the mount is skipped and Vite's dev proxy handles `/api` as before.
