# PLAN: feat-multi-board — Multiple Boards

## Overview

Introduce the concept of multiple boards. Each user can have up to 5 boards. Each board has its own tasks and its own labels. The system ships one "General tasks" board per user (seeded on first access). All existing scoped entities (tasks, labels, conversations, reports) operate within the context of the active board.

---

## Requirements

- Max 5 boards per user (server-side constant `MAX_BOARDS_PER_USER = 5`; not user-changeable)
- System seeds one "General tasks" board for every user (new and existing), with the current 9 default labels
- New boards created by the user start with zero labels
- Board display order: default board first, then creation order (`is_default DESC, created_at ASC`)
- Active board = whatever the user is currently viewing (client-side state only); on app open → default board
- Default board stored on backend; user can change which board is default at any time
- Board can be renamed; user can set any board as the new default
- Board can only be deleted if it has zero tasks AND zero labels; cannot delete if it is the only board; cannot delete if it is the current default (user must promote another board to default first)
- All existing scopes (tasks, labels, conversations, reports, AI chat) operate within the active board only (cross-board views are future work)
- Tasks cannot be moved between boards (future work)

---

## Data Model Changes

### New table: `boards`

All columns that reference IDs use `Column(String, ...)` to match the existing codebase pattern (not the SQLAlchemy `UUID` dialect type).

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR | PK, UUID string |
| `user_id` | VARCHAR | FK → users, NOT NULL, indexed |
| `name` | VARCHAR | NOT NULL |
| `is_default` | BOOLEAN | NOT NULL, default false |
| `is_deleted` | BOOLEAN | NOT NULL, default false — soft-delete to match project-wide convention and protect future sync |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Constraints:**
- Partial unique index: `UNIQUE (user_id) WHERE is_default = true` — enforces exactly one default board per user at the DB level. **Must be created via raw SQL in the `main.py` lifespan block** (`conn.execute(text(...))`) — SQLAlchemy `create_all()` does not support partial indexes.

**Display order**: `ORDER BY is_default DESC, created_at ASC` — no separate `display_order` column needed.

---

### Modified table: `labels`

- **Add**: `board_id` VARCHAR FK → boards (nullable first, then tightened — see migration steps below)
- **Drop**: uniqueness index `labels_user_id_category_value_key` on `(user_id, category, value)` — via `DROP INDEX IF EXISTS` in `main.py` lifespan
- **Add**: uniqueness index `labels_board_id_category_value_key` on `(board_id, category, value)` — via `CREATE UNIQUE INDEX IF NOT EXISTS` in `main.py` lifespan. Same label value can appear in different boards.

---

### Modified table: `tasks`

- **Add**: `board_id` VARCHAR FK → boards (nullable first, then tightened — see migration steps below)

---

### Modified table: `conversations`

- **Add**: `board_id` VARCHAR FK → boards (nullable first, then tightened — see migration steps below)

---

### Table: `messages` — no change

`messages` are scoped to a board through their parent `conversation.board_id`. No `board_id` column is needed on `messages` directly. `handle_conversation_message` receives the conversation object and already has access to `conversation.board_id` at call time.

---

### New backend constant

```python
MAX_BOARDS_PER_USER = 5
```

Lives in `board_service.py` (not `models.py` — keeping ORM models free of business-rule constants).

---

## Seeding Changes

**Current sentinel**: "user has 0 labels" → seed 9 labels.

**Problem 1**: labels now belong to a board. A board must exist before labels can be seeded into it.

**Problem 2**: the current sentinel fires once per user lifetime. After the migration, existing users already have labels, so the sentinel would never fire — which is correct for existing boards. But it must not fire for new (empty) boards either, since new boards intentionally start with zero labels.

**New sentinel**: scoped to the board, not the user. `ensure_board_seeded(board_id)` checks "this board has 0 labels". It is called only for the initial "General tasks" board during first-access seeding — **not** for new boards created by the user (those start empty by design).

Call chain: on first user access → `ensure_board_seeded()` in `board_service.py` → if no boards exist, create "General tasks" board + seed 9 labels for it → return the board. Subsequent calls are idempotent. `IntegrityError` on `labels_board_id_category_value_key` is caught and swallowed (same pattern as today).

