# PLAN: Remove Mode Labels Completely

**Branch:** `chore/remove-mode-labels`  
**Epic:** Mode Label Removal  
**Status:** Planning phase

---

## Summary

Remove the "Mode" label category entirely from tasksAreUs — database, backend API, frontend UI, and mobile UI. Keep only the "Type" label category, which will be **renamed to "Tags" in the UI** for better clarity (household, financial, child, trip, medical).

**Rationale:** Mode labels (online, phone, outdoor, email) are seeded into every user's default board but remain unused in production (0 task associations across all 11 users/44 label rows). Removing unused complexity simplifies the label system and clarifying "Type" → "Tags" improves user understanding.

---

## Production State

**Database Analysis (Railway):**
- 44 Mode labels across 11 users/11 boards
- 0 task_labels associations with Mode labels
- 0 beliefs referencing Mode labels
- **Result:** Safe to delete entirely with no data loss

**Type Labels (for reference):**
- 115 Type labels
- 293 task_labels associations
- Active and in use — keep all

---

## Scope

### In Scope
- Remove Mode label category from database, backend API, frontend UI, mobile UI
- Delete all existing Mode labels and their (empty) associations
- Update all label type definitions to exclude "mode"
- Remove Mode-related state, rendering, and tests
- **Rename "Type" category to "Tags" in frontend/mobile UI** (backend API still uses `category: "type"`)
- Update documentation and tests

### Out of Scope
- Type/Tags label system functionality (keep all, only rename UI)
- Task/belief systems (no changes needed)
- User data migration (no Mode data to migrate)

---

## Data Model Changes

### Database Schema
**Before:** `category` ENUM with values `'mode', 'type'`  
**After:** `category` ENUM with value `'type'` only

**Changes:**
1. Delete all rows where `category = 'mode'` (44 labels)
2. Alter PostgreSQL ENUM type:
   ```sql
   DELETE FROM labels WHERE category = 'mode';
   ALTER TYPE category RENAME TO category_old;
   CREATE TYPE category AS ENUM ('type');
   ALTER TABLE labels ALTER COLUMN category TYPE category USING category::text::category;
   DROP TYPE category_old;
   ```

**Migration Script:** Already created in `scripts/migrate-remove-mode-labels.sh`

**Backup:** Completed before running migration

---

## UI Naming Change: "Type" → "Tags"

**Backend/API:** Keep `category: "type"` in all API payloads (no schema change)

**Frontend/Mobile UI:** Display as "Tags" instead of "Type" to users
- Settings page: "Customize **Tags** for this board" (was "Customize Mode and Type labels")
- Task form: "**Tags**" section header (was separate Mode/Type sections)
- Task card: Badge labels grouped under **Tags** (was under Type)
- Filter chips: Label filters shown as **Tags**

