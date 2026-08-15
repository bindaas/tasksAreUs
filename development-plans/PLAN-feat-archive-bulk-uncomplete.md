# PLAN: feat-archive-bulk-uncomplete — Bulk un-complete/delete on the Archive page, plus an "All" date filter and checkmark removal

## Status
**State:** Ready for PR
**Last updated:** 2026-08-15 by Grumpy
**Next step:** `/full-review` complete on PR #82 (https://github.com/bindaas/tasksAreUs/pull/82) — awaiting user merge decision.
**Blocked on:** n/a

**Full review chain results (2026-08-15):**
- **Doc (architecture):** 3 recommend items, all applied (per-card `bulkActionLoading` gating, batched bulk requests, Delete path manually verified) — see above.
- **Dopey (code review):** approved with 1 Should-fix (stale `ARCHITECTURE.MD` text describing the already-fixed gating gap as still present) — fixed, plus a stale test-file-count nit fixed opportunistically. No Must-fix items.
- **Sleepy (test review):** integration suite run against this branch, all sections pass; no test changes needed — this PR reuses `POST /tasks/{id}/reopen` and `DELETE /tasks/{id}`, both already exhaustively covered, and adds no backend/data-model surface.
- **Bashful (requirements):** `PRODUCT_REQUIREMENTS_DOCUMENT.MD` updated to document the bulk selection UI, "All" preset, auto-expand-on-select-all, and checkmark removal.

Implemented on branch `feat-archive-bulk-uncomplete`. `tsc -b` clean, all 211 frontend unit tests pass (including the new `'all'` preset case). Manually verified in-browser (Docker dev stack): "All" preset sets `from=2000-01-01`; checkmark removed from both card layouts; per-card checkbox toggles independently without navigating (stopPropagation confirmed) and without a React console warning; "Select all" while a board group was collapsed correctly auto-expanded it and selected every loaded task (confirmed the Sneezy-flagged Gap is resolved); per-card un-complete button reopened the task, removed it from Archive, and confirmed it reappeared pending on its board's "No Date" column in the Board view; single-board (flat-list) layout renders via the same shared `CompletionCard`, correctly without a color accent stripe, matching prior behavior.

**Post-PR: Doc's architecture review (2026-08-15) filed 3 recommend items (0 stop-ship, 0 nit), all applied:**
1. Per-card un-complete/delete buttons weren't gated by `bulkActionLoading` (contradicting the plan's own stated design) — fixed by threading a new `actionsDisabled` prop from `ArchivePage.tsx` through `ArchiveBoardGroups` to `CompletionCard`'s two action buttons.
2. Bulk actions fanned out one unbounded concurrent HTTP request per selected id via `Promise.all`, amplified by the new "All" preset's ability to select an entire completion history at once — fixed by batching (`runBatched`, chunks of 10 via `Promise.allSettled`) and switching from fail-fast to always-refetch-then-report-partial-failure (`setError` with a "Failed to X of Y task(s)" count when any chunk item rejects).
3. The Delete path (single + bulk) shipped with no exercised verification (the original manual-QA pass skipped it because `confirm()` blocks browser-automation dialogs) — resolved by stubbing `window.confirm` via the browser automation's JS-execution tool (returns `true` without a real native dialog ever appearing, so nothing was blocked) and clicking through both single-card and bulk delete on two disposable throwaway tasks in a live dev-stack session; confirmed both actually deleted server-side (searched for them afterward in the Tasks view — "No tasks match this search") rather than just disappearing from the Archive report.

Re-ran `tsc -b` and the full unit-test suite after these fixes — both still clean/passing. Committed and pushed to `feat-archive-bulk-uncomplete`.