**Unit test impact**: `TestSeedUserLabels` in `backend/tests/unit/test_labels_router.py` currently asserts on `Label.user_id`. After this change the assertions must use `Label.board_id`. This test must be rewritten as part of PR 1.

---

## Startup Migration (idempotent, at lifespan startup)

The migration runs in this exact order to avoid NOT NULL violations on existing rows:

**Step 1 — DDL: add columns as NULLABLE**
```sql
ALTER TABLE labels ADD COLUMN IF NOT EXISTS board_id VARCHAR;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS board_id VARCHAR;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS board_id VARCHAR;
```

**Step 2 — DDL: create boards table + partial unique index**
```sql
-- boards table is created by Base.metadata.create_all() via the Board ORM model
CREATE UNIQUE INDEX IF NOT EXISTS boards_user_id_default_key
  ON boards (user_id) WHERE is_default = true;
```

**Step 3 — DDL: drop old label uniqueness index + create new one**
```sql
DROP INDEX IF EXISTS labels_user_id_category_value_key;
CREATE UNIQUE INDEX IF NOT EXISTS labels_board_id_category_value_key
  ON labels (board_id, category, value);
```

**Step 4 — DML: create "General tasks" board for all existing users who have no board**
For each user who has labels/tasks/conversations but no board row:
1. Insert a "General tasks" board for that user, `is_default = true`, `is_deleted = false`
2. `UPDATE labels SET board_id = <new_board_id> WHERE user_id = <user_id> AND board_id IS NULL`
3. `UPDATE tasks SET board_id = <new_board_id> WHERE user_id = <user_id> AND board_id IS NULL`
4. `UPDATE conversations SET board_id = <new_board_id> WHERE user_id = <user_id> AND board_id IS NULL`

Guard: `SELECT 1 FROM boards WHERE user_id = <user_id> LIMIT 1` — skip if row exists. Safe to re-run.

**Step 5 — DDL: tighten columns to NOT NULL**
```sql
ALTER TABLE labels ALTER COLUMN board_id SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN board_id SET NOT NULL;
ALTER TABLE conversations ALTER COLUMN board_id SET NOT NULL;
```

This step runs only after Step 4 ensures all rows are populated.

---

## API Changes

### New resource: `/boards`

#### `GET /boards`
Returns all boards for the current user, ordered default-first then creation order.

**Response**
```json
{
  "boards": [
    { "id": "uuid", "name": "General tasks", "is_default": true, "created_at": "..." },
    { "id": "uuid", "name": "Job search", "is_default": false, "created_at": "..." }
  ]
}
```

---

#### `POST /boards`
Create a new board. New boards always start with `is_default = false` and zero labels.

**Request**
```json
{ "name": "Write a book" }
```

**Response** `201 Created` — the created board object

**Error cases**
- `400` — name is empty/whitespace
- `422` — user already has `MAX_BOARDS_PER_USER` boards

---

#### `PUT /boards/{board_id}`
Rename a board and/or set it as the new default.

**Request** (all fields optional)
```json
{ "name": "Personal tasks", "is_default": true }
```

Setting `is_default: true` atomically clears the old default and sets this board as default (single transaction).

Setting `is_default: false` on the current default board → `400` ("cannot demote the default board — set another board as default first"). Setting `is_default: false` on a non-default board is a no-op (already false).

**Response** — updated board object

**Error cases**
- `400` — name is empty/whitespace
- `400` — `is_default: false` sent on the current default board
- `403` — caller does not own the board
- `404` — board not found

---

#### `DELETE /boards/{board_id}`
Delete a board.

**Response** `204 No Content`

**Error cases**
- `400` — board has tasks (delete tasks first)
- `400` — board has labels (delete labels first)
- `400` — board is the only board (minimum 1 required)
- `400` — board is the current default (set another board as default first)
- `403` — caller does not own the board
- `404` — board not found

---

### Modified existing endpoints (backward-compat: omitting `board_id` defaults to the user's default board)

| Endpoint | Change |
|---|---|
| `GET /labels` | Add `?board_id=uuid` (optional) |
| `POST /labels` | Add `board_id` in request body (optional) |
| `GET /tasks` | Add `?board_id=uuid` (optional) |
| `POST /tasks` | Add `board_id` in request body (optional) |
| `POST /conversations` | Add `board_id` in request body (optional) |
| `GET /reports/completions` | Add `?board_id=uuid` (optional) |
| `POST /sync` | Extend to include `boards` array in push/pull; tasks and labels carry `board_id` in the payload |

