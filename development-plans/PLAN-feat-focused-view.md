# Development Plan: feat-focused-view

## Summary

Introduce a "Focused View" that shows only high-priority tasks from selected boards and a chosen day range, presented as a responsive card grid. The view configuration (board selection + day range) is stored in the database. Board color is user-configurable and stored on the `boards` table.

---

## Scope

Three sequential PRs:

| PR | Scope | Deploy type |
|---|---|---|
| 1 | Backend: DB schema + new API endpoints | Railway redeploy |
| 2 | Web frontend: settings + focused view component | Railway frontend redeploy |
| 3 | Mobile: settings + focused view screen | OTA (`eas update`) — JS/TS only |

Deployment order: Backend → Web → Mobile. Web and mobile are backward-compatible with the new backend (additive endpoints only).

---

## Feature Behaviour Summary

- User switches between **Detailed view** (current kanban) and **Focused view** (new). Toggle is session-only — resets to Detailed on next load.
- Focused view shows tasks where `is_high_priority = true` AND (`must_do_by` OR `target_date`) falls within the configured day range.
- Tasks are grouped alphabetically by board. Within each board, sorted by `updated_at` descending.
- Boards with zero qualifying tasks are silently omitted.
- Layout is a responsive card grid (columns determined by screen width; no semantic meaning to columns).
- Each board is color-coordinated using a user-configurable hex color stored on `boards.color`.
- Cards are larger and airier than the current task list cards; same fields.
- Configuration (board selection + day range) is stored per-user in `focused_view_configs`. One row per user enforced by `UNIQUE(user_id)`; upsert (`ON CONFLICT DO UPDATE`) used when creating the default config.
- Default config: `board_selection = all`, `day_range = today_tomorrow`.
- Config UI lives in Settings, directly below the default board picker.
- Overdue tasks (effective date before today) are **not** shown — the focused view is forward-looking only. Users see overdue tasks in Detailed view.
- Focused view cards are **tap-to-open only** — no drag-and-drop.

---

## Data Model Changes

### New table: `focused_view_configs`

Created via `CREATE TABLE IF NOT EXISTS` in `main.py` lifespan (via SQLAlchemy `Base.metadata.create_all()`).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | NOT NULL. FK → users (CASCADE). **Not unique** — designed to support multiple configs per user later. |
| `board_selection` | VARCHAR | NOT NULL. Values: `all`, `selected` |
| `selected_board_ids` | JSONB | NOT NULL. Default `[]`. Array of board UUID strings. Ignored when `board_selection = all`. |
| `day_range` | VARCHAR | NOT NULL. Values: `today`, `today_tomorrow`, `today_plus_two` |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

`user_id` is indexed. **`UNIQUE(user_id)` constraint added** — enforces one config per user at the DB level. The GET endpoint uses `INSERT ... ON CONFLICT (user_id) DO UPDATE SET updated_at = now()` (no-op update) to create the default row idempotently, eliminating the race condition. Future multi-config expansion will require a schema change (drop the unique constraint, add a `name` or `is_active` column), which is acceptable — the data model is otherwise already shaped for it.

### Modified table: `boards`

Add via `ALTER TABLE boards ADD COLUMN IF NOT EXISTS color VARCHAR(7)`:

| Column | Type | Notes |
|---|---|---|
| `color` | VARCHAR(7) | Nullable. Hex color string e.g. `#6366f1`. Null = UI assigns default from fixed palette. |

---

## API Changes

### New router: `backend/app/routers/focused_view.py`

Mounted at `/api/v1`.

#### `GET /focused-view/config`

Returns the user's focused view config. Creates the default config (`board_selection = all`, `day_range = today_tomorrow`) if none exists.

**Response:**
```json
{
  "id": "uuid",
  "board_selection": "all",
  "selected_board_ids": [],
  "day_range": "today_tomorrow"
}
```

#### `PUT /focused-view/config`

Update the focused view config.

**Request:**
```json
{
  "board_selection": "selected",
  "selected_board_ids": ["uuid1", "uuid2"],
  "day_range": "today"
}
```

