# tasksAreUs — Data Model & API Definitions

---

## Data Model

### Design Principles
- Every table includes `user_id` for multi-tenancy from day one
- Every table includes `created_at` and `updated_at` timestamps
- All deletes are **soft deletes** (`is_deleted` flag) to support offline sync
- UUIDs for all primary keys

---

### Table: `users`
Represents a tenant. All users are identified solely by `firebase_uid` — there is no legacy device-UUID path.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `auth_provider` | VARCHAR | Nullable. e.g. `google.com`, `apple.com`, `anonymous` |
| `auth_provider_id` | VARCHAR | Nullable. Provider-specific user ID |
| `firebase_uid` | VARCHAR | Unique, indexed. Firebase user UID. Set on first Firebase-authenticated request; the row is auto-created by `get_current_user()` in `dependencies.py`. |
| `email` | VARCHAR | Nullable. Populated from Firebase claims on sign-in. |
| `display_name` | VARCHAR | Nullable. Populated from Firebase claims (`name` claim) on sign-in. |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

The `device_uuid` column was removed at startup via `ALTER TABLE users DROP COLUMN IF EXISTS device_uuid`. Columns `firebase_uid`, `email`, and `display_name` are added via `ALTER TABLE IF NOT EXISTS` at startup — no manual migration SQL required.

---

### Table: `boards`
Top-level organizational unit. Each user has up to `MAX_BOARDS_PER_USER = 10` boards. Tasks and labels each belong to exactly one board. A default board named "General tasks" is created automatically for new users on first access (via `board_service.ensure_board_seeded`). Existing users received a "General tasks" board via the startup migration in PR #33.

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR | PK (UUID string) |
| `user_id` | VARCHAR | NOT NULL. FK → users (CASCADE). Indexed. |
| `name` | VARCHAR | NOT NULL. |
| `is_default` | BOOLEAN | NOT NULL. Exactly one non-deleted board per user has `is_default = true`. |
| `is_deleted` | BOOLEAN | NOT NULL. Default false. Soft-delete. |
| `color` | VARCHAR(7) | Nullable. User-configurable hex color string (e.g. `#6366f1`). Added via `ALTER TABLE boards ADD COLUMN IF NOT EXISTS color VARCHAR(7)` in PR #36. |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Constraints:**
- Partial unique index `boards_user_id_default_key ON boards (user_id) WHERE is_default = true AND is_deleted = false` — enforces exactly one default board per user. Created via raw SQL in `main.py` lifespan (not expressible via SQLAlchemy `UniqueConstraint`).

**Display order**: `ORDER BY is_default DESC, created_at ASC` — default board first, then creation order.

---

### Table: `labels`
All labels are per-board (and per-user). There are no global rows. On first access, the user's default board is seeded with type labels (5 entries total) from the `LABEL_SEED` constant in `models.py` by `label_service.seed_board_labels()`. New boards created by users start with zero labels. Users can add, rename, and delete their own type labels.

