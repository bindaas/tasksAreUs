---
name: run
description: Launch tasksAreUs (backend, frontend, and/or mobile) locally and verify it's up. Use when asked to run, start, or restart the app, check that a change works, or confirm a service is healthy.
user-invocable: true
---

# run — launch tasksAreUs locally

This is the project-specific launcher. It knows the fixed set of ways this repo runs, so
there's no need to explore the codebase to figure out how to start it.

## Which stack to launch

Ask only if truly ambiguous — otherwise infer from what the user is testing:
- Backend/API change only → **backend only**
- Frontend change → **full stack** (frontend needs the API) or **frontend + already-running backend**
- Mobile change → **mobile**
- Unspecified / "run the app" → **full stack (Docker)**

## Full stack (Docker) — default

```bash
cd backend && docker-compose up -d
```
- API: http://localhost:8000
- Frontend: http://localhost:5173
- pgAdmin: http://localhost:5050

Verify:
```bash
curl -s http://localhost:8000/api/v1/health
curl -s http://localhost:5173 -o /dev/null -w "%{http_code}\n"
```

## Backend only (no Docker)

```bash
cd backend && uvicorn app.main:app --reload
```
Requires `backend/.env` (copy from `.env.example`) with `ANTHROPIC_API_KEY`,
`FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID` set — the app refuses to start without
`FIREBASE_SERVICE_ACCOUNT_JSON`. Verify with the health check above.

## Frontend only (no Docker)

```bash
cd frontend && npm run dev   # http://localhost:5173
```
Requires `frontend/.env` (copy from `.env.example`) with `VITE_FIREBASE_*` vars set, or
anonymous sign-in fails silently on load.

## Mobile (Expo Go)

```bash
cd mobile && npm install && npx expo start
```
Requires `mobile/.env` (copy from `.env.example`) with `EXPO_PUBLIC_FIREBASE_*`,
`EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`, and `EXPO_PUBLIC_API_URL` set to the host machine's local IP
(not `localhost` — physical devices/emulators can't resolve it). Scan the QR code with Expo Go.

## After launching

- Report which service(s) came up and on which port(s).
- If a port is already bound, check what's running there (`lsof -i :<port>`) before assuming a
  restart is needed — don't kill a process without confirming what it is first.
- Don't run destructive commands (`docker-compose down -v`, killing unrelated processes) without
  asking.
