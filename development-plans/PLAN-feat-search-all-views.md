# PLAN-feat-search-all-views

## Scope

The existing task search box (title + notes, client-side, All-view-only) gets extended and repositioned, and the tag-chip row gets a style tweak:

1. Search filters tasks in **Overdue / Focused / Today / Tomorrow** views too, not just All.
2. The search box moves from the header row (next to the view-toggle buttons) to a new row **directly above the board-tabs row**.
3. The tag/label filter chip row is **right-aligned**, matching `BoardTabs`'s `justify-end`.
4. Tag chips render in **alphabetical order** by `label.value`.
5. **Mobile only** (`mobile/src/screens/TasksScreen.tsx`): the view-mode pill row (Overdue/Focused/Today/Tomorrow/All), the Collapse/Expand toggle, and the filter toggle (☰) currently share the header row with the screen title ("Tasks Are Us - <view>"), competing for width — the rightmost "All" pill is pushed fully off-screen. (`BoardTabs` is not part of this problem — it already renders in its own row below the header.) Move the pill row + Collapse/Expand + filter toggle to a new row below the title so the pills get the full screen width.
6. **Web All-view kanban, high-priority zone divider** (`frontend/src/pages/TasksPage.tsx`): three fixes to the "High Priority" collapse strip inside each priority-eligible column (Today/Tomorrow/Day After Tomorrow/Monday/Overdue):
   - Swap the collapse/expand icon from a vertical chevron/arrow to a triangle.
   - Make the **entire strip** (not just the small icon button) clickable to toggle collapse — bigger, easier hit target.
   - Fix a real date bug: the "Day After Tomorrow" column header shows the **same date as "Tomorrow"** instead of tomorrow+1.
   - Fix the same-shaped sibling bug in the Friday-only "Monday" column header, which currently shows Sunday's date.

No backend or API changes. Three components touched (frontend web ×2 unrelated fixes + mobile), each deployed independently through its own channel — see Deployment below.

## Current behavior (verified by reading the code)