Validation:
- `board_selection` must be `all` or `selected`
- `day_range` must be `today`, `today_tomorrow`, or `today_plus_two`
- When `board_selection = selected`, `selected_board_ids` must be non-empty and all IDs must be owned by the caller
- When `board_selection = all`, `selected_board_ids` is ignored (stored as `[]`)

**Response:** updated config object

**Error cases:**
- `400` — invalid `board_selection` or `day_range` value
- `400` — `board_selection = selected` with empty `selected_board_ids`
- `400` — any board ID in `selected_board_ids` not found or not owned by caller (body-field validation error → 400, not 404; consistent with rest of API)

#### `GET /focused-view/tasks`

Returns high-priority tasks matching the user's focused view config, grouped by board.

**Query params:**
- `reference_date=YYYY-MM-DD` (optional) — the client's local date. Used as "today" for computing the day window. Defaults to server UTC date if omitted. Clients should always supply this to avoid timezone mismatch (e.g. a user at UTC-7 at 11 PM would otherwise see server "tomorrow" as their "today").

**Logic:**
1. Load the user's config (create default if none)
2. Determine the date window:
   - `today`: today only
   - `today_tomorrow`: today and tomorrow
   - `today_plus_two`: today, tomorrow, and day after tomorrow
3. Determine the board scope:
   - `all`: all non-deleted boards owned by the user
   - `selected`: only the boards in `selected_board_ids`
4. Query tasks where:
   - `user_id = current_user.id`
   - `board_id IN (scoped boards)`
   - `is_deleted = false`
   - `state = pending`
   - `is_high_priority = true`
   - `(must_do_by IN date_window OR target_date IN date_window)`
5. Group by board, sort boards alphabetically by name
6. Within each board, sort tasks by `updated_at` DESC
7. Omit boards with zero qualifying tasks

**Response:**
```json
{
  "boards": [
    {
      "board_id": "uuid",
      "board_name": "Alpha",
      "board_color": "#6366f1",
      "tasks": [
        { ...full task object including labels... }
      ]
    }
  ]
}
```

**Note:** `board_color` is `null` when the user has not configured a color; clients substitute a default from a fixed palette.

---

### Modified: `PUT /boards/{board_id}`

Add optional `color` field to request body. Accepts a 7-character hex string (e.g. `#6366f1`) or `null` (to clear the color). Server validates format if provided.

**Updated request (all fields optional):**
```json
{ "name": "Personal tasks", "is_default": true, "color": "#6366f1" }
```

**Error cases (added):**
- `400` — `color` provided but not a valid 7-char hex string

**Hex color validation:** Validated via a Pydantic `field_validator` on `BoardUpdate` (regex `^#[0-9a-fA-F]{6}$`). Catches bad input before it reaches the service layer, consistent with how the rest of the API uses Pydantic for field-level validation.

### Modified: `GET /boards`

`BoardOut` schema gains a `color` field (nullable string). Backward-compatible (additive).

---

## Backend Files to Create / Modify

| File | Change |
|---|---|
| `backend/app/models.py` | Add `FocusedViewConfig` ORM model; add `color` column to `Board` model |
| `backend/app/schemas.py` | Add `FocusedViewConfigOut`, `FocusedViewConfigUpdate`, `FocusedViewTasksOut`, `FocusedViewBoardGroup`; update `BoardOut` + `BoardUpdate` to include `color` |
| `backend/app/main.py` | Add `ALTER TABLE boards ADD COLUMN IF NOT EXISTS color VARCHAR(7)` in lifespan; mount focused_view router |
| `backend/app/routers/focused_view.py` | New file — GET/PUT config + GET tasks |
| `backend/app/services/board_service.py` | Add `color=None` keyword default to `update_board()` signature; apply `board.color = color` when `color is not None`; existing 5 test call sites are unaffected (keyword default is backward-compatible) |
| `backend/app/routers/boards.py` | Update `PUT /boards/{id}` call site to pass `color=body.color` to `update_board()` (the schema alone does not flow through — the router explicitly unpacks fields) |
| `backend/tests/unit/test_focused_view_service.py` | New: unit tests for config CRUD and task filtering logic |