**One implementation deviation from the written Design, recorded per lifecycle step 5:** the Design's "Select all" resolution (in the Response-to-Sneezy section) described adding a new `onSelectAll: () => void` prop threaded from `ArchivePage.tsx` down through `ArchiveBoardGroups.tsx`. Implementation instead calls `useBoardCollapse()` directly in `ArchivePage.tsx` (it's a React context hook, available anywhere inside `BoardCollapseProvider`, not something that has to be prop-drilled) and invokes `setAllCollapsed('archive', boards.map(b => b.board_id), false)` inline in `toggleSelectAll`, guarded by `if (boards)`. Same end behavior (checking "select all" expands every board group), one fewer prop and no changes needed to `ArchiveBoardGroupsProps`.

## Overview

User request (verbatim, four asks, all scoped to the web Archive page — `frontend/src/pages/ArchivePage.tsx`):
1. Bulk un-complete tasks from the Archive page: a checkbox next to each card, plus a "select all" control.
2. Per-card buttons on Archive task cards: un-complete, delete.
3. Archive currently has three pre-defined date-range filter buttons (`this_month`, `last_month`, `last_three_months`); add a fourth, "All".
4. Remove the green checkmark icon currently shown on each Archive card — it signals "this task is complete," which is redundant information on a page that only ever shows completed tasks.

**Scope:** Web frontend only (`frontend/src/`). The mobile app has its own, structurally similar but separate `mobile/src/screens/ArchiveScreen.tsx` + `mobile/src/components/ArchiveBoardGroups.tsx` — confirmed with user this plan does not touch mobile. No backend or data-model changes (see "Data model / API changes" below) — this reuses two endpoints (`POST /tasks/:id/reopen`, `DELETE /tasks/:id`) that already exist and are already wired into the frontend API client (`frontend/src/api/tasks.ts:105-107,119-121`) for a different page (`TaskDetailPage.tsx`).

## Current state (confirmed by reading code)

**`frontend/src/pages/ArchivePage.tsx`** — the Archive page. Fetches a date-ranged, optionally board-scoped completions report via `getCompletions(from, to, options)` (`frontend/src/api/reports.ts:29-41`, calling `GET /reports/completions`). Renders one of two card layouts depending on what the API returns:
- If a specific board is selected (`selectedBoardId !== 'all'`): backend's `all_boards=False` branch (`backend/app/services/reports_service.py:57-61`) returns `{completions, total}` with `boards` omitted. `ArchivePage.tsx` renders this flat list inline (lines 137-169) as plain white cards with no board-color accent — a `<div>` per completion, a title, a "Completed `<date>`" line, and a green checkmark SVG (lines 153-157).
- If "All boards" is selected: backend's `all_boards=True` branch also populates `boards: BoardCompletions[]`, one group per board with `board_id`/`board_name`/`board_color`/`completions`. `ArchivePage.tsx` (line 130) delegates this case to `<ArchiveBoardGroups boards={boards} />`.

Either way, `completions: CompletionRecord[]` (state, set from `result.completions`) always holds the full flat set of every completion currently loaded, regardless of which of the two layouts is rendering — confirmed by reading both backend branches: both construct and return `completions = [_to_completion_item(t) for t in tasks]` from the *same* `tasks` query result (`reports_service.py:59-61` and `:73-92`), just with the all-boards branch additionally grouping the same tasks into `boards`. This matters for the plan below: a single `completions` array is a safe, complete source of "every task_id currently visible" for a "select all" control, independent of which layout is showing.

**`frontend/src/components/ArchiveBoardGroups.tsx`** — renders the board-grouped layout. Defines a local (not exported) `CompletionCard` component (lines 18-47): a `<div onClick={navigate to task detail}>` styled with a `border-l-4` colored by board, containing title, "Completed `<date>`" line, a green checkmark SVG (lines 32-36) — visually identical in intent to the one duplicated inline in `ArchivePage.tsx` — and sorted `LabelBadge`s. `ArchiveBoardGroups` itself (lines 49-94) renders a "Collapse all / Expand all" control (using `BoardCollapseContext`, keyed `'archive'`) and, per board, a header (collapse toggle, board dot, name, completion count) followed by a list of `CompletionCard`s.

