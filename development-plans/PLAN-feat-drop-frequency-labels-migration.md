# PLAN: Drop Frequency Labels — PR 3: DB Migration

**Branch:** `feat/drop-frequency-labels-migration`
**PR sequence:** PR #29 (UI, merged) → PR #30 (backend logic, merged) → **this PR** (DB migration)

---

## Scope

This is the final step of the three-PR frequency label removal. PRs #29 and #30 removed all frontend, mobile, and backend application-layer references to frequency labels. This PR:

1. Runs a SQL migration to purge frequency data from the database and remove `frequency` from the Postgres enum type.
2. Removes `CategoryEnum.frequency` from Python (`models.py`) — safe now that no DB rows use it.
3. Removes `recurrence_group_id` from the DB column and all Python backend layers (model, schemas, routers, service) — since it was only meaningful in the context of recurring tasks. Frontend and mobile type cleanup is deferred to a follow-up PR.

---

## What does NOT change

- `ensure_seeded()` sentinel in `label_service.py` — `any_count == 0` remains correct; after the SQL migration removes frequency rows, new users still start at zero total labels.
- `task_labels` rows referencing frequency labels — auto-deleted by the `ON DELETE CASCADE` on `task_labels.label_id` → `labels.id` when frequency label rows are deleted.
- No new API endpoints added or removed. No auth changes.

---

## Data model changes

| Change | Detail |
|--------|--------|
| `labels` table | DELETE all rows where `category = 'frequency'` |
| `beliefs` table | SET `label_id = NULL` where `label_id` points to a frequency label (no CASCADE on this FK) |
| `task_labels` table | Auto-cascades when `labels` rows are deleted |
| Postgres `category` enum | Remove `frequency` value: create new enum → alter column → drop old |
| `tasks.recurrence_group_id` | DROP COLUMN (index included) |
| Python `CategoryEnum` | Remove `frequency = "frequency"` |

---

## API changes

`TaskOut` schema loses `recurrence_group_id: Optional[str]`. The frontend and mobile `Task` type declarations will have a stale field that the API no longer returns — harmless at runtime since nothing reads it. Type cleanup is deferred to a follow-up PR.

`GET /labels?category=frequency` now returns 400 (unknown category) instead of an empty list, because `frequency` is removed from the enum. Frontend and mobile no longer call this endpoint after PR #29.

---

## Files to change

### New file
| File | What |
|------|------|
| `backend/scripts/migrate_drop_frequency_labels.sql` | SQL migration script |

### Backend application (`backend/app/`)
| File | Change |
|------|--------|
| `models.py:27` | Remove `frequency = "frequency"` from `CategoryEnum` |
| `models.py:93` | Remove `recurrence_group_id = Column(String, nullable=True, index=True)` from `Task` |
| `schemas.py:56` | Remove `recurrence_group_id: Optional[str] = None` from `TaskOut` |
| `routers/tasks.py:26` | Remove `recurrence_group_id: Optional[str] = Query(None)` param |
| `routers/tasks.py:42-43` | Remove `if recurrence_group_id: q = q.filter(...)` block |
| `routers/sync.py:58` | Remove `recurrence_group_id=t_data.get("recurrence_group_id")` from `Task(...)` constructor |
| `routers/sync.py:161` | Remove `"recurrence_group_id": t.recurrence_group_id` from task dict |
| `routers/labels.py:79` | Update error message: "Frequency labels are not editable" → "Only mode and type labels are editable" |
| `routers/labels.py:116` | Update error message: "Frequency labels cannot be deleted" → "Only mode and type labels can be deleted" |
| `services/task_service.py:90` | Remove `recurrence_group_id: Optional[str] = None` param from `create_task()` |
| `services/task_service.py:111` | Remove `recurrence_group_id=recurrence_group_id` from `Task(...)` constructor |

### Frontend and Mobile — deferred
Type cleanup (`Label.category` union narrowing, `recurrence_group_id` removal from `Task` type, dead `TaskCard.tsx` filter guard) is out of scope for this PR. Clients remain functional with stale type declarations — no runtime reads of these fields exist. Follow-up PR to handle.

### Backend application — additional change
| File | Change |
|------|--------|
| `services/label_service.py` docstring | Remove "until PR 3 removes them" parenthetical from `ensure_seeded()` — sentinel logic remains correct but the text is stale after this PR |