---

## Web Frontend Changes

### New files

| File | Purpose |
|---|---|
| `frontend/src/api/focused_view.ts` | `getFocusedViewConfig()`, `updateFocusedViewConfig()`, `getFocusedViewTasks()` |
| `frontend/src/components/FocusedView.tsx` | Main focused view component — fetches tasks, renders responsive grid grouped by board |
| `frontend/src/components/FocusedTaskCard.tsx` | Larger, airier card variant with board color accent; reuses task action handlers |

### Modified files

| File | Change |
|---|---|
| `frontend/src/api/boards.ts` | Add `color?: string \| null` to `Board` type **and** widen `updateBoard` body parameter type to include `color?: string \| null` (the function takes a separate inline body type, not `Partial<Board>`) |
| `frontend/src/pages/TasksPage.tsx` | Add session-level `view: 'detailed' \| 'focused'` state + toggle button; conditionally render `FocusedView` instead of kanban columns |
| `frontend/src/pages/SettingsPage.tsx` | (1) Add inline color picker to `BoardEditor` per board; (2) Add `FocusedViewConfigSection` below the Boards section |

### FocusedView layout

Responsive CSS grid via Tailwind:
```
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4
```

Board groups are rendered in alphabetical order, separated by a thin colored header strip (uses `board_color`, fallback palette for null). Cards within each group flow naturally through the grid (no per-board column isolation — cards from the next board follow immediately after the last card of the previous board, with a board header card as a visual separator).

Actually — board groups will be rendered as full-width headers between the cards of each board. The grid flows all cards together; each board's cards are preceded by a full-width (`col-span-full`) colored header row showing the board name.

### Color picker (Settings)

Use an HTML `<input type="color">` element (native browser color picker). Displayed as a small color swatch button next to each board name in the `BoardEditor`. Calls `PUT /boards/{id}` with the chosen hex string on change. No separate save button — updates immediately (consistent with how rename/default work via inline actions in BoardEditor). After the API call succeeds, calls `refetch()` from `BoardContext` to refresh the boards list and keep context in sync (prevents stale color in any component reading from context).

### Focused View Config section (Settings)

Below the Boards section in SettingsPage. Contains:
- **Board selection**: radio or select — "All boards" / "Selected boards" (shows board checkboxes when "Selected" is chosen)
- **Day range**: select — "Today" / "Today + Tomorrow" / "Today + Day After Tomorrow"
- Auto-saves on change (PUT /focused-view/config) with a brief "Saved" confirmation.

---

## Mobile Changes

### New files

| File | Purpose |
|---|---|
| `mobile/src/api/focused_view.ts` | Same API calls as web |
| `mobile/src/screens/FocusedViewScreen.tsx` | Focused view using `FlatList` with dynamic `numColumns` (2 on phone, 3 on tablet based on `Dimensions.get('window').width`) |

### Modified files

| File | Change |
|---|---|
| `mobile/src/types/index.ts` | Add `color?: string \| null` to `Board`; add `FocusedViewConfig` type |
| `mobile/src/api/boards.ts` | Widen `updateBoard` body parameter type to include `color?: string \| null` (file has a hardcoded inline type — must be updated explicitly) |
| `mobile/src/screens/SettingsScreen.tsx` | (1) Add color picker per board in `BoardSection`; (2) Add focused view config section |
| `mobile/src/screens/TasksScreen.tsx` | Add view toggle (icon/tab in header) — session-only state; **inline swap** (conditionally renders `FocusedViewScreen` content inside `TasksScreen` instead of a separate Modal — simpler, avoids safe-area/dismiss complexity; scroll position loss on toggle is acceptable) |

### Mobile color picker

React Native has no native color picker. Use a preset palette of 8–10 curated hex colors rendered as tappable swatches. User selects one; immediately calls `PUT /boards/{id}`. After success, calls `refetch()` from `BoardContext` (same as web — keeps context in sync). A `null` color clears back to the default palette assignment.