**`frontend/src/api/tasks.ts`** — already exports everything this plan needs, no changes required here:
- `reopenTask(id): Promise<Task>` → `POST /tasks/:id/reopen` (lines 119-121).
- `deleteTask(id): Promise<void>` → `DELETE /tasks/:id` (lines 105-107).
Both are already used by `TaskDetailPage.tsx` (`handleReopen` line 153, `handleDelete` line 165), which on failure calls `setError(err instanceof Error ? err.message : '...')` — a page-level error-banner pattern, not `alert()` — and for delete, a `confirm()` guard first (`TaskDetailPage.tsx:167`). `TaskCard.tsx:58` (`if (!confirm('Delete this task?')) return;`) uses the same `confirm()`-before-delete convention but reports failure via `alert(err.message)` instead, since `TaskCard.tsx` has no page-level error-banner state of its own. `ArchivePage.tsx` already has an error banner (`error` state, lines 105-109) — the Design below follows that existing precedent (`setError`) for its new bulk/single-action failures, not `alert()`.

**`frontend/src/utils/dateRangePresets.ts`** — `PresetKey = 'this_month' | 'last_month' | 'last_three_months'`, `PRESET_LABELS` record, and `getPresetRange(preset, referenceDate)` returning `{from, to}` as `YYYY-MM-DD` strings (via `dateOnly`, `frontend/src/utils/taskDateUtils.ts`). `ArchivePage.tsx:21` defines `const PRESETS: PresetKey[] = [...]` and maps it to buttons (lines 73-81) that call `applyPreset(preset)` → `setFrom`/`setTo`.

**Backend contract for the date range** (`backend/app/routers/reports.py:17-18`, `backend/app/services/reports_service.py:27-28`): `from`/`to` are **required** `date` query params (Pydantic `date`, not optional) filtered as `Task.completed_at >= from_date AND Task.completed_at < to_date + 1 day`. There is no "omit the bound" option server-side — an "All" preset must still supply a concrete `from` date, just one early enough to include everything.

## Design

### 1. "All" date preset (`dateRangePresets.ts`, `ArchivePage.tsx`)

Add `'all'` to `PresetKey`, `PRESET_LABELS.all = 'All'`, and a new case in `getPresetRange`:
```ts
case 'all':
  return { from: dateOnly(new Date(2000, 0, 1)), to: dateOnly(referenceDate) };
```
`2000-01-01` is an arbitrary fixed anchor picked to be safely before any task this app could contain (the app itself is far newer) — not derived from any real "app launch date" constant, because no such constant exists in the codebase (confirmed: no `LAUNCH_DATE`/`EPOCH`-style constant found via search). This keeps the "All" preset a pure client-side date-range trick with zero backend change, consistent with how the other three presets work.

`ArchivePage.tsx:21`'s `PRESETS` array becomes `['this_month', 'last_month', 'last_three_months', 'all']` — appended at the end so existing button order/positions for the first three are unchanged.