**Cross-entity validation**: when assigning a label to a task (`POST /tasks`, `PUT /tasks/{task_id}`), the API verifies `label.board_id == task.board_id`. Mismatch → `400`.

---

## Files to Modify

### Backend (PR 1)

- `backend/app/models.py` — add `Board` model, `MAX_BOARDS_PER_USER` constant, add `board_id` FK to `Task`, `Label`, `Conversation`
- `backend/app/schemas.py` — add `BoardOut`, `BoardCreate`, `BoardUpdate`; extend `TaskIn`/`TaskOut`, `LabelIn`/`LabelOut`, `ConversationOut` with `board_id`; extend sync schemas
- `backend/app/main.py` — add DDL migrations (`ALTER TABLE labels ADD COLUMN IF NOT EXISTS board_id`, tasks, conversations); add DML migration for existing users; register new `boards` router
- `backend/app/routers/boards.py` — **new file**: CRUD for boards
- `backend/app/routers/labels.py` — pass `board_id` through; update `ensure_seeded()` call chain
- `backend/app/routers/tasks.py` — pass `board_id` through
- `backend/app/routers/conversations.py` — pass `board_id` through
- `backend/app/routers/reports.py` — pass `board_id` through
- `backend/app/routers/sync.py` — extend push/pull to include boards; **explicitly add default-board resolution** for tasks/labels pushed without `board_id` (sync router constructs `Task` directly, not via `task_service.create_task()`, so the defaulting logic must be added here independently)
- `backend/app/services/label_service.py` — update `ensure_seeded()` call chain; the seeding sentinel changes from "user has 0 labels" to "board has 0 labels" (in `board_service.ensure_board_seeded()`)
- `backend/app/services/board_service.py` — **new file**: board CRUD logic, board seeding (`ensure_board_seeded()`), board cap enforcement (`MAX_BOARDS_PER_USER = 5`), default-board lookup helper used by all routers
- `backend/app/services/task_service.py` — update `_resolve_labels(label_ids, user_id, db)` → `_resolve_labels(label_ids, user_id, board_id, db)`; add `board_id` filter to the label query to enforce cross-board isolation. Call sites: `create_task()`, `update_task()`, and the AI service's `create_task` tool invocation in `ai_service.py` — all must pass `board_id`
- `backend/app/services/ai_service.py` — **add to PR 1 scope**: filter label queries by `board_id` in both `generate_beliefs()` (line 68) and `handle_conversation_message()` (line 228); both currently query `Label.user_id == user_id` only and will pull labels from all boards without this fix
- `backend/tests/unit/test_labels_router.py` — rewrite `TestSeedUserLabels`: assertions currently use `Label.user_id`; after the change they must use `Label.board_id`
- `backend/tests/unit/` — add unit tests for board service: board cap, default swap atomicity, deletion guards (has tasks, has labels, only board, is default), `ensure_board_seeded()` idempotency, `_resolve_labels()` cross-board rejection

### Frontend (PR 2)

- Board navigation component (selector/tabs)
- Board management UI: create, rename, set default, delete (with guard messaging)
- Active board state (local state or context)
- Pass `board_id` to all API calls based on active board
- On app load: fetch boards, navigate to default board
- **`FilterContext.tsx`**: label filter panel must show only labels belonging to the active board (currently shows all user labels — will silently show cross-board labels without this fix)

### Mobile (PR 3)

- Same as frontend
- Label filter panel on mobile must be scoped to the active board (same issue as `FilterContext.tsx`)
- OTA update (`eas update`) — JS/TS only changes

---

## Deployment Order

1. **Backend** — deploys first. Old mobile/frontend clients omit `board_id`; server defaults to the user's default board. Fully backward-compat.
2. **Frontend** — deploys after backend. Board UI becomes available on web.
3. **Mobile** — OTA update after backend. Board UI becomes available on mobile.

No hard dependency between steps 2 and 3.

---

## Risks and Assumptions

1. **Startup migration includes DML** — existing pattern only runs `ALTER TABLE`. Adding rows at startup is safe with the idempotent guard. Risk: slow on large datasets; acceptable for current scale.