### Mobile focused view layout

`FlatList numColumns` driven by screen width via `Dimensions.get('window').width`:
- `width < 600`: 2 columns
- `width >= 600`: 3 columns

**`key={numColumns}`** must be set on the `FlatList` so React Native unmounts/remounts the list when `numColumns` changes on orientation change — without it the list throws a warning and renders incorrectly.

Cards use `flex: 1`. Board name headers are rendered as full-width separators between board groups (achieved by interleaving header items into the data array as a distinct item type, rendered with `columnWrapperStyle` suppressed for header rows).

---

## Test Plan

### Backend unit tests (new file)
`backend/tests/unit/test_focused_view_service.py`:
- Config creation (default values on first GET)
- Config update — valid cases
- Config update — validation errors (bad board_selection, bad day_range, empty selected_board_ids)
- Task filtering — `today` window matches today, excludes tomorrow
- Task filtering — `today_tomorrow` window
- Task filtering — `today_plus_two` window
- Task filtering — only `is_high_priority = true` tasks returned
- Task filtering — only `state = pending` tasks returned
- Task filtering — `board_selection = selected` scopes to correct boards
- Task filtering — board with zero tasks omitted
- Board ordering — alphabetical

### Integration tests
Owned by Sleepy (`/test-review`). Will cover the new endpoints end-to-end.

### Frontend unit tests
- `frontend/src/__tests__/boards.api.test.ts` — add test for `updateBoard` with `color` field (1 new test)
- No other new pure util functions introduced. `FocusedView` and `FocusedTaskCard` are component-level — not unit-tested.

### Mobile unit tests
- `mobile/src/__tests__/boards.api.test.ts` — add test for `updateBoard` with `color` field (1 new test)
- No other new utility functions. Component-level testing via device inspection.

---

## Deployment Order & Backward Compatibility

1. **Backend (PR 1)** — deploy first. Adds new columns + new endpoints. All changes are additive:
   - `boards.color` is nullable — existing rows get `null` (valid)
   - `GET /boards` gains `color` field — web/mobile clients that don't read it yet are unaffected
   - `/focused-view/*` endpoints are new — no existing clients call them
2. **Web (PR 2)** — deploy after backend. Reads new fields, calls new endpoints.
3. **Mobile (PR 3)** — OTA update after web. Same dependency on backend.

No backward-compat shims needed. No breaking changes to existing endpoints.

---

## Open Questions / Risks

1. **Color null handling**: when `board_color` is null, both web and mobile need a consistent default palette. Suggest a fixed array of 8 colors (indigo, emerald, amber, rose, sky, violet, orange, teal) cycled by board index in the `GET /boards` response order. This logic lives purely client-side.

2. **Overdue tasks**: NOT included — resolved in Feature Behaviour Summary above.

3. **High priority + overdue**: NOT shown in focused view — resolved in Feature Behaviour Summary above.

4. **Config race on first load**: resolved — `UNIQUE(user_id)` on `focused_view_configs` + `ON CONFLICT DO UPDATE` upsert in GET endpoint. See Data Model Changes.

5. **selected_board_ids stale references**: if a user deletes a board that's in `selected_board_ids`, the GET /focused-view/tasks endpoint silently skips the missing board (no 404). The PUT /focused-view/config validation runs at save time only.

---

## Grumpy's Responses to Sneezy's Review

**Issue 1 [Blocker] — `board_service.py` missing from change list.**
Addressed. Added `board_service.py` to the Backend Files table with explicit instruction to add `color=None` keyword default to `update_board()` and apply it in the function body. Router call site updated to pass `color=body.color`.

**Issue 2 [Blocker] — `mobile/src/api/boards.ts` missing from mobile files.**
Addressed. Added `mobile/src/api/boards.ts` to the Mobile Files table with explicit note to widen the `updateBoard` body type.

**Issue 3 [Blocker] — `test_board_service.py` will break.**
Addressed. Using `color=None` keyword default on `update_board()` makes all existing call sites backward-compatible without modification. Noted in the `board_service.py` change entry.