Add one test case to `frontend/src/__tests__/dateRangePresets.test.ts` (existing file, pure-utility target per `CLAUDE.md`'s frontend-unit-test convention) asserting `getPresetRange('all', REFERENCE)` returns `{from: '2000-01-01', to: '2026-06-15'}` using the file's existing `REFERENCE = new Date(2026, 5, 15)` constant.

### 2. Remove the checkmark (`ArchivePage.tsx`, `ArchiveBoardGroups.tsx`)

Delete the green checkmark `<svg>` block in both locations (`ArchivePage.tsx:153-157` inline flat-list card, `ArchiveBoardGroups.tsx:32-36` inside `CompletionCard`). This space is replaced by the new per-card action buttons in the next section — not left empty.

### 3. Selection state, bulk actions, and per-card buttons

**Consolidate the two card renderers and add the new props in the same change** — read this whole subsection before touching either file; "consolidate" and "add selection/action props" are not two independent, separately-typechecking steps, since the target `CompletionCardProps` shape below already requires `selected`/`onToggleSelect`/`onUncomplete`/`onDelete` as non-optional. Today `ArchivePage.tsx` duplicates `CompletionCard`'s JSX inline (its flat-list branch, lines 137-169) instead of reusing the one already defined in `ArchiveBoardGroups.tsx`. Adding checkbox + button logic to both copies separately would double the surface area for a bug and violates the "don't duplicate" instinct for a ~30-line component. This plan instead:
- Exports `CompletionCard` from `ArchiveBoardGroups.tsx` (currently module-local).
- Gives it an **optional** `color?: string` prop (currently required, always supplied by `ArchiveBoardGroups`). The `border-l-4` class and `style={{ borderLeftColor: color }}` are only applied when `color` is defined — this preserves today's real visual difference between the two layouts (grouped-by-board cards get a color accent stripe; the flat single-board list does not, since the board is already fixed via the tab selector, confirmed by reading `ArchivePage.tsx`'s current inline card, which has no border-left styling at all).
- `ArchivePage.tsx`'s flat-list branch (lines 137-169) is replaced with a `.map` over `completions` rendering `<CompletionCard item={item} selected={...} onToggleSelect={...} onUncomplete={...} onDelete={...} />` (no `color` passed), deleting the duplicated JSX.

**New props on `CompletionCard`:**
```ts
interface CompletionCardProps {
  item: CompletionRecord;
  color?: string;
  selected: boolean;
  onToggleSelect: (taskId: string) => void;
  onUncomplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}
```
Layout: a checkbox is prepended to the card (before the title block), and the checkmark-SVG slot is replaced with two icon buttons — un-complete (indigo, "undo" icon — heroicons-style `arrow-uturn-left` path) and delete (red, "×" icon, reusing the exact path already used for delete in `frontend/src/components/TaskCardBody.tsx:303-305` for visual consistency with the rest of the app). The checkbox drives selection off `onChange={() => onToggleSelect(item.task_id)}` (the real state-changing handler — required so React doesn't emit a "controlled `checked` prop without `onChange`" dev warning) paired with `onClick={(e) => e.stopPropagation()}` on the same `<input>` purely to stop the click from bubbling to the card's `onClick={navigate}`; the two icon buttons call `e.stopPropagation()` inside their own `onClick` handlers. Same propagation-stopping pattern already used for delete/complete buttons in `TaskCardBody.tsx:280-306`.

`onUncomplete`/`onDelete` are per-task callbacks (single id), not bulk — `ArchivePage.tsx` implements them as thin wrappers that reuse the same underlying bulk-action functions with a one-element array (see below), so there is exactly one code path for "reopen these tasks" and one for "delete these tasks," whether triggered from a single card's button or the bulk toolbar.

**`ArchiveBoardGroups.tsx`** itself gains four new pass-through props (`selectedIds: Set<string>`, `onToggleSelect`, `onUncomplete`, `onDelete`) threaded down to each `CompletionCard` it renders — no new state of its own; selection stays fully owned by `ArchivePage.tsx`.

**New state in `ArchivePage.tsx`:**
```ts
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [bulkActionLoading, setBulkActionLoading] = useState(false);
```
- `selectedIds` resets to an empty `Set` whenever `completions` is replaced by a fresh `fetchReport()` call — both on filter changes (existing `useEffect` at line 55-57, already re-running `fetchReport` whenever `from`/`to`/`selectedBoardId` change) and after a bulk/single action completes, so stale ids from a previous filter view can never linger and reference a task_id no longer on screen. This is implemented as a `useEffect([completions])` that clears selection whenever the `completions` reference changes — simpler than threading an explicit "was this a fresh load" flag through `fetchReport`.
- `onToggleSelect(id)`: functional `setSelectedIds` update, add/remove `id` from the `Set`.
- "Select all" checkbox: checked when `completions.length > 0 && selectedIds.size === completions.length`; `onChange` either clears the set or sets it to `new Set(completions.map(c => c.task_id))`. **Collapsed board groups:** `ArchiveBoardGroups.tsx:82-88` only renders a board's `CompletionCard`s (and their checkboxes) when that board isn't collapsed, but `completions` (the source for "select all") is independent of collapse state — so checking "select all" while a board is collapsed would otherwise silently pull in task ids for cards the user never saw or individually toggled, widening the blast radius of a subsequent bulk delete beyond what's on screen. Resolved: when "select all" is checked (not when unchecked), also expand every board — `setAllCollapsed('archive', boards.map(b => b.board_id), false)` (the same function `ArchiveBoardGroups.tsx`'s own "Expand all" button already calls, from `useBoardCollapse()`) — via a new prop, `onSelectAll: () => void`, passed from `ArchivePage.tsx` down through `ArchiveBoardGroups.tsx` only when boards are present (the flat single-board list has no collapse concept). This makes "select all" == "everything currently loaded, made visible" — never a silent hidden-task inclusion.
- `handleReopenIds(ids: string[])` / `handleDeleteIds(ids: string[])`: `setBulkActionLoading(true)` → `try { await Promise.all(ids.map(reopenTask / deleteTask)); await fetchReport(); } catch (err) { setError(...) } finally { setBulkActionLoading(false) }`. Delete path is preceded by `confirm(ids.length === 1 ? 'Delete this task?' : \`Delete ${ids.length} tasks?\`)` — bail out (no state change) if declined, matching the existing single-delete confirm pattern app-wide.
- Per-card `onUncomplete={(id) => handleReopenIds([id])}`, `onDelete={(id) => handleDeleteIds([id])}`. Bulk toolbar buttons call `handleReopenIds([...selectedIds])` / `handleDeleteIds([...selectedIds])`.
- All four action-triggering controls (bulk buttons + implicitly every per-card button, since they call the same underlying functions) respect `bulkActionLoading` by disabling themselves (`disabled={bulkActionLoading}`) to prevent overlapping concurrent `Promise.all` batches if a user double-clicks or fires a per-card action while a bulk action from the toolbar is still in flight.