- `frontend/src/utils/taskFilters.ts` — `filterTasks(tasks, selectedLabelIds, searchQuery)` matches `task.title` and `task.notes` (case-insensitive substring). Used only by the All view's kanban board in `TasksPage.tsx`.
- `TasksPage.tsx` renders the search `<input>` only when `viewMode === 'all'` (line ~290), inside the header row next to the view-toggle buttons.
- `BoardTabs` (used only in All view) uses `flex justify-end` — right-aligned.
- The tag-chip row (`CATEGORIES.map(...)` in `TasksPage.tsx`, All-view-only) uses `flex flex-wrap gap-1.5 items-center` — left-aligned — and renders `labelsByCategory[cat]` in whatever order `useLabels`'s `listLabels` API call returns (no sort).
- `Overdue`/`Today`/`Tomorrow` views render via `<DayView referenceDate=... viewKey=... />`, `Focused` via `<FocusedView />`. Both fetch `{ boards: FocusedBoard[] }` where `FocusedBoard.tasks: Task[]` are full `Task` objects (including `notes`) grouped by board, and both delegate rendering to the shared `BoardGroupedTasks` component. Neither currently accepts or applies a search query.
- `TaskForm.tsx` and `TaskQuickEdit.tsx` each build their **own** local `labelsByCategory` from `labels` (not the `useLabels` hook's grouped output) — sorting inside `useLabels` would not reach them, and they're out of scope here anyway.
- `mobile/src/screens/TasksScreen.tsx` (lines ~645-718) — the header is a single `<View className="px-4 pt-2 pb-2">` containing one `flex-row items-center justify-between` row with: the title `Text`, then a `flex-row` cluster holding (in order) the Collapse/Expand text button (All view only), the `pillModes` view-toggle row, the filter toggle (☰, All view only), and the `+` create button. `BoardTabs` renders in a second, separate row below that (`viewMode === 'all'` only) — already positioned correctly, not part of the problem. The collapsible search+chips filter panel (`filterOpen && (...)`) is a fully separate `<View>` below the header, already unaffected by the cramped-row issue.
- `TasksPage.tsx` lines 434-446 — the "High Priority" zone header inside each priority-eligible kanban column is an orange strip (`<div className="px-2 py-1 flex items-center gap-1.5 bg-orange-100 border-b border-orange-200">`) containing a `<button onClick={() => togglePriorityCollapse(col.key)}>` that wraps **only** a chevron `<svg>` (path `M19 14l-7-7m0 0L5 14m7-7v12`, a vertical up-arrow that rotates 180° when collapsed) — the adjacent `<span>High Priority</span>` text sits outside the button and is not clickable.
- `TasksPage.tsx` lines 86-101 (`COLUMNS`) — the `day_after_tomorrow` column title is computed as `const dat = new Date(tomorrow); dat.setDate(dat.getDate() + 1); ...formatDateWithDay(dateOnly(dat))`, where `tomorrow` is a plain `YYYY-MM-DD` string. `new Date(tomorrow)` (no time component) parses per the ISO-8601 spec as **UTC midnight**, not local midnight — in any timezone behind UTC, converting that back to local time lands on the *previous* local day, so `dat.getDate()` (a local-time accessor) already reads one day short before `+1` is applied, and the final result equals `tomorrow`'s date instead of `tomorrow + 1`. This is exactly the bug the user is seeing (Day After Tomorrow shows the same date as Tomorrow). The rest of the codebase avoids this: `taskDateUtils.ts`'s `getColumn` (line 57) and `getDropDate` build the day-after-tomorrow date via `new Date(tomorrow + 'T00:00:00')` / `new Date(now)` (an already-local `Date` object) respectively — both sidestep the UTC-parse pitfall.
- `TasksPage.tsx` lines 79-84 (the `monday` `useMemo`, used only when `isFridayToday`) has the **identical bug**, plus a second, independent off-by-one: `const m = new Date(tomorrow); m.setDate(m.getDate() + 1); return dateOnly(m);` — same unsuffixed `new Date(tomorrow)` UTC-parse issue, and even ignoring that, it only advances `tomorrow` by one day (giving Sunday) where Monday requires two (Friday's `tomorrow` = Saturday, +2 = Monday). `getColumn`'s own Friday branch (`taskDateUtils.ts` lines 61-65) and `getDropDate`'s `monday` branch (lines 86-90, `now + 3`) both compute the correct date independently, so — same as `day_after_tomorrow` — this is a **display-only** bug; task bucketing into the Monday column is already correct.

## Changes

### `frontend/src/utils/taskFilters.ts`
- Extract the title/notes predicate into `matchesSearch(task: Task, query: string): boolean` (lowercased, trimmed query in, same two fields).
- `filterTasks` uses `matchesSearch` internally — no behavior change for All view.
- Add `filterBoards(boards: FocusedBoard[], searchQuery: string): FocusedBoard[]`: for a non-empty trimmed query, maps each board's `tasks` through `matchesSearch` and drops any board left with zero tasks; empty/whitespace query returns `boards` unchanged (reference equality preserved, matching `filterTasks`'s existing whitespace-only-query behavior).

### `frontend/src/components/BoardGroupedTasks.tsx`
- Accept an optional `searchQuery?: string` prop (default `''`).
- Apply `filterBoards(boards, searchQuery)` and derive `allCollapsed`/render from the **filtered** result, not the raw `boards` prop.
- If the filtered result is empty (i.e., the raw `boards` prop was non-empty but the search excluded everything), return the empty-state block (message **"No tasks match this search"**, same visual pattern as the existing DayView/FocusedView empty states) as the component's **entire** output — this gates the "Collapse all"/"Expand all" toggle too, so it never renders pointing at nothing. (Addresses Sneezy's Gap finding below.)

### `frontend/src/components/DayView.tsx` / `FocusedView.tsx`
- Accept `searchQuery?: string` prop, pass through unchanged to `<BoardGroupedTasks searchQuery={searchQuery} ... />`.
- No change to their own top-level empty states (`boards.length === 0` from the raw fetch) — those stay about "no data fetched," independent of search.

### `frontend/src/pages/TasksPage.tsx`
- Remove the search `<input>` block from the header row (no longer gated by `viewMode === 'all'`).
- Add a new row, rendered once `overdueChecked` is true (regardless of `viewMode`), positioned immediately before the `{viewMode === 'all' && <BoardTabs ... />}` line — right-aligned (`flex justify-end`), containing the same search input markup as today, with `mb-3` (consistent gap whether it sits directly above `BoardTabs`'s `mb-4` in All view, or directly above the `DayView`/`FocusedView` content in the other views). (Addresses Sneezy's Nit finding below.) In non-All views this row stands alone (BoardTabs still only renders in All view); in All view it sits directly above BoardTabs.
- Pass `searchQuery` into the three `<DayView ... />` call sites (overdue/today/tomorrow) and into `<FocusedView />`.
- Sort `catLabels` alphabetically at the render site: `((labelsByCategory[cat] ?? []) as Label[]).slice().sort((a, b) => a.value.localeCompare(b.value))`. Scoped to this one render location — `useLabels`, `TaskForm`, and `TaskQuickEdit` are untouched.
- Add `justify-end` to the tag-chip row's className (`flex flex-wrap gap-1.5 items-center justify-end`).