**Issue 4 [Risk] — Race condition workaround is internally contradictory.**
Addressed. Replaced "no unique constraint" design with `UNIQUE(user_id)` + `ON CONFLICT DO UPDATE` upsert. Updated Data Model Changes section and Feature Behaviour Summary. Future multi-config will require a schema change — acceptable trade-off.

**Issue 5 [Risk] — Server-side "today" ignores client timezone.**
Addressed. Added `reference_date=YYYY-MM-DD` optional query param to `GET /focused-view/tasks`. Updated API section.

**Issue 6 [Risk] — FlatList `numColumns` without `key` prop breaks on orientation change.**
Addressed. Added explicit `key={numColumns}` requirement to Mobile Focused View Layout section.

**Issue 7 [Risk] — Color picker bypasses `BoardContext`.**
Addressed. Both web and mobile color picker sections now specify calling `refetch()` from `BoardContext` after save.

**Issue 8 [Gap] — Hex color validation location unspecified.**
Addressed. Specified Pydantic `field_validator` on `BoardUpdate` with regex `^#[0-9a-fA-F]{6}$`. Updated `PUT /boards/{board_id}` section.

**Issue 9 [Gap] — `frontend/src/api/boards.ts` `updateBoard` body type also needs `color`.**
Addressed. Updated the web Modified Files table entry for `boards.ts` to call out both the `Board` type and the `updateBoard` body type.

**Issue 10 [Gap] — `PUT /focused-view/config` should return 400 not 404 for invalid board IDs in body.**
Addressed. Updated error cases to `400` with explanatory note.

**Issue 11 [Gap] — No test for color update in `boards.api.test.ts`.**
Addressed. Added to Test Plan (1 new test in each of web and mobile `boards.api.test.ts`).

**Issue 12 [Gap] — Mobile `FocusedViewScreen` presentation style ambiguous.**
Addressed. Committed to **inline swap** (conditional render inside `TasksScreen`) — simpler, avoids Modal safe-area/dismiss complexity. Noted in Mobile Modified Files table.

**Unverified assumption — `BoardUpdate` "flows through" to service.**
Addressed. Removed the false note from `boards.py` table entry; the router explicitly unpacks fields. `board_service.py` is now in the change list with explicit service + router call site changes.

**Suggestion — `color=None` keyword default.**
Adopted. See Issue 1 / Issue 3 responses above.

**Suggestion — `reference_date` query param.**
Adopted. See Issue 5 response above.

**Suggestion — Specify FocusedView has no drag-and-drop.**
Adopted. Added "tap-to-open only, no drag-and-drop" to Feature Behaviour Summary.

---

## Sneezy's Review — 2026-06-28

**Verdict:** Changes required

### Issues

1. **[Blocker] `backend/app/services/board_service.py` is missing from the "Backend Files to Create / Modify" table.** The `update_board()` function at line 124 of `board_service.py` has the signature `update_board(db, board, name, is_default)`. Adding `color` to `BoardUpdate` schema and to the router call will accomplish nothing unless `update_board()` also accepts a `color` parameter and applies it to the board object. The router at `boards.py:43` calls `svc.update_board(db, board, body.name, body.is_default)` explicitly — it does not forward the entire `body` object. `board_service.py` must be in the change list, and the function signature, body, and the router call site all need updating together.

2. **[Blocker] `mobile/src/api/boards.ts` is missing from the mobile files table.** That file defines `updateBoard(id, body: { name?: string; is_default?: boolean })` with a hardcoded body type that does not reference `mobile/src/types/index.ts`. Adding `color` to `mobile/src/types/index.ts` does not widen this function's body parameter. TypeScript will reject any color picker call that passes `color` to `updateBoard`. The file must be explicitly added to the change list.

3. **[Blocker] Existing `test_board_service.py` tests will break if `color` is added to `update_board()` without a default value.** The five tests in `TestUpdateBoard` (lines 157–205) call `update_board(db, board, name=..., is_default=...)` with no `color` argument. If the parameter is positional and required, all five calls raise `TypeError`. Either add `color=None` as a keyword default, or update the five existing test call sites. The plan mentions neither. This is a regression in the existing unit test suite.

