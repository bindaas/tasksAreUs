# Plan: Remove Frequency Label Logic from Backend (PR 2 of 3)

## Context

This project (`tasksAreUs`) is removing the `frequency` label category in three PRs:

- **PR 1 (merged):** Remove frequency from all frontend (React) and mobile (React Native) UI. The frontend and mobile no longer display, filter, or offer frequency labels. Backend still serves them.
- **PR 2 (this plan):** Remove backend business logic — seeding, recurrence scheduling, and API validation. The Postgres `category` enum and existing frequency rows in the DB are untouched.
- **PR 3 (future):** DB migration — DELETE frequency label rows, null out any FK references, drop `frequency` from the Postgres `category` enum using the create-new-enum → alter-column → drop-old pattern.

The outside-in order (UI → logic → data) ensures at no point does a deployed layer depend on something already removed.

---

## What the `frequency` category is / was

Labels have a `category` field with three possible values: `mode`, `type`, `frequency`.

Frequency labels (`daily`, `weekly`, `monthly`, `annual`, `one-time`) drove recurring task creation: completing a task with a frequency label would automatically create the next instance due after the appropriate interval. This recurrence feature is being removed entirely.

---

## Codebase map (relevant files)

```
backend/app/
  models.py            — SQLAlchemy models; CategoryEnum; LABEL_SEED list
  schemas.py           — Pydantic request/response schemas
  routers/
    labels.py          — Label CRUD; _CONFIGURABLE set; create/update/delete endpoints
    tasks.py           — Task CRUD + complete endpoint
    sync.py            — Mobile sync endpoint
  services/
    ai_service.py      — Calls ensure_seeded() directly (handle_conversation_message)
    label_service.py   — ensure_seeded() — one-time label seeding per user
    task_service.py    — complete_task(); _get_frequency_label(); _next_due_date(); FREQUENCY_VALUES

backend/tests/unit/
  test_labels_router.py   — Unit tests for label router logic
  test_task_service.py    — Unit tests for task service functions
```

---

## Exact changes planned

### 1. `backend/app/models.py`

**Keep** `CategoryEnum.frequency = "frequency"` — the Python enum must stay because SQLAlchemy maps DB rows with `category='frequency'` to this member. Removing it before the DB migration (PR 3) would cause a runtime error when any existing frequency label is fetched.

**Remove** the five frequency entries from `LABEL_SEED` (the actual constant name — not `SEED_LABELS`):
```python
# DELETE these lines (models.py:163–167):
("frequency", "one-time"),
("frequency", "daily"),
("frequency", "weekly"),
("frequency", "monthly"),
("frequency", "annual"),
```

New users will be seeded with only `mode` and `type` labels (9 entries total, down from 14). Existing users already have frequency labels in the DB and are unaffected.

---

### 2. `backend/app/services/label_service.py`

`ensure_seeded()` currently uses "presence of a frequency label for this user" as its idempotency sentinel — if no frequency label exists, it seeds all labels.