### Mobile: `mobile/src/screens/TasksScreen.tsx`
- Split the current single header row into two:
  - **Row 1** (unchanged position): the title `Text` and the `+` create-task button only, still `flex-row items-center justify-between`. (Confirmed with the user: `+` stays top-right/thumb-reachable; everything else moves down.)
  - **Row 2** (new, `mt-2`): a `flex-row items-center justify-between` containing the `pillModes` view-toggle row on the left, and — All view only — the Collapse/Expand text button and the filter toggle (☰) grouped on the right, in their existing order.
- `BoardTabs` keeps rendering as its own row below that (All view only, `mt-2`) — unchanged, already correctly separated from the title.
- The collapsible search+chips filter panel (`filterOpen`) is untouched — it already renders below the header as its own section; only the ☰ toggle that opens it moves (per Row 2 above).
- Pure JSX/layout reorganization — no new state, no logic changes, no new props threaded anywhere. `pillModes`, `handleToggleAllSections`, `setFilterOpen`, `handleCreatePress` all keep their existing behavior, just relocated in the tree.
- **Not visually verified in a simulator** (none available in this environment) — recommend a quick check on a device/simulator before merging, specifically that the 5-pill row + Collapse/Expand + ☰ now fits full-width without wrapping oddly on a narrow phone.

