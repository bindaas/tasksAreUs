# PLAN: Remove Beliefs Feature and All LLM/Anthropic Integration

**Branch:** `chore/remove-beliefs-and-llm`
**Status:** Planning phase

---

## Summary

Remove all remaining backend code, database tables, config, dependencies, and ops-script references for the Beliefs feature and for LLM (Anthropic/Claude) usage. The Beliefs UI was already removed from web and mobile in a prior change; this PR completes the removal on the backend and retires the app's only LLM dependency entirely. After this PR, the app makes no LLM calls of any kind.

**Rationale:** Beliefs (AI-suggested labels/time estimates with accept/reject feedback) has no UI entry point anywhere in the product. The backend code, `beliefs`/`ai_cost_log` tables, and the `anthropic` SDK dependency are now fully dead weight.

---

## Production State

- `beliefs` and `ai_cost_log` are live Postgres tables (created via `Base.metadata.create_all()`, no Alembic migrations in this repo) and may hold real historical data from when the feature was active.
- **Decision (confirmed with user):** drop both tables with no backup, via `DROP TABLE IF EXISTS` in `main.py`'s startup migration block — the same pattern already used for the `conversations`/`messages` removal in PR #50. Data loss is accepted since nothing reads these tables once the code is removed.
- No other table has a foreign key pointing *at* `beliefs.id` or `ai_cost_log.id` — both are leaf tables. `beliefs.user_id`/`beliefs.task_id` cascade *into* beliefs (on user/task delete), which becomes moot once the table is gone. Safe to drop in isolation.

---

## Scope