**New UI row in `ArchivePage.tsx`**, placed between the "Total completions" banner (lines 119-122) and the board-groups/flat-list branch (line 124 onward), rendered only when `!loading && !error && completions.length > 0`:
```
[checkbox] Select all                    [N selected]  [Un-complete] [Delete]
```
The two action buttons only render when `selectedIds.size > 0`. Styling follows the existing rounded-pill button language already used for the date-preset buttons a few lines up (`ArchivePage.tsx:74-81`) for un-complete (indigo, matching `TaskCardBody`'s edit/complete button palette) and delete (red, matching `TaskCardBody`'s delete button palette).

### Error handling

Bulk `Promise.all` means a single failed `reopenTask`/`deleteTask` call rejects the whole batch immediately (fail-fast), surfaced via the existing `error` state / red banner (`ArchivePage.tsx:105-109`) with a message distinguishing bulk from single-item action (e.g. `'Failed to update task(s)'` / `'Failed to delete task(s)'`), matching the existing app-wide convention of a single generic error string rather than per-item partial-failure reporting (no existing bulk-operation UI in this codebase to model partial failure after — `Promise.all`'s fail-fast semantics are the simplest option consistent with everything else in `ArchivePage.tsx`, which already treats `fetchReport` failures the same way). **Known tradeoff, stated explicitly:** if task 3 of 5 fails, tasks 1-2 already succeeded server-side but the UI reports a single failure with no indication which ones went through; the subsequent `fetchReport()` (which does **not** run when a bulk call throws, since it's inside the same `try` after the `Promise.all` line) means the list will still show all 5 as complete until the user manually retries or reloads — acceptable for this app's scale (personal task tracker, small lists) but noted here as a known limitation rather than silently accepted.

## Data model / API changes

None. Reuses `POST /tasks/:id/reopen` and `DELETE /tasks/:id`, both pre-existing and already used elsewhere in the frontend (`TaskDetailPage.tsx`). No new endpoint, no schema change, no new query param on `/reports/completions` — the "All" filter is a pure client-side date-range trick.