### Backend unit tests
| File | Change |
|------|--------|
| `tests/unit/test_labels_router.py:129-136` | Remove `TestUpdateLabel.test_rejects_frequency_label` — uses `CategoryEnum.frequency` which no longer exists |
| `tests/unit/test_labels_router.py:179-186` | Remove `TestDeleteLabel.test_rejects_frequency_label` — same reason |
| `tests/unit/test_labels_router.py:78-82` | Keep `test_rejects_frequency_category` — passes string `"frequency"`, still gets 400 (now: unknown category). Add one-line comment: `# 'frequency' is no longer a valid CategoryEnum value — triggers 400 as unknown category` |
| `tests/unit/test_task_service.py:48-57` | Remove `test_returns_none_next_task_even_with_legacy_frequency_label` — scenario no longer possible; base case covered by `test_returns_none_next_task` |
| `tests/unit/test_task_service.py:29` | Remove `task.recurrence_group_id = None` from test setup — field no longer exists on `Task` |

### Integration tests (Sleepy's file — do NOT modify directly)
| What changes | Detail |
|------|--------|
| Remove `GET /labels?category=frequency` assertions | Endpoint now returns 400 for unknown category |
| Update frequency seeding section | Frequency rows are now gone entirely, not just unseeded for new users |
| Remove `recurrence_group_id` from task fixture comparisons | Field no longer in API response |
| Remove `recurrence_group_id: None` from sync push payload at line 1118 | Column dropped; field is dead in request body |

---

## SQL migration

```sql
-- migrate_drop_frequency_labels.sql
-- Run this BEFORE deploying the new Python code.
-- Verify: SELECT count(*) FROM labels WHERE category = 'frequency'; must be 0 before deploying.

BEGIN;

-- 1. Null out beliefs referencing frequency labels (no CASCADE on this FK)
UPDATE beliefs
SET label_id = NULL
WHERE label_id IN (
    SELECT id FROM labels WHERE category = 'frequency'
);

-- 2a. Safety-net: explicitly delete task_labels rows for frequency labels
--     (task_labels.label_id has ON DELETE CASCADE in the ORM definition, but
--      if the FK constraint was created without CASCADE in the DB, this ensures
--      no orphaned rows and avoids a FK violation on step 2b)
DELETE FROM task_labels
WHERE label_id IN (
    SELECT id FROM labels WHERE category = 'frequency'
);

-- 2b. Delete frequency labels
DELETE FROM labels WHERE category = 'frequency';

-- 3. Remove 'frequency' from the Postgres enum type.
--    Verify the actual type name first: SELECT typname FROM pg_type WHERE typtype = 'e';
--    It is likely 'categoryenum' (SQLAlchemy lowercases the Python class name).
ALTER TYPE categoryenum RENAME TO categoryenum_old;
CREATE TYPE categoryenum AS ENUM ('mode', 'type');
ALTER TABLE labels
    ALTER COLUMN category TYPE categoryenum
    USING category::text::categoryenum;
DROP TYPE categoryenum_old;

-- 4. Drop recurrence_group_id column and its index.
DROP INDEX IF EXISTS ix_tasks_recurrence_group_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS recurrence_group_id;

COMMIT;
```

> **Important:** Run `SELECT typname FROM pg_type WHERE typtype = 'e';` first to confirm the actual enum type name. If it differs from `categoryenum`, update the migration SQL before running.

---

## Test plan

- Run `backend/tests/unit/` — all unit tests must pass after Python changes, before migration
- Run migration against local Docker DB
- Run `backend/tests/test_api.py` (Sleepy updates and runs this) — all tests must pass post-migration
- Confirm `GET /labels?category=frequency` → 400
- Confirm `GET /tasks` response has no `recurrence_group_id` field
- Frontend: TypeScript build must pass with no type errors

---

## Deployment order

1. **Run SQL migration** against production DB (Railway Postgres)
2. **Verify** `SELECT count(*) FROM labels WHERE category = 'frequency';` returns 0
3. **Deploy backend** — Railway auto-triggers on `backend/app/` changes in this PR
4. **Mobile OTA** — `eas update` (type-only change in `types/index.ts`; no native code touched)

> The SQL migration MUST run before the Python code is deployed. SQLAlchemy cannot deserialise `category='frequency'` DB rows once `CategoryEnum.frequency` is removed from Python. Run → verify → deploy.

---

## Risks

