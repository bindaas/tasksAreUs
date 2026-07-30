# PLAN-fix-all-view-ux-polish

## Branch
`fix-all-view-ux-polish`, cut from up-to-date `main` (PR #56 / `feat-search-all-views` is already merged — do not stack on it).

## Scope
Nine small UX polish items on the web Tasks page (All-view kanban primarily, one item touches search positioning "across all screens"). **Frontend-only** (`frontend/src/`). No backend, API, or data-model changes. Single-component deploy (frontend build only).

## Background / current behavior
- `TasksPage.tsx` renders the All-view kanban (`COLUMNS` computed from `taskDateUtils`), the label filter-chip row, and the search box.
- `TaskCard.tsx` renders each task card, delegating to shared `TaskCardBody.tsx` and `TaskQuickEdit.tsx` (inline pencil-icon edit).
- `BoardCollapseContext.tsx` is an existing, already-shipped pattern for making per-board collapse state survive navigation: a context provider mounted **above** `BrowserRouter` in `App.tsx`, so its state isn't lost when a page unmounts (e.g., navigating to `/tasks/:id` and back). This plan reuses that exact pattern for item 1.

## Items and fixes

### 1. Sticky high-priority collapse state
- **Problem:** `collapsedPriorityByColumn` (state + `togglePriorityCollapse`) lives in local `useState` inside `TasksPage.tsx` (lines ~59, 258-263). Navigating to `/tasks/:id` unmounts `TasksPage`, resetting it.
- **Fix:** New file `frontend/src/context/ColumnPriorityCollapseContext.tsx`, mirroring `BoardCollapseContext.tsx`'s shape but keyed only by `ColumnKey` (no per-view dimension needed — this only applies to the All view):
  ```ts
  interface ColumnPriorityCollapseContextValue {
    isCollapsed: (columnKey: ColumnKey) => boolean;
    toggleColumn: (columnKey: ColumnKey) => void;
  }
  ```
  Backed by `useState<Partial<Record<ColumnKey, boolean>>>({})`.
- Mount `<ColumnPriorityCollapseProvider>` in `App.tsx` alongside `BoardCollapseProvider` (same nesting level, above `BrowserRouter`).
- In `TasksPage.tsx`: replace the local `collapsedPriorityByColumn` state and `togglePriorityCollapse` function with `useColumnPriorityCollapse()`; replace all `collapsedPriorityByColumn[col.key]` reads with `isCollapsed(col.key)` and the toggle call site with `toggleColumn(col.key)`.

### 2. Count next to "High Priority"
- `TasksPage.tsx` ~line 453: change `<span ...>High Priority</span>` to include the live count: `High Priority ({highTasks.length})`. Leave the existing separate `⚠ {highTasks.length}/{highPriorityDailyLimit} high` warning badge in the column header untouched — that's a distinct "over limit" indicator, not the same UI element.

### 3. Remove "tag" word next to tag list
- `TasksPage.tsx` ~lines 327-330: the filter-chip row currently renders a `<span>{CATEGORY_DISPLAY_NAMES[cat]}</span>` ("Tags") to the left of the chips, with `w-16 shrink-0` reserved for it. Remove that span and the now-unnecessary width reservation; the chip row's `justify-end` alignment is preserved. `CATEGORY_DISPLAY_NAMES` becomes dead for this render path — check whether it's still used elsewhere in the file before deleting the constant entirely (it's currently only used at this one call site in `TasksPage.tsx`; a separate, distinct copy in `TaskForm.tsx` is unaffected and out of scope).

### 4. Right-align "Clear filters"
- `TasksPage.tsx` ~lines 348-355: the `<button onClick={clearLabels}>Clear filters</button>` sits directly in the `space-y-2` column div with no alignment wrapper, so it defaults left. Wrap it in a `<div className="flex justify-end">`.

### 5. Search box to the top, across all screens
- Currently the search `<div className="flex justify-end mb-3">` block renders *inside* the `overdueChecked` conditional, **after** the title/view-toggle header block (~line 300, after the header at ~line 268-292).
- Fix: move the search box markup to render first, before the "Header" block, so it's the topmost element under `<div className="p-4">`. It does not depend on `overdueChecked` (it's just local input state), so it can render unconditionally — this also means it stays visible/stable while the one-time overdue check is still in flight, instead of popping in afterward.
- No change to the search box's own styling/alignment, box logic, or the views it applies to (already threaded to `FocusedView`/`DayView`/All-view via `searchQuery` per PR #56) — purely a position/order change.

### 6. Reserve 2 rows for tags in All-view cards
- **Problem:** `TaskCard.tsx`'s `renderLabels` render-prop (~lines 73-84) returns `null` when a task has no labels, and otherwise renders a `flex flex-wrap` row with no fixed height. Depending on how many labels a task has, the row is 0, 1, or 2 lines tall. Since the All view shows one board's tasks at a time (via `BoardTabs`) and different boards' tasks have different label counts, switching boards changes each card's height inconsistently, causing the kanban columns to visibly jump.
- **Fix:** always render the label container (remove the `null` short-circuit for zero labels) and give it a `min-height` sized for exactly 2 rows of `LabelBadge` chips (`text-xs px-1.5 py-0.5` chips, `gap-1` between rows) — e.g. `min-h-[2.75rem]` (~44px: two ~20px chip rows + ~4px gap), applied via an added class on the existing `<div className="flex flex-wrap gap-1 mt-2 ...">`. Exact value to be confirmed visually during implementation/testing (browser check against real chip rendering), not hard-committed to 2.75rem sight-unseen.
- Scope check: this only touches `TaskCard.tsx` (All view). `FocusedTaskCard.tsx` (Focused/Today/Tomorrow, via `BoardGroupedTasks.tsx`) is a separate component not mentioned in this request and is out of scope.

### 7 + 8. Date on its own line below Today/Tomorrow/etc., abbreviated day
- **Problem:** `taskDateUtils.formatDateWithDay()` returns a single string like `"July 29, Tuesday"` (full weekday), which `TasksPage.tsx`'s `COLUMNS` memo (~lines 87-102) concatenates directly into the column title: `` `Today (${formatDateWithDay(today)})` ``. This single string is rendered as one `<span>` in both column-header JSX blocks (priority columns ~line 428, non-priority columns ~line 553).
- **Fix:**
  1. `taskDateUtils.ts`: change `formatDateWithDay`'s `weekday: 'long'` → `'short'` (e.g. "Wed" instead of "Wednesday"). Month stays as currently formatted (`long`) — the request only calls out abbreviating the *day*, not the month; if that reads as too wide once implemented, flag it rather than silently also abbreviating the month.
  2. `TasksPage.tsx`: restructure the `COLUMNS` memo so each entry carries `{ key, title, dateLabel? }` instead of a single pre-concatenated `title` string. Applies to **all** date-bearing entries, not just `today`: `today`, `tomorrow`, `day_after_tomorrow`, and `monday` each get `{ title: '<Name>', dateLabel: formatDateWithDay(...) }`; `upcoming` and `nodate` keep `title` only (no `dateLabel`). The `day_after_tomorrow` entry's IIFE (currently computes `dat` and returns one concatenated string) is restructured to return `{ title: 'Day After Tomorrow', dateLabel: formatDateWithDay(dateOnly(dat)) }` instead of a string.
  3. Update both column-header JSX blocks to render `title` and, when present, `dateLabel` as a second line underneath (e.g. a `<span className="block text-xs text-gray-400 font-normal">{col.dateLabel}</span>` under the existing bold title span), instead of one combined string.

### 9. Alphabetize tags in Task List quick-edit
- **Problem:** `TaskQuickEdit.tsx` (~lines 93-97) renders `labelsByCategory[cat]` directly in whatever order labels were fetched/passed in (creation order) — unlike `TasksPage.tsx`'s own filter-chip row, which already does `.slice().sort((a, b) => a.value.localeCompare(b.value))`.
- **Fix:** apply the same sort to `catLabels` before mapping over it in `TaskQuickEdit.tsx`.

## Files to modify
- `frontend/src/context/ColumnPriorityCollapseContext.tsx` (new)
- `frontend/src/App.tsx` (mount new provider)
- `frontend/src/pages/TasksPage.tsx` (items 1, 2, 3, 4, 5, 7, 8)
- `frontend/src/utils/taskDateUtils.ts` (item 8)
- `frontend/src/components/TaskCard.tsx` (item 6)
- `frontend/src/components/TaskQuickEdit.tsx` (item 9)

## Data model changes
None.

## API / contract changes
None.

## Test changes
- No changes to `backend/tests/test_api.py` (backend untouched, owned by `/test-review` anyway).
- Frontend unit tests (`frontend/src/__tests__/taskDateUtils.test.ts`, Vitest): update the three `formatDateWithDay` regex assertions (lines 186, 191, 196) from full weekday names to abbreviated ones — `/July.*27.*Monday/` → `/July.*27.*Mon\b/`, `/July.*28.*Tuesday/` → `/July.*28.*Tue\b/`, `/August.*1.*Saturday/` → `/August.*1.*Sat\b/`. No new pure-utility logic is introduced beyond this.

## Deployment
Single component (frontend only). No staggered/backward-compat concerns — no API contract changes, no mobile files touched.

## Manual verification plan
Run the app locally (`/run` skill), then in the browser:
1. Collapse a column's high-priority zone in All view, navigate to a task's edit page and back — confirm it's still collapsed.
2. Confirm "High Priority (n)" shows the live count per column.
3. Confirm the "Tags" word is gone above the filter chips, chips still right-aligned.
4. Confirm "Clear filters" is right-aligned under the chips.
5. Confirm the search box is the topmost element on Focused/Today/Tomorrow/Overdue/All.
6. Switch boards via BoardTabs in All view; confirm column/card heights no longer jump between boards with differing tag-row counts.
7. Confirm column headers show e.g. "Today" / "Jul 29, Tue" on two lines with abbreviated day.
8. Open a task's inline quick-edit in the All view and confirm tag buttons are alphabetically ordered.

---

## Sneezy's Review — 2026-07-29

**Tier:** LIGHT — no proposed file falls under a model/schema/router/API-contract area; plan declares no data-model changes and single-component (frontend-only) deployment. Confirmed on inspection: all six files to modify are under `frontend/src/`, none touch backend/app or schema/router code. No escalation to FULL.

**Verdict:** Approved with concerns

### Issues
1. **[Gap] Test coverage** — `frontend/src/__tests__/taskDateUtils.test.ts` lines 183-198 (`describe('formatDateWithDay', ...)`) contains three tests that assert the **full** weekday name via regex:
   - line 186: `expect(result).toMatch(/July.*27.*Monday/)`
   - line 191: `expect(result).toMatch(/July.*28.*Tuesday/)`
   - line 196: `expect(result).toMatch(/August.*1.*Saturday/)`

   The plan's "Test changes" section hedges with "check whether `formatDateWithDay`'s weekday format is asserted anywhere and update the expected string." It is asserted, and item 8's fix (`weekday: 'long'` → `'short'`) will break all three tests — `"Mon"`/`"Tue"`/`"Sat"` do not satisfy a regex requiring the literal substring `"Monday"`/`"Tuesday"`/`"Saturday"`. This is a confirmed, not a hypothetical, required change. The plan should commit to updating these three assertions (e.g. to `/July.*27.*Mon\b/` or an exact string check) as part of item 8, not leave it as an open question to "re-check once Sneezy's review lands."

2. **[Gap] Item 7/8 scope on `COLUMNS`** — the plan's restructuring example only spells out the `today`/`upcoming` shapes. Three other entries need the same `{title, dateLabel}` split and aren't mentioned individually: `tomorrow` (TasksPage.tsx:91), `monday` (line 97), and especially `day_after_tomorrow` (lines 92-96), which today computes its label via an IIFE that both derives a date **and** concatenates the string in one step:
   ```ts
   { key: 'day_after_tomorrow' as const, title: (() => {
       const dat = new Date(tomorrow + 'T00:00:00');
       dat.setDate(dat.getDate() + 1);
       return `Day After Tomorrow (${formatDateWithDay(dateOnly(dat))})`;
     })() },
   ```
   Splitting this into `{ title: 'Day After Tomorrow', dateLabel: formatDateWithDay(dateOnly(dat)) }` requires restructuring the IIFE to return an object (or hoisting the `dat` computation out) rather than a plain string. Not a blocker — it's a natural extension of the stated pattern — but worth calling out explicitly since it's the one entry with materially more logic than the `today` example implies.

3. **[Nit] Item 5's actual reach** — the in-code comment at TasksPage.tsx:300 currently reads "Search box — all views, directly above the board-tabs row," but the plan's fix moves the search box above the **entire** Header block (page title + view-mode toggle), not just above board tabs. That is a bigger reorder than "search box to the top" might suggest on first read — the search input will sit above "Tasks Are Us - {view}" itself. The plan is internally consistent about this (manual verification step 5 confirms "topmost element under `<div className="p-4">`"), so this is not a correctness problem, just a note that the change is more visually prominent than the one-line item summary implies.

### Unverified assumptions
- None outstanding. Every line-number reference in the plan was checked against the current file contents and found accurate:
  - `TasksPage.tsx`: lines 59, 258-263 (item 1), 453 (item 2), 327-330 (item 3), 348-355 (item 4), ~300/268-292 (item 5), 87-102/428/553 (items 7-8) all match verbatim.
  - `TaskCard.tsx` lines 73-84 (item 6) match verbatim, including the exact target div (`className="flex flex-wrap gap-1 mt-2"`).
  - `TaskQuickEdit.tsx` lines 93-97 (item 9) match verbatim.
  - `taskDateUtils.ts`'s `formatDateWithDay` (item 8) matches the described `"Month Day, Weekday"` format exactly.
  - `CATEGORY_DISPLAY_NAMES` in `TasksPage.tsx` is confirmed used at exactly one call site (line 329) in that file; the separate copy in `TaskForm.tsx` (line 31/360) is confirmed distinct and unaffected.
  - `FocusedTaskCard.tsx` (used via `BoardGroupedTasks.tsx`) is confirmed to have its own independent `renderLabels` closure (not shared with `TaskCard.tsx`), so the item 6 scope-exclusion claim holds.
  - `TaskCardBody.tsx` calls `renderLabels(task.labels)` unconditionally in both its `'stacked'` (line 156) and default/`'inline'` (line 171) branches, which are mutually exclusive per render — confirmed no double-render risk from removing the `null` short-circuit in item 6.
  - No other file in `frontend/src/` references `collapsedPriorityByColumn` or `togglePriorityCollapse` (grep confirmed) — the item 1 refactor is self-contained to `TasksPage.tsx` as the plan assumes.
  - No component/DOM-level tests exist for `TasksPage.tsx`, `TaskCard.tsx`, or `TaskQuickEdit.tsx` (only pure-utility tests exist in `__tests__/`, consistent with this project's convention of unit-testing `utils/` only) — so items 1-6 and 9 carry no test-breakage risk beyond the one confirmed in Issue 1.

### Suggestions
- Since Issue 1 is now confirmed rather than speculative, fold the exact updated assertions into the plan's "Test changes" section before implementation, so the pre-implementation checklist's "Test changes needed" line can name the file and tests directly instead of "will re-check."
- Consider a one-line note in item 6 acknowledging that `FocusedTaskCard.tsx` has the same zero-labels/no-fixed-height pattern and could see the same board-switch height jump in Focused/Today/Tomorrow views — even though it's correctly out of scope for this plan, flagging it as a known follow-up avoids it looking like an oversight later.

— *Sneezy*

## Grumpy's response — 2026-07-29

- **Issue 1 (test coverage):** Addressed. "Test changes" section above now names the exact 3 assertions and their updated regex.
- **Issue 2 (COLUMNS scope):** Addressed. Item 7/8's fix section now explicitly covers `tomorrow`, `day_after_tomorrow`, and `monday`, including the IIFE restructuring for `day_after_tomorrow`.
- **Issue 3 (nit, item 5 reach):** Acknowledged, no plan change needed — the bigger reorder (search above the page title) is intentional and matches the user's literal ask ("move to the top — across all screens").
- **Suggestion (FocusedTaskCard follow-up):** Noted as a known out-of-scope follow-up, not implemented here — `FocusedTaskCard.tsx`/`BoardGroupedTasks.tsx` untouched by this plan.

User approved proceeding. Implementation begins now on branch `fix-all-view-ux-polish`.
