# Plan: Custom board order + board-color styling in All view + alphabetical tags

Branch: `feat-board-order-and-color`

## Summary

Four related changes, bundled into one PR because they all touch the same `boards` display/ordering surface:

1. **Board color everywhere** — board colors already exist and are already editable in Settings (`BoardEditor`, PR #37). New work: use each board's color to (a) fill the active board's button in the All-view board-tab row (`BoardTabs.tsx`) and (b) render a left-accent dot on inactive tabs, and (c) render a colored left border on All-view task cards (`TaskCard.tsx`), matching the border treatment `FocusedTaskCard.tsx` already has for non-All views.
2. **Custom board order** — replace the current fixed `is_default DESC, created_at ASC` board ordering with a user-draggable custom order, persisted via a new `boards.sort_order` column (same fractional-index pattern as `tasks.sort_order`, PR #61). Order drives:
   - Left-to-right position of the board-tab buttons in All view.
   - Top-to-bottom board grouping order in Focused/Today/Tomorrow/Overdue (currently alphabetical by name — this changes to custom order).
   - Row order in Settings' board list (where the drag happens).
3. **Order-driven default board** — per user decision, the topmost board in the custom order *is* the default board. The existing manual "click a star to set default" mechanism is removed; the only way to change the default is to drag a different board to the top. This is a backend behavior change (`is_default` becomes a derived/maintained field, no longer directly settable via the API) as well as a UI change (web Settings loses the star-click button; mobile Settings loses its "Default" tap button, since it would otherwise silently no-op).
4. **Alphabetical tags in Settings** — `SettingsPage.tsx`'s Tags section (`LabelEditor`) currently renders labels in whatever order `GET /labels` returns (creation order). Sort alphabetically by `value` before rendering, matching the alphabetical-tag sort already applied elsewhere (`TaskForm.tsx` PR #58, `TaskQuickEdit.tsx` PR #57, `TasksPage.tsx` PR #56).

**Scope decision (confirmed with user):** Web ships the drag-to-reorder UI and all styling changes. Mobile is read-only with respect to order — it automatically inherits the new custom order from the backend (its board lists/tabs already just render `boards` in API order, no local re-sorting), but gets no drag-and-drop UI. Mobile's now-dead "Default" tap button is removed as a direct consequence of decision 2 (see Mobile section).

---

## Data model change

### `boards.sort_order`

New column, mirroring `tasks.sort_order` (PR #61) exactly:

| Column | Type | Notes |
|---|---|---|
| `sort_order` | DOUBLE PRECISION | NOT NULL. Client-computed fractional index controlling board display order. Python-side `Column(default=_sort_order_default)` (reuse the existing `_sort_order_default()` callable in `models.py` — it's generic, just returns `datetime.now(timezone.utc).timestamp()`), so every newly-created board naturally sorts after all existing ones (real time only moves forward — same rationale already documented for `tasks.sort_order`). |

**Migration** (idempotent, 3-step, same shape as the existing `tasks.sort_order` migration in `main.py`):
1. `ALTER TABLE boards ADD COLUMN IF NOT EXISTS sort_order DOUBLE PRECISION` (nullable initially).
2. Backfill existing rows to preserve today's on-screen order exactly, so no existing user sees their boards jump around on deploy:
   ```sql
   UPDATE boards SET sort_order = sub.rn
   FROM (
     SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY is_default DESC, created_at ASC) AS rn
     FROM boards
   ) sub
   WHERE boards.id = sub.id AND boards.sort_order IS NULL;
   ```
3. `ALTER TABLE boards ALTER COLUMN sort_order SET NOT NULL`.

### `boards.is_default` — semantics change, no schema change

Column stays exactly as-is (still backs the existing partial unique index `boards_user_id_default_key`, still read everywhere it's read today — `get_default_board_id()`, sync pull payload, etc.). What changes is **who writes it**: no longer a directly client-settable field. It becomes a value the server maintains automatically so it always matches "whichever board has the lowest `sort_order`".

---

## Backend changes

### `backend/app/models.py`
- `Board`: add `sort_order = Column(DOUBLE_PRECISION, nullable=False, default=_sort_order_default)`.

### `backend/app/main.py`
- Add the 3-step migration above to the startup lifespan block, same style as the existing `tasks.sort_order` migration.

### `backend/app/schemas.py`
- `BoardOut`: add `sort_order: float`.
- `BoardUpdate`: add `sort_order: Optional[float] = None`; **remove** `is_default: Optional[bool] = None` (no longer part of the write contract — see Contract change note below).

### `backend/app/services/board_service.py`
- `update_board()` signature changes: drop the `is_default` parameter entirely. Add `sort_order: Optional[float] = None`.
  - When `sort_order is not None`: set `board.sort_order = sort_order`, flush, then call a new helper `_recompute_default(db, board.user_id)`.
  - `_recompute_default(db, user_id)`: queries all non-deleted boards for the user ordered by `sort_order asc, created_at asc` (secondary key per Sneezy Issue 3 — same tie-break rationale as `GET /boards`, prevents nondeterministic `is_default` flips on exact ties); if the topmost board is not already `is_default`, demotes whichever board currently has `is_default = True` and promotes the topmost — same atomic demote-then-promote flush order the old manual-set-default code used (avoids the partial-unique-index `IntegrityError`). Uses `db.flush()` only, never `db.commit()` — the existing single-commit-at-the-end pattern in `update_board()` owns the transaction boundary (confirms Sneezy's unverified-assumption note).
  - **Why recompute globally rather than just checking the moved board:** a drag can move the *current default* board away from the top (no other board's row is touched by that single PUT), so the invariant "topmost board is default" must be re-derived from the full ordered list on every reorder, not inferred from the single board being updated.
- `create_board()`: unchanged — new boards get `is_default=False` and rely on the model's `sort_order` column default (a fresh timestamp), which naturally places them after all existing boards.

### `backend/app/routers/boards.py`
- `GET /boards`: change `.order_by(Board.is_default.desc(), Board.created_at.asc())` → `.order_by(Board.sort_order.asc(), Board.created_at.asc())` (secondary key per Sneezy Issue 3, avoids nondeterministic tab order on exact `sort_order` ties).
- `PUT /boards/{board_id}`: drop `body.is_default` from the call to `svc.update_board()`; add `sort_order=body.sort_order`.

### `backend/app/services/focused_view_service.py`
- All three board-resolution queries currently ordered `.order_by(Board.name.asc())` (used by `get_focused_tasks()`'s `all`/`selected` branches and `get_day_view_tasks()`) change to `.order_by(Board.sort_order.asc())`, so Focused/Today/Tomorrow/Overdue board grouping follows the same custom order as everything else, per the user's explicit requirement ("non-all views, the order defines top to bottom").

### Contract change (flagging per Rules of Engagement)
- `BoardUpdate.is_default` is removed from the writable API. A client that still sends `{"is_default": true}` gets a normal `200` and the field is silently ignored (Pydantic ignores unknown fields) — same graceful-degradation precedent already established for `starter_questions`' removal (PR #50). This means an un-updated mobile client tapping its old "Default" button would silently no-op rather than error; we're additionally removing that button from mobile in this same PR (see below) so no client ships with a live dead button, but the fallback behavior is safe regardless of OTA rollout timing.

---

## Frontend (web) changes

### `frontend/src/api/boards.ts`
- `Board` interface: add `sort_order: number`.
- `updateBoard()` body type: replace `is_default?: boolean` with `sort_order?: number`.

### `frontend/src/__tests__/boards.api.test.ts` (added per Sneezy Issue 1 — Blocker)
- Existing test `'calls PUT /boards/{id} with is_default'` (lines 61-67) calls `updateBoard('b2', { is_default: true })`, which fails to type-check once `is_default` is removed from the body type — breaks the build, not just the assertion. Rewrite it as `'calls PUT /boards/{id} with sort_order'`, asserting the request body is `{ sort_order: <value> }`, mirroring the existing color add/clear test shapes already in this file.

### `frontend/src/context/BoardContext.tsx`
- Remove `setDefaultBoard` from the context value and provider (no longer callable).
- Add `reorderBoard(id: string, sortOrder: number): Promise<void>` — calls `updateBoard(id, { sort_order: sortOrder })` then `fetchBoards()`.

### New: `frontend/src/utils/boardOrder.ts`
- `computeBoardInsertSortOrder(boards: Board[], draggedId: string, targetId: string | null, edge: 'above' | 'below' | null): number` — same Trello-style fractional-indexing algorithm as `utils/taskOrder.ts`'s `computeInsertSortOrder`, operating on the flat `boards` list instead of a task zone. Not extracted into a shared generic with `taskOrder.ts` — the two operate on unrelated domain types and duplicating ~15 lines of a well-understood algorithm is preferable to coupling boards and tasks through a shared abstraction.
- New Vitest unit tests in `frontend/src/__tests__/boardOrder.test.ts` (drop at top/bottom/between, empty list, single board) — required since this is new business logic (Rules of Engagement: unit tests for business logic changes).

### New: `frontend/src/utils/boardColor.ts`
- Extracts the `PALETTE` array and adds `getBoardColor(color: string | null | undefined, index: number): string` (falls back to `PALETTE[index % PALETTE.length]` when `color` is null/undefined) — the exact logic currently inlined in `BoardGroupedTasks.tsx`. `BoardGroupedTasks.tsx`, `BoardTabs.tsx`, and `TaskCard.tsx`'s caller (`TasksPage.tsx`) all need the identical fallback logic, so this is immediate concrete reuse, not speculative abstraction.
- New Vitest unit tests in `frontend/src/__tests__/boardColor.test.ts` (explicit color returned as-is; null/undefined falls back to palette by index; index wraps past palette length).

### `frontend/src/components/BoardGroupedTasks.tsx`
- Replace its local `PALETTE`/`boardColor()` with imports from `utils/boardColor.ts` (no behavior change).

### `frontend/src/components/BoardTabs.tsx`
- Active tab: background becomes `getBoardColor(board.color, index)` (inline `style`, since it's a dynamic hex, not a Tailwind class) with white text; drop the hardcoded `bg-indigo-600` active class.
- Inactive tabs: add a small colored dot (same visual as `BoardGroupedTasks.tsx`'s board-header dot) in `getBoardColor(board.color, index)` before the board name, on the existing plain white/gray-border background.
- The star icon (read-only default marker) stays, but per Sneezy Nit 6, switch its styling from `text-amber-300`/`text-amber-400` (tuned for the old fixed indigo background) to `text-white drop-shadow` — legible against any per-board palette/custom color the active tab background can now take, including amber/yellow-ish boards.

### `frontend/src/pages/TasksPage.tsx`
- Compute `activeBoardColor = getBoardColor(activeBoard?.color, Math.max(0, boards.findIndex(b => b.id === activeBoard?.id)))` once near the top of the component (All view only shows one board's tasks at a time, so every `TaskCard` in the kanban gets the same color). The `Math.max(0, ...)` guard is per Sneezy Nit 5 — without it, an unmatched `findIndex` (`-1`) would evaluate `PALETTE[-1 % 8]` (`-1` in JS, not wrapped) → `undefined`. Verified currently unreachable since `useTasks()` bails early when `activeBoard` is null, but the guard is cheap insurance against that coupling changing later.
- Pass `boardColor={activeBoardColor}` to every `<TaskCard>` call site (3 occurrences in the file).

### `frontend/src/components/TaskCard.tsx`
- Add required prop `boardColor: string`.
- Container `style`: add `borderLeftColor: boardColor, borderLeftWidth: 4` (mirrors `FocusedTaskCard.tsx` exactly) — keep the existing `border border-gray-200` Tailwind class for the other three sides (matches `FocusedTaskCard`'s pattern of a plain-gray full border with the left side overridden inline).

### `frontend/src/pages/SettingsPage.tsx` — `BoardEditor`
- Remove the star/"set as default" `<button onClick={() => !board.is_default && handleSetDefault(board.id)}>` — replace with a plain non-interactive `★` marker shown only on the topmost (`boards[0]`) board, with a `title="Default board"` tooltip. Remove `handleSetDefault`, the `onSetDefault` prop, and its usage from `SettingsPage`'s call to `<BoardEditor>` (drop the `setDefaultBoard` destructure from `useBoard()`).
- Add drag-and-drop reordering on each board row: native HTML5 `draggable`/`onDragStart`/`onDragOver`/`onDrop` on the row `<div>`, same pattern already used for task drag-and-drop in `TasksPage.tsx`. On drop, compute the new `sort_order` via `computeBoardInsertSortOrder(boards, draggedId, targetId, edge)` and call the new `reorderBoard(draggedId, newSortOrder)` prop (threaded down from `SettingsPage`, sourced from `useBoard()`).
- Copy update: the existing helper text ("Manage your boards. The starred board is your default — you return to it on every app open.") gets an added sentence noting boards can be dragged to reorder, and that the top board is the default.

### `frontend/src/pages/SettingsPage.tsx` — Tags section
- Where `typeLabels` is passed into `<LabelEditor labels={typeLabels} ... />`, sort first: `labels={[...typeLabels].sort((a, b) => a.value.localeCompare(b.value))}`.

---

## Mobile changes (minimal — read-only order, no drag UI)

### `mobile/src/screens/SettingsScreen.tsx`
- Remove the `{!board.is_default && (<TouchableOpacity onPress={() => handleSetDefault(board.id)}>...Default...</TouchableOpacity>)}` block and its `handleSetDefault` function — it would now silently no-op against the backend (per the Contract change note above), so it must not remain a live-looking control. The `★` read-only indicator for `board.is_default` stays.

### `mobile/src/context/BoardContext.tsx`
- Remove `setDefaultBoard` from the context (mirrors the web `BoardContext` change; nothing else calls it once the Settings screen button above is removed).

### `mobile/src/types/index.ts`
- `Board` type: add `sort_order: number` for type accuracy (mobile doesn't act on this field — it already renders `boards` in whatever order the API returns — this is a documentation-only addition, no behavior change).

### `mobile/src/api/boards.ts` (added per Sneezy Nit 4 + Suggestions)
- `updateBoard()` body type: drop `is_default?: boolean`, matching the web contract change, rather than leaving a dead-but-type-legal field once `setDefaultBoard` is deleted from mobile's `BoardContext.tsx`.

### `mobile/src/__tests__/boards.api.test.ts` (added per Sneezy Nit 4)
- Existing test `'updateBoard calls PUT /boards/:id with is_default'` (line 55) is rewritten or removed to stop exercising a field the backend no longer accepts as writable, consistent with the web-side test rewrite.

**No other mobile changes.** `BoardTabs.tsx` (mobile) and the board list in `SettingsScreen.tsx` already render `boards.map(...)` directly with no local re-sort, so they automatically pick up the new custom order for free once the backend ships.

**Mobile update type:** OTA (`eas update`) — JS/TS only, no native modules/`app.json`/`eas.json` changes.

---

## Files to modify

**Backend:** `models.py`, `main.py`, `schemas.py`, `services/board_service.py`, `routers/boards.py`, `services/focused_view_service.py`
**Backend tests:** `tests/unit/test_board_service.py` (update existing `is_default`-related tests to match the new signature; add tests for `_recompute_default` — promote on drag-to-top, demote-and-promote when the default is dragged away from top, no-op when order changes but topmost is unchanged); `tests/unit/test_focused_view_service.py` (rename the two `test_boards_ordered_alphabetically` tests, lines 256 & 367, to reflect `sort_order`-based ordering — added per Sneezy Issue 2, MagicMock-based so they won't fail on their own, but their names would otherwise assert something false)
**Web frontend:** `api/boards.ts`, `__tests__/boards.api.test.ts` (added per Sneezy Issue 1), `context/BoardContext.tsx`, new `utils/boardOrder.ts` + test, new `utils/boardColor.ts` + test, `components/BoardGroupedTasks.tsx`, `components/BoardTabs.tsx`, `pages/TasksPage.tsx`, `components/TaskCard.tsx`, `pages/SettingsPage.tsx`
**Mobile:** `screens/SettingsScreen.tsx`, `context/BoardContext.tsx`, `types/index.ts`, `api/boards.ts` (added per Sneezy Nit 4), `__tests__/boards.api.test.ts` (added per Sneezy Nit 4)

**Not modified:** `backend/tests/test_api.py` (owned by `/test-review` — will be updated by Sleepy in the review chain to cover `sort_order` in board responses and the new default-derivation behavior).

---

## Deployment order

Backend + web frontend ship as a single Railway Docker image (existing project convention) — one deploy unit, no cross-version window to worry about between them.

Mobile ships separately via OTA, and can go before or after the backend/web deploy without a broken window:
- If mobile's OTA lands *before* backend/web deploys: old backend still has the old `is_default`-settable behavior and no `sort_order` column — mobile's board list renders in the pre-existing `is_default DESC, created_at ASC` order (unchanged), and the removed "Default" button is simply gone a little early (no functional loss, since nothing else changes yet).
- If mobile's OTA lands *after*: no issue, straightforward.

Recommended order: backend+web first, mobile OTA shortly after (so the removed "Default" button doesn't sit un-explained for long, though it causes no harm either way).

---

## Risks / accepted tradeoffs

- **Fractional `sort_order` precision drift**: same accepted risk already documented for `tasks.sort_order` — repeated reorders can shrink the gap between neighboring floats indefinitely; no rebalancing job exists for tasks either, and board counts are capped at `MAX_BOARDS_PER_USER = 10`, making this a non-issue in practice.
- **Concurrent reorder races**: two browser tabs dragging boards simultaneously could interleave; last-write-wins via each PUT's own transaction, same as every other board mutation today. Accepted — Settings is a single-user, single-focus page.
- **Removed API contract field** (`BoardUpdate.is_default`): mitigated via Pydantic's silent-ignore-unknown-field behavior (already an established pattern in this codebase, see `starter_questions` removal PR #50).

---

## Pre-implementation checklist

- Confidence in solution: 4/5
- Regression risk: 3/5 (board-ordering and default-board logic is read by several call sites — `get_default_board_id`, `ensure_board_seeded`, sync pull, both Focused/Day view queries — all audited above, but this is the riskiest part of the change)
- Data model changes: `boards.sort_order` (new column, 3-step migration, mirrors `tasks.sort_order`)
- Test changes needed: `backend/tests/unit/test_board_service.py` (update + new cases for `_recompute_default`); `backend/tests/unit/test_focused_view_service.py` (rename 2 misleading tests); new `frontend/src/__tests__/boardOrder.test.ts` and `boardColor.test.ts`; rewrite `frontend/src/__tests__/boards.api.test.ts`'s `is_default` case; update `mobile/src/__tests__/boards.api.test.ts`'s `is_default` case; `backend/tests/test_api.py` — deferred to Sleepy per test ownership
- Deployment order: backend+web (single Railway image) → mobile OTA (JS/TS only, no native changes) — see Deployment order section
- Mobile update type: OTA (`eas update`)

---

## Sneezy's Review — 2026-08-02

**Tier:** FULL — matches the tier stated at spawn (proposed files fall under `models.py`/`schemas.py`/`routers/boards.py`, plus a non-none data model change and a 3-component deployment). Confirmed correct on inspection; no escalation needed beyond this.

**Verdict:** Approved with concerns

### Issues

1. **[Blocker]** `frontend/src/__tests__/boards.api.test.ts:61-67` has an existing test (`'calls PUT /boards/{id} with is_default'`) that calls `updateBoard('b2', { is_default: true })`. The plan (`frontend/src/api/boards.ts` section) changes `updateBoard()`'s body type from `{ name?: string; is_default?: boolean; color?: string | null }` to `{ name?: string; sort_order?: number; color?: string | null }` — dropping `is_default` entirely. Once that type change lands, this test fails **TypeScript type-checking** (not just a stale assertion — `is_default` won't be an assignable property), which will break the Vitest/tsc build. This file is not listed anywhere in the plan's "Files to modify" (Web frontend section or elsewhere). It must be added to the file list and the `is_default` test rewritten to cover `sort_order` instead (mirroring the existing color add/clear tests immediately below it in the same file). This is the same class of gap PR #61's own Sneezy review caught (test fixtures not updated for a schema/type change) — worth double-checking for exactly this pattern given the project's history with it.

2. **[Gap]** `backend/tests/unit/test_focused_view_service.py` has two tests named `test_boards_ordered_alphabetically` (lines 256 and 367, in `TestGetFocusedTasks` and `TestGetDayViewTasks` respectively). Verified these are MagicMock-based: `board_mock.filter.return_value.order_by.return_value.all.return_value = boards` returns whatever list the test pre-sorted, regardless of the real `.order_by(...)` clause in the source — so they will keep passing after `Board.name.asc()` → `Board.sort_order.asc()` and won't catch a regression. But their names now assert something false (ordering is no longer alphabetical), which is misleading coverage. This file isn't in the plan's backend-tests list (only `test_board_service.py` is). Should be renamed/updated for accuracy, same as the mocked-filter caveat ARCHITECTURE.MD already documents for the PR #55 day-view tests.

3. **[Risk]** Neither `GET /boards`'s new `.order_by(Board.sort_order.asc())` (routers/boards.py) nor `_recompute_default()`'s "topmost board" query has a secondary sort key. If two boards ever end up with an exactly-equal `sort_order` float (the same fractional-index-collision class of risk the plan already accepts for repeated reorders), Postgres does not guarantee a stable row order for ties across repeated queries. That means: (a) the board-tab/Settings-row display order could flicker between reloads, and (b) `_recompute_default()`'s notion of "topmost" — and therefore which board is `is_default` — could flip nondeterministically between calls without the user having dragged that board. Low probability given `MAX_BOARDS_PER_USER = 10`, but a cheap, standard fix (`.order_by(Board.sort_order.asc(), Board.created_at.asc())` in both places) would remove the nondeterminism entirely and isn't mentioned anywhere in the plan.

4. **[Nit]** `mobile/src/api/boards.ts`'s `updateBoard()` body type still declares `is_default?: boolean` as writable — the plan's mobile file list (`screens/SettingsScreen.tsx`, `context/BoardContext.tsx`, `types/index.ts`) never touches this file. Once `setDefaultBoard` is deleted from mobile's `BoardContext.tsx` (the only caller that ever passed `is_default`), the field becomes dead but still type-legal, and `mobile/src/__tests__/boards.api.test.ts`'s existing `'updateBoard calls PUT /boards/:id with is_default'` test (line 55) keeps "passing" while exercising functionality the backend now silently ignores. Won't break the build (unlike the web equivalent in Issue 1), but it's a dangling contract surface a future mobile change could reach for, expecting it to still work.

5. **[Nit]** `TasksPage.tsx`'s proposed `activeBoardColor = getBoardColor(activeBoard?.color, boards.findIndex(b => b.id === activeBoard?.id))`: when `activeBoard` isn't (yet) present in `boards`, `findIndex` returns `-1`, and `getBoardColor`'s documented fallback `PALETTE[index % PALETTE.length]` evaluates to `PALETTE[-1]` (`-1 % 8 === -1` in JS) — `undefined`, not a wrapped-around palette color. Verified this is very likely unreachable today: `useTasks()` "bails early when activeBoard is null" (per ARCHITECTURE.MD), so `columnTasks` would be empty and no `<TaskCard>` would render during that window — but it's fragile against future changes that decouple task-fetch timing from `activeBoard` resolution. A one-line `Math.max(0, idx)` guard would close it cheaply.

6. **[Nit]** `BoardTabs.tsx`'s star icon currently uses `text-amber-300`/`text-amber-400` for contrast against the hardcoded `bg-indigo-600` active-tab background. Once the active background becomes a per-board dynamic color (any of 8 palette colors or a custom user hex — including amber/yellow-ish boards), the amber star may lose contrast against its own tab. Purely cosmetic; not addressed by the plan.

### Unverified assumptions

- **"`sync.py`'s board push path only reads `is_default`, never writes it."** Verified true by reading `routers/sync.py` in full: `body.changes.boards` (the push payload) is never iterated or applied anywhere in `sync()` — only the *pull* response's `board_dicts` are built by reading `b.is_default`/`b.name`/etc. from already-committed rows. So there is no board-write path in sync at all today, and the plan's claim holds.
- **"`focused_view_service.py`'s three `Board.name.asc()` sites are the complete set."** Verified via grep across `backend/app/` — exactly 3 occurrences of `Board.name.asc()` (all three in `focused_view_service.py`, matching the plan) plus the one `is_default.desc()/created_at.asc()` site in `routers/boards.py` that the plan separately handles. No fourth call site (e.g. in `day_view.py`, which doesn't exist as a separate ordering call — `get_day_view_tasks` lives in `focused_view_service.py` itself).
- **`_recompute_default()`'s atomicity**: the plan describes "flush, then call `_recompute_default`" without stating explicitly that `_recompute_default()` itself must not call `db.commit()` (only `db.flush()`), to preserve the existing pattern where `update_board()` commits once at the end. Reading the current `update_board()` confirms this single-commit-at-the-end pattern for the existing demote/promote logic, so it's a reasonable inference that `_recompute_default()` will follow it too — but the plan doesn't say so explicitly, and it's worth confirming at implementation time rather than assuming.
- **Migration backfill correctness**: the `ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY is_default DESC, created_at ASC)` backfill produces small per-user integer ranks (1, 2, 3…), while newly-created boards get `_sort_order_default()` (a ~1.7-billion-scale Unix timestamp). Verified these two value spaces never collide or invert ordering (ranks are always numerically far below any real timestamp), so the migration is safe to run before, during, or after new boards are created — this wasn't explicitly called out in the plan but checks out.

### Suggestions

- Add a stable secondary sort key (`Board.created_at.asc()` or `Board.id.asc()`) alongside `Board.sort_order.asc()` in both `GET /boards` and `_recompute_default()`'s query, to eliminate the tie-nondeterminism in Issue 3 for near-zero cost.
- Consider updating `mobile/src/api/boards.ts`'s `updateBoard()` body type to drop `is_default?: boolean` in this same PR (mirroring the web change) rather than leaving a dead field — even though mobile has no live caller left, an explicit removal is more consistent with the plan's own "Contract change" framing than a silent leftover.
- When implementing, grep for `boards.api.test.ts` on both platforms before touching `frontend/src/api/boards.ts` / `mobile/src/api/boards.ts` — both files have `is_default`-specific tests today that need conscious handling (rewrite on web, decide-and-document on mobile).

— *Sneezy*

---

## Response to Sneezy's Review — Grumpy, 2026-08-02

All 6 issues addressed inline above (edits made directly to the relevant sections rather than only noted here):

1. **[Blocker] resolved** — `frontend/src/__tests__/boards.api.test.ts` added to the file list; `is_default` test rewritten to `sort_order`.
2. **[Gap] resolved** — `backend/tests/unit/test_focused_view_service.py` added to the backend-tests list; both misleadingly-named tests will be renamed.
3. **[Risk] resolved** — secondary sort key (`Board.created_at.asc()`) added to both `GET /boards` and `_recompute_default()`'s query.
4. **[Nit] resolved** — took the suggestion: `mobile/src/api/boards.ts` drops `is_default?: boolean` in this PR too, plus its test file updated, for contract-removal consistency with web.
5. **[Nit] resolved** — `Math.max(0, idx)` guard added to `TasksPage.tsx`'s `activeBoardColor` computation.
6. **[Nit] resolved** — star icon in `BoardTabs.tsx` changes from `text-amber-300`/`text-amber-400` to `text-white drop-shadow` for contrast against arbitrary per-board colors.

All "Unverified assumptions" confirmed correct by Sneezy's own independent checks — no plan changes needed there. `_recompute_default()`'s section now explicitly states it uses `db.flush()` only.

Proceeding to implementation.