| Risk | Mitigation |
|------|-----------|
| Postgres enum type name differs from `categoryenum` | Verify with `SELECT typname FROM pg_type WHERE typtype = 'e';` before running migration |
| Old mobile clients sending `recurrence_group_id` in sync payload | Safe — the sync router will stop reading the field; JSON value is silently discarded |
| Production migration not run before Python deploy | Critical ordering constraint — document in PR checklist; migration must be verified complete before merging |
| `task_labels` orphaned rows | No risk — `ON DELETE CASCADE` handles this automatically |
| `beliefs.label_id` FK violation | Mitigated by explicit `UPDATE beliefs SET label_id = NULL` before DELETE in migration |

---

## Sneezy's Review — 2026-06-27

**Verdict:** Approved with concerns

### Issues

1. **[Risk] `frontend/src/api/tasks.ts:5` — `Label.category` type union not narrowed.** The `Label` interface in `frontend/src/api/tasks.ts` has `category: 'frequency' | 'mode' | 'type'`. The plan removes `recurrence_group_id` from the `Task` interface at line 17 but does not remove `'frequency'` from the `Label.category` union at line 5. After the migration `frequency` is a dead value — the type should be narrowed to `'mode' | 'type'`. The plan explicitly removes `recurrence_group_id: string | null;` from `Task` but is silent on the `Label.category` union in this file.

2. **[Risk] `mobile/src/types/index.ts:3` — same gap for mobile `Label.category`.** The `Label` interface at line 3 has `category: 'frequency' | 'mode' | 'type'`. The plan removes `recurrence_group_id` from `Task` at line 17 but does not narrow the `Label.category` union. Both are in the same file; only one change is listed.

3. **[Risk] `frontend/src/components/TaskCard.tsx:29` — dead filter guard not removed.** The component already filters out frequency labels with `.filter((l) => l.category !== 'frequency')`. After the migration there are no frequency rows, so this guard is permanently dead code. The plan does not mention removing it. It is harmless at runtime but leaves a stale reference that will confuse the next reader.

4. **[Gap] `backend/tests/test_api.py:1118` — integration test sends `recurrence_group_id` in sync payload; not listed under integration-test changes.** The plan's integration test section lists three types of changes needed (frequency assertions, seeding section, task fixture comparisons). However, at line 1118, `test_api.py` builds a sync payload that explicitly includes `"recurrence_group_id": None` as a sync field. After the column is dropped this key is a dead field in the request body. Sleepy will need to remove it. It is not listed in the plan's integration test table.

5. **[Gap] `backend/app/services/label_service.py:27` — stale docstring will read incorrectly post-migration.** The docstring for `ensure_seeded()` reads: "Existing users always have at least their frequency labels (until PR 3 removes them), so any_count == 0 reliably identifies new users across both the pre- and post-PR-3 windows." After this PR ships, the parenthetical is no longer future-tense — the sentinel reasoning is still correct but the text is stale. The plan's "What does NOT change" section notes the sentinel remains correct (it does) but does not call out that the docstring should be updated to remove the "until PR 3" language.

6. **[Gap] `DATA_MODEL_AND_API.MD` and `ARCHITECTURE.MD` need updates.** After the migration both docs still describe `recurrence_group_id` in the tasks table, `GET /labels?category=frequency` returning 200, and `CategoryEnum.frequency` as still present. The plan does not schedule a Doc (arch-review) run to update these files. Post-migration, the docs will be factually wrong about the DB schema and the API. The plan correctly notes this is the final PR in the series, so the docs should be updated now.

7. **[Nit] `backend/tests/unit/test_labels_router.py:78-82` — plan says "keep" but the comment update is ambiguous.** The plan says to keep `test_rejects_frequency_category` because it passes the string `"frequency"` (which will still produce 400, now as "Unknown category" rather than "Only mode and type labels are configurable"). The plan says to "Update comment to reflect new reason." The test currently has no inline comment explaining the reason; the test method name is `test_rejects_frequency_category`. The comment update target is not entirely clear — it is a good-faith change but the plan should specify what text to add or update.

### Unverified assumptions

1. **Plan claims `ON DELETE CASCADE` on `task_labels.label_id → labels.id`.** Verified correct at `models.py:79`: `label_id = Column(String, ForeignKey("labels.id", ondelete="CASCADE"), ...)`. The cascade is in the ORM definition; however, this is an ORM-level `ondelete` hint. Whether the DB-level constraint was created with `ON DELETE CASCADE` depends on whether the tables were created by SQLAlchemy's `create_all` (which respects `ondelete`) or by a manual migration. The plan assumes the FK constraint exists with CASCADE in Postgres. If the constraint was added without `CASCADE` (e.g., if the table pre-dated this FK definition), the cascade will not fire and frequency label rows being deleted could fail or leave orphaned `task_labels` rows. The plan mentions running the migration before the deploy, but it does not include a verification step for the FK constraint itself (e.g., `\d task_labels` in psql to confirm `ON DELETE CASCADE`).