**Frequency label removal (completed — PR #29, #30, #31):** The `frequency` category has been fully removed from the system. `GET /labels?category=frequency` now returns `400 Unknown category`.

**Mode label removal (completed — PR #51):** The `mode` category has been fully removed from the system. All existing Mode labels (online, phone, outdoor, email) were deleted via startup migration. `POST /labels` with `category=mode` and `GET /labels?category=mode` now return `400 Unknown category`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | VARCHAR | NOT NULL. FK → users (CASCADE). Indexed. |
| `board_id` | VARCHAR | NOT NULL. FK → boards. Indexed. Every label belongs to exactly one board. |
| `category` | ENUM | `type` (mode removed in PR #51) |
| `value` | VARCHAR | e.g. `online`, `household` |

**Uniqueness constraint:**
- `labels_board_id_category_value_key`: unique on `(board_id, category, value)` — the same label value can exist independently in two different boards.

The old `labels_user_id_category_value_key` unique **constraint** (on `(user_id, category, value)`) and the older partial indices (`uq_global_label`, `uq_user_label`) have all been dropped. Note: SQLAlchemy creates `UNIQUE(...)` as a table constraint, not a plain index — it must be removed with `ALTER TABLE labels DROP CONSTRAINT`, not `DROP INDEX`.

**Per-board seed data** (from `LABEL_SEED` constant in `models.py`; seeded lazily into the "General tasks" board on first user access — 5 entries, type only; mode labels removed in PR #51):

| category | value |
|---|---|
| type | household |
| type | financial |
| type | child |
| type | trip |
| type | medical |

**Seeding sentinel**: `ensure_board_seeded()` in `board_service.py` first looks up the user's default board via `.first()` — if found, returns immediately (single query, hot path). Only if no default board exists does it issue a COUNT to distinguish "zero boards → create + seed" from "boards exist but none is default → 500". This is the sentinel for brand-new users — existing users always have at least one board. Concurrent-request races are handled by catching `IntegrityError` on the board insert and falling back to a lookup (idempotent). New boards created by users via `POST /boards` are NOT seeded.

---

### Table: `tasks`
Core entity. One-time and recurring task instances are both stored here.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users |
| `board_id` | VARCHAR | NOT NULL. FK → boards. Indexed. Every task belongs to exactly one board. |
| `title` | VARCHAR | Required |
| `notes` | TEXT | Nullable |
| `state` | ENUM | `pending`, `done` |
| `must_do_by` | DATE | Nullable. Hard deadline |
| `target_date` | DATE | Nullable. Aspirational completion date |
| `completed_at` | TIMESTAMP | Nullable. Set when state → done |
| `is_high_priority` | BOOLEAN | Default false. Only meaningful when effective date (earliest of `must_do_by` / `target_date`) is overdue, today, or tomorrow |
| `is_deleted` | BOOLEAN | Default false. Soft delete |
| `links` | JSONB | NOT NULL. Default `[]`. Array of up to `MAX_TASK_LINKS = 3` objects: `{"id": string, "url": string, "description": string}`. Added via `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb` in PR #39. |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | Used for last-write-wins conflict resolution |

**Recurring task rules: removed (PR #30, PR #31)**

Recurrence logic has been fully removed. `FREQUENCY_VALUES`, `_get_frequency_label()`, and `_next_due_date()` were deleted from `task_service.py` in PR #30. `complete_task()` always returns `next_task: null` — no follow-on task is ever created.

The `recurrence_group_id` column was dropped from the `tasks` table and the `TaskOut` schema in PR #31 (idempotent `DROP COLUMN IF EXISTS` in `main.py` lifespan; also in the SQL migration script). The sync router silently ignores `recurrence_group_id` if a stale client includes it in a push payload.

**Effective date** is defined as the earliest of `must_do_by` and `target_date` when both are set; otherwise whichever one is non-null; `null` if both are null. This is computed by `getEffectiveDate()` in both `frontend/src/utils/taskDateUtils.ts` and `mobile/src/utils/taskDateUtils.ts`. (Prior to PR #20, `getEffectiveDate` incorrectly returned `target_date` when both were set, regardless of which was earlier. This was a client-side display bug only — the backend never relied on this helper.)

**High-priority rules (enforced by the API):**
- `is_high_priority = true` is only meaningful when the task's effective date (earliest of `must_do_by` / `target_date`) is today, tomorrow, or in the past (overdue)
- The API auto-resets `is_high_priority` to `false` on any create or update if the effective date is outside today/tomorrow/overdue range
- The daily cap is user-configurable via `user_settings.high_priority_daily_limit` (default 3, min 1). The API reads this setting dynamically on each create/update check; falls back to 3 if no row or null
- Attempting to set a task high-priority when the cap is reached raises HTTP 422. The error message includes the live limit value
- The daily limit is checked against the effective date of the task, not `must_do_by` alone
- Overdue tasks retain their existing priority; the cap re-engages only when the task is moved to a current or future date

**Link rules (enforced by the API):**
- Up to `MAX_TASK_LINKS = 3` links per task. Each link has `id` (client-generated string — no server-side non-empty or uniqueness check), `url` (must start with `http://` or `https://`, max 2048 chars — other schemes such as `javascript:`, `data:`, `mailto:` are rejected), and `description` (non-empty after trim, max 200 chars)
- On `POST /tasks`, `links` defaults to `[]` if omitted
- On `PUT /tasks/{id}`, `links` uses full-replace semantics matching `label_ids`: omitting the field leaves existing links unchanged; providing any list — including `[]` — fully replaces the set
- Exceeding the cap or failing field validation on `POST`/`PUT /tasks` returns `422` (Pydantic-level validation error)
- The `/sync` push path re-validates each link independently (`SyncChanges.tasks` are raw dicts and bypass Pydantic validation) — an invalid item is dropped rather than failing the whole array, and the result is capped at `MAX_TASK_LINKS`

---

### Table: `task_labels`
Join table for the many-to-many relationship between tasks and labels.

| Column | Type | Notes |
|---|---|---|
| `task_id` | UUID | FK → tasks |
| `label_id` | UUID | FK → labels |

PK: `(task_id, label_id)`

A task may have **multiple labels within the same category** (e.g. both `online` and `email` under Mode).

---

### Table: `beliefs`
AI-generated suggestions (labels, time estimates) awaiting user validation.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users |
| `task_id` | UUID | FK → tasks |
| `belief_type` | ENUM | `label_suggestion`, `time_estimate` |
| `label_id` | UUID | Nullable. FK → labels. Set when belief_type = label_suggestion |
| `estimated_minutes` | INTEGER | Nullable. Set when belief_type = time_estimate |
| `status` | ENUM | `pending`, `accepted`, `rejected` |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Weighting rule**: accepted beliefs are weighted more heavily than pending/rejected beliefs when generating future suggestions.

---

**Conversations/messages removal (PR #50):** The `conversations` and `messages` tables (previously documented here as per-board conversation sessions and their message turns), the `/conversations` API, the `Conversation`/`Message` SQLAlchemy models and Pydantic schemas, and `ai_service.handle_conversation_message()` were removed entirely. The Chat feature had no users; its UI was already removed from web (PR #41) and mobile (PR #46), and this PR completed the removal on the backend. Both tables were dropped via `DROP TABLE IF EXISTS` in `main.py`'s startup migration (no backup taken — accepted, no data existed).

---

### Table: `focused_view_configs`
Per-user focused view configuration. One row per user, enforced by `UNIQUE(user_id)` (`focused_view_configs_user_id_key`). Created lazily on first `GET /focused-view/config` via insert + `IntegrityError` rollback-and-re-fetch (race-safe). Added in PR #36.

| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR | PK (UUID string) |
| `user_id` | VARCHAR | NOT NULL. FK → users (CASCADE). Indexed. UNIQUE. |
| `board_selection` | VARCHAR | NOT NULL. `all` or `selected`. |
| `selected_board_ids` | JSONB | NOT NULL. Array of board UUID strings. Populated when `board_selection = selected`; set to `[]` when `board_selection = all`. |
| `day_range` | VARCHAR | NOT NULL. `today`, `today_tomorrow`, or `today_plus_two`. |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Default config** (created lazily on first GET): `board_selection = all`, `day_range = today` (changed from `today_tomorrow` in PR #40 — applies to newly-created configs only; the one pre-existing user's saved config was migrated separately via `backend/scripts/reset_focused_view_config_default.py`), `selected_board_ids = []`.

**Table creation**: handled by `Base.metadata.create_all()` on startup — no separate raw SQL needed.

---

### Table: `user_settings`
Per-user configuration. One row per user.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users. Unique |
| `high_priority_daily_limit` | INTEGER | Nullable. Configurable cap on high-priority tasks per calendar day. Defaults to 3 when null. Min 1. |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**`starter_questions` removal (PR #50):** The `starter_questions` JSONB column (array of up to 5 strings, previously fed the Chat screen's quick-start chips) was dropped via `ALTER TABLE user_settings DROP COLUMN IF EXISTS starter_questions` in `main.py`'s startup migration, orphaned once the Chat UI it fed was removed from web (PR #41) and mobile (PR #46).

---

### Table: `ai_cost_log`
Tracks every Claude API call for cost monitoring.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users |
| `feature` | VARCHAR | e.g. `label_suggestion`, `time_estimate`, `journal_parse`. The `conversation` feature value is no longer logged as of PR #50 (chat removal) but may still appear on historical rows. |
| `model` | VARCHAR | e.g. `claude-sonnet-4-6` |
| `input_tokens` | INTEGER | |
| `output_tokens` | INTEGER | |
| `estimated_cost_usd` | NUMERIC(10,6) | |
| `created_at` | TIMESTAMP | |

---

---

## API Definitions

**Base URL**: `/api/v1`

**Authentication:** All endpoints (except `/health`) require:
- `Authorization: Bearer <firebase_id_token>` — `get_current_user()` verifies the token with the Firebase Admin SDK, then resolves or auto-creates the internal `user_id`.

---

### Boards

#### `GET /boards`
Returns all non-deleted boards for the current user, ordered default-first then by creation time. Calls `ensure_board_seeded()` before querying — lazily creates the "General tasks" default board (and seeds its 9 default labels) for brand-new users who have not yet hit any other endpoint. This makes `GET /boards` a reliable board-initialisation entry point regardless of call order.

**Response**
```json
{
  "boards": [
    { "id": "uuid", "name": "General tasks", "is_default": true, "is_deleted": false, "color": null, "created_at": "...", "updated_at": "..." },
    { "id": "uuid", "name": "Job search", "is_default": false, "is_deleted": false, "color": "#6366f1", "created_at": "...", "updated_at": "..." }
  ]
}
```
`color` is `null` when the user has not set a custom color; clients should assign a default from a fixed palette when `null`.

---

#### `POST /boards`
Create a new board for the current user. New boards always start with `is_default = false` and zero labels.

**Request**
```json
{ "name": "Write a book" }
```

**Response** `201 Created` — the created board object (same shape as GET /boards item)

**Error cases**
- `400` — name is empty/whitespace
- `422` — user already has `MAX_BOARDS_PER_USER` (10) non-deleted boards

---

#### `PUT /boards/{board_id}`
Rename a board, change its default status, and/or set its color. The caller must own the board.

**Request** (all fields optional)
```json
{ "name": "Personal tasks", "is_default": true, "color": "#6366f1" }
```

Setting `is_default: true` atomically demotes the previously-default board and promotes this one (single DB transaction). Setting `is_default: false` on the current default returns `400`. Setting `is_default: false` on a non-default board is a no-op.

The `color` field accepts a 7-character hex string (e.g. `#6366f1`) or `null` to clear the color. Omitting `color` entirely leaves the existing value unchanged (sentinel logic via `model_fields_set` in the router + `_UNSET` sentinel in `board_service.update_board()`). Validated by a Pydantic `field_validator` on `BoardUpdate` (regex `^#[0-9a-fA-F]{6}$`).

**Response** — updated board object (includes `color` field)

**Error cases**
- `400` — name is empty/whitespace
- `400` — `is_default: false` sent on the current default board
- `400` — `color` provided but not a valid 7-character hex string
- `404` — board not found or not owned by caller

---

#### `DELETE /boards/{board_id}`
Soft-delete a board (`is_deleted = true`). The caller must own the board.

**Response** `204 No Content`

**Error cases**
- `400` — board is the only non-deleted board (minimum 1 required)
- `400` — board is the current default (promote another board to default first)
- `400` — board has pending tasks (delete the tasks first)
- `400` — board has labels (delete the labels first)
- `404` — board not found or not owned by caller

---

### Health

#### `GET /health`
Backend connectivity check. Used by the Settings Connection section on both web and mobile. No authentication required.

**Response**
```json
{
  "status": "ok",
  "version": "<git-commit-hash>",
  "timestamp": "2026-05-06T10:00:00Z",
  "checks": {
    "database": { "status": "ok" }
  }
}
```
`status` is `"ok"` when the database check passes; `"degraded"` otherwise. `checks.database.error` is included when the database check fails.

---

### Labels

#### `GET /labels`
Returns labels for the specified board. Optionally filter by category.

All labels are per-board. On first access (when `board_id` is omitted), the user's default board is resolved via `resolve_board_id()`, which lazily creates the "General tasks" board and seeds it if needed (idempotent — concurrent-request races swallowed via `IntegrityError` rollback).

**Query params**: `?category=mode|type`, `?board_id=uuid` (optional; defaults to the user's default board)

**Response**
```json
{
  "labels": [
    { "id": "uuid", "category": "mode", "value": "online" },
    { "id": "uuid", "category": "type", "value": "household" }
  ]
}
```

**Error cases**
- `400` — unknown category value (includes `category=frequency` as of PR #31)

---

#### `POST /labels`
Create a new type label in the specified board (or the user's default board if `board_id` is omitted). Only `type` category is accepted (mode labels removed in PR #51).

**Request**
```json
{ "category": "type", "value": "in-person", "board_id": "uuid" }
```
`board_id` is optional; omitting it creates the label in the user's default board.

**Response** `201 Created` — the created label object
```json
{ "id": "uuid", "category": "type", "value": "in-person" }
```

**Error cases**
- `400` — unknown category (including `frequency` and `mode`), or value is empty/whitespace
- `404` — `board_id` not found or not owned by caller
- `409` — label with that value already exists in this board in this category

---

#### `PUT /labels/{label_id}`
Rename a type label. The caller must own the label.

**Request**
```json
{ "value": "new-name" }
```

**Response** — the updated label object

**Error cases**
- `400` — label category is not `type` (not editable), or new value is empty/whitespace
- `403` — caller does not own the label
- `404` — label not found
- `409` — another label with the new value already exists in this board in this category

---

#### `DELETE /labels/{label_id}`
Delete a type label. The caller must own the label. Deleting a label removes it from any tasks that reference it (CASCADE via `task_labels`).

**Response** `204 No Content`

**Error cases**
- `400` — label category is not `type` (not deletable)
- `403` — caller does not own the label
- `404` — label not found

---

### Tasks

#### `GET /tasks`
List tasks for the current user.

**Query params**:
- `state=pending|done` — filter by state
- `label_ids=uuid,uuid` — filter by one or more label IDs (AND logic)
- `due_before=YYYY-MM-DD` — tasks with must_do_by on or before this date
- `due_after=YYYY-MM-DD`
- `include_deleted=true` — include soft-deleted records (for sync)
- `updated_after=ISO8601` — records updated after this timestamp (for sync)
- `board_id=uuid` (optional) — filter to a specific board; defaults to the user's default board

**Response**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "board_id": "uuid",
      "title": "Return library books",
      "notes": null,
      "state": "pending",
      "must_do_by": "2026-05-11",
      "target_date": "2026-05-09",
      "completed_at": null,
      "labels": [
        { "id": "uuid", "category": "mode", "value": "outdoor" },
        { "id": "uuid", "category": "type", "value": "child" }
      ],
      "is_high_priority": false,
      "is_deleted": false,
      "links": [
        { "id": "link-uuid", "url": "https://library.example.com/account", "description": "Library account" }
      ],
      "created_at": "2026-05-06T10:00:00Z",
      "updated_at": "2026-05-06T10:00:00Z"
    }
  ]
}
```

---

#### `POST /tasks`
Create a new task.

**Request**
```json
{
  "title": "Return library books",
  "notes": null,
  "must_do_by": "2026-05-11",
  "target_date": "2026-05-09",
  "label_ids": ["uuid-outdoor", "uuid-child"],
  "is_high_priority": false,
  "board_id": "uuid",
  "links": [
    { "id": "link-uuid", "url": "https://library.example.com/account", "description": "Library account" }
  ]
}
```
`board_id` is optional; omitting it creates the task in the user's default board. `label_ids` must all belong to the same board as the task — cross-board label assignment returns `422`. `links` is optional and defaults to `[]` (see Link rules under Table: `tasks`); a payload with more than `MAX_TASK_LINKS` (3) items, a non-`http(s)` URL, or an empty description returns `422`.

**Response**: the created task object (same shape as GET /tasks item, including `board_id`)

---

#### `GET /tasks/{task_id}`
Get a single task.

**Response**: task object

---

#### `PUT /tasks/{task_id}`
Update a task's fields or labels.

**Request** (all fields optional)
```json
{
  "title": "Return library books",
  "notes": "Don't forget the DVDs too",
  "must_do_by": "2026-05-11",
  "target_date": "2026-05-09",
  "label_ids": ["uuid-outdoor", "uuid-raghav", "uuid-email"],
  "is_high_priority": false,
  "links": [
    { "id": "link-uuid", "url": "https://library.example.com/account", "description": "Library account" }
  ],
  "board_id": "uuid"
}
```

To clear a date field to null, include the field explicitly as `null` in the JSON body. Omitting the field leaves the existing value unchanged. The frontend `TaskForm` × button clears the local state and sends `null` for any date that was previously set but is now empty, ensuring the backend receives an explicit clear signal.

`notes` has no equivalent `clear_notes` flag — `TaskUpdate.notes` is a plain `Optional[str]`, so an explicit JSON `null` and an omitted key are indistinguishable at the schema level (both decode to `None`), and **both leave the existing value unchanged**. Only a non-`None` string value — including `""` — writes through and clears/updates the field. Frontend `TaskForm` always sends `notes` as a (possibly empty) string on every save so that clearing the Notes textarea to empty actually persists (fixed in PR #45 — the field was previously omitted from the payload whenever it was blank).

`links` uses full-replace semantics: omitting it leaves the task's existing links unchanged; providing any list — including `[]` — fully replaces the set. Both `TaskForm` (web) and `TaskFormScreen` (mobile) always include `links` in the update payload so that removing the last link actually clears it.

`board_id` (added PR #40) moves the task to a different board. `None`/omitted leaves the board unchanged (not full-replace like `links`). When `board_id` is provided and differs from the task's current board: the destination board must exist, be owned by the caller, and not be soft-deleted (`404` otherwise); the task's existing labels are unconditionally cleared (labels are board-scoped and not valid across boards); if `label_ids` is also present in the same request, it is resolved against the *new* board_id and applied after the move (`422` if any id doesn't belong to the destination board). Sending `board_id` equal to the task's current board is a no-op — labels are left untouched.

**Response**: updated task object

---

#### `DELETE /tasks/{task_id}`
Soft-delete a task (`is_deleted = true`).

**Response**: `204 No Content`

---

#### `POST /tasks/{task_id}/complete`
Mark a task as done.
- Sets `state = done` and `completed_at = now`
- No follow-on task is created (recurrence logic removed in PR #30)

**Request** (optional)
```json
{ "notes": "Returned 3 books" }
```

**Response**
```json
{
  "completed_task": { ...task object... },
  "next_task": null
}
```
`next_task` is always `null`. The field is retained in the response schema for backward compatibility.

---

### Beliefs

#### `POST /tasks/{task_id}/beliefs/generate`
Ask the AI to generate beliefs (label suggestions + time estimate) for a task. Results are stored as `pending` beliefs.

**Response**
```json
{
  "beliefs": [
    {
      "id": "uuid",
      "belief_type": "label_suggestion",
      "label": { "id": "uuid", "category": "mode", "value": "online" },
      "estimated_minutes": null,
      "status": "pending"
    },
    {
      "id": "uuid",
      "belief_type": "time_estimate",
      "label": null,
      "estimated_minutes": 30,
      "status": "pending"
    }
  ]
}
```

---

#### `GET /tasks/{task_id}/beliefs`
Get all beliefs for a task.

**Query params**: `?status=pending|accepted|rejected`

**Response**
```json
{ "beliefs": [ ...belief objects... ] }
```

---

#### `PUT /beliefs/{belief_id}`
Accept or reject a belief.

**Request**
```json
{ "status": "accepted" }
```

**Response**: updated belief object

---

### Conversations — removed (PR #50)

`POST /conversations`, `POST /conversations/{conversation_id}/messages`, and `GET /conversations/{conversation_id}/messages` were deleted entirely in PR #50, along with the `conversations`/`messages` tables. The Chat feature had no users; its UI was already removed from web (PR #41) and mobile (PR #46). All three routes now 404 (no route registered).

---

### Reports

#### `GET /reports/completions`
Get completed tasks within a date range.

**Query params**:
- `from=YYYY-MM-DD` (required) — lower bound, inclusive (`completed_at >= from`)
- `to=YYYY-MM-DD` (required) — upper bound, inclusive of the full calendar day (`completed_at < to + 1 day`); tasks completed at any time on `to` are included
- `label_ids=uuid,uuid` — optional filter
- `board_id=uuid` (optional) — filter to a specific board; defaults to the user's default board

**Response**
```json
{
  "completions": [
    {
      "task_id": "uuid",
      "title": "Laundry",
      "completed_at": "2026-05-02T18:00:00Z",
      "labels": [ ...label objects... ]
    }
  ],
  "total": 7
}
```

---

### Settings

#### `GET /settings`
Get the current user's settings.

**Response**
```json
{
  "high_priority_daily_limit": 3
}
```
`high_priority_daily_limit` defaults to 3 when no setting has been saved. `starter_questions` was removed from this response in PR #50 (orphaned once the Chat UI it fed was removed from web and mobile).

---

#### `PUT /settings`
Update user settings.

**Request**
```json
{
  "high_priority_daily_limit": 3
}
```
`high_priority_daily_limit` is clamped to a minimum of 1 server-side. Reducing below the current count is allowed (no retroactive enforcement — warnings are shown but no tasks are auto-demoted). `starter_questions` was removed from `SettingsUpdate` in PR #50; a stale client that still sends it gets a normal `200` (Pydantic silently ignores unknown fields) and the field is not echoed back or persisted.

**Response**: updated settings object

---

### Focused View

New in PR #36 (backend only). The Focused View shows high-priority pending tasks falling within a user-configured day range, grouped alphabetically by board.

#### `GET /focused-view/config`
Returns the current user's focused view configuration, creating it with defaults lazily if it does not yet exist. Race-safe via `UNIQUE(user_id)` + `IntegrityError` rollback.

**Response**
```json
{
  "id": "uuid",
  "board_selection": "all",
  "selected_board_ids": [],
  "day_range": "today"
}
```

---

#### `PUT /focused-view/config`
Update the user's focused view configuration.

**Request**
```json
{
  "board_selection": "selected",
  "selected_board_ids": ["uuid-board-1", "uuid-board-2"],
  "day_range": "today"
}
```

`board_selection` must be `all` or `selected`. `day_range` must be `today`, `today_tomorrow`, or `today_plus_two`. When `board_selection = selected`, `selected_board_ids` must be non-empty and all IDs must belong to the caller. When `board_selection = all`, `selected_board_ids` is ignored and saved as `[]`.

**Response** — updated config object (same shape as GET)

**Error cases**
- `400` — invalid `board_selection` value
- `400` — invalid `day_range` value
- `400` — `board_selection = selected` with empty `selected_board_ids`
- `400` — one or more `selected_board_ids` not found or not owned by caller

---

#### `GET /focused-view/tasks`
Returns `is_high_priority = true` pending tasks that have `must_do_by` or `target_date` falling within the configured day range, grouped alphabetically by board. Overdue tasks are excluded — this view is forward-looking only.

**Query params**
- `reference_date=YYYY-MM-DD` (optional) — client-supplied date anchor to avoid server-timezone issues. Defaults to `date.today()` (server UTC) when omitted.

**Response**
```json
{
  "boards": [
    {
      "board_id": "uuid",
      "board_name": "Alpha",
      "board_color": "#6366f1",
      "tasks": [ { ...full TaskOut object including labels... } ]
    }
  ]
}
```

- Boards with zero qualifying tasks are omitted from the response.
- Boards are ordered alphabetically by name.
- Within each board group, tasks are sorted by `is_high_priority DESC` (high-priority first), then `updated_at` DESC (as of PR #47).
- `board_color` is `null` when the user has not configured a color; clients should substitute a default from a fixed palette.

---

### Day View

New in PR #40 (backend only; part 1 of a 3-PR epic — web/mobile Today/Tomorrow views consume this endpoint in later PRs). Unlike Focused View, Day View has no per-user configuration — it always shows all pending tasks (any priority) across all boards for a single date.

#### `GET /day-view/tasks`
Returns pending tasks (any priority) whose `must_do_by` or `target_date` falls on `reference_date`, across all of the caller's boards, grouped alphabetically by board. This is the same OR-across-both-date-fields filter Focused View uses (not a computed "earliest effective date"). Ignores the user's Focused View config entirely — no `board_selection`/`day_range` concept applies here.

**Query params**
- `reference_date=YYYY-MM-DD` (required — no default; `422` if omitted)

**Response** — same shape as `GET /focused-view/tasks`
```json
{
  "boards": [
    {
      "board_id": "uuid",
      "board_name": "Alpha",
      "board_color": "#6366f1",
      "tasks": [ { ...full TaskOut object including labels... } ]
    }
  ]
}
```

- Boards with zero qualifying tasks are omitted from the response.
- Boards are ordered alphabetically by name.
- Within each board group, tasks are sorted by `is_high_priority DESC` (high-priority first), then `updated_at` DESC (as of PR #47).
- Completed and soft-deleted tasks are excluded.

---

### Sync

#### `POST /sync`
Push local changes to the server and pull server changes since last sync. Uses last-write-wins based on `updated_at`.

**Request**
```json
{
  "last_synced_at": "2026-05-06T08:00:00Z",
  "changes": {
    "tasks": [ ...task objects with updated_at; board_id optional (stale clients may omit it; server defaults to default board on create, unchanged on update; present on update = move the task to that board and clear its labels); links optional (omitted = unchanged on update, present = replace, including [])... ],
    "task_labels": [ ...task_label objects... ],
    "beliefs": [ ...belief objects... ],
    "boards": []
  }
}
```

**Response**
```json
{
  "synced_at": "2026-05-06T10:05:00Z",
  "changes": {
    "tasks": [ ...server-side task objects updated since last_synced_at, each including board_id and links... ],
    "task_labels": [ ... ],
    "beliefs": [ ... ],
    "boards": [ ...board objects updated since last_synced_at... ]
  }
}
```
`changes.settings` was removed from both the push and pull payloads in PR #50 — `SyncChanges.settings` no longer exists on the schema, and `starter_questions` (the only field it ever carried) was removed end-to-end.

**Board sync notes**: Task objects in the pull response always include `board_id`. Stale clients that push tasks without `board_id` have them assigned to the user's default board. Cross-board label assignments in sync push payloads are silently dropped (only labels matching the task's board are applied). The pull response includes a `boards` array of boards updated since `last_synced_at`; clients that do not yet support boards can ignore this field.

**Board move via sync (PR #40)**: pushing an existing task with a `board_id` that differs from its current one moves the task to that board — mirroring `PUT /tasks/{id}`'s move behavior. The sync push path validates ownership item-by-item via `_owned_board_id()` (`db.query(Board.id).filter(Board.id == ..., Board.user_id == ..., Board.is_deleted == False)`) rather than calling `board_service.get_board_or_404()`, since raising mid-batch would fail every other change in the same push; an unowned, nonexistent, or soft-deleted `board_id` is silently ignored (existing task keeps its current board; a new task falls back to the default board), matching the same drop-invalid-item convention already used for links and cross-board labels in this router. Labels not valid for the new board are dropped by the existing label-reconciliation step (which runs after the board_id write and filters by `Label.board_id == task.board_id`), the same as a REST move.

**Link sync notes**: Task objects in the pull response always include `links`. Push payloads are raw dicts and bypass the `TaskCreate`/`TaskUpdate` Pydantic validation that `POST`/`PUT /tasks` get for free, so each pushed task's `links` array is re-validated server-side (see Link rules under Table: `tasks`) — unlike the REST endpoints, an individually invalid link (bad scheme, empty description, oversized field) is dropped rather than rejecting the whole push, and the result is capped at `MAX_TASK_LINKS`. On update, `links` follows the same full-replace convention as the REST endpoints: the key must be present in the pushed task dict to change the stored links (its absence means unchanged), not merely non-empty.