## Files to modify

1. `frontend/src/utils/dateRangePresets.ts` — add `'all'` preset.
2. `frontend/src/__tests__/dateRangePresets.test.ts` — add one test case for `'all'`.
3. `frontend/src/components/ArchiveBoardGroups.tsx` — export `CompletionCard`, add checkbox + un-complete/delete buttons, remove checkmark, make `color` optional, thread selection/action props through `ArchiveBoardGroups`.
4. `frontend/src/pages/ArchivePage.tsx` — add `'all'` to `PRESETS`, add selection state + bulk handlers + toolbar row, replace duplicated inline flat-list card JSX with the now-exported `CompletionCard`.

None of these fall under `ARCHITECTURE.MD`'s model/schema/router/API-contract areas (confirmed by reading `ARCHITECTURE.MD`'s Code Structure section) — all four are frontend component/utility files.

## Test plan

- New unit test case for `getPresetRange('all', ...)` in `dateRangePresets.test.ts`, per `CLAUDE.md`'s convention that frontend unit tests target pure utility functions.
- No backend change → no integration test changes, and that file is Sleepy-owned regardless (not touched directly).
- No new unit test for the selection/bulk-action wiring itself — component interaction state, not a pure utility, consistent with how `PLAN-feat-clickable-card-date.md` (a similar recent card-interaction change) scoped its own test plan.
- Manual verification in-browser (dev server) before calling this done:
  - "All" button sets the date range wide enough to show every completed task across boards; the other three presets still produce their existing ranges unchanged.
  - Checkmark icon no longer appears on any Archive card, in both single-board and all-boards layouts.
  - Checking individual card checkboxes updates a running "N selected" count and reveals the bulk toolbar; unchecking back to zero hides it.
  - "Select all" selects every card currently on screen (across all board groups, not just one), and re-clicking it clears the selection.
  - Per-card "un-complete" button reopens that one task (card disappears from Archive, task reappears on its board in the Board view) without needing a page reload.
  - Per-card "delete" button prompts a confirm dialog; confirming removes the task entirely (verify it's gone from `GET /tasks` too, not just Archive); cancelling leaves it untouched.
  - Bulk "Un-complete" reopens every selected task in one action; bulk "Delete" prompts one confirm covering the whole batch, then removes all selected tasks.
  - Selection resets after changing the date range or board tab, and after any bulk/single action completes (no stale checked-but-now-invisible ids).
  - Clicking a checkbox or an action button never navigates to the task detail page (verifies `stopPropagation` wiring).

## Deployment order

Single component: frontend-only (`frontend/src/**`). Per `CLAUDE.md`, frontend changes always trigger a Railway deploy — no `[skip deploy]` tag on commits touching these files.

## Risks

- `Promise.all` fail-fast partial-failure behavior on bulk actions (see "Error handling" above) — accepted tradeoff for this app's scale, not mitigated further in this plan.
- Selecting "All" and then bulk-deleting is a wide-blast-radius action (potentially every completed task the user has ever had) gated only by a single `confirm()` dialog with a count in it — consistent with this app's existing single-task delete confirm pattern, no additional safeguard (e.g. typed confirmation) is planned unless the user asks for one.
- `CompletionCard`'s `color` prop becoming optional is a widening (backward-compatible) change to an already-narrow, locally-scoped component — low risk of an unrelated call site being affected, since `grep` confirms `ArchiveBoardGroups.tsx` is the only file currently defining or importing this component.

---

## Sneezy's Review — 2026-08-15

**Tier:** LIGHT — confirmed correct. All four "Files to modify" are frontend component/utility files (no model/schema/router/API-contract area touched), the plan declares no data-model/API changes, and deployment is genuinely single-component (frontend-only). Spot-checked `backend/app/routers/reports.py:17-18` and `backend/app/services/reports_service.py` directly (read in full, not just trusted from the plan's description) to confirm the backend really is being read-only referenced, not modified, and that the `from`/`to`-required-date-params claim holds. Not escalated.

I re-verified essentially every line-number citation in this plan against the actual current files (`ArchivePage.tsx`, `ArchiveBoardGroups.tsx`, `tasks.ts`, `dateRangePresets.ts`, `dateRangePresets.test.ts`, `reports.ts`, `TaskCardBody.tsx`, `TaskCard.tsx`, `TaskDetailPage.tsx`, `reports_service.py`, `reports.py`). This plan's line-number and code-content citations are unusually accurate — every one checked out exactly as described, including the more obscure ones (`reports_service.py:27-28`'s filter predicate, `reports.ts:29-41`'s function span, the exact checkmark SVG block spans in both card renderers). That level of diligence is worth noting explicitly since it's the exception, not the rule.

### Issues

1. **[Gap]** Select-all's scope versus collapsed board groups is never addressed. `ArchiveBoardGroups.tsx:82-88` only renders a board's `CompletionCard`s when `!collapsed` — a collapsed board's cards (and their per-card checkboxes) aren't in the DOM at all. But the plan's "select all" (line 88) operates over the full `completions` array regardless of collapse state: `new Set(completions.map(c => c.task_id))`. So checking "select all" while one or more boards are collapsed adds task ids to `selectedIds` for cards the user cannot see and never individually toggled — and the bulk toolbar's "Un-complete"/"Delete" buttons would then act on those hidden tasks too. The plan's own test-plan line 125 ("'Select all' selects every card currently on screen") is not accurate in this scenario — it selects every *loaded* card, not every *visible* one. Given Risk #2 in this same plan already flags "select all + bulk delete" as a wide-blast-radius action gated only by a `confirm()`, this interaction (silently including collapsed-away tasks in that blast radius) deserves an explicit design answer — e.g. expand all collapsed boards when "select all" is checked, or exclude collapsed-board task ids from the set, or simply state that "select all" is intentionally collapse-independent and note it in the confirm dialog copy.
2. **[Nit]** `frontend/src/components/TaskDetailPage.tsx` (Current state, line 32) is mischaracterized. The plan attributes "the established error-handling convention: try/catch, `alert(err.message)` on failure" jointly to `TaskDetailPage.tsx:153/165` and `TaskCard.tsx:58`. I read `TaskDetailPage.tsx:145-175` directly: `handleReopen`/`handleDelete` there use `setError(err instanceof Error ? err.message : '...')` plus `setSaving(false)` — a page-level error-banner pattern, not `alert()`. Only `TaskCard.tsx` (and, per this plan's own Design, the new `ArchivePage.tsx` bulk handlers) actually call `alert()`. This doesn't affect the plan's actual design — Design > "Error handling" correctly has `ArchivePage.tsx` use its existing `setError`/banner pattern, matching `ArchivePage.tsx`'s own precedent rather than `TaskDetailPage.tsx`'s — but the "Current state" claim as written is factually wrong about what convention `TaskDetailPage.tsx` follows.
3. **[Nit]** The controlled checkbox design (`selected: boolean` prop driving `checked={selected}`, toggled via `onClick` per line 75) will produce a React dev-console warning ("You provided a `checked` prop to a form field without an `onChange` handler") unless an `onChange` (even a no-op) or `readOnly` is also supplied — React requires one of those on any input with a controlled `checked`/`value` prop, regardless of which handler actually drives the state change. Functionally the checkbox will still end up in the right state (the click handler updates `selectedIds`, which flows back down as a new `checked` value on re-render), but the console warning isn't mentioned and would show up in every dev session touching this page. Trivial fix, just worth stating.
4. **[Nit]** Internal sequencing ambiguity in "Selection state, bulk actions, and per-card buttons" (lines 57-91): the "Consolidate the two card renderers first" bullet (line 62) shows `<CompletionCard item={item} />` with no other props, but the very next subsection's `CompletionCardProps` interface (lines 65-74) makes `selected`, `onToggleSelect`, `onUncomplete`, and `onDelete` non-optional. If a fresh implementer follows the plan's own ordering literally (consolidate first, add selection second), the intermediate state won't type-check. Almost certainly intended as "read both subsections before touching code, implement together" rather than two literal sequential steps, but worth one clarifying sentence given this plan is meant to be resumable by a session with zero prior context.

### Unverified assumptions

- None remaining unverified — the two explicit "confirmed by search" claims in the plan (no `LAUNCH_DATE`/`EPOCH`-style constant in the codebase; `ArchiveBoardGroups.tsx` is the only file defining/importing `CompletionCard`) were independently re-run via `grep -rn "LAUNCH_DATE\|EPOCH" frontend/src` and `grep -rln "CompletionCard" frontend/src` — both hold exactly as claimed.
- All cited line numbers and code excerpts across `ArchivePage.tsx`, `ArchiveBoardGroups.tsx`, `tasks.ts`, `dateRangePresets.ts`, `dateRangePresets.test.ts`, `reports.ts`, `reports_service.py`, `reports.py`, `TaskCardBody.tsx`, `TaskCard.tsx`, and `TaskDetailPage.tsx` were checked against the current files and are accurate, with the one content (not line-number) exception noted in Issue 2.
- `dateOnly()`'s implementation (`taskDateUtils.ts:5-10`) was checked directly: it builds `YYYY-MM-DD` from local `getFullYear()`/`getMonth()`/`getDate()`, no UTC conversion — so the plan's proposed `'all'` test assertion (`{from: '2000-01-01', to: '2026-06-15'}` against the existing `REFERENCE` constant) is correct and not at risk of a timezone off-by-one.

### Suggestions

- Add one sentence to the "Select all" bullet stating the intended behavior when boards are collapsed (expand-and-select, exclude-hidden, or explicitly collapse-independent-by-design) — closes Issue 1 without needing new code beyond a decision.
- Add `onChange={() => {}}` (or `readOnly` if `onClick` remains the sole driver) to the checkbox to preempt the React console warning in Issue 3.
- Reword the `TaskDetailPage.tsx` sentence in "Current state" to describe its actual `setError`-based pattern rather than attributing `alert()` to it, since the plan already correctly designs `ArchivePage.tsx`'s own error handling around `setError`/banner, not `alert()` — fixing the sentence would remove a claim that doesn't match either the cited file or the plan's own downstream design.

— *Sneezy*

---

## Response to Sneezy's Review (Grumpy, 2026-08-15)

User approved implementation with these resolutions; each is folded into the Design/Current-state sections above and confirmed here per DEVELOPMENT PLAN LIFECYCLE step 4:

1. **[Gap] Select-all scope vs. collapsed board groups** — **Addressed.** Design > "New state in `ArchivePage.tsx`" now specifies that checking "select all" also expands every board group (`setAllCollapsed('archive', boards.map(b => b.board_id), false)`, via a new `onSelectAll` prop threaded through `ArchiveBoardGroups.tsx`), so the selection set can never include cards the user hasn't seen.
2. **[Nit] `TaskDetailPage.tsx` mischaracterized** — **Addressed.** "Current state" now correctly describes `TaskDetailPage.tsx`'s `setError`/banner pattern instead of attributing `alert()` to it, and explicitly notes `ArchivePage.tsx`'s Design follows its own existing `setError`/banner precedent, not `TaskCard.tsx`'s `alert()` pattern.
3. **[Nit] Checkbox console warning** — **Addressed.** Design > "New props on `CompletionCard`" now drives selection off `onChange={() => onToggleSelect(item.task_id)}` (the real state-changing handler) with `onClick={(e) => e.stopPropagation()}` on the same input purely to stop bubbling — no controlled-without-`onChange` warning.
4. **[Nit] Sequencing ambiguity** — **Addressed.** The "Consolidate the two card renderers" subsection now opens by stating consolidation and the new selection/action props are implemented together, not as two independently-typechecking steps, and the example JSX now shows the full prop set.