2. **Atomic default swap** — `PUT /boards/{board_id}` with `is_default: true` must clear the old default and set the new one in a single transaction. The partial unique index enforces DB integrity; the application layer must use an explicit transaction.

3. **Sync with stale mobile clients** — old clients pushing tasks without `board_id` have tasks defaulted to the user's default board. Handled explicitly in `sync.py` (not just `tasks.py`).

4. **`messages` scoped through conversation** — no `board_id` column on `messages`; they inherit scope via `conversation.board_id`. Confirmed safe.

5. **Label seed collision** — `IntegrityError` fires on `labels_board_id_category_value_key` after the change (not the old key). The rollback catch is generic and will still work. Any test asserting on the specific constraint name must be updated.

6. **Boards use soft-delete** — `is_deleted` column added to `boards` to match the project-wide convention and protect the sync protocol if boards are ever included in sync payloads.

7. **`DELETE /boards` on the default board** — returns `400`; user must promote another board first. No auto-promotion.

8. **`LabelOut` intentionally omits `board_id`** — clients always fetch labels in a board context; the `board_id` is redundant in the response. If mobile sync ever needs it, `LabelOut` can be extended then.

9. **`422` for board cap** — consistent with the existing `422` for the high-priority daily cap. Both are business-rule violations. `400` is used for input validation (empty name). This is documented as a deliberate pattern choice.

---

## Test Plan

- Unit tests: board cap enforcement, default swap atomicity, deletion guards (tasks present, labels present, only board, is default), seeding idempotency, cross-board label validation
- Integration tests (`test_api.py`, owned by Sleepy): create board, rename board, set default, delete board (happy path and each guard condition), create task in a board, label scoped to board, backward-compat (no board_id → default board)

---

## Sneezy's Review — 2026-06-27

**Verdict:** Changes required

### Issues

1. **[Blocker] Seeding sentinel breaks after the board migration.** The current `ensure_seeded()` in `backend/app/services/label_service.py` (line 29) checks `Label.user_id == user_id` and returns early if any labels exist. After the startup DML migration every existing user already has labels (now with a `board_id`). So `ensure_seeded()` will never re-seed labels for new boards created by existing users. The plan says "new boards start with zero labels" — that is intentional — but the plan also says `ensure_seeded()` must "call `ensure_board_seeded()` first, then seed labels for the returned board." The sentinel must change from "user has 0 labels" to "this board has 0 labels" so that a new board correctly gets no seed while the old boards are untouched. This change invalidates the existing unit test `TestSeedUserLabels` in `backend/tests/unit/test_labels_router.py`, which currently asserts on `Label.user_id` only — those tests will need rewriting and the plan does not mention them.

2. **[Blocker] `ai_service.py` queries labels by `user_id` only and will pull labels across all boards.** `handle_conversation_message` (line 228) runs `db.query(Label).filter(Label.user_id == user_id).all()`. After this change a user with 3 boards and 30 labels per board will have all 90 labels presented to the AI for every conversation regardless of which board the conversation belongs to. The same problem exists in `generate_beliefs` (line 68). Both calls must be filtered by `board_id`. The plan lists `ai_service.py` nowhere in "Files to Modify."

3. **[Blocker] `task_service._resolve_labels()` is not board-aware.** Line 71 in `backend/app/services/task_service.py` queries `Label.id.in_(label_ids), Label.user_id == user_id`. After the change a label from Board B could be silently applied to a task in Board A if the label IDs are passed directly. The plan says cross-board label validation is added in `tasks.py` and `task_service.py`, but the described fix ("validate labels belong to same board") is only mentioned at the router/service level without specifying how `_resolve_labels()` changes. Since `_resolve_labels()` accepts only `label_ids` and `user_id` today, it has no way to enforce the board constraint unless it also receives `board_id`. This signature change will cascade into every call site (`create_task`, `update_task`, and their callers in the router) and is more invasive than the plan implies.

4. **[Blocker] `messages` table is not mentioned in the schema or migration.** `backend/app/models.py` contains a `Message` model (line 125) tied to `Conversation`. Conversations will carry `board_id`; messages belong to a conversation. The plan adds `board_id` to `conversations` but never discusses `messages`. If the AI context for a conversation must be board-scoped, `handle_conversation_message` must know the board at call time, which it currently gets from the conversation object. The plan must explicitly confirm that `messages` are scoped through `conversation.board_id` and that no direct `board_id` column is needed on `messages` — this is plausible but it must be stated, not silently omitted.