### In Scope
- Delete the Beliefs router, service, and all ORM models/schemas
- Delete `ai_service.py` (100% belief/LLM-specific — no shared "AI client" infra used elsewhere; the prior chat feature that also used Claude was already removed in PR #50)
- Remove `anthropic` SDK dependency and all `ANTHROPIC_API_KEY`/`CLAUDE_*` config
- Drop `beliefs` and `ai_cost_log` tables in production via startup migration
- Remove `beliefs`/`ai_cost_log` references from ops scripts (`purge_test_data.py`, `sync_local_to_railway.py`)
- Update the one unit test file that references the `Belief` model (`tests/unit/test_sync_router.py`)

### Out of Scope
- `backend/tests/test_api.py` — owned exclusively by Sleepy (`/test-review`). Not modified by this plan. Flagged below for a required Sleepy pass after the PR is opened, since its belief test block and sync payload fixtures will break once the routes/schema fields disappear.
- `ARCHITECTURE.MD`, `DATA_MODEL_AND_API.MD`, `PRODUCT_REQUIREMENTS_DOCUMENT.MD` — owned by Doc/Bashful respectively, updated via `/full-review` after the PR is open, per project convention.
- `REQUIREMENTS_HUMAN.MD` — matches the `*HUMAN*` ignore rule in `CLAUDE.md`; not read or touched.
- Frontend and mobile — confirmed zero references to "belief", "anthropic", "claude", or "llm" in `frontend/src/` or `mobile/src/` (including mobile's built `dist/` bundle). Mobile has no sync client at all (`mobile/src/api/` has no `sync.ts`), so it cannot be affected by the `SyncChanges`/`SyncResponse` schema change either. No files to modify in either app.

---

## Data Model Changes

### Database Schema
**Before:** `beliefs` table (FK → `users`, `tasks` CASCADE; FK → `labels` no cascade) and `ai_cost_log` table (FK → `users`) exist.
**After:** Both tables dropped; corresponding ORM models removed so `create_all()` no longer recreates them on fresh databases.

**Migration (in `main.py`'s `lifespan` startup block, appended after the existing `# ── Chat removal ──` block):**
```python
# ── Beliefs/LLM removal — drop beliefs and ai_cost_log tables ──
conn.execute(text("DROP TABLE IF EXISTS beliefs"))
conn.execute(text("DROP TABLE IF EXISTS ai_cost_log"))
```
No backup taken (per user decision above), consistent with the `conversations`/`messages` precedent.

---

## API Contract Changes

**Removed routes (all return 404 after this change):**
- `POST /tasks/{task_id}/beliefs/generate`
- `GET /tasks/{task_id}/beliefs`
- `PUT /beliefs/{belief_id}`

**Sync payload change:**
- `SyncChanges.beliefs` field removed from the incoming sync request schema
- `SyncResponse` no longer includes a `beliefs` key in its output
- Confirmed no client on either platform calls `/sync` at all — neither web nor mobile has a `sync.ts`/sync API module, so this removal is fully inert, not merely backward-compatible. (Corrected per Sneezy's review below: the original draft understated this — it's zero callers, not just "no dependency.")

---

## Files to Modify

### Backend (`backend/app/`)

**Delete entirely (2 files)**
- `routers/beliefs.py`
- `services/ai_service.py`

**Edit (5 files)**
- `main.py` — remove `beliefs` import (`from .routers import beliefs, ...`) and `app.include_router(beliefs.router, ...)`; add the two `DROP TABLE IF EXISTS` statements described above
- `models.py` — remove `BeliefTypeEnum`, `BeliefStatusEnum`, `Belief`, `AICostLog`
- `schemas.py` — remove `BeliefOut`, `BeliefUpdate`; remove `beliefs: List[Dict[str, Any]] = []` from `SyncChanges`
- `routers/sync.py` — remove `Belief` import; remove incoming belief merge logic; remove outgoing `server_beliefs` query and `belief_dicts` serialization; remove `beliefs=belief_dicts` from the `SyncResponse` construction
- `config.py` — remove `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `CLAUDE_INPUT_COST_PER_M`, `CLAUDE_OUTPUT_COST_PER_M`

**Dependencies & env (2 files)**
- `requirements.txt` — remove `anthropic==0.40.0`
- `.env.example` — remove `ANTHROPIC_API_KEY`, `CLAUDE_MODEL` lines

**Ops scripts (2 files, not part of the deployed app but part of the repo)**
- `scripts/purge_test_data.py` — remove `"ai_cost_log"`, `"beliefs"` from the per-user table cleanup list (line 38)
- `scripts/sync_local_to_railway.py` — remove `"beliefs"`/`"ai_cost_log"` from `USER_TABLES`; remove them from the backup-table loop, the `SELECT`/bulk-insert blocks, and the `DROP TABLE ... _backup_{ts}` cleanup lines

**Tests (1 file, unit test — mine to update, not Sleepy's)**
- `tests/unit/test_sync_router.py` — remove `Belief` from the `models` import (line 12); remove the `elif model is Belief:` mock-dispatch branch (line 32)

**Docs — one-time setup doc, not owned by any review agent (1 file)**
- `railway_migration.md` (repo root) — remove the `ANTHROPIC_API_KEY`/`CLAUDE_MODEL` Railway env var setup lines and the stale `beliefs` mention in its user-keyed table list. *(Added in response to Sneezy's Gap finding — see review below.)*

### Not touched
- `backend/tests/test_api.py` — flagged for Sleepy (see Out of Scope)
- `ARCHITECTURE.MD`, `DATA_MODEL_AND_API.MD`, `PRODUCT_REQUIREMENTS_DOCUMENT.MD` — flagged for Doc/Bashful via `/full-review`
- `CLAUDE.md:18` (root) — currently reads "See DATA_MODEL_AND_API.MD for ... beliefs, sync, and cost tracking." Minor stray reference; left as-is since DATA_MODEL_AND_API.MD's beliefs section removal (by Doc) makes this self-correcting in spirit, and CLAUDE.md is not in this plan's file list. Can be tidied in a follow-up if desired.

---

## Test Plan

### Unit Tests (`backend/tests/unit/`)
- `test_sync_router.py` — remove `Belief`-specific import and mock branch; no new tests needed since no belief behavior remains to cover
- All other unit test files already confirmed clean (no belief/LLM references)

### Integration Tests (`test_api.py`) — Sleepy's responsibility, flagged not fixed here
Known breakage once this PR merges, for Sleepy to address in a `/test-review` pass:
- **[Blocking — must fix, per Sneezy's review]** `cleanup(user_id)` at `test_api.py:82` runs an unguarded `DELETE FROM ai_cost_log`/`DELETE FROM beliefs` (no `IF EXISTS`), and executes *before every test run* (line 124) and again via `atexit` (line 125). Once this PR drops those tables, this raises `psycopg2.errors.UndefinedTable` and **crashes the entire integration suite** before the first assertion runs — not just the belief-specific tests. This is the identical failure mode already fixed once for `conversations`/`messages` after PR #50 (see the comment at `test_api.py:79-81` documenting that exact lesson); `beliefs`/`ai_cost_log` were missed. Sleepy must remove `"ai_cost_log"` and `"beliefs"` from this table list, mirroring how `conversations`/`messages` were already removed from the same loop.
- The `── Beliefs ──` test block (gated behind `if os.getenv("ANTHROPIC_API_KEY")`) calls the now-404'd belief routes
- Multiple sync test fixtures assert `"beliefs": []` in request/response payloads — will need removal once `SyncResponse` no longer emits that key

### Manual Verification (Post-Deploy)
1. `POST /tasks/{id}/beliefs/generate`, `GET /tasks/{id}/beliefs`, `PUT /beliefs/{id}` all return 404
2. `POST /sync` request/response payloads no longer contain a `beliefs` key
3. Confirm `beliefs` and `ai_cost_log` tables no longer exist in the Railway database after deploy
4. Confirm app boots without `ANTHROPIC_API_KEY` set at all (env var can be removed from Railway dashboard separately, out of band from this code change)

---

## Deployment Order

**Single component: backend only.** Frontend and mobile have zero belief/LLM references and are unaffected — no frontend/mobile deploy needed alongside this.

1. Land backend changes on `chore/remove-beliefs-and-llm`
2. Open PR, run `/full-review` (code-review, test-review, requirements-review, arch-review in sequence — Sleepy specifically needs to update `test_api.py`'s belief block and sync fixtures; Doc/Bashful update the three owned docs)
3. Merge to `main` → Railway deploys the backend image; startup migration drops `beliefs`/`ai_cost_log` tables
4. **Safe window:** N/A in the multi-phase sense — this is a single-component, backward-compatible-not-required change since no client depends on the removed surface

---

## Rollback Plan

**If deploy fails before going live:** Revert the commit on `main`; Railway redeploys the previous version. The `DROP TABLE IF EXISTS` migration runs once at startup — if it already executed before the failure, the tables are gone permanently (no backup, per the accepted decision above); if it didn't run, no rollback complication.

**If issues detected post-deploy:** No recovery path for `beliefs`/`ai_cost_log` data (no backup taken, by design). Revert the code commit if the removal itself causes unrelated regressions (e.g., a bug introduced in `sync.py` while removing the belief merge logic) — that revert does not restore the dropped tables.

---

## Confidence & Risk Assessment

| Metric | Rating | Notes |
|--------|--------|-------|
| **Confidence in solution** | 5/5 | Scope fully mapped via codebase-wide grep; no shared infra depends on belief/LLM code |
| **Regression risk** | 2/5 | Isolated feature, no inbound FKs, frontend/mobile confirmed clean |
| **Data loss risk** | 5/5 (accepted) | No backup taken per explicit user decision; irreversible |
| **Test coverage** | N/A pre-Sleepy | Unit tests fixed in this PR; integration test fixes deferred to Sleepy by design (test ownership rule) |

---

## Success Criteria

- All belief/LLM code removed from `backend/app/` (routers, services, models, schemas, config)
- `anthropic` dependency removed from `requirements.txt`
- `beliefs`/`ai_cost_log` tables dropped from the Railway database
- `tests/unit/test_sync_router.py` passes with no `Belief` references
- No remaining references to "belief", "anthropic", "claude", or "llm" anywhere under `backend/app/` or `backend/scripts/` (grep confirms)
- `railway_migration.md` no longer documents `ANTHROPIC_API_KEY`/`CLAUDE_MODEL` or mentions the `beliefs` table
- `test_api.py`'s `cleanup()` no longer references `ai_cost_log`/`beliefs` (Sleepy, post-PR — required, not optional)
- App starts and serves traffic with no `ANTHROPIC_API_KEY` set

---

## Notes for Reviewers

**Dopey (Code Review):** Verify no orphaned imports remain after `Belief`/`AICostLog` model removal; verify `sync.py`'s belief merge removal doesn't leave dangling variables or break the surrounding diff/merge logic for other entities.

**Sleepy (QE/Test Review):** Required follow-up — **first and foremost, remove `"ai_cost_log"` and `"beliefs"` from the `cleanup()` table list at `test_api.py:82`** (this is a blocker per Sneezy's review: leaving it will crash the entire suite via `UndefinedTable`, not just belief tests). Then remove the `── Beliefs ──` test block from `test_api.py` (or replace with 404 assertions on the removed routes, reviewer's judgment) and strip `"beliefs": []` from all sync fixtures. Consider adding a regression comment next to the `cleanup()` table list (mirroring the existing PR #50 comment) so this class of mistake isn't repeated a third time.

**Doc (Architecture Review):** Remove the `### Beliefs` and `### Table: beliefs` / `### Table: ai_cost_log` sections from `ARCHITECTURE.MD`/`DATA_MODEL_AND_API.MD`; update the code-structure listing (no more `beliefs.py`, `ai_service.py`); update `config.py` bullet to drop the Claude env vars; note the removal in the same style as the PR #50 conversations/messages entry.

**Bashful (Requirements Review):** Mark the `### Beliefs` section in `PRODUCT_REQUIREMENTS_DOCUMENT.MD` as removed (not just aspirational — it previously shipped and is now fully retired); update the AI-conversational-interface references on lines 15/179 that mention belief generation alongside chat (chat was already removed in PR #50, so both AI-feature mentions are now stale).

---

## Sneezy's Review — 2026-08-03

**Tier:** FULL — stated at spawn: proposed files touch `models.py`, `schemas.py`, and `routers/sync.py` (schema/router area), and the plan drops two production database tables in a startup migration.

**Verdict:** Changes required

### Issues

1. **[Blocker]** `backend/tests/test_api.py`'s `cleanup(user_id)` function (lines 70–94) will hard-crash once this PR's migration runs, and the plan's own briefing to Sleepy doesn't tell her to fix it. Verified directly: line 82 reads `for table in ["ai_cost_log", "beliefs", "tasks", "user_settings", "focused_view_configs"]: cur.execute(f"DELETE FROM {table} WHERE user_id = %s", (user_id,))` — a plain `DELETE FROM` with no `IF EXISTS` guard. `cleanup()` is called at line 124, *before any test runs* (to clear leftovers from a prior run), and again via `atexit.register(cleanup, test_user_id)` at line 125. Once `beliefs`/`ai_cost_log` are dropped, `DELETE FROM ai_cost_log WHERE user_id = %s` raises `psycopg2.errors.UndefinedTable`, which is uncaught — this aborts the *entire* `test_api.py` run at the very first line of `main()`, before even the `GET /health` check, not just the belief-specific assertions the plan describes. This exact failure mode was already learned once: a code comment at lines 79–81 explicitly documents that `conversations`/`messages` had to be removed from this same loop after PR #50 dropped those tables ("deleting from them here would fail with 'relation does not exist'"). `beliefs`/`ai_cost_log` were evidently missed when that lesson was applied, or added back afterward — this plan repeats the identical mistake unless corrected. The plan's own Test Plan section (line 114) mischaracterizes this as "harmless against a DB where those tables no longer exist... but should be verified by Sleepy" — it is not harmless, it is a guaranteed crash, and hedging it as "should be verified" undersells the certainty. Most importantly: the "Notes for Reviewers → Sleepy" section (line 170) — the actual actionable briefing an agent would follow — only says to remove the `── Beliefs ──` test block and strip `"beliefs": []` from sync fixtures. It does not mention line 82's cleanup table list at all. Since `test_api.py` is Sleepy's exclusively, and this plan is the document Sleepy/Grumpy will act on, this omission risks the fix being skipped, which would silently break the entire integration suite on the very next run after merge. **Required fix to this plan:** add an explicit line to the Sleepy briefing: remove `"ai_cost_log"` and `"beliefs"` from `cleanup()`'s table list at `test_api.py:82`, mirroring how `conversations`/`messages` were already removed from the same loop.

2. **[Gap]** `railway_migration.md` (repo root) is not mentioned anywhere in this plan — not in "Files to Modify," not in "Not touched." It documents `ANTHROPIC_API_KEY` as a required Railway env var and `CLAUDE_MODEL` as an optional one (lines 27–30), and mentions "beliefs" as one of the tables keyed by user `id` (line 72). This is a low-urgency, already-partially-stale one-time setup doc (it also predates Firebase env vars), but the plan explicitly frames this PR as making "the app makes no LLM calls of any kind" and its Success Criteria's grep check is scoped only to `backend/app` and `backend/scripts` — this doc falls outside that scope and will keep telling a future reader to configure `ANTHROPIC_API_KEY` on Railway. Recommend either adding a one-line edit to strip the `ANTHROPIC_API_KEY`/`CLAUDE_MODEL` env var lines, or explicitly listing it under "Not touched" the way `CLAUDE.md:18` already is, so its omission is a decision rather than an oversight.

### Unverified assumptions

1. **"No other table has a foreign key pointing at `beliefs.id` or `ai_cost_log.id`" (Production State, line 20).** Not independently verifiable against the live Railway schema from this review (no DB access), but corroborated at the ORM level: `models.py` was read in full and no other model class declares a `ForeignKey` referencing `Belief`/`AICostLog`. Since this repo has no Alembic migrations and the schema is driven by `Base.metadata.create_all()` plus hand-written `ALTER`/`DROP` statements in `main.py`, the ORM definitions are the authoritative source of truth for declared FKs — this claim checks out to the extent it's checkable from code.

2. **"Confirmed no live client... depends on this field surviving" (API Contract Changes, line 68).** Verified and actually stronger than claimed: grepped `frontend/src` and `mobile/src` for "beliefs" and for any `sync.ts`/sync API module — neither platform has a sync client at all (not just mobile, as the plan states; the web frontend has no `sync.ts` either as of this review). So `POST /sync` currently has zero callers on either platform, making the `SyncChanges.beliefs` removal fully inert rather than merely "confirmed safe." Worth a one-line correction in the plan for precision, not a blocking issue.

3. **Grep-confirmed, not just assumed:** all in-repo references to `Belief`/`AICostLog`/`ai_service`/`anthropic`/`ANTHROPIC_API_KEY`/`CLAUDE_*` under `backend/` were independently re-derived via grep and match the plan's file list exactly (`models.py`, `schemas.py`, `routers/sync.py`, `routers/beliefs.py`, `services/ai_service.py`, `tests/unit/test_sync_router.py`, `tests/test_api.py`, `scripts/purge_test_data.py`, `scripts/sync_local_to_railway.py`, `config.py`, `requirements.txt`, `.env.example`) — no additional backend file was missed. `test_sync_router.py`'s cited line numbers (12 for the `Belief` import, 32 for the `elif model is Belief:` branch) are exact.

### Suggestions

1. Strengthen the Test Plan section's characterization at line 114 from "harmless... presumably" to state plainly that `cleanup()` will raise `UndefinedTable` and abort the suite pre-first-assertion if not fixed — this makes the urgency visible to whoever reads the plan quickly, not just to someone who traces through `test_api.py` themselves.
2. Consider having Sleepy add a regression comment next to the `cleanup()` table list (mirroring the existing PR #50 comment at lines 79–81) so the next table-removal PR doesn't repeat this same gap a third time.
3. Minor precision fix: "web sync flow uses the same repo" (API Contract Changes, line 68) implies web has a sync flow sharing this schema; as of this review neither platform calls `/sync` at all. Rephrasing to "no client on either platform calls `/sync`" would be more accurate and slightly stronger support for the change.

— *Sneezy*

---

## Response to Sneezy's Review — 2026-08-03

Per the plan lifecycle, addressing each item before implementation begins (implementation itself deferred to next session — see below):

1. **[Blocker] `test_api.py:82` cleanup() crash** — **Addressed.** Added as an explicit, first-priority line item in the Sleepy briefing (Notes for Reviewers, and Integration Tests section) rather than being buried or left implicit. Not fixed in this plan's own diff since `test_api.py` remains Sleepy's exclusively per test ownership rules — but it is no longer possible to miss in the briefing.
2. **[Gap] `railway_migration.md` not in scope** — **Addressed.** Added to "Files to Modify" as a one-file doc edit (strip `ANTHROPIC_API_KEY`/`CLAUDE_MODEL` setup lines and the stale `beliefs` mention); not owned by any review agent, so it's mine to edit directly. Added to Success Criteria as well.
3. **Suggestion 1 (strengthen Test Plan urgency language)** — **Addressed.** Test Plan section now states plainly that the unguarded `DELETE` will raise `UndefinedTable` and abort the suite pre-first-assertion, rather than hedging with "harmless... presumably."
4. **Suggestion 2 (regression comment in test_api.py)** — **Addressed as a recommendation** in the Sleepy briefing (her call whether to add it, since it's her file).
5. **Suggestion 3 (precision fix on sync callers)** — **Addressed.** API Contract Changes now states plainly that neither platform calls `/sync` at all, rather than the softer "no live client depends on this field."

**Implementation status:** Not started. Per explicit user instruction, this session ends with the plan finalized and reviewed only — implementation (branch creation, code changes, PR) picks up in the next session.

— *Grumpy*