After removing frequency from seeds, this sentinel is broken for new users (they'll never have a frequency label, so every request would re-seed them).

**Change:** Swap the sentinel to check for any `mode` label instead:

```python
# Before (label_service.py:31):
Label.category == CategoryEnum.frequency,

# After:
Label.category == CategoryEnum.mode,
```

**Why this is safe:**
- Existing users (already seeded): have both mode and frequency labels → new sentinel passes → no re-seed. ✓
- New users (not yet seeded): have no labels at all → new sentinel fails → seed with mode+type. ✓
- Edge case: a user who deleted all their mode labels would be re-seeded. `seed_user_labels()` is additive and checks individual `(category, value)` pairs, so it only inserts missing entries — it will not duplicate anything already present.

**Note on `ai_service.py`:** `handle_conversation_message()` in `ai_service.py` calls `ensure_seeded()` directly (line 227), in addition to the call via `_resolve_labels()` in `task_service.py`. After the sentinel swap, the first conversation message for any existing user checks for a mode label instead of a frequency label. All real existing users have mode labels, so this is a no-op and correct.

---

### 3. `backend/app/services/task_service.py`

**Remove:**
- `FREQUENCY_VALUES = {"daily", "weekly", "monthly", "annual"}` (module-level constant)
- `_get_frequency_label(task)` function
- `_next_due_date(base, frequency)` function
- The entire recurrence block inside `complete_task()`:

```python
# DELETE this block (task_service.py:213–239):
frequency = _get_frequency_label(task)
if frequency:
    base = task.must_do_by or date.today()
    next_due = _next_due_date(base, frequency)
    rg_id = task.recurrence_group_id or str(uuid.uuid4())
    if not task.recurrence_group_id:
        task.recurrence_group_id = rg_id
    # ... query for existing pending recurrence instance ...
    # ... create_task(..., recurrence_group_id=rg_id) ...
```

After removal, `complete_task()` always returns `(completed_task, None)`. `next_task` is initialised to `None` at the top of the function and is never reassigned after the recurrence block is gone.

**What stays:**
- The `recurrence_group_id` parameter on `create_task()` — the sync router still passes it; removing it here would break the sync endpoint. Removed in PR 3.
- The `task.recurrence_group_id` column/attribute — still exists in the DB until PR 3.

---

### 4. `backend/tests/unit/test_task_service.py`

**Remove:**
- The import of `_get_frequency_label` and `_next_due_date` (line 14)
- `TestNextDueDate` class (6 tests: `test_daily`, `test_weekly`, `test_monthly`, `test_annual`, `test_monthly_end_of_month`, `test_unknown_frequency_returns_base`)
- `TestGetFrequencyLabel` class (4 tests: `test_returns_frequency_label`, `test_returns_none_when_no_frequency_label`, `test_ignores_unknown_frequency_value`, `test_returns_none_for_empty_labels`)

**Add** a new `TestCompleteTask` class to cover the post-change behavior:
- `test_complete_task_returns_none_next_task` — verifies `complete_task()` returns `(completed_task, None)` for a plain (non-recurring) task.
- `test_complete_task_returns_none_next_task_even_with_frequency_label` — verifies that even if a task has a legacy frequency label attached, `complete_task()` still returns `(task, None)` (no recurrence created).

All other test classes remain unchanged.

---

### 5. `backend/tests/unit/test_labels_router.py`

The class that manages seed tests is `TestSeedUserLabels` (not `TestListLabels` — the latter does not exist in the current file). Two tests in this class need updating:

- **`test_seeds_all_labels_for_new_user`** — currently asserts `db.add.call_count == len(LABEL_SEED)` and that the seeded set matches `LABEL_SEED`. After removing five frequency entries from `LABEL_SEED`, this test will still pass automatically (it asserts against the constant, not a hardcoded 14). Verify it passes; no edit likely needed.

- **`test_skips_already_existing_labels`** — pre-seeds the mock DB with one `(CategoryEnum.frequency, "daily")` row and asserts `db.add.call_count == len(LABEL_SEED) - 1`. After frequency is removed from `LABEL_SEED`, the pre-seeded frequency row is no longer in `LABEL_SEED`, so `seed_user_labels()` will not skip it and `add.call_count` will equal `len(LABEL_SEED)` instead of `len(LABEL_SEED) - 1`. **Fix:** change the pre-seeded mock row from `(CategoryEnum.frequency, "daily")` to a mode or type entry that remains in `LABEL_SEED` (e.g., `(CategoryEnum.mode, "online")`).

- **`test_seeds_nothing_when_fully_seeded`** — will still pass after the shrink (no `db.add` calls). It now exercises a smaller seed set, which is acceptable; PR 3 removes frequency data entirely.

The following tests **stay unchanged** (they verify correct rejection behaviour that remains valid):
- `test_rejects_frequency_category` (~line 78) — the labels router still blocks users from creating frequency labels via `_CONFIGURABLE = {CategoryEnum.mode, CategoryEnum.type}`
- `test_rejects_frequency_label` (~lines 129, 179) — delete and update endpoints still reject frequency labels

---

### 6. Integration test pre-conditions (Sleepy's responsibility)

`backend/tests/test_api.py` is owned exclusively by Sleepy and is not edited here, but Sleepy **must** update it as part of this PR before CI can pass. Specific failures after this PR:

| Line(s) | Current assertion | Breaks because |
|---------|------------------|---------------|
| ~129 | `>= 14` label count | New users get 9 labels |
| ~169 | `== 14` label count | New users get 9 labels |
| ~176–179 | `len(freq_labels) == 5` and each of the five frequency values | No frequency labels seeded |
| ~804–811 | `next_task is not None`, task is pending, has `recurrence_group_id`, has `must_do_by` set to tomorrow | `complete_task()` always returns `None` for `next_task` |

Sleepy should update these assertions to reflect the new expected behavior and delete or convert the recurring-task completion test to assert `next_task is None`.

---

## What does NOT change in this PR

| Thing | Why it stays |
|-------|-------------|
| `CategoryEnum.frequency` | SQLAlchemy needs it to deserialise existing DB rows |
| `recurrence_group_id` column, Task model field | DB column stays until PR 3 |
| `recurrence_group_id` in schemas / tasks router filter / sync router | All reference the DB column; removed in PR 3 |
| `_CONFIGURABLE` in `labels.py` | Already excludes frequency; no change needed |
| Existing frequency rows in the DB | Untouched; removed in PR 3 |

---

## API contract impact

`POST /tasks/{id}/complete` response schema:
```json
{ "completed_task": {...}, "next_task": null | {...} }
```
After this PR, `next_task` is always `null`. This is already a valid value per the schema (`Optional[Task]`). Frontend and mobile already merged PR 1 and handle `null` gracefully.

No other endpoint signatures change.

---

## Risks / concerns for reviewer

1. **`ensure_seeded` sentinel swap** — the change from frequency→mode sentinel is the highest-risk item. Verify there is no timing window where an existing user (who has mode labels) could be incorrectly re-seeded.

2. **`complete_task` always returns `None` for `next_task`** — confirm that no client code beyond frontend/mobile consumes this field (e.g., the sync endpoint or any admin tooling).

3. **`recurrence_group_id` left in place** — existing tasks in the DB may have non-null `recurrence_group_id`. The column stays. Verify that leaving orphaned `recurrence_group_id` values causes no runtime error in any remaining code path.

---

## Out of scope for this PR

- Removing the Postgres `category` enum value `'frequency'` — requires a multi-step enum migration (PR 3)
- Deleting frequency label rows from the `labels` table — PR 3
- Nulling `beliefs.label_id` FK references to frequency labels — PR 3
- Any mobile or frontend changes — already done in PR 1
- Updating `DATA_MODEL_AND_API.MD` to reflect the new seeding sentinel — Doc handles this via `/full-review` post-merge

---

## Sneezy's Review — 2026-06-25

**Verdict:** Changes required

### Issues

1. **[Blocker] `test_labels_router.py` — `TestSeedUserLabels` breaks after `LABEL_SEED` shrinks.**
   `backend/tests/unit/test_labels_router.py:28` asserts `db.add.call_count == len(LABEL_SEED)` and line 31 asserts `{(l.category.value, l.value) for l in added} == set(LABEL_SEED)`. After removing the five frequency entries from `LABEL_SEED`, both assertions still hold against the *new* (smaller) constant — so `test_seeds_all_labels_for_new_user` will pass. However `test_skips_already_existing_labels` (line 34) pre-populates the mock DB with one `CategoryEnum.frequency / "daily"` row and asserts `db.add.call_count == len(LABEL_SEED) - 1`. Once frequency entries are removed from `LABEL_SEED`, this mock row no longer appears in `LABEL_SEED`, so the "skip" logic will never fire and `add.call_count` will equal `len(LABEL_SEED)` (not `len(LABEL_SEED) - 1`), causing a test failure. The plan does not mention updating this test.

   > **Grumpy — Addressed.** Plan §5 now explicitly calls out `test_skips_already_existing_labels` and prescribes changing the pre-seeded mock row from `(CategoryEnum.frequency, "daily")` to `(CategoryEnum.mode, "online")`.

2. **[Blocker] `test_api.py` integration test asserts exactly 14 seeded labels and 5 frequency labels.**
   `backend/tests/test_api.py:169` — `assert_eq("GET /labels returns all 14 seeded labels (PR #16)", len(labels), 14)`. After removing five frequency entries from `LABEL_SEED`, a newly seeded user gets 9 labels, not 14. Line 129 has a softer `>= 14` check, but line 169 and lines 176-179 (asserting `len(freq_labels) == 5` and each of the five frequency values) will all fail. The plan explicitly excludes `test_api.py` from its change list (correctly — it is Sleepy's file), but it does not flag this as a consequence that Sleepy must handle.

   > **Grumpy — Addressed.** Plan §6 now explicitly lists all failing assertions with line numbers and marks them as Sleepy's responsibility before CI can pass.

3. **[Blocker] `test_api.py` integration test asserts that completing a recurring task produces a `next_task`.**
   `backend/tests/test_api.py:804-811` — the recurring-task test creates a daily task and asserts `result["next_task"] is not None`, the next task is pending, shares `recurrence_group_id`, and has `must_do_by` set to tomorrow. After this PR removes the recurrence block from `complete_task()`, `next_task` will always be `None`, causing these assertions to fail.

   > **Grumpy — Addressed.** Captured in plan §6. Sleepy must convert or remove the recurring-task completion test.

4. **[Blocker] No unit test coverage for `complete_task()`'s new always-`None` behavior.**
   The plan does not add any test coverage for `complete_task()`'s post-change behavior (i.e. that it always returns `(task, None)`).

   > **Grumpy — Addressed.** Plan §4 now prescribes a new `TestCompleteTask` class with two tests: one for a plain task and one asserting a task with a legacy frequency label still returns `(task, None)`.

5. **[Risk] `test_labels_router.py:53` (`test_seeds_nothing_when_fully_seeded`) will silently pass but tests dead seed data.**
   That test constructs a fully-seeded mock DB using the current `LABEL_SEED` content. After removing frequency entries, the test still passes (no `db.add` calls) but now exercises a smaller set.

   > **Grumpy — Acknowledged, not actioned.** Plan §5 notes this. Acceptable gap; PR 3 removes frequency data entirely. The test remains structurally correct.

6. **[Risk] `ensure_seeded()` sentinel swap: `seed_user_labels()` is additive and checks individual `(category, value)` pairs.**
   The plan's edge-case reasoning is accurate and the behavior is correct.

   > **Grumpy — Acknowledged.** Plan §2 now explicitly notes that `seed_user_labels()` is additive and idempotent at the individual-row level to make the reasoning clearer.

7. **[Risk] `ai_service.py` calls `ensure_seeded()` directly — not mentioned in the plan.**
   `handle_conversation_message` in `ai_service.py` calls `ensure_seeded` directly (line 227). After the sentinel swap, existing users are unaffected (they have mode labels).

   > **Grumpy — Addressed.** Plan §2 now explicitly calls out `ai_service.py` as a second caller of `ensure_seeded()` and confirms no code change is needed there.

8. **[Gap] The plan names the constant `SEED_LABELS` but the actual constant is `LABEL_SEED`.**
   `backend/app/models.py:162` defines `LABEL_SEED`. The plan used `SEED_LABELS` throughout its codebase map and §1.

   > **Grumpy — Addressed.** All occurrences of `SEED_LABELS` replaced with `LABEL_SEED` throughout the plan.

9. **[Gap] The plan does not mention updating `DATA_MODEL_AND_API.MD`.**
   `DATA_MODEL_AND_API.MD` documents the seeding sentinel as "presence of a frequency label." After this PR it will be inaccurate.

   > **Grumpy — Addressed.** Added to Out of scope section: Doc handles this via `/full-review` post-merge, consistent with how all other doc updates are handled.

10. **[Gap] `test_labels_router.py` — the plan says to update `TestListLabels` but that class does not exist.**
    The plan referenced `TestListLabels` at lines 37/45. The actual class in the current file is `TestSeedUserLabels`.

    > **Grumpy — Addressed.** Plan §5 now correctly names `TestSeedUserLabels` and identifies the exact tests to update (`test_seeds_all_labels_for_new_user` and `test_skips_already_existing_labels`).

### Unverified assumptions

- **"The test file does not appear to have a `TestCompleteTask` class"** (plan §4, risk #4): Confirmed true — `test_task_service.py` has no `TestCompleteTask`. The assumption is correct.
- **"`recurrence_group_id` in sync router still passes it"** (plan §3 "What stays"): Confirmed — `sync.py` line 58 sets `recurrence_group_id=t_data.get("recurrence_group_id")` when creating tasks, and line 59 in the server response includes `"recurrence_group_id": t.recurrence_group_id`. The column and router reference are safe to leave.
- **"complete_task() always returns (completed_task, None) after removal"**: Confirmed by reading `complete_task()` at lines 201–243 of `task_service.py`. After the recurrence block (lines 213–239) is removed, the function commits and returns `(task, next_task)` where `next_task` is initialized to `None` and never reassigned. Correct.
- **"The `_CONFIGURABLE` set in labels.py already excludes frequency; no change needed"**: Confirmed — `labels.py:14` defines `_CONFIGURABLE = {CategoryEnum.mode, CategoryEnum.type}`. No change needed.
- **"Line numbers ~163–167 for the five frequency entries in LABEL_SEED"**: Confirmed accurate. `models.py:163-167` are exactly the five frequency tuples.
- **"Sentinel currently checks `CategoryEnum.frequency`"**: Confirmed — `label_service.py:31` filters on `Label.category == CategoryEnum.frequency`.
- **"Import of `_get_frequency_label` and `_next_due_date` on line 14 of `test_task_service.py`"**: Confirmed — line 14 imports both symbols from `app.services.task_service`.

### Suggestions

1. **Explicitly call out the integration test impact as a pre-condition.** The plan should note that `backend/tests/test_api.py` will have multiple test failures after this PR (label count assertions, recurring task assertions) and that Sleepy must update those tests as part of this PR before it can pass CI.

2. **Add a `TestCompleteTask` unit test.** After removing the recurrence block, add at least one test asserting `complete_task()` returns `(task, None)` for any task, and one confirming it still raises 422 for already-completed tasks. This closes the coverage gap introduced by the deletion.

3. **Update the codebase map naming.** Replace `SEED_LABELS` with `LABEL_SEED` in the plan's codebase map and §1 description so the plan matches the actual symbol.

4. **Add a note about `test_skips_already_existing_labels` in `test_labels_router.py`.** The test's pre-seeded mock row (`CategoryEnum.frequency / "daily"`) will become an out-of-LABEL_SEED row after the frequency entries are removed. Either update the mock to use a mode/type entry, or document why the test remains meaningful.

5. **Note the `TestListLabels` discrepancy.** The plan references updating a `TestListLabels` class at specific line numbers that do not exist in the current `test_labels_router.py`. Resolve this before implementation — either the class was removed in a prior PR or the plan is pointing at the wrong file.

— *Sneezy*