5. **[Blocker] The existing uniqueness constraint on `labels` uses a raw SQL `CREATE UNIQUE INDEX`, not the ORM model's `__table_args__`.** `main.py` line 85 runs `CREATE UNIQUE INDEX IF NOT EXISTS labels_user_id_category_value_key ON labels (user_id, category, value)`. The plan says to DROP this index and CREATE a new one on `(board_id, category, value)`. The plan lists this only as a model change and does not add the corresponding DDL to the `main.py` lifespan block. The drop of the old index and creation of the new one must both appear there, matching the existing pattern. The plan does not spell this out.

6. **[Risk] Startup DML migration order is undefined relative to existing labels/tasks having a NULL `board_id`.** The plan says "DDL runs first, then DML." After DDL the columns exist as `NOT NULL` — but they have no default. This means all existing rows instantly violate the NOT NULL constraint the moment `ALTER TABLE ... ADD COLUMN board_id UUID NOT NULL` executes, unless a DEFAULT is supplied or the column is added as nullable and tightened later. The plan does not address this sequencing gap. Safe approach: add the column as `NULLABLE`, run the DML migration to populate all rows, then add the NOT NULL constraint. The plan glosses over this ordering.

7. **[Risk] `POST /sync` push path in `sync.py` (lines 48–70) creates new tasks from client data with `Task(...)` directly, bypassing any `board_id` resolution.** The plan says old clients omit `board_id` and the server defaults to the default board. This defaulting logic is described as happening "at the API layer" — but the sync router constructs `Task` objects directly (not via `task_service.create_task()`). The plan must explicitly state that the sync router also resolves missing `board_id` to the default board, and that this code path is added to `routers/sync.py`.

8. **[Risk] `PUT /boards/{board_id}` with `is_default: false` is not specified.** The API spec says "Setting `is_default: true` atomically clears the old default and sets this board as default." What happens when a client sends `is_default: false` on the current default board? The plan is silent. This should return a 400 ("cannot demote default — promote another board first") or be explicitly documented as a no-op.

9. **[Risk] The partial unique index `UNIQUE (user_id) WHERE is_default = true` is a PostgreSQL partial index.** The plan describes this correctly but does not address the `create_all()` path. SQLAlchemy's `Base.metadata.create_all()` (used in this project — `main.py` line 57) does not support partial indexes through standard `UniqueConstraint`. This index must be created via a raw `conn.execute(text(...))` call in the lifespan block, matching the project's existing pattern. The plan does not call this out.

10. **[Gap] `beliefs` scoping is asserted safe but `generate_beliefs` queries labels without board filter.** Risk #4 in the plan says "authorization is inherited through the task." However, `generate_beliefs` in `ai_service.py` lines 68–72 queries all of the user's labels (`Label.user_id == user_id`) to build the prompt. After this change those are labels from all boards. The AI could suggest a label from Board B for a task in Board A, and the belief's `label_id` would then reference a label not in the task's board. If the cross-board label validation is later enforced on belief acceptance, this becomes a silent data-integrity issue.

11. **[Gap] `LabelOut` schema does not currently include `user_id` or `board_id`.** `schemas.py` line 11–15: `LabelOut` exposes `id`, `category`, `value`. Clients embedding labels in `TaskOut` will not receive `board_id`. That may be intentional, but the plan should state it explicitly. If clients ever need to know which board a label belongs to (e.g. for validation on the mobile sync path), this becomes a problem.

12. **[Gap] `models.py` uses `String` as the PK/FK type (e.g. `id = Column(String, primary_key=True, default=_uuid)`), not SQLAlchemy `UUID`.** The plan spec says `board_id UUID FK → boards`. In practice all existing FKs in this codebase use `Column(String, ...)`. Adding a `UUID` dialect type would be inconsistent. The plan should specify `Column(String, ...)` to match the existing pattern, not `UUID`.

13. **[Gap] No mention of what happens to `FilterContext.tsx` (frontend) and the label filter panel on mobile.** Both currently filter by `label_ids` scoped to the current user. After this change labels are board-scoped; the filter panel must only show labels belonging to the active board. The plan's frontend section is intentionally high-level, but this is a behaviorally correct requirement that could be overlooked during implementation.

