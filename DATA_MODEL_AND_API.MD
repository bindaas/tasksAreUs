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

### Table: `labels`
All labels are per-user. There are no global rows (`user_id` is NOT NULL). On a user's first access, mode and type labels (9 entries total) are seeded from the `LABEL_SEED` constant in `models.py` by `label_service.seed_user_labels()`. Users can add, rename, and delete their own mode/type labels.

**Frequency label removal (completed — PR #29, #30, #31):** The `frequency` category has been fully removed from the system. PR #29 removed it from all client UI surfaces. PR #30 removed frequency entries from `LABEL_SEED` and recurrence logic from the backend. PR #31 (this PR) removed `CategoryEnum.frequency` from Python, ran the SQL migration to delete all frequency label DB rows and drop the `frequency` value from the Postgres `categoryenum` type, and dropped the `recurrence_group_id` column. `GET /labels?category=frequency` now returns `400 Unknown category`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | VARCHAR | NOT NULL. FK → users (CASCADE). Every label belongs to exactly one user. Indexed. |
| `category` | ENUM | `mode`, `type` |
| `value` | VARCHAR | e.g. `online`, `household` |

**Uniqueness constraint:**
- `labels_user_id_category_value_key`: unique on `(user_id, category, value)`

The old partial indices (`uq_global_label`, `uq_user_label`) were dropped when this constraint was added.

**Per-user seed data** (from `LABEL_SEED` constant in `models.py`; seeded lazily on first access — 9 entries, mode and type only):

| category | value |
|---|---|
| mode | online |
| mode | phone |
| mode | outdoor |
| mode | email |
| type | household |
| type | financial |
| type | child |
| type | trip |
| type | medical |

**Seeding sentinel**: `ensure_seeded()` in `label_service.py` checks whether the user has any labels at all (total count = 0). If so, it calls `seed_user_labels()` to insert all `LABEL_SEED` rows for the user. Zero labels reliably identifies a brand-new user — existing users always have at least their mode/type labels. Concurrent-request races are handled by catching `IntegrityError` and rolling back (idempotent).

---

### Table: `tasks`
Core entity. One-time and recurring task instances are both stored here.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users |
| `title` | VARCHAR | Required |
| `notes` | TEXT | Nullable |
| `state` | ENUM | `pending`, `done` |
| `must_do_by` | DATE | Nullable. Hard deadline |
| `target_date` | DATE | Nullable. Aspirational completion date |
| `completed_at` | TIMESTAMP | Nullable. Set when state → done |
| `is_high_priority` | BOOLEAN | Default false. Only meaningful when effective date (earliest of `must_do_by` / `target_date`) is overdue, today, or tomorrow |
| `is_deleted` | BOOLEAN | Default false. Soft delete |
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

### Table: `conversations`
A session of conversational UI interaction.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users |
| `created_at` | TIMESTAMP | |

---

### Table: `messages`
Individual turns within a conversation.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `conversation_id` | UUID | FK → conversations |
| `user_id` | UUID | FK → users |
| `role` | ENUM | `user`, `assistant` |
| `content` | TEXT | The message text |
| `suggested_questions` | JSONB | Nullable. Array of strings. Only on assistant messages |
| `created_at` | TIMESTAMP | |

---

### Table: `user_settings`
Per-user configuration. One row per user.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users. Unique |
| `starter_questions` | JSONB | Array of up to 5 strings for the Conversational UI |
| `high_priority_daily_limit` | INTEGER | Nullable. Configurable cap on high-priority tasks per calendar day. Defaults to 3 when null. Min 1. |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

---

### Table: `ai_cost_log`
Tracks every Claude API call for cost monitoring.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → users |
| `feature` | VARCHAR | e.g. `label_suggestion`, `time_estimate`, `conversation`, `journal_parse` |
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
Returns labels for the current user. Optionally filter by category.

All labels (mode and type) are per-user. On first access, both categories are seeded from the `LABEL_SEED` constant for the requesting user via `ensure_seeded()` (idempotent — a concurrent-request race is swallowed via `IntegrityError` rollback). `ensure_seeded()` is also called by `_resolve_labels` in `task_service.py` and `handle_conversation_message` in `ai_service.py`, so seeding cannot be bypassed by clients that skip `GET /labels`.

**Query params**: `?category=mode|type`

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
Create a new mode or type label for the current user. Only `mode` and `type` categories are accepted.

**Request**
```json
{ "category": "mode", "value": "in-person" }
```

**Response** `201 Created` — the created label object
```json
{ "id": "uuid", "category": "mode", "value": "in-person" }
```

**Error cases**
- `400` — unknown category (including `frequency`), category is not `mode` or `type`, or value is empty/whitespace
- `409` — label with that value already exists for this user in this category

---

#### `PUT /labels/{label_id}`
Rename a mode or type label. The caller must own the label.

**Request**
```json
{ "value": "new-name" }
```

**Response** — the updated label object

**Error cases**
- `400` — label category is not `mode` or `type` (not editable), or new value is empty/whitespace
- `403` — caller does not own the label
- `404` — label not found
- `409` — another label with the new value already exists for this user in this category

---

#### `DELETE /labels/{label_id}`
Delete a mode or type label. The caller must own the label. Deleting a label removes it from any tasks that reference it (CASCADE via `task_labels`).

**Response** `204 No Content`

**Error cases**
- `400` — label category is not `mode` or `type` (not deletable)
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

**Response**
```json
{
  "tasks": [
    {
      "id": "uuid",
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
  "label_ids": ["uuid-outdoor", "uuid-raghav"],
  "is_high_priority": false
}
```

**Response**: the created task object (same shape as GET /tasks item)

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
  "is_high_priority": false
}
```

To clear a date field to null, include the field explicitly as `null` in the JSON body. Omitting the field leaves the existing value unchanged. The frontend `TaskForm` × button clears the local state and sends `null` for any date that was previously set but is now empty, ensuring the backend receives an explicit clear signal.

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

### Conversations

#### `POST /conversations`
Start a new conversation session.

**Response**
```json
{ "id": "uuid", "created_at": "2026-05-06T10:00:00Z" }
```

---

#### `POST /conversations/{conversation_id}/messages`
Send a user message and receive an AI response. The AI interprets the message and may:
- Create one or more new tasks
- Mark existing tasks as done
- Answer a query about the user's tasks

**Request**
```json
{ "content": "I returned the library books today" }
```

**Response**
```json
{
  "message": {
    "id": "uuid",
    "role": "assistant",
    "content": "Got it — I've marked 'Return library books' as done.",
    "suggested_questions": [
      "What other outdoor tasks do I have this week?",
      "What tasks are due before the weekend?"
    ],
    "created_at": "2026-05-06T10:00:00Z"
  },
  "actions": {
    "tasks_created": [],
    "tasks_completed": ["uuid-library-task"]
  }
}
```

---

#### `GET /conversations/{conversation_id}/messages`
Get the message history for a conversation.

**Response**
```json
{
  "messages": [ ...message objects... ]
}
```

---

### Reports

#### `GET /reports/completions`
Get completed tasks within a date range.

**Query params**:
- `from=YYYY-MM-DD` (required) — lower bound, inclusive (`completed_at >= from`)
- `to=YYYY-MM-DD` (required) — upper bound, inclusive of the full calendar day (`completed_at < to + 1 day`); tasks completed at any time on `to` are included
- `label_ids=uuid,uuid` — optional filter

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
  "starter_questions": [
    "What tasks do I need to do today?",
    "What online tasks can I do in the next hour?",
    "What did I complete this week?",
    "What tasks are due this weekend?",
    "What household tasks are pending?"
  ],
  "high_priority_daily_limit": 3
}
```
`high_priority_daily_limit` defaults to 3 when no setting has been saved.

