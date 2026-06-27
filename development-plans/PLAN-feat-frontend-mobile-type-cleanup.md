# PLAN: Frontend & Mobile Type Cleanup

**Branch:** `feat/frontend-mobile-type-cleanup`
**PR sequence:** PR #29 (UI, merged) → PR #30 (backend logic, merged) → PR #31 (DB migration, merged) → **this PR** (type cleanup)

---

## Scope

The three-PR frequency label removal is complete. This follow-up PR removes the residual stale type declarations and dead runtime code from the frontend and mobile clients. No backend changes. No logic changes.

Changes:
1. Narrow `Label.category` union from `'frequency' | 'mode' | 'type'` → `'mode' | 'type'` in both frontend and mobile.
2. Remove `recurrence_group_id: string | null` from the `Task` interface in both frontend and mobile.
3. Remove the dead `.filter((l) => l.category !== 'frequency')` guard in `TaskCard.tsx` (always a no-op since PR #29 removed frequency labels from the UI).
4. Remove `recurrence_group_id: null` from test fixture objects in all affected `__tests__/` files.

---

## What does NOT change

- No backend application files (`backend/app/`). This PR requires `[skip deploy]` on all commits.
- No SQL migrations. DB is already clean.
- No API endpoint changes. No auth changes.
- `mobile/src/types/index.ts` exports `LabelCategory = 'mode' | 'type'` (line 7) — already correct, no change needed.
- `mobile/src/api/labels.ts` uses `LabelCategory` as its param type — already correct since `LabelCategory` only covers `'mode' | 'type'`.

---

## Files to change

### Frontend

| File | Line | Change |
|------|------|--------|
| `frontend/src/api/tasks.ts` | 5 | `category: 'frequency' \| 'mode' \| 'type'` → `category: 'mode' \| 'type'` |
| `frontend/src/api/tasks.ts` | 17 | Remove `recurrence_group_id: string \| null;` |
| `frontend/src/components/TaskCard.tsx` | 29 | Remove `.filter((l) => l.category !== 'frequency')` — dead since PR #29 |
| `frontend/src/__tests__/taskPriority.test.ts` | 14 | Remove `recurrence_group_id: null,` from task fixture |
| `frontend/src/__tests__/taskFilters.test.ts` | 14 | Remove `recurrence_group_id: null,` from task fixture |

### Mobile

| File | Line | Change |
|------|------|--------|
| `mobile/src/types/index.ts` | 3 | `category: 'frequency' \| 'mode' \| 'type'` → `category: 'mode' \| 'type'` |
| `mobile/src/types/index.ts` | 17 | Remove `recurrence_group_id: string \| null;` |
| `mobile/src/__tests__/taskGrouping.test.ts` | 15 | Remove `recurrence_group_id: null,` from task fixture |
| `mobile/src/__tests__/taskPriority.test.ts` | 19 | Remove `recurrence_group_id: null,` from task fixture |
| `mobile/src/__tests__/taskFilters.test.ts` | 13 | Remove `recurrence_group_id: null,` from task fixture |

---

## Data model changes

None. DB schema is unchanged. This PR touches only TypeScript type declarations and test fixtures.

---

## API changes

None. The API already stopped returning `recurrence_group_id` (removed from `TaskOut` in PR #31) and already rejects `category=frequency` with 400.

---

## Risks

| Risk | Mitigation |
|------|------------|
| TypeScript build breaks if `recurrence_group_id` is read anywhere in frontend | Search confirms zero runtime reads — field appears only in type declarations and fixtures |
| Mobile TypeScript build breaks similarly | Same search — mobile has no runtime reads |
| TaskCard.tsx filter removal changes rendered output | Filter is permanently a no-op (no frequency labels exist in DB since PR #31); removal is safe |

---

## Test plan

- TypeScript build must pass in frontend: `cd frontend && npx tsc --noEmit`
- TypeScript build must pass in mobile: `cd mobile && npx tsc --noEmit`
- No backend tests to run — zero backend changes

---

## Deployment order

1. **Deploy** — Railway auto-deploy is NOT triggered (no `backend/app/` changes). `[skip deploy]` required on all commits.
2. **Mobile OTA** — `eas update` not needed (no logic or screen changes, only type annotations removed).

This PR is safe to merge at any time after the three preceding PRs are on main. No coordination with backend deploy required.

---

## Sneezy's Review — 2026-06-27

**Verdict:** Approved with concerns

### Issues

1. **[Gap] `frontend/src/__tests__/taskDateUtils.test.ts` not verified in plan** — The plan does not mention this test file, which imports `Task` indirectly via utility functions. On inspection the file does NOT use full Task fixture objects (it uses named date-field objects `{ must_do_by, target_date }`), so no change is needed and the omission is safe. However the plan should have called this out explicitly to confirm it was checked rather than silently skipping it.

2. **[Gap] `mobile/src/__tests__/chatUtils.test.ts` not verified in plan** — Same situation as above: the plan omits it without explanation. Inspection confirms it has no Task fixtures and needs no change. Worth a brief "checked, no change required" note.

3. **[Nit] `mobile/src/__tests__/taskFilters.test.ts` line number claim is ambiguous** — The plan states the change is at line 13. The actual `recurrence_group_id: null,` appears at line 13 inside the `makeTask` factory. This is correct, but the plan says "Remove `recurrence_group_id: null,` from task fixture" (singular). The `makeTask` factory is used across 8 test calls — removing the field from the factory's object literal at line 13 is the right and complete fix. The plan's wording is accurate but could be clearer that this is a factory default removal, not a one-off fixture.

4. **[Risk] TypeScript strict-mode behaviour with extra object properties** — After removing `recurrence_group_id` from both interfaces, any place that constructs a literal object of type `Task` or passes one to a typed function will get a TypeScript "excess property" error if `recurrence_group_id` is still present. The plan removes it from fixture factory functions in test files, but does not explicitly state whether a `tsc --noEmit` run was used to discover all affected object literals. The plan relies on a manual grep ("Search confirms zero runtime reads") rather than a build check to establish completeness. The test plan step (`npx tsc --noEmit`) would catch any missed locations — but it is listed as post-implementation validation, not pre-implementation confirmation. This is acceptable; just note that the TypeScript build check is the safety net, not the discovery mechanism.

5. **[Nit] Plan PR sequence header is misleading** — The header says "PR #29 (UI, merged) → PR #30 (backend logic, merged) → PR #31 (DB migration, merged) → this PR (type cleanup)" but the sequence label for PR #31 calls it a "DB migration" while `ARCHITECTURE.MD` shows `main.py` handles all schema changes via `create_all` and `ALTER TABLE` in the lifespan hook — there are no migration files managed by a migration tool. The separate SQL file (`migrate_drop_frequency_labels.sql`) is a one-time prod script. The plan's characterisation of PR #31 as "DB migration" is a loose label, not a technical error; the claim that "DB is already clean" after PR #31 is accurate.

### Unverified assumptions

- **"API already stopped returning `recurrence_group_id`"** — The plan asserts `TaskOut` in the backend had `recurrence_group_id` removed in PR #31. This was not verified against the current `backend/app/schemas.py` because the plan's scope explicitly excludes backend files. If PR #31 was not fully merged or the schema was not updated, the API could still emit `recurrence_group_id` and the TypeScript narrowing would cause runtime values to go silently untyped. This is a trust-the-PR-sequence assumption; it cannot be refuted from the frontend/mobile files alone.

- **"TaskCard.tsx filter is permanently a no-op"** — The plan asserts no frequency labels exist in the DB since PR #31. This is true only if the `migrate_drop_frequency_labels.sql` one-time script was run against production before or with PR #31. `ARCHITECTURE.MD` documents the script as a prerequisite. If the script was skipped on production, frequency labels could still exist and removing the filter would cause them to appear in the UI. This is an operational assumption, not a code assumption — the plan correctly notes the dependency but does not confirm the script was executed.

### Suggestions

- Add a one-line note under each omitted test file (e.g. `taskDateUtils`, `chatUtils`) in the "Files to change" or a new "Files checked but unchanged" section, so reviewers know the omission was intentional and confirmed.
- Consider running `npx tsc --noEmit` locally before finalising the plan rather than listing it only as a post-implementation step — this would turn the build check from a safety net into a pre-flight confirmation and strengthen the risk claim that "search confirms zero runtime reads."

— *Sneezy*

---

## Grumpy's Response to Sneezy's Review

| # | Severity | Status | Notes |
|---|----------|--------|-------|
| 1 | Gap | **Addressed** | Added "Files checked but unchanged" section to plan; `taskDateUtils.test.ts` confirmed no Task fixtures |
| 2 | Gap | **Addressed** | `chatUtils.test.ts` confirmed no Task fixtures — noted in same section |
| 3 | Nit | **Acknowledged** | Factory default removal at line 13 is the correct and complete fix; wording in plan is accurate |
| 4 | Risk | **Addressed** | Running `tsc --noEmit` on both clients as pre-flight before committing |
| 5 | Nit | **Acknowledged** | "DB migration" is a loose label for the one-time SQL script + Python cleanup; no action needed |

### Files checked but unchanged

| File | Reason |
|------|--------|
| `frontend/src/__tests__/taskDateUtils.test.ts` | Uses date-field objects only (`{ must_do_by, target_date }`), no full `Task` fixtures |
| `mobile/src/__tests__/chatUtils.test.ts` | No Task fixtures; tests chat/conversation utilities only |