14. **[Nit] The plan says `MAX_BOARDS_PER_USER = 5` lives in `models.py` "alongside `LABEL_SEED`." `LABEL_SEED` is a module-level list at the bottom of `models.py` (line 160). A board-cap constant sitting in the ORM model file is a minor code-organization issue; `board_service.py` or a `constants.py` would be cleaner. Not blocking, but the justification ("alongside LABEL_SEED") is weak given that `LABEL_SEED` is itself questionable placement.**

15. **[Nit] `POST /boards` returns `422` for the board cap but `400` for an empty name, which is inconsistent with existing API error conventions.** Across the existing codebase, `422` is reserved for business-rule violations that involve the request body field values (e.g. high-priority cap). The board cap is also a business rule, so `422` is defensible, but the plan should note this choice explicitly since it deviates from how similar guards (label duplicate → `409`, task not found → `404`) are coded.**

### Unverified assumptions

1. **"Backward-compat: omitting `board_id` defaults to the user's default board"** — The plan states this applies to all modified endpoints. This is not verified in any existing code (there is no `board_id` anywhere today). It is a design intent, not a verified pattern. The implementation must ensure that the default-board lookup path is atomic with the request and handles the race condition where a user's default board is being swapped mid-request.

2. **"Label seed collision — `IntegrityError` rollback pattern already handles this correctly"** — Confirmed that `seed_user_labels` (label_service.py line 17–21) does catch `IntegrityError` and rolls back. However, after the schema change, the `IntegrityError` would fire on `labels_board_id_category_value_key`, not the old `labels_user_id_category_value_key`. The existing rollback logic will still catch it, but any test that validates the integrity constraint name or specific exception context may need updating.

3. **"Beliefs are board-scoped through the task — no schema change needed"** — Partially true: `beliefs.task_id → tasks.task_id → tasks.board_id`. However, `generate_beliefs` and `handle_conversation_message` in `ai_service.py` query all user labels without board scoping. The claim that "no schema change is needed" is accurate, but the claim that "authorization is inherited through the task" is incomplete — it ignores the cross-board label contamination in AI prompts.

4. **"The `is_deleted` flag (soft-delete convention) is satisfied for boards"** — The `boards` table as designed has no `is_deleted` column. The DATA_MODEL_AND_API.MD states "All deletes are soft deletes (`is_deleted` flag) to support offline sync." The plan proposes hard-deleting boards (the DELETE endpoint returns `204 No Content` and the guard prevents deletion of non-empty boards). This is a departure from the project-wide soft-delete invariant. The plan does not acknowledge or justify this exception. If the sync protocol ever needs to propagate board deletions to mobile clients, this will be a problem.

5. **"`Base.metadata.create_all()` will create the `boards` table automatically"** — True only for the `boards` table itself. But the partial unique index (`UNIQUE (user_id) WHERE is_default = true`) is not expressible through standard SQLAlchemy `UniqueConstraint` and will not be created by `create_all`. This must be confirmed and explicitly handled in the lifespan block.

### Suggestions