---

#### `PUT /settings`
Update user settings.

**Request**
```json
{
  "starter_questions": [
    "What tasks do I need to do today?",
    "What online tasks can I do in the next hour?",
    "What did I complete this week?",
    "What tasks are due this weekend?",
    "What household tasks are pending?"
  ],
  "high_priority_daily_limit": 3
}
```
`high_priority_daily_limit` is clamped to a minimum of 1 server-side. Reducing below the current count is allowed (no retroactive enforcement — warnings are shown but no tasks are auto-demoted).

**Response**: updated settings object

---

### Sync

#### `POST /sync`
Push local changes to the server and pull server changes since last sync. Uses last-write-wins based on `updated_at`.

**Request**
```json
{
  "last_synced_at": "2026-05-06T08:00:00Z",
  "changes": {
    "tasks": [ ...task objects with updated_at... ],
    "task_labels": [ ...task_label objects... ],
    "beliefs": [ ...belief objects... ],
    "settings": { ...settings object... }
  }
}
```

**Response**
```json
{
  "synced_at": "2026-05-06T10:05:00Z",
  "changes": {
    "tasks": [ ...server-side task objects updated since last_synced_at... ],
    "task_labels": [ ... ],
    "beliefs": [ ... ],
    "settings": { ... }
  }
}
```