**Implementation:**
- Replace text strings in UI components (e.g., "Type" → "Tags", "type" → "tags" in headers)
- No TypeScript type changes needed (internal `category: "type"` remains)
- API requests/responses still use `category: "type"` (users don't see this)
- Only visual/user-facing text changes

---

## API Contract Changes

### Labels Endpoints

**Affected Routes:** `GET /labels`, `POST /labels`, `PUT /labels/{id}`, `DELETE /labels/{id}`

**Before:**
```python
# models.py
class CategoryEnum(str, Enum):
    mode = "mode"
    type = "type"

# routers/labels.py
_CONFIGURABLE = {CategoryEnum.mode, CategoryEnum.type}
```

**After:**
```python
# models.py
class CategoryEnum(str, Enum):
    type = "type"

# routers/labels.py
_CONFIGURABLE = {CategoryEnum.type}
```

**Validation Changes:**
- `POST /labels` with `category: "mode"` returns `400 Unknown category` (same as removed `frequency` category)
  - Example: `POST /labels` body: `{ "category": "mode", "value": "online" }` → `400 Unknown category`
- `GET /labels?category=mode` returns `400 Unknown category`
  - Example: `GET /labels?category=mode` → `400 Unknown category`
- Responses only include `type` labels

**Schema Changes:**
- Remove `"mode" or "type"` from docstrings
- Update API docs to reference `type` only
- **Note:** API continues to use `category: "type"` in responses; UI displays this as "Tags"

**API Response Example (unchanged payload structure):**
```json
{
  "id": "uuid",
  "value": "household",
  "category": "type",
  "board_id": "uuid"
}
```
The frontend/mobile displays `category: "type"` to users as "Tags" (text-only UI change, no schema modification)

---

## Files to Modify

### Backend (`backend/app/`)

**Models & Configuration (2 files)**
- `models.py` — Remove `mode = "mode"` from `CategoryEnum`; remove 4 Mode entries from `LABEL_SEED` (keep 5 Type entries)
- `schemas.py` — Update docstrings; no schema changes needed (category is a string)

**Routers & Services (2 files)**
- `routers/labels.py` — Update `_CONFIGURABLE = {CategoryEnum.type}` only; update docstrings
- `services/label_service.py` — No changes (seeding function is mode-agnostic)

**Tests (2 files)**
- `tests/test_api.py` — Remove all `"mode"` label tests (create, list, duplicate, rename); keep Type tests
- `tests/unit/test_labels_router.py` — Remove Mode-related test cases; keep Type tests

### Frontend (`frontend/src/`)

**API Module (1 file)**
- `api/labels.ts` — Change `LabelCategory = 'mode' | 'type'` → `'type'`

**Components (4 files)**
- `components/LabelBadge.tsx` — Remove Mode color styling (green); keep Type colors (type: purple, etc.)
- `components/TaskForm.tsx` — Remove `'mode'` from `CATEGORY_ORDER`; remove Mode section header; rename "Type" section header to **"Tags"**
- `components/TaskQuickEdit.tsx` — Remove `'mode'` from `EDIT_CATEGORY_ORDER`
- `components/TaskCard.tsx` — Update `LABEL_CATEGORY_ORDER` from `{ mode: 0, type: 1 }` to `{ type: 0 }` (fixes label sorting)

**Pages (2 files)**
- `pages/SettingsPage.tsx` — Remove `modeLabels` state; remove Mode label section from UI; rename Type section to **"Tags"** ("Customize **Tags** for this board"); update `ConfigurableCategory` type from `'mode' | 'type'` to `'type'` only
- `pages/TasksPage.tsx` — Remove `'mode'` from `CATEGORIES` array; rename category display from "Type" to **"Tags"**

**Tests (2 files)**
- `src/__tests__/taskFilters.test.ts` — Remove test cases using Mode labels
- `src/__tests__/` — No other frontend tests reference Mode directly

### Mobile (`mobile/src/`)

**Types & API (2 files)**
- `types/index.ts` — Change `LabelCategory = 'mode' | 'type'` → `'type'`
- `api/labels.ts` — Change function signatures accepting `'mode' | 'type'` → `'type'`

**Components & Screens (4 files)**
- `components/TaskQuickEdit.tsx` — Remove `'mode'` from `EDIT_CATEGORY_ORDER`
- `screens/TaskFormScreen.tsx` — Remove `'mode'` from `CATEGORY_ORDER`; rename "Type" section header to **"Tags"**
- `screens/SettingsScreen.tsx` — Remove `modeLabels` state; remove Mode label section; rename Type section to **"Tags"**
- `screens/ReportsScreen.tsx` — Update `LABEL_CATEGORY_ORDER` from `{ mode: 0, type: 1 }` to `{ type: 0 }` (fixes label sorting)

**Tests (1 file)**
- `src/__tests__/taskFilters.test.ts` — Remove test cases using Mode labels

### Documentation (2 files)
- `DATA_MODEL_AND_API.MD` — Update LABEL_SEED table (remove 4 Mode rows); update category enum note
- `ARCHITECTURE.MD` — Update LABEL_SEED reference; no code structure changes

---

## Test Plan

### Integration Tests (`test_api.py`)
**Removed entirely:**
- `test_create_mode_label` — delete; no longer valid
- `test_list_mode_labels` — delete; no longer valid
- `test_mode_label_duplicate` — delete; no longer valid
- `test_rename_mode_label` — delete; no longer valid
- Mode assertions in bulk label list test

**Added (new 400-validation tests):**
- `test_create_mode_label_returns_400` — POST /labels with category="mode" → 400 Unknown category
- `test_list_mode_labels_returns_400` — GET /labels?category=mode → 400 Unknown category

**Kept:**
- Type label CRUD (create, read, update, delete)
- Cross-board label isolation
- Label assignment to tasks (with Type labels only)
- Duplicate prevention for Type labels

**Expected Result:** All Type label tests pass; new 400-validation tests confirm Mode category is rejected

### Unit Tests (`tests/unit/`)
**test_labels_router.py:**
- Remove `TestSeedBoardLabels.test_seed_includes_mode_labels`
- Keep seed tests for Type labels only
- Keep create/update/delete tests (Type only)

**test_schemas.py:**
- No changes (schemas don't validate enum values directly)

### Frontend Tests (`frontend/src/__tests__/`)
**taskFilters.test.ts:**
- Remove test cases using `{ category: 'mode', value: ... }`
- Keep Type label filtering tests

### Mobile Tests (`mobile/src/__tests__/`)
**taskFilters.test.ts:**
- Remove test cases using Mode labels
- Keep Type label filtering tests

### Manual Verification (Post-Deploy)
1. **Backend API:** Verify GET /labels returns only Type labels; POST /labels with category="mode" returns 400
2. **Frontend Settings:** Verify section header shows **"Tags"** (not "Type" or "Mode")
3. **Frontend TaskForm:** Verify section header shows **"Tags"**; label picker shows only Type labels
4. **Frontend TaskCard:** Verify labels displayed under **"Tags"** category
5. **Mobile Settings:** Verify section header shows **"Tags"** (not "Type")
6. **Mobile TaskForm:** Verify section header shows **"Tags"**; label picker shows only Type labels
7. **Mobile TaskCard:** Verify labels displayed under **"Tags"** category

---

## Deployment Order

**Phase 1: Database Migration** (pre-deployment)
1. Take full database backup
2. Run `scripts/migrate-remove-mode-labels.sh`
3. Verify Mode labels deleted, Type labels intact
4. Keep backup for 30 days

**Phase 2: Backend Deployment** (independent, deploys via Railway)
1. Update `models.py`, `schemas.py`, `routers/labels.py`
2. Update `LABEL_SEED` (remove Mode entries)
3. Update tests (`test_api.py`, `test_labels_router.py`)
4. Verify all tests pass locally
5. Commit + push to feature branch
6. Create PR; run `/full-review`
7. Merge to `main` (triggers Railway backend deploy)
8. **Safe window:** Existing Mode labels already deleted from DB; new Mode creation blocked by schema

**Phase 3: Frontend + Mobile Deployment** (deploy together)
1. Update all frontend files (API, components, pages, tests)
2. Update all mobile files (types, API, components, screens, tests)
3. Update documentation (`DATA_MODEL_AND_API.MD`, `ARCHITECTURE.MD`)
4. Verify all tests pass locally
5. Commit + push to feature branch (same PR as backend, separate files)
6. Merge to `main` (triggers Railway frontend+mobile build)
7. **Safe window:** Backend blocking Mode creation; frontend/mobile UI never offers to create Mode labels

**Pre-Deployment Checklist:**
- [ ] Backup taken and verified
- [ ] Migration script tested on backup (dry-run recommended)
- [ ] Confirm no external webhooks/integrations listening for 'mode' category in label events
- [ ] DATABASE_URL env var configured (not hardcoded in any scripts)
- [ ] All code changes committed and tested locally

**Deployment Monitoring (Phase 3 window):**
- After backend deploy succeeds, monitor for Mode-creation 400 errors in logs
- Keep database backup for 30 days (for potential rollback if frontend deploy fails mid-deployment)
- Expected: Zero 400 errors during Phase 3 deployment (frontend/mobile UI doesn't offer Mode creation)

**Timeline:**
- Backup: 5-10 min
- Migration: 2-5 min
- Backend deploy: 10-15 min (includes tests)
- Frontend+mobile deploy: 10-15 min (includes tests)
- Total: ~45 min, mostly waiting on CI/CD

---

## Rollback Plan

**If migration fails (before code deploy):**
1. Run `scripts/restore-railway-db.sh ./.backups/railway_backup_*.sql`
2. Retry migration or investigate error
3. Do not proceed to code deployment

**If backend deploy fails:**
1. Revert commit on `main`
2. Railway automatically redeploys previous version
3. Database already migrated (Mode labels already deleted); safe state

**If frontend/mobile deploy fails (before becoming live):**
1. Revert commit on `main`
2. Railway automatically redeploys previous version
3. **Critical:** Database is already migrated (Mode labels deleted); backend is blocking Mode creation
4. Old UI tries to fetch Mode labels; API returns empty list (no Mode labels in DB); graceful degradation
5. **Monitoring:** If 400 errors spike during this window, immediately revert backend commit and restore database from backup

**If issues detected post-deploy:**
1. Restore database from backup (keep backup for 30 days)
2. Revert code commits (backend, frontend, mobile)
3. Re-deploy reverted versions
4. Investigate root cause before retry

**Data Safety Note:**
- Keep database backup for **30 days minimum** after successful deployment
- After 30 days and no issues, backup can be safely deleted

---

## Confidence & Risk Assessment

| Metric | Rating | Notes |
|--------|--------|-------|
| **Confidence in solution** | 5/5 | Mode labels unused (0 associations); full data safety |
| **Regression risk** | 2/5 | Type labels unaffected; changes isolated to Mode code paths only |
| **Data loss risk** | 1/5 | Backup taken; 0 Mode data in use; no user impact |
| **Test coverage** | 5/5 | Integration + unit tests cover CRUD and validation; manual verification post-deploy |

**Risk Mitigations:**
- Full database backup before any changes
- Mode isolation (no cross-category logic)
- Backward compatibility not needed (no Mode in use)
- Extensive test coverage for Type labels ensures no regression

---

## Success Criteria

✅ All 44 Mode labels deleted from database  
✅ CategoryEnum contains only `type`  
✅ All Mode code paths removed from backend, frontend, mobile  
✅ All existing tests pass  
✅ Type/Tags labels fully functional (logic unchanged, UI renamed)  
✅ New label creation only offers Type category  
✅ Settings UI shows only **"Tags"** section (renamed from "Type")  
✅ Task form shows **"Tags"** section (renamed from "Type")  
✅ Task cards display labels under **"Tags"** category  
✅ API responses still use `category: "type"` (unchanged)  
✅ No references to "Mode" in code or docs (grep confirms)  
✅ No references to "Type" in user-facing UI (all renamed to "Tags")

---

## Notes for Reviewers

**Dopey (Code Review):**
- Verify all Mode references removed (grep for "mode" in code)
- Ensure Type label functionality unchanged
- Check test coverage for removed code paths
- Verify API returns 400 for Mode operations

**Sleepy (QE/Test Review):**
- Verify test_api.py passes with Mode tests removed
- Check integration tests for Type label CRUD
- Ensure no Mode labels appear in UI or API responses
- Manual test: attempt POST /labels with category="mode" → expect 400

**Doc (Architecture Review):**
- Update LABEL_SEED table documentation
- Update CategoryEnum reference
- Update API contract examples (remove Mode examples)
- No code structure changes needed

**Bashful (Requirements Review):**
- Mode label removal was not in PRD (aspirational feature removal)
- Mark as "aspirational cleanup — removed due to zero usage"
- No product impact (users never used Mode)

---

## Appendix: Production State Details

**Label Distribution:**
- Mode: 44 labels (online, phone, outdoor, email × 11 users/boards)
- Type: 115 labels (mixed user-created + seeded)

**Task Associations:**
- Mode labels: 0 task_labels rows
- Type labels: 293 task_labels rows across 164 tasks

**User Impact:**
- 11 users have Mode labels in default/custom boards
- 0 users have any tasks tagged with Mode
- 0 users will be affected by removal (no feature loss)

---

## Sneezy's Review — 2026-07-13

**Tier:** FULL — plan proposes changes to database schema (CategoryEnum ENUM alteration), API contracts (CategoryEnum removal), and multi-component deployment (backend + frontend + mobile).

**Verdict:** Changes required

### Issues

1. [Gap] **Missing UI component updates** — `frontend/src/components/TaskCard.tsx` and `mobile/src/screens/ReportsScreen.tsx` each define `LABEL_CATEGORY_ORDER: Record<string, number>` with `{ mode: 0, type: 1 }`. These need to be updated to remove the `mode: 0` entry (making it `{ type: 0 }`), but are not mentioned in the "Files to Modify" section (line 129). Without this change, the sorting logic will fail or produce incorrect results when filtering/rendering labels. Same issue for `frontend/src/pages/TasksPage.tsx` if it uses category ordering.

2. [Gap] **Incomplete SettingsPage.tsx changes** — The plan says "remove Mode section" but the actual structure is more complex: 
   - Line 228 of `frontend/src/pages/SettingsPage.tsx` defines `ConfigurableCategory = 'mode' | 'type'` which must be updated to `'type'` only.
   - The instruction text "Customise Mode and Type labels" (found via grep) must be updated to "Customise Tags".
   - The LabelEditor component is called twice (once for mode, once for type); the mode call must be removed entirely, not just hidden or toggled.
   - Same applies to mobile's `SettingsScreen.tsx`.

3. [Gap] **Missing CategoryEnum type update in frontend/mobile** — The plan updates `LabelCategory` type in `frontend/src/api/labels.ts` and `mobile/src/types/index.ts`, but does not mention `ConfigurableCategory` (web) which is a separate type used only in SettingsPage and must also change from `'mode' | 'type'` to `'type'` only.

4. [Gap] **Test strategy ambiguity** — The plan says Mode tests should "pass by asserting `400 Unknown category` for Mode operations" (line 199) but does not clarify whether existing Mode-specific tests should be removed or replaced with new 400-assertion tests. Example: should `test_list_mode_labels` be deleted entirely, or renamed to `test_list_mode_labels_returns_400`? This matters for test ownership (Sleepy's domain per RULES_OF_ENGAGEMENT.md).

5. [Risk] **Database migration script hardcodes production URL** — `scripts/migrate-remove-mode-labels.sh` line 13 embeds the Railway database URL as a default. While it can be overridden via `DATABASE_URL` env var, committing a production database URL (even as a fallback) to version control is a security anti-pattern. Recommend removing the hardcoded default or making it a CI/CD-only secret.

6. [Risk] **Rollback procedure incomplete for phased deployment** — The plan outlines rollback for each phase (DB migration fails, backend deploy fails, frontend deploy fails) but does not address the case where DB migration succeeds, backend deployment succeeds, but frontend/mobile deployment fails **before becoming live**. In this scenario: the DB is migrated and backend is blocking Mode creation, but old UI is still live for the remaining users. While the plan notes "graceful degradation", this window should be explicitly monitored (recommended: keep rollback DB backup for 30 days, set Slack alert if Mode-creation 400 errors spike).

7. [Nit] **UI "Tags" rename not fully specified** — The plan states `category: "type"` remains in API payloads but UI displays as "Tags". The plan should explicitly confirm this is **text-only** (user-visible strings like "Tags" in headers, section titles, buttons) and not a payload/schema change. Spot-checked examples confirm this is correct, but a summary line would prevent implementation confusion.

### Unverified assumptions

1. **Assumption: `LabelCategory` type is the only place type unions need updating.** Verified in `frontend/src/api/labels.ts` (line 4) and `mobile/src/types/index.ts` (line 17), but did not exhaustively search for other union types or type aliases that might include `'mode'`. A pre-implementation grep for `'mode' \|` and `"mode" \|` across the codebase would be prudent.

2. **Assumption: No other tables or views reference the `category` column besides labels and task_labels.** The plan does not mention beliefs (DATA_MODEL_AND_API.MD line 157 shows `belief.label_id` is FK → labels, but category is not stored on beliefs themselves) or ai_cost_log. Verified beliefs and ai_cost_log do not directly reference mode; beliefs get their category transitively via label lookup, so removal is safe.

3. **Assumption: The migration SQL is PostgreSQL-compatible and matches Railway's dialect.** The `ALTER TYPE ... RENAME TO ... CREATE TYPE ... ALTER TABLE ... USING` pattern is standard PostgreSQL, but has not been tested against a staging database. Railway's managed Postgres should support it, but a dry-run on a backup is strongly recommended before production.

### Suggestions

1. **Add a pre-deployment checklist item**: "Confirm no external integrations or webhooks are listening for 'mode' category in label events." (Low risk here since Mode is unused, but good hygiene for future removals.)

2. **Make the Settings page ConfigurableCategory type change explicit in the plan**: Currently line 155–157 only mentions updating "components" and "pages", but type definitions inside the same file should be called out by name (`ConfigurableCategory: 'type'` only).

3. **Document the "expected 400 behavior" in one place**: Add a subsection under "Validation Changes" in the API Contract section (around line 117) with concrete examples:
   ```
   POST /labels with body { "category": "mode", "value": "..." } → 400 Unknown category
   GET /labels?category=mode → 400 Unknown category
   ```
   This will help QE (Sleepy) write confident tests.

4. **Consider adding a pre-migration audit query** to the migration script to confirm zero mode-label task associations:
   ```sql
   SELECT COUNT(*) FROM task_labels tl
   JOIN labels l ON tl.label_id = l.id
   WHERE l.category = 'mode';
   ```
   If this returns > 0, the migration should abort with a clear error message (not just "task_labels cascade delete"). This defensive check is already in the plan narrative (line 56) but not in the script.

5. **Verify LABEL_SEED after removing 4 mode entries**: The plan correctly identifies 9 entries → 5 entries (lines 163–173 of models.py), but add a comment in the code noting "LABEL_SEED now contains only Type labels (5 entries); Mode labels removed in PR #XYZ."

---

*Sneezy*