### Web: `frontend/src/pages/TasksPage.tsx` — high-priority divider fixes
- **Icon swap**: replace the chevron `<path d="M19 14l-7-7m0 0L5 14m7-7v12" />` (lines 441-443) with a solid triangle. Simplest option that keeps the existing `rotate-180` collapse/expand animation: swap to a filled `<svg viewBox="0 0 24 24" fill="currentColor">` with a triangle `<path d="M12 6l7 12H5z" />` (points up when expanded, flips 180° via the existing `collapsedPriorityByColumn[col.key] ? 'rotate-180' : ''` class when collapsed — same animation contract as today, just a different glyph and `fill` instead of `stroke`).
- **Whole strip clickable, keyboard-accessible**: move the `onClick={() => togglePriorityCollapse(col.key)}` handler from the inner `<button>` up to the outer `<div className="px-2 py-1 flex items-center gap-1.5 bg-orange-100 border-b border-orange-200">` (lines 435-446), add `cursor-pointer` to its className. Keep the inner element as a `<button>` (not a `<span>`) so keyboard users retain Tab+Enter/Space activation, but strip its own `onClick` and add `pointer-events-none` so pointer clicks pass through to the parent's handler — a focused button still fires a native click on Enter/Space that bubbles up, so this preserves keyboard operability (per Sneezy's Risk finding). Carry the button's existing classes (`text-orange-600 hover:text-orange-700 transition-colors p-0.5`) over unchanged so the icon keeps its orange tint and hover affordance (per Sneezy's Nit finding) — only `onClick` moves and `pointer-events-none` is added. Keep the `title={...}` tooltip on the outer div.
- **Day After Tomorrow date bug**: in `COLUMNS`'s `day_after_tomorrow` title IIFE (line 92), change `const dat = new Date(tomorrow);` to `const dat = new Date(tomorrow + 'T00:00:00');`, matching the local-midnight-parse pattern already used in `taskDateUtils.ts`'s `getColumn`. This is a one-line fix — the rest of the IIFE (`dat.setDate(dat.getDate() + 1)`, `formatDateWithDay(dateOnly(dat))`) is unchanged and already correct once `dat` starts from the right local day.
- **Monday date bug (Friday-only sibling)**: in the `monday` `useMemo` (lines 79-84), fix both bugs at once: change `const m = new Date(tomorrow); m.setDate(m.getDate() + 1);` to `const m = new Date(tomorrow + 'T00:00:00'); m.setDate(m.getDate() + 2);` — the `T00:00:00` suffix fixes the UTC-parse issue (same as Day After Tomorrow), and `+ 2` (not `+ 1`) fixes the separate off-by-one so `monday` correctly lands two days after `tomorrow` (Saturday + 2 = Monday), matching `getColumn`'s Friday branch and `getDropDate`'s `now + 3` result.
- No change to `getColumn`/`getDropDate` in `taskDateUtils.ts` — both already parse and offset correctly; only the two `TasksPage.tsx` display computations (`COLUMNS`'s `day_after_tomorrow` IIFE and the `monday` `useMemo`) had bugs, and both are independent of which tasks actually land in those buckets (bucketing logic was already correct — only the displayed header dates were wrong).

### Tests
- `frontend/src/__tests__/taskFilters.test.ts`: add a `filterBoards` describe block — matches title/notes across multiple boards, drops boards left empty after filtering, leaves boards unchanged for an empty/whitespace query, preserves boards with no match removed entirely (not just emptied).
- No unit test for the `day_after_tomorrow`/`monday` title fixes — both are computed inline in a component (not an extracted `utils/` function), consistent with this project's convention of unit-testing only `utils/` functions; would need extracting the date-title logic into `taskDateUtils.ts` to get coverage, which is out of scope for these one-line fixes.
- No backend test changes (`backend/tests/test_api.py` untouched — nothing here touches the API).
- No mobile test changes — layout-only, no new logic to unit test.

## Assumptions

- Search stays scoped to `title` + `notes` only, matching current All-view semantics — tags and link URL/description remain unsearched.
- Tag-chip *filtering* (the selectable chip behavior) stays All-view-only. Only alignment and sort order change, and only where they already render (TasksPage's All-view chip row).
- "Over the board buttons" = a new row directly above `BoardTabs`, right-aligned to match it.
- The high-priority divider strip's triangle icon direction/glyph is not specified by the user beyond "not a vertical arrow" — a filled up/down-flipping triangle is assumed as the natural equivalent of the current chevron's rotate-on-collapse behavior.
- "Day and date for Day after Tom are wrong — they are same as for tom" is interpreted as the `COLUMNS` header title bug identified above (confirmed by reading the code), not a task-bucketing bug — `getColumn`'s bucketing logic already places tasks in `day_after_tomorrow` correctly; only the displayed date text was wrong.

## Files to modify

- `frontend/src/utils/taskFilters.ts`
- `frontend/src/components/BoardGroupedTasks.tsx`
- `frontend/src/components/DayView.tsx`
- `frontend/src/components/FocusedView.tsx`
- `frontend/src/pages/TasksPage.tsx` (search-row repositioning, tag-chip sort/alignment, and the high-priority divider icon/click-target/date-bug fixes)
- `frontend/src/__tests__/taskFilters.test.ts`
- `mobile/src/screens/TasksScreen.tsx`

None of these fall under a model/schema/router/API-contract area (per `ARCHITECTURE.MD`'s code structure). Data model changes: none.

## Deployment

Two components, deployed through independent channels with no ordering dependency between them (no shared API/contract change, so no backward-compat window to worry about):

- **Frontend web** (`frontend/` files): triggers a Railway deploy per `CLAUDE.md`'s deploy-trigger rule. Committed **without** `[skip deploy]`.
- **Mobile** (`mobile/src/screens/TasksScreen.tsx` only): does not trigger Railway (per `CLAUDE.md`, `mobile/` changes don't build into the Docker image) — committed **with** `[skip deploy]` since it's a pure-mobile commit and correctly triggers no Railway rebuild. Ships via Expo OTA (`eas update`) since it's a JS/TS-only change — no native modules, `app.json`, or `eas.json` touched, so no full rebuild (`eas build`) needed.

To keep the tagging accurate, the frontend and mobile changes will be committed separately (not squashed into one commit) even though both land on this one branch/PR.

## Branch

`feat-search-all-views`, created off `origin/main` (post PR #55 merge) — deliberately not stacked on `feat-overdue-view`, which still has an unrelated uncommitted README edit and was mid-flight when this work started.

---

## Sneezy's Review — 2026-07-28

**Tier:** LIGHT — no proposed file falls under a model/schema/router/API-contract area, and the plan declares single-component (frontend-only) deployment with no data model changes. Confirmed by reading all six proposed files directly; nothing in them touches a schema, router, or API contract, so the LIGHT gate holds — no escalation needed.

### Issues

1. **[Gap]** `frontend/src/components/BoardGroupedTasks.tsx` — the plan says to render an empty-state block "instead of the board list" when `filterBoards` returns zero boards, but doesn't say what happens to the "Collapse all"/"Expand all" toggle button currently rendered unconditionally at lines 25-33 (inside the same `space-y-6` wrapper as the board list). As written, a literal reading ("board list" = just the `boards.map(...)` block at lines 34-60) would leave the toggle visible above a "No tasks match this search" message with nothing to collapse/expand — `allCollapsed` would evaluate to `false` (since `boards.length > 0` check would be on the *filtered* empty array), so it'd read "Collapse all" pointing at nothing. The plan should specify that the toggle is suppressed too (i.e., the empty-state check should gate the whole component body, not just the list).

2. **[Nit]** `frontend/src/pages/TasksPage.tsx` — the plan doesn't specify a spacing/margin class for the new search row relative to `BoardTabs` (which carries `mb-4`) or, in non-All views, relative to the `DayView`/`FocusedView` content rendered directly below it. Cosmetic, but worth pinning down before implementation to avoid an inconsistent gap.

### Unverified assumptions

All load-bearing claims in the "Current behavior" section were checked directly against source and confirmed accurate:
- `BoardTabs.tsx` line 10: `flex justify-end gap-1.5 overflow-x-auto mb-4 -mx-1 px-1` — confirmed right-aligned as claimed.
- `taskFilters.ts` `filterTasks` — confirmed reference-equality preservation on empty/whitespace query (lines 8, 12-19: the `result = tasks` reference survives untouched when both the label-filter and search-filter blocks are skipped).
- `TasksPage.tsx` line 290 (`viewMode === 'all'` gate on the search `<input>`) and line 315 (`BoardTabs` gate) — both confirmed at the cited/approximate locations.
- `FocusedBoard.tasks: Task[]` (`api/focusedView.ts`) and `Task.notes: string | null` (`api/tasks.ts`) — confirmed, so `matchesSearch`/`filterBoards` can operate on board tasks without a type mismatch.
- `Label.value: string` (`api/tasks.ts` lines 3-7) — confirmed, so the proposed `.sort((a, b) => a.value.localeCompare(b.value))` type-checks.
- `TaskForm.tsx` (line 111) and `TaskQuickEdit.tsx` (line 43) each build their own local `labelsByCategory` via `labels.reduce(...)`, independent of `useLabels`'s grouped output — confirmed, so sorting only at the `TasksPage.tsx` render site is correctly scoped and won't silently miss those two components.
- Grepped for other references to `filterTasks`, `BoardGroupedTasks`, and the search input's placeholder/`type="search"` markup: `filterTasks` has exactly one call site (`TasksPage.tsx:173`), `BoardGroupedTasks` is consumed only by `DayView.tsx` and `FocusedView.tsx` as claimed, and no other file references the search input's text/markup — so repositioning it and refactoring `filterTasks` internals carries no dangling-reference risk anywhere else in the frontend.

No claim in the plan was found to be inaccurate or unverifiable.

### Suggestions

- `BoardGroupedTasks.tsx`'s planned empty state would be a fourth independent copy of the "centered gray-400 SVG + message" pattern (alongside `TasksPage.tsx`'s local `EmptyState`, `DayView.tsx`'s inline JSX, and `FocusedView.tsx`'s inline JSX with yet another icon). Not blocking — it matches existing project convention of no shared `EmptyState` component — but a good opportunity to extract one while touching all three call sites in this same PR.
- The plan calls `filterBoards(boards, searchQuery)` directly in the render body rather than via `useMemo`. Fine at expected board-list sizes, but worth a one-line note in the implementation if board counts ever grow.
- The alphabetical tag sort is inlined at the `TasksPage.tsx` render site rather than extracted into a testable `utils/` function, so it gets zero unit-test coverage (consistent with this project's convention of testing only `utils/` functions, but worth a conscious tradeoff call-out rather than a silent gap).

— *Sneezy*

---

## Sneezy's Review — 2026-07-28 (high-priority divider addition)

**Tier:** LIGHT — reason given at spawn: the only proposed files are `frontend/src/pages/TasksPage.tsx` and other components already covered by prior LIGHT reviews; no model/schema/router/API-contract file is touched. Confirmed by reading `frontend/src/pages/TasksPage.tsx` and `frontend/src/utils/taskDateUtils.ts` directly — this addition is pure display/JSX logic inside an existing kanban column component, no data-model or contract surface. LIGHT gate holds, no escalation needed.

Scope of this pass: only Scope item 6, its two new "Current behavior" bullets (lines 434-446 and 86-101), the "Web: `frontend/src/pages/TasksPage.tsx` — high-priority divider fixes" Changes subsection, the two new Assumptions bullets (triangle icon glyph, day-after-tomorrow interpretation), and the Files-to-modify note. The rest of the plan (search/mobile work covered by the two prior review sections above) was not re-evaluated.

### Issues

1. **[Risk]** Accessibility regression in the click-handler move. Moving `onClick={() => togglePriorityCollapse(col.key)}` from the inner `<button>` (currently `TasksPage.tsx` lines 436-444) up to the outer `<div className="px-2 py-1 flex items-center gap-1.5 bg-orange-100 border-b border-orange-200">` (lines 435-446) drops native keyboard operability unless handled carefully — and the plan doesn't handle it. The Changes section offers two options as if interchangeable ("change the inner `<button>` to a plain `<span>` (or keep a button with no `onClick`, `pointer-events-none`...)"), but they are **not** equivalent: a plain `<span>` has no `tabIndex`/`role`, so a keyboard user who could previously Tab to the icon button and press Enter/Space to toggle collapse loses that ability entirely. The button-with-`pointer-events-none` variant is closer to preserving it — a focused `<button>` still fires a native click on Enter/Space that bubbles to the parent's `onClick`, since `pointer-events: none` only affects pointer/mouse hit-testing, not keyboard activation — but the plan doesn't commit to that variant or otherwise add `role="button"`/`tabIndex={0}`/an `onKeyDown` handler to the outer `div` as a fallback. Recommend either explicitly specifying the button/`pointer-events-none` variant, or adding proper keyboard semantics to the outer div if going the `<span>` route.

2. **[Gap]** The plan's own "Current behavior" claim is factually wrong, and the underlying bug it describes is left unfixed. Line 29 of the plan states: *"`COLUMNS`'s inline IIFE at line 91-95 is the only place that doesn't [sidestep the UTC-parse pitfall]."* This is false — `TasksPage.tsx` lines 79-84 (the `monday` `useMemo`, used only on Fridays) computes the "Monday" column's displayed date with the identical unsuffixed pattern, `new Date(tomorrow)`, and additionally only advances it by one day (`m.setDate(m.getDate() + 1)`) rather than two relative to `tomorrow` — so even setting the timezone bug aside, it computes **Sunday's** date, not Monday's. Confirmed this is display-only, not a bucketing bug: `getDropDate`'s `columnKey === 'monday'` branch (`taskDateUtils.ts` lines 86-90, `now + 3` days) and `getColumn`'s Friday branch (lines 61-65, `dat + 1` day where `dat` is already `day_after_tomorrow`) both independently compute the correct Friday+3 Monday date, exactly parallel to how `day_after_tomorrow`'s bucketing was already correct while only its title was wrong. The plan fixes the Day-After-Tomorrow title bug but leaves this same-shaped sibling bug (on the very next column that renders alongside it every Friday) in place, and the "only place" claim in the Current-behavior section should be corrected or the sibling bug should be folded into this same fix.

3. **[Nit]** The button→span/`pointer-events-none` swap isn't specified to carry over the button's existing styling classes (`text-orange-600 hover:text-orange-700 transition-colors p-0.5`, line 438). The plan only discusses relocating the `onClick`, not where those classes land. If dropped rather than relocated, the triangle icon loses its orange tint (the proposed `fill="currentColor"` depends on an ancestor's text-color class) and its hover affordance. Worth stating explicitly that these classes move with the icon.

### Unverified assumptions

- **Date-parsing bug (item 1 in the task): confirmed real and confirmed fixed correctly.** `tomorrow` (`TasksPage.tsx` line 76) is a plain `YYYY-MM-DD` string; `new Date(tomorrow)` at line 92 parses it as UTC midnight per the ISO-8601 spec, and in any timezone behind UTC, converting back to local time lands one calendar day early before `setDate(getDate() + 1)` is applied — netting out to `tomorrow`'s own date instead of `tomorrow + 1`. Traced through concretely (US Eastern, UTC-4): `new Date("2026-07-29")` → local `2026-07-28T20:00`, `.getDate()` reads 28, `+1` → 29, same as `tomorrow` itself. The proposed one-line fix (`new Date(tomorrow + 'T00:00:00')`) matches the pattern already used correctly in `taskDateUtils.ts`'s `getColumn` (line 57) and fixes it with no side effects — it only touches the display-title IIFE, independent of `getColumn`/`getDropDate`'s bucketing logic, which was already correct.
- **Click-handler move / icon swap (item 2 in the task): implementable as described, no drag-and-drop conflict found.** The header strip div (lines 435-446) is a plain child of the column container div (which owns `onDragOver`/`onDragLeave`/`onDrop` at lines 405-420) — those are drag-event handlers, not click handlers, and don't intercept or get intercepted by a new `onClick` on a sibling/child div. `collapsedPriorityByColumn` and `togglePriorityCollapse`'s closure over `col.key` are unaffected by the DOM restructuring. The one real conflict found is the accessibility regression in Issue 1 above, not a drag/drop or state-management one.
- **Triangle path validity**: `M12 6l7 12H5z` verified as a well-formed, closed, upward-pointing solid triangle (apex at (12,6), base corners at (19,18) and (5,18)); the `fill="none"/stroke` → `fill="currentColor"` swap is a straightforward attribute change and composes cleanly with the existing `rotate-180` transform class.
- **Assumption bullet on triangle glyph/direction** ("not specified by the user beyond 'not a vertical arrow'"): plausible on its face but not independently verifiable — the original user request wasn't available to this reviewer. Flagged by the plan itself as an assumption, not newly contested here.
- **Assumption bullet on the day-after-tomorrow bug interpretation**: confirmed true for `day_after_tomorrow` specifically (display-only bug, bucketing already correct) — but see Issue 2: the identical reasoning applies, unaddressed, to the sibling `monday` display computation.

### Suggestions

- Fold the sibling `monday` display-date bug (`TasksPage.tsx` lines 79-84) into this same fix — same file, same root cause shape, same triggering "date bug" commit. Leaving it as-is will very likely produce a near-identical bug report the next time anyone views the board on a Friday, right after this exact class of bug was reported and partially fixed.
- If keyboard accessibility for the collapse/expand toggle is intentionally being deprioritized for this pass, say so explicitly as a plan Assumption rather than leaving the button→div/span swap's keyboard implications unaddressed — makes it a conscious tradeoff rather than a silent regression.

**Verdict:** Approved with concerns — the date-bug fix and the click/icon changes are correctly diagnosed and implementable as described, but there's a real accessibility regression risk in the click-handler move that the plan doesn't resolve, and the plan's own "only place with this bug" claim is inaccurate (a same-shaped, unaddressed sibling bug exists four lines above the one being fixed).

— *Sneezy*

---

## Sneezy's Review — 2026-07-28 (re-review)

**Tier:** LIGHT — `mobile/src/screens/TasksScreen.tsx` is a screen component (no model/schema/router/API-contract involvement), and the plan still declares no data-model changes and two independently-deployed components with no shared contract. Confirmed by reading the file directly; the LIGHT gate holds, no escalation needed.

Scope of this pass: only the three revisions since the prior LIGHT-tier review (Gap fix, Nit fix, and the new mobile scope item). The rest of the plan was not re-evaluated.

### Issues

1. **[Gap]** `frontend/src/components/BoardGroupedTasks.tsx` fix — **confirmed resolved.** Read the current file: the "Collapse all"/"Expand all" toggle (lines 25-33) and the board list (lines 34-60) both live unconditionally inside the same `<div className="space-y-6">` wrapper today, with no empty-boards guard. The revised plan text ("gates the whole component body... this gates the Collapse all/Expand all toggle too") correctly directs the empty-state check to wrap the entire return, not just the `boards.map(...)` block, which eliminates the "Collapse all pointing at nothing" scenario originally flagged. No remaining issue.

2. **[Nit]** `frontend/src/pages/TasksPage.tsx` fix — **confirmed resolved.** Read the current file: the header row (line 267, `mb-4`), the search `<input>`'s current gated position (lines 290-303), `BoardTabs`'s render site (line 315, and `BoardTabs.tsx` carries its own `mb-4`), and the label-chip row (lines 318-355) all match the plan's description. The revised plan now pins `mb-3` on the new search row, applied consistently whether it sits above `BoardTabs` (All view) or directly above `DayView`/`FocusedView` content (other views). That resolves the original complaint, which was the total absence of a specified spacing class — not a specific numeric preference. No remaining issue.

3. **[Gap]** `mobile/src/screens/TasksScreen.tsx` — **Scope item 5 (line 11) misdescribes the current problem and is inconsistent with the plan's own later sections.** It states: "the view-mode pill row..., the filter toggle, and **the board tabs** currently share the header row with the screen title... Move that entire control cluster to new row(s)." Reading the actual file (lines 645-718) shows this is wrong on two counts:
   - `BoardTabs` (lines 712-717) is **not** part of the cramped `flex-row items-center justify-between` title row (line 649) — it already renders in its own separate `<View className="mt-2">` below the header row, gated `viewMode === 'all'`. The plan's own "Current behavior" bullet (line 23) and the Changes section (line 52, "BoardTabs keeps rendering as its own row below that... unchanged, already correctly separated from the title") both say this correctly — Scope item 5 alone contradicts them.
   - Scope item 5 also **omits** the Collapse/Expand text button (lines 654-663), which *is* one of the cramped row's elements and *does* move per the Changes section (line 51). So the Scope bullet both adds an element that isn't part of the problem (board tabs) and drops one that is (Collapse/Expand).
   In practice this is contained: the Changes section (lines 48-55), which is what an implementer would actually follow, correctly identifies the four real elements (title, +, pillModes, Collapse/Expand, filter toggle) and correctly leaves BoardTabs untouched. So this does not appear to risk a wrong implementation — but it's worth fixing Scope item 5's wording before merge so the summary doesn't mislead a reader who only skims the Scope section. Suggested fix: replace "the filter toggle, and the board tabs" with "the Collapse/Expand toggle, and the filter toggle (board tabs already render in their own row below and are unaffected)."

### Unverified assumptions

- The mobile header structure claims in the "Current behavior" bullet (line 23) and the new "Changes" subsection (lines 48-55) were checked directly against `mobile/src/screens/TasksScreen.tsx` and found accurate: the header is `<View className="px-4 pt-2 pb-2">` (line 648) containing one `flex-row items-center justify-between` row (line 649) with the title `Text` (650-652) and a `flex-row` cluster (`style={{ gap: 8 }}`, line 653) holding, in order, Collapse/Expand (654-663, All-view only), `pillModes` (664-689), filter toggle (690-701, All-view only), and the `+` button (702-708) — matches the plan exactly, including relative order.
- The proposed two-row split (Row 1: title + `+` button; Row 2, `mt-2`: `pillModes` left, Collapse/Expand + filter toggle grouped right, All-view only; `BoardTabs` unchanged below) is coherent and complete against the actual JSX — all four cluster elements are accounted for exactly once, and no state/handler (`pillModes`, `handleToggleAllSections`, `setFilterOpen`, `handleCreatePress`, `hasActiveFilters`, `allSectionsExpanded`) is referenced anywhere else in the file that would depend on JSX tree position (grepped all six symbols — every reference is inside this render block).
- Confirmed no mobile test file exercises this component's render tree (`mobile/src/__tests__/` has no `TasksScreen`-related test, only pure-utility tests like `taskFilters.test.ts`, `taskGrouping.test.ts`, etc.), so the plan's "no mobile test changes" claim still holds for this addition too.
- The "Not visually verified in a simulator" caveat is an honest, checkable-only-by-hand limitation, not a claim I can confirm or refute from source alone — flagged by the plan itself, not newly found here.

### Suggestions

- Row 2's internal spacing (gap between `pillModes` and the right-hand Collapse/Expand+filter group, and within that group) isn't specified — the original single row got its spacing for free from one `style={{ gap: 8 }}` container; splitting into two rows means that gap needs to be re-established in at least two places. Minor, inferable from the existing pattern, but the same category of oversight as the original TasksPage.tsx spacing Nit — worth pinning down explicitly before implementation rather than leaving it to whoever writes the code.
- Consider fixing Scope item 5's wording (see Issue 3) in the same pass as implementation, since it's a one-line correction and the plan will likely be referenced later (e.g. by Doc/arch-review) as the record of what changed and why.

**Verdict:** Approved with concerns — the two previously-flagged items are correctly resolved, and the new mobile addition's actual implementation instructions (Changes section) are accurate and complete. The only new finding is a self-contradictory Scope bullet that doesn't propagate into the actionable spec but should be corrected for accuracy.

— *Sneezy*
