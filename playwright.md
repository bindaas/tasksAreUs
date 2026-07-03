# Playwright notes (ad hoc verification → future test suite)

This file captures what worked, what broke, and what residue was left behind
while manually verifying the `feat-tasks-view-redesign-web` PR with a throwaway
Playwright script (no `@playwright/test`, no repo integration — just a Node
script driving a headless Chromium against the real local dev stack). Read
this before writing the real smoke/regression suite — there's real overlap in
setup, but the ad hoc approach cut corners that a real suite can't.

## Environment setup that actually worked

1. `cd backend && docker-compose up -d` — starts `db`, `pgadmin`, `frontend` (a
   dockerized Vite dev server bind-mounted to `frontend/`), and `api`.
2. **Orphan container gotcha**: an old `backend-postgres-1` container (stale,
   different compose project name) was blocking the `api` container from
   resolving the `db` hostname (`could not translate host name "db"`). Fixed
   with `docker-compose up -d --remove-orphans api`.
3. **Stale `api` image**: the `backend-api` image had been built weeks
   earlier and was missing routes added since (e.g. `/day-view/tasks` 404'd).
   Unlike the `frontend` service, `api`'s code is `COPY`'d at build time, not
   bind-mounted — it does **not** pick up source changes automatically.
   Fix: `docker-compose build api && docker-compose up -d --force-recreate api`.
4. **Stale `frontend` node_modules volume**: the `frontend` service mounts
   `frontend/` for source but keeps `node_modules` in a separate named Docker
   volume. If a dependency (e.g. `firebase`) was added to `package.json` after
   that volume was created, Vite throws `Failed to resolve import "@firebase/..."`
   (500s, blank page). Fix: `docker exec backend-frontend-1 npm install`, then
   `docker-compose restart frontend` (restart is required — Vite's
   `optimizeDeps` cache doesn't self-invalidate on a mid-session `npm install`).
5. Playwright itself: `npx playwright install chromium --with-deps` downloads
   browsers to `~/Library/Caches/ms-playwright` (machine-wide cache, fast on
   repeat runs). The `playwright` npm package still needs to be resolvable
   from whatever directory runs the script — `npm init -y && npm install
   playwright` in a scratch dir was enough.

## Script gotchas

- **Never use `waitUntil: 'networkidle'` against the Vite dev server.** It
  hangs forever — Vite's HMR client keeps a WebSocket open, and this repo's
  `vite.config.ts` also sets `watch.usePolling: true`, so the network never
  goes idle. Use `waitUntil: 'load'` plus an explicit `waitForTimeout(...)`
  instead.
- Prefer polling `document.getElementById('root').innerHTML` in a loop over
  chaining long-timeout locators when debugging a blank page — it surfaces
  "still blank after N seconds" immediately instead of eating a 30s default
  locator timeout per failed assertion.
- Real Firebase project is configured in `frontend/.env` — anonymous sign-in
  (`signInAnonymously()`) works against it out of the box, no mocking needed.
  That's convenient but has a cost (see Residue below).

## Residue this ad hoc run left behind — clean up before/after using this again

Every fresh `chromium.launch()` + `newPage()` has no persisted storage, so
**each script run signs in as a brand-new anonymous Firebase user**. The
backend auto-creates a `users` row on first authenticated request (per
`DATA_MODEL_AND_API.MD`), which in turn auto-seeds a "General tasks" board +
9 default labels for that user. Across the handful of ad hoc script runs done
for this PR, that means:

- Several orphaned anonymous users in the local Postgres `users` table, each
  with its own auto-seeded board + labels.
- One of those users also has a real task: **"Playwright smoke-test task"**
  (created via the FAB → Create Task flow in `verify3.mjs`), left un-deleted
  by request.

**Cleanup**: `backend/scripts/purge_test_data.py` already exists for exactly
this — it deletes every user except a hardcoded `KEEP_USER_ID` (the one real
active user), and thanks to `ondelete="CASCADE"` on `boards.user_id`,
`labels.user_id`, `tasks.user_id`, etc. (see `app/models.py`), deleting the
user row cascades to wipe everything under it — no need to touch `boards`/
`labels` tables by hand. Run it against your local dev DB:

```bash
cd backend && DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tasksareus python3 scripts/purge_test_data.py
```

It prints the user IDs it's about to delete and prompts `[y/N]` first —
review the list before confirming. **Never point this at the Railway
production `DATABASE_URL`** — it's a local-dev cleanup tool only, and
production has real user data under those same table names.

## Building the real suite later

If/when this becomes an actual `@playwright/test` smoke/regression suite:

- Check the script into the repo (e.g. `frontend/e2e/`), not a scratch temp
  dir — this note's scripts were throwaway and never committed.
- **Don't rely on real anonymous Firebase sign-in per test run** — it's fine
  for one-off manual checks but will keep multiplying orphaned users/boards
  exactly like the residue above, every single CI run. Prefer either a fixed
  test account (email/password, signed in once and reused) or a seeded
  test user ID the suite owns and cleans up itself after each run.
- Reuse the golden-path flows already confirmed working end-to-end for this
  PR as the first test cases: 4-view toggle (Focused/Today/Tomorrow/All),
  board tabs appearing only under All, URL state (`?view=&board=`) surviving
  a task create/edit round-trip, and the new-task board dropdown defaulting
  correctly.
- Decide test-data isolation up front (dedicated test board vs. dedicated
  test user vs. post-run purge script) — this project has exactly one real
  active user and a shared dev DB, so accidental cross-contamination is easy
  and `purge_test_data.py`'s `KEEP_USER_ID` assumption needs to keep holding.