2. **Plan claims both frontend and mobile carry `recurrence_group_id` as "type-only with no runtime reads".** Verified partially: the field is present in `Task` interface definitions and in test fixtures but there is no evidence it is read at runtime in components or screens. However, `frontend/src/api/tasks.ts` `Label` interface still includes `'frequency'` in the category union (see Issue 1), and `mobile/src/types/index.ts` does the same (Issue 2) — so the claim of "type-only, no runtime reads" is accurate for `recurrence_group_id` specifically, but the plan overstates completeness because it ignores the `Label.category` union in those same files.

3. **Enum type name is `categoryenum`.** Confirmed by direct Python introspection: `CategoryEnum` with `Column(Enum(CategoryEnum), ...)` produces a Postgres type named `categoryenum`. The migration SQL uses this name and the plan correctly instructs verifying it first.

4. **Plan states `ix_tasks_recurrence_group_id` is the index name.** SQLAlchemy's naming convention for `index=True` columns is `ix_<tablename>_<columnname>`, so `ix_tasks_recurrence_group_id` is the expected name. Confirmed as plausible via model inspection — the plan's SQL uses `DROP INDEX IF EXISTS ix_tasks_recurrence_group_id` which is safe even if the actual name differs (the `IF EXISTS` prevents failure).

### Suggestions

1. Add the `Label.category` union narrowing (`'frequency' | 'mode' | 'type'` → `'mode' | 'type'`) to the frontend and mobile files-to-change tables. These are in the same files as `recurrence_group_id` removals and are clean-up with zero risk.

2. Add removal of the dead `.filter((l) => l.category !== 'frequency')` guard in `frontend/src/components/TaskCard.tsx:29` to the files-to-change table. It is not a correctness issue post-migration but improves code clarity.

3. Add a `psql \d task_labels` check to the pre-migration verification checklist to confirm the FK constraint has `ON DELETE CASCADE` before running the migration. Alternatively, include a fallback `DELETE FROM task_labels WHERE label_id IN (SELECT id FROM labels WHERE category = 'frequency');` as step 1a in the SQL, which is safe even if CASCADE is present.

4. Schedule a Doc run (`/arch-review`) after this PR merges to update `DATA_MODEL_AND_API.MD` and `ARCHITECTURE.MD` — both will have stale references to `recurrence_group_id`, `CategoryEnum.frequency`, and `GET /labels?category=frequency` returning 200.

5. Update the `ensure_seeded()` docstring in `label_service.py` to remove the "until PR 3 removes them" parenthetical — after this PR it will be past-tense and misleading.

— *Sneezy*

---

## Grumpy's Response to Sneezy's Review

| # | Severity | Status | Notes |
|---|----------|--------|-------|
| 1 | Risk | **Deferred — out of scope** | Frontend/mobile type cleanup is not part of this DB-layer PR. `Label.category` union narrowing, `recurrence_group_id` removal from client types, and dead `TaskCard.tsx` guard moved to a follow-up PR. No runtime impact. |
| 2 | Risk | **Deferred — same as #1** | See above. |
| 3 | Risk | **Deferred — same as #1** | See above. |
| 4 | Gap | **Addressed** | Added `recurrence_group_id: None` sync payload removal at line 1118 to integration test changes table for Sleepy |
| 5 | Gap | **Addressed** | Added `label_service.py` docstring update to backend application changes |
| 6 | Gap | **Not addressed in plan — handled by /full-review** | Doc (arch-review) updates `ARCHITECTURE.MD` and `DATA_MODEL_AND_API.MD` as part of the standard `/full-review` run after this PR. No change needed to the plan. |
| 7 | Nit | **Addressed** | Clarified the comment to add: `# 'frequency' is no longer a valid CategoryEnum value — triggers 400 as unknown category` |
| Unverified 1 | Risk | **Addressed** | Added explicit `DELETE FROM task_labels WHERE label_id IN (...)` as step 2a in the SQL migration — safe even if CASCADE is present, eliminates dependency on FK constraint definition |