4. **[Risk] The config race-condition workaround described in Open Question 4 is mechanically impossible as designed.** The plan proposes handling concurrent first-GET races with `INSERT ... ON CONFLICT DO NOTHING` or `try/except on IntegrityError`. Both mechanisms require a UNIQUE constraint on `user_id`. But the schema section explicitly states there is **no** unique constraint on `user_id` in `focused_view_configs`. Without the constraint, a concurrent insert raises no IntegrityError and `ON CONFLICT` has no column to conflict on. The plan is internally contradictory: either add a unique constraint (which changes the "no unique constraint" design decision), or accept that duplicate default rows can exist and define how the GET endpoint selects among them (e.g., always take the most-recently-created row).

5. **[Risk] Server-side "today" computation ignores client timezone.** `GET /focused-view/tasks` computes the date window server-side based on the server's local date (likely UTC). The existing `GET /tasks` and `GET /reports/completions` avoid this problem because the client supplies the date parameters. A user in UTC-7 at 11 PM will see "today" on the server as "tomorrow" in their local time, causing tomorrow's tasks to appear under "today" and today's to appear missing. The plan offers no timezone mechanism (e.g., a client-supplied `timezone` query param or the client supplying the `reference_date`).

6. **[Risk] React Native `FlatList` does not support dynamic `numColumns` without a key change.** The plan specifies `numColumns` driven by screen width to handle orientation changes (`width < 600 → 2`, `≥ 600 → 3`). React Native requires `key={numColumns}` on the `FlatList` itself to force unmount/remount when `numColumns` changes; without it, the list will throw a warning and render incorrectly after orientation change. The plan does not mention this requirement.

7. **[Risk] Color picker in `SettingsPage.tsx` bypasses `BoardContext`, leaving stale board colors in the context.** `BoardContext.tsx` holds the canonical boards list (including color). If the color picker calls `updateBoard(id, { color })` directly (as the plan implies by analogy with inline actions), `BoardContext.boards` will still hold the old color until the next `fetchBoards()` call. `FocusedView.tsx` and `FocusedTaskCard.tsx`, which read `board_color` from the API response rather than from the context, are unaffected — but any component that reads board color from context (e.g., the board switcher or the colored header in `FocusedView`) will display stale data. The plan should specify that the color picker calls `refetch()` from the board context after saving, or routes through a new `setColor` context method.

8. **[Gap] Hex color validation location is unspecified.** The plan asserts `400` on invalid color format but does not say whether validation lives in a Pydantic `field_validator` on `BoardUpdate` or in `board_service.update_board()`. The codebase pattern places string validation in the service layer (e.g., `name.strip()` checks). A Pydantic validator approach is cleaner and catches bad input before the DB layer; either is acceptable, but the plan should commit to one location so implementation is unambiguous.

9. **[Gap] `frontend/src/api/boards.ts` — `updateBoard` body type also needs `color`.** The plan says to add `color?: string | null` to the `Board` interface. But `updateBoard` takes a separate `body: { name?: string; is_default?: boolean }` type (not `Partial<Board>`). TypeScript will reject `updateBoard(id, { color: '#6366f1' })` as written. The plan must explicitly call out that this body type is widened.

10. **[Gap] `PUT /focused-view/config` uses HTTP 404 for invalid board IDs in a request body field.** The existing API uses 404 exclusively for URL-path resource lookups (e.g., board not found by ID in the path). Returning 404 for an invalid `selected_board_ids` entry — which is a validation failure on a request body field — is inconsistent with how the rest of the API treats body-field errors (400/422). Consider 400 with a specific message, which is consistent with `POST /boards` and `PUT /boards/{id}` body validation errors.