1. Add a `is_deleted` column to `boards` (consistent with the project's soft-delete invariant documented in `DATA_MODEL_AND_API.MD`). The plan's current hard-delete approach is the only table in the schema that departs from this pattern. Keeping it consistent protects the sync protocol if boards are ever synced.

2. Split the startup migration into three explicit steps in the lifespan block: (a) `ALTER TABLE ... ADD COLUMN board_id VARCHAR NULLABLE`, (b) DML to populate `board_id` for all existing rows, (c) `ALTER TABLE ... ALTER COLUMN board_id SET NOT NULL`. This avoids the NOT NULL constraint violation on existing rows.

3. Add `ai_service.py` to the "Files to Modify" list in PR 1. It must filter label queries by `board_id` when building belief and conversation prompts.

4. Explicitly define the `_resolve_labels()` new signature (adding `board_id: str` parameter) and list all its call sites, since that signature change propagates through `create_task`, `update_task`, the tasks router, and the AI service's `create_task` tool invocation.

5. The `PUT /boards/{board_id}` spec should explicitly document the behavior when `is_default: false` is sent on the current default board (recommend: `400` with a clear error message).

6. Consider whether `GET /boards` should return a `board_id` on each label in responses (or at minimum document why it deliberately does not).

— *Sneezy*

---

## Grumpy's Response to Sneezy's Review — 2026-06-27

### Issues

1. **[Blocker] Seeding sentinel** — **Addressed.** Seeding section rewritten. Sentinel now scoped to the board (`ensure_board_seeded(board_id)` checks "this board has 0 labels"). New boards created by users start empty by design and do not trigger seeding. `TestSeedUserLabels` added to the files-to-modify list with a note that assertions must migrate from `Label.user_id` to `Label.board_id`.

2. **[Blocker] `ai_service.py` not in files list** — **Addressed.** Added `ai_service.py` to PR 1 scope. Both `generate_beliefs()` (line 68) and `handle_conversation_message()` (line 228) must filter label queries by `board_id`. Detailed in the updated files list.

3. **[Blocker] `_resolve_labels()` signature change** — **Addressed.** Updated files list to explicitly state the new signature: `_resolve_labels(label_ids, user_id, board_id, db)`. All call sites listed: `create_task()`, `update_task()`, and the AI service's `create_task` tool invocation.

4. **[Blocker] `messages` table not mentioned** — **Addressed.** Added explicit "Table: `messages` — no change" section stating that messages inherit scope through `conversation.board_id` and no direct column is needed.

5. **[Blocker] Uniqueness constraint DDL not in lifespan** — **Addressed.** Updated startup migration section to include explicit `DROP INDEX IF EXISTS labels_user_id_category_value_key` and `CREATE UNIQUE INDEX IF NOT EXISTS labels_board_id_category_value_key` steps. Also noted that the partial unique index on `boards` must be created via raw SQL in the lifespan block.

6. **[Risk] NOT NULL migration order** — **Addressed.** Startup migration now uses the 3-step approach: add columns as NULLABLE → DML to populate all rows → `ALTER COLUMN SET NOT NULL`.

7. **[Risk] Sync router bypasses board_id defaulting** — **Addressed.** `routers/sync.py` added to files list with an explicit note that the default-board resolution must be added there independently (sync router constructs `Task` directly, not via `task_service`).

8. **[Risk] `PUT /boards/{board_id}` with `is_default: false`** — **Addressed.** API spec updated: `is_default: false` on the current default → `400`; on a non-default board → no-op.

9. **[Risk] Partial unique index not via SQLAlchemy** — **Addressed.** Called out in the boards table section and in the startup migration DDL steps.

10. **[Gap] `generate_beliefs` cross-board label contamination** — **Addressed.** Same fix as Issue 2 (`ai_service.py` scope added).

11. **[Gap] `LabelOut` omits `board_id`** — **Addressed.** Documented as intentional in Risks and Assumptions (item 8). Clients fetch labels within a board context; the field is redundant.

12. **[Gap] `String` not `UUID` column type** — **Addressed.** Boards table spec now says `VARCHAR` / `Column(String, ...)` throughout, matching existing codebase pattern.

13. **[Gap] Frontend label filter panel** — **Addressed.** `FilterContext.tsx` (frontend) and mobile label filter panel added to PR 2/3 scope with explicit note about the cross-board risk.

14. **[Nit] `MAX_BOARDS_PER_USER` placement** — **Addressed.** Moved to `board_service.py`.

15. **[Nit] Error code inconsistency** — **Addressed.** Documented as intentional: `422` for board cap (business-rule violation, consistent with high-priority cap); `400` for input validation (empty name).

### Unverified assumptions

1. **Backward-compat default-board lookup** — Noted. The default-board lookup helper lives in `board_service.py` and is used consistently by all routers. The race condition (default being swapped mid-request) is benign: the lookup runs within the same DB session as the insert, so the snapshot is consistent.

2. **`IntegrityError` on new constraint name** — Noted. The rollback catch is generic (`except IntegrityError`) and will fire correctly on `labels_board_id_category_value_key`. Any test asserting constraint names must be updated.

3. **Beliefs scoped through task** — Addressed via `ai_service.py` fix. The claim "no schema change needed" remains accurate; the label contamination risk was the actual gap.

4. **`is_deleted` on boards** — **Addressed.** `is_deleted` column added to the `boards` table.

5. **Partial unique index not via `create_all()`** — **Addressed.** Explicitly handled in the lifespan DDL steps.

— *Grumpy*