11. **[Gap] No test for color update in `boards.api.test.ts` (web and mobile).** The plan adds `color` as a new field accepted by `PUT /boards/{id}`. Neither test file (`frontend/src/__tests__/boards.api.test.ts` nor `mobile/src/__tests__/boards.api.test.ts`) is mentioned as needing new tests for the color update path. These tests are unit-level and are owned by the feature author, not Sleepy.

12. **[Gap] `FocusedViewScreen` presentation style on mobile is ambiguous.** The plan says "renders `FocusedViewScreen` as a modal or inline swap." The approved pattern for full-screen content in this codebase is the `pageSheet Modal` (per `ARCHITECTURE.MD` — `TaskFormScreen` pattern). If `FocusedViewScreen` is presented as a Modal, it needs `onRequestClose`, safe-area handling, and a way to dismiss. If it is an inline swap (replacing the SectionList in `TasksScreen`), it is simpler but scroll position is lost on switch. The plan should commit to one approach.

### Unverified assumptions

- **Plan claims `BoardUpdate` schema "already flows through" to the board update logic.** This is false as verified. The router at `boards.py:43` unpacks `body.name` and `body.is_default` individually before passing them to `board_service.update_board`. A new `color` field on `BoardUpdate` does not automatically reach the service or the database. Three separate changes are required: schema, service signature, and router call site.

- **Plan claims `FocusedViewConfig` will be created via `Base.metadata.create_all()`.** This is correct — any SQLAlchemy model inheriting from `Base` in `models.py` will be picked up by the existing `create_all()` call on startup. No separate `CREATE TABLE IF NOT EXISTS` raw SQL statement is needed in the lifespan block. This assumption holds.

- **Plan assumes the `color` column on `boards` must be added via raw `ALTER TABLE` in `main.py`.** This is correct — `create_all()` does not alter existing tables, only creates missing ones. The `ALTER TABLE boards ADD COLUMN IF NOT EXISTS color VARCHAR(7)` approach is the established pattern in this codebase (consistent with how `is_high_priority`, `board_id`, and other columns were added).

- **Plan assumes mobile PR 3 qualifies as OTA (`eas update`).** This holds if `FocusedViewScreen` is not registered in the navigator (i.e., presented as a Modal from `TasksScreen`) and no native modules are added. The plan should confirm that `AppNavigator.tsx` is not being modified; if it is, the OTA classification still holds since navigator changes are TypeScript-only.

- **ARCHITECTURE.MD describes `board_service.py` as having `MAX_BOARDS_PER_USER = 5`.** The actual code has `MAX_BOARDS_PER_USER = 10` (confirmed at `board_service.py:14`). ARCHITECTURE.MD is outdated on this point. The plan author was likely working from the stale documentation. The plan itself does not cite a specific cap number, so this does not affect the plan's correctness — but it means any developer reading ARCHITECTURE.MD for context will see the wrong value.

### Suggestions

- **Add a partial UNIQUE constraint on `(user_id)` to `focused_view_configs` — or define a clear "one active config" resolution rule.** The simplest resolution to the race condition: add `WHERE is_active = true` and a partial unique index `ON focused_view_configs (user_id) WHERE is_active = true`, mirroring how the default board is handled. Alternatively, accept at most one config per user (add `UNIQUE(user_id)`) and use `ON CONFLICT DO UPDATE` for the default-creation GET. This also simplifies the GET endpoint logic.

- **Pass a `reference_date` query parameter to `GET /focused-view/tasks` from the client.** The client already knows the local date. Accepting an optional `?reference_date=YYYY-MM-DD` parameter (falling back to server UTC date if omitted) solves the timezone mismatch without requiring timezone name handling on the backend.

- **Add `color=None` as a keyword-default to `board_service.update_board()` signature.** This makes the parameter backward-compatible with all existing call sites and tests without modifying them. Existing tests pass untouched; only the implementation body needs the `if color is not None: board.color = color` conditional.

- **Specify that `FocusedView` does not use draggable tasks.** The plan describes cards as "larger and airier" but is silent on interactivity. Making this explicit avoids scope creep and confirms cards are tap-to-open only (consistent with the "read" nature of the view).

— *Sneezy*
