# PLAN-fix-board-tag-ux-polish

## Status
**State:** Ready for PR
**Last updated:** 2026-08-05 by Grumpy
**Next step:** Commit on branch `fix-board-tag-ux-polish`, push, and open the PR.
**Blocked on:** n/a

All 6 items implemented, unit tests added and passing (153/153, including 3 new AND/OR tests), `tsc --noEmit` clean, and manually verified in the browser (empty-board New Task button, same-row chips + AND/OR toggle with immediate re-filter on toggle, browser tab title, alphabetical tag order on both All-view and Focused/Today cards, and full-text wrapping link descriptions).

## Branch
`fix-board-tag-ux-polish`, cut from up-to-date `main`.

## Scope
Six small, independent UX fixes on the web Tasks page. **Frontend-only** (`frontend/`). No backend, API, or data-model changes. Single-component deploy (frontend build only) — this branch's frontend changes trigger a Railway deploy per `CLAUDE.md` (no `[skip deploy]`).

## Background / current behavior
- `TasksPage.tsx` renders the All-view kanban board, delegating empty-state rendering to `EmptyState.tsx` and tag-filter-chip rendering to `LabelFilterChips.tsx`.
- `BoardGroupedTasks.tsx` (used by `FocusedView.tsx` for the Focused view) is a second, independent consumer of `LabelFilterChips.tsx` and `taskFilters.ts`'s `filterTasks` — it keeps its own local `selectedLabelIds` state (scoped to whichever single board is currently the only one visible), separate from `TasksPage.tsx`'s global `FilterContext`.
- `TaskCard.tsx` (All-view kanban card) and `FocusedTaskCard.tsx` (Focused/Today/Tomorrow card) both delegate their body markup to the shared `TaskCardBody.tsx`, but each supplies its own `renderLabels` render-prop — they do not share sort logic today.
- `ArchiveBoardGroups.tsx` and `ArchivePage.tsx` already alphabetize labels inline (`[...item.labels].sort((a, b) => a.value.localeCompare(b.value))`) — this is the established codebase convention for label ordering (also used in `LabelFilterChips.tsx` and `TaskQuickEdit.tsx`), not a shared utility function. This plan follows that same inline-sort convention rather than introducing a new abstraction.

## Items and fixes

### 1. Centered "New Task" button on an empty board
- **Problem:** `TasksPage.tsx` lines 361-366 render `<EmptyState icon={<FolderIcon />} message="No pending tasks" />` (or "No tasks match this filter" when a search/label filter is active) when `filteredTasks.length === 0` in the All view. `EmptyState.tsx` (lines 3-26) has no button affordance beyond an optional `onRefresh` link. The only way to add a task today is the floating action button (FAB) fixed at the bottom-right of the page (`TasksPage.tsx` lines 583-591), which has no visible text label (icon + `title="New task"` tooltip only).
- **Fix:**
  1. `EmptyState.tsx`: add an optional prop `action?: { label: string; onClick: () => void }`. When present, render a primary button (`bg-indigo-600 hover:bg-indigo-700 text-white`, matching the FAB's color) below the message/subMessage, showing `action.label`.
  2. `TasksPage.tsx` lines 361-366: pass `action={{ label: 'New Task', onClick: handleFabClick }}` **only** in the genuinely-empty case (`selectedLabelIds.size === 0 && !searchQuery.trim()`) — i.e. only alongside the "No pending tasks" message, not the "No tasks match this filter" message. `handleFabClick` (lines 162-169) already resolves the correct board to create the task under, so it's reused as-is.
- **"Revert to normal view once ≥1 task exists":** already correct with no additional change — the ternary at line 362 means the moment `filteredTasks.length > 0`, the kanban grid (lines 368-576) renders instead of `EmptyState`, exactly as it does today.
- **Note (flagged, not auto-decided):** the bottom-right FAB stays visible everywhere, including when the new centered button is showing — the request only asks for a button *in the empty state*, not for removing the FAB. Two "add task" affordances will be visible simultaneously on an empty board. If this reads as redundant once implemented, that's a follow-up, not a blocker for this plan.

### 2. Tag filter link on the same row as the tag chips
- **Problem:** `LabelFilterChips.tsx` (lines 24-58) wraps everything in `<div className="mb-4 space-y-2">` (line 25): each label category renders its own `flex flex-wrap ... justify-end` row (line 31), and "Clear filters" renders in a **separate** `flex justify-end` row below (lines 49-54). `space-y-2` stacks them vertically.
- **Fix:** restructure into a single flex row. Since `CATEGORIES` currently has exactly one entry (`'type'`, line 4), flatten the per-category chip rendering and the "Clear filters" button into one `<div className="flex flex-wrap gap-1.5 items-center justify-end mb-4">` container, with "Clear filters" (and the new AND/OR toggle from item 5) rendered as trailing items inside that same row rather than in a nested `space-y-2` sibling. If a second category is ever added later, its chips join the same flat row (categories are visually distinguished only by their per-category color, not by separate rows) — this is a reasonable reading of "same row as tags," and no current caller passes more than one category.

### 3. Browser tab title
- **Fix:** `frontend/index.html` line 7: `<title>frontend</title>` → `<title>Tasks are us</title>`. (`frontend/dist/index.html` is a build artifact regenerated from this source — no separate edit needed.)

### 4. Alphabetical tag order on task cards, all views
- **Problem:**
  - `TaskCard.tsx` lines 93-95 sorts only by `LABEL_CATEGORY_ORDER[a.category]` with no tie-break — since every label currently has category `'type'`, this sort is a no-op and labels render in whatever order the API returned them.
  - `FocusedTaskCard.tsx` lines 59-72 (`renderLabels`) applies no sort at all.
  - `ArchiveBoardGroups.tsx` line 20 and `ArchivePage.tsx` line 139 **already** sort alphabetically — confirmed via repo-wide search for `.labels` rendering call sites, so Archive is already correct and out of scope.
- **Known divergence (not a defect today):** `TaskCard.tsx`'s sort (category-order first, alphabetical tie-break) and `FocusedTaskCard.tsx`/`ArchiveBoardGroups.tsx`/`ArchivePage.tsx`'s sort (pure alphabetical, no category grouping) are different algorithms that produce identical output only because every label currently has category `'type'`. If a second label category is ever introduced, `TaskCard.tsx` would start grouping by category first, diverging visually from the other three views. Flagged here so it isn't mistaken for a regression later — no fix needed while there is only one category.
- **Fix:**
  - `TaskCard.tsx` lines 93-95: add `.value.localeCompare(b.value)` as the tie-break when the category comparison is `0`:
    ```ts
    const sorted = [...taskLabels].sort((a, b) => {
      const catDiff = (LABEL_CATEGORY_ORDER[a.category] ?? 3) - (LABEL_CATEGORY_ORDER[b.category] ?? 3);
      return catDiff !== 0 ? catDiff : a.value.localeCompare(b.value);
    });
    ```
  - `FocusedTaskCard.tsx` lines 59-72: sort `labels` alphabetically by `value` before mapping, matching the existing Archive convention exactly:
    ```ts
    renderLabels={(labels) => {
      const sorted = [...labels].sort((a, b) => a.value.localeCompare(b.value));
      return sorted.length > 0 ? (
        <div className="flex flex-wrap gap-1 mt-2">
          {sorted.map((label) => ( ... ))}
        </div>
      ) : null;
    }}
    ```

### 5. AND/OR toggle for tag filtering
- **Problem:** `taskFilters.ts` lines 10-23 (`filterTasks`) hardcodes OR semantics: `task.labels.some((l) => selectedLabelIds.has(l.id))`. There is no mode concept anywhere — `FilterContext.tsx` (lines 5-9) holds only `selectedLabelIds`/`toggleLabel`/`clearLabels`, and `BoardGroupedTasks.tsx` (lines 29, 54-61) keeps its own local `selectedLabelIds` with the same OR-only behavior via the same `filterTasks` call (line 94). Both call sites need the new mode, since both independently render `LabelFilterChips` and call `filterTasks`.
- **Fix:**
  1. `taskFilters.ts`: add an optional 4th parameter, default `'OR'` (preserves current behavior for any caller not yet updated):
     ```ts
     export function filterTasks(
       tasks: Task[],
       selectedLabelIds: Set<string>,
       searchQuery: string,
       matchMode: 'AND' | 'OR' = 'OR',
     ): Task[] {
       let result = tasks;
       if (selectedLabelIds.size > 0) {
         result = result.filter((task) =>
           matchMode === 'AND'
             ? [...selectedLabelIds].every((id) => task.labels.some((l) => l.id === id))
             : task.labels.some((l) => selectedLabelIds.has(l.id)),
         );
       }
       if (searchQuery.trim()) {
         result = result.filter((task) => matchesSearch(task, searchQuery));
       }
       return result;
     }
     ```
  2. `FilterContext.tsx`: add `matchMode: 'AND' | 'OR'` state (default `'OR'`) and `setMatchMode: (mode: 'AND' | 'OR') => void`, exposed alongside the existing values. Not reset on uid change (only the label *selection* is identity-scoped; the mode preference isn't tied to which labels are picked).
  3. `LabelFilterChips.tsx`: add props `matchMode: 'AND' | 'OR'` and `onMatchModeChange: (mode: 'AND' | 'OR') => void`. Render a small two-way toggle (e.g. `AND | OR` pill buttons, same visual weight as "Clear filters") inside the same row as the chips (per item 2), positioned before "Clear filters". Shown only when `selectedLabelIds.size > 1` — matching the existing convention that "Clear filters" itself only renders when `selectedLabelIds.size > 0` — since AND vs. OR is behaviorally identical with 0 or 1 selected tags, and showing it only when it matters avoids dead UI.
  4. `TasksPage.tsx`: destructure `matchMode, setMatchMode` from `useFilter()` (line 39), pass both to `<LabelFilterChips>` (lines 333-338), and pass `matchMode` as the 4th argument to `filterTasks` (line 172) — **and add `matchMode` to the `useMemo` dependency array at line 173** (currently `[tasks, selectedLabelIds, searchQuery]`). Without this, toggling AND/OR won't recompute `filteredTasks` until some other dependency changes, since `filterTasks` is called inside a `useMemo` here (unlike `BoardGroupedTasks.tsx`'s equivalent call, which runs unmemoized inside a `.map()` and needs no dependency-array change).
  5. `BoardGroupedTasks.tsx`: add local `const [matchMode, setMatchMode] = useState<'AND' | 'OR'>('OR')`, reset it alongside `selectedLabelIds` in the existing board-change reset block (lines 36-40) so a mode chosen for one board doesn't silently apply to the next, pass both to `<LabelFilterChips>` (lines 81-86), and pass `matchMode` as the 4th argument to the `filterTasks` call at line 94.

### 6. Longer link-description text on task cards
- **Problem:** `TaskCardBody.tsx` line 91 truncates each task-link's description to a single line capped at `max-w-[10rem]` (160px) with `truncate` (ellipsis): `className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline truncate max-w-[10rem]"`. On kanban cards (`w-52 sm:w-60`, 208-240px wide) this clips most descriptions well before the card's actual available width.
- **Fix:** line 91 — replace `truncate max-w-[10rem]` with `break-words max-w-full`, letting the description wrap onto additional lines within the existing `flex flex-wrap` links container (line 82) instead of being ellipsis-clipped at a fixed narrow width. The `title={link.url}` tooltip (line 87) stays as-is for the full URL on hover.

## Files to modify
- `frontend/src/components/EmptyState.tsx` (item 1)
- `frontend/src/pages/TasksPage.tsx` (items 1, 2 indirectly via prop wiring, 5)
- `frontend/src/components/LabelFilterChips.tsx` (items 2, 5)
- `frontend/index.html` (item 3)
- `frontend/src/components/TaskCard.tsx` (item 4)
- `frontend/src/components/FocusedTaskCard.tsx` (item 4)
- `frontend/src/utils/taskFilters.ts` (item 5)
- `frontend/src/context/FilterContext.tsx` (item 5)
- `frontend/src/components/BoardGroupedTasks.tsx` (item 5)
- `frontend/src/components/TaskCardBody.tsx` (item 6)

## Data model changes
None.

## API / contract changes
None.

## Test changes
- `frontend/src/__tests__/taskFilters.test.ts`: all existing `filterTasks(...)` calls use 3 args and keep passing unchanged (item 5's 4th param defaults to `'OR'`). Add new tests under a new `describe('filterTasks — AND/OR match mode', ...)` block:
  - AND mode with 2 selected labels keeps only tasks that have both.
  - AND mode with 2 selected labels excludes a task that has only one of them.
  - OR mode (explicit 4th arg `'OR'`) behaves identically to the existing default-arg OR tests, as a regression check that the explicit branch matches the default branch.
- No other pure-utility logic is introduced (item 4's sort is inline per-component, matching the existing convention already exercised implicitly by `ArchiveBoardGroups`/`ArchivePage`, neither of which has dedicated unit tests today — consistent with this project's convention of unit-testing `utils/`, not component-local render-prop closures).
- No changes to `backend/tests/integration/` (backend untouched, owned by `/test-review` anyway).

## Deployment
Single component (frontend only). No staggered/backward-compat concerns — no API contract changes, no mobile files touched.

## Manual verification plan
Run the app locally (`/run` skill), then in the browser:
1. On a board with zero pending tasks, confirm a centered "New Task" button appears in the grid area and creates a task under the correct board; add a task and confirm the view reverts to the normal kanban grid.
2. Confirm a board filtered to zero results (via search or a tag chip) shows "No tasks match this filter" **without** the New Task button.
3. Confirm the tag chips and "Clear filters" link render on the same visual row in both the All view (`TasksPage`) and the Focused view's single-board chip row (`BoardGroupedTasks`).
4. Confirm the browser tab title reads "Tasks are us".
5. Confirm tags on a kanban card (All view) and on a Focused/Today/Tomorrow card render alphabetically.
6. Select 2+ tags, confirm the AND/OR toggle appears; toggle it and confirm the **displayed task list changes immediately** (without needing to touch the label selection again) — this specifically exercises the `useMemo` dependency fix in item 5.4. Verify OR keeps tasks matching any selected tag and AND keeps only tasks matching all selected tags, in both the All view and the Focused view's single-board filter. Then drop back to 0 or 1 selected tags and confirm the toggle disappears (per item 5.3).
7. Confirm a task with a long link description now wraps and reads in full on a kanban card instead of being cut off with an ellipsis.

---

## Sneezy's Review — 2026-08-05

**Tier:** LIGHT — no proposed file falls under a model/schema/router/API area; all files are under `frontend/`; the plan declares no data-model changes and single-component (frontend-only) deployment. No escalation triggers were found while reading the code (no proposed file turned out to touch backend, routing, or shared type contracts beyond the local `filterTasks`/`FilterContext` pair already scoped by the plan).

**Verdict:** Changes required

### Issues

1. **[Blocker]** `frontend/src/pages/TasksPage.tsx:171-174` — Item 5.4 instructs passing `matchMode` as the 4th argument to `filterTasks` at line 172, but the `useMemo` dependency array on line 173 (`[tasks, selectedLabelIds, searchQuery]`) is not updated to include `matchMode`. Verified by reading the current code: `filteredTasks` is memoized on those three deps only. Once `matchMode` becomes a 4th call argument without becoming a 4th dependency, toggling AND/OR in the All view will not recompute `filteredTasks` — the memo will return its stale value until `tasks`, `selectedLabelIds`, or `searchQuery` next changes (e.g. the user (de)selects a label). This directly contradicts the plan's own manual verification step 6 ("verify OR keeps tasks matching any selected tag and AND keeps only tasks matching all selected tags... in the All view") — as written, toggling the pill alone would appear to do nothing in the All view. Note `BoardGroupedTasks.tsx`'s equivalent call (line 94, inside the `.map()`) is *not* memoized, so it is unaffected — this bug is specific to `TasksPage.tsx`. Fix: add `matchMode` to the line-173 dependency array alongside the other changes in item 5.4.

2. **[Nit]** `frontend/src/pages/TasksPage.tsx` — item 5.4 cites "lines 333-340" for the `<LabelFilterChips>` JSX call that needs `matchMode`/`setMatchMode` wired in. The actual JSX tag spans lines 333-338 (`<LabelFilterChips ... />`); lines 339-340 are the closing `)}` of the `viewMode === 'all' &&` conditional and a blank line. Not misleading enough to block on, but the precise edit region is 333-338.

3. **[Gap, non-blocking]** `TaskCard.tsx`'s sort (category-order tie-broken by `value`) and `FocusedTaskCard.tsx`/`ArchiveBoardGroups.tsx`/`ArchivePage.tsx`'s sort (pure `value` alphabetical, no category grouping) are different algorithms that happen to produce identical output today only because every label currently has category `'type'`. The plan already acknowledges in the Background section that these two components "do not share sort logic," and item 2 separately notes categories may grow beyond one entry — but the plan does not flag that if a second category is ever added, `TaskCard.tsx` would start grouping by category first (diverging visually from the Focused/Archive views, which would stay purely alphabetical). Not a defect in this plan's stated scope (single category today), but worth a one-line callout so a future reader doesn't mistake "alphabetical, all views" as fully unified sort behavior going forward.

### Unverified assumptions

- All file:line citations in items 1, 2, 3, 4, and 6, and in the Background section, were checked against the current repo state and are accurate (verified: `EmptyState.tsx:3-26`, `TasksPage.tsx:361-366,162-169,583-591`, `LabelFilterChips.tsx:24-58,4,49-54`, `index.html:7`, `TaskCard.tsx:93-95,21`, `FocusedTaskCard.tsx:59-72`, `ArchiveBoardGroups.tsx:20`, `ArchivePage.tsx:139`, `TaskQuickEdit.tsx:94` inline-sort convention, `TaskCardBody.tsx:91,82,87`, `taskFilters.ts:10-23`, `FilterContext.tsx:5-9`, `BoardGroupedTasks.tsx:29,36-40,54-61,81-86,94`). Item 5's claim that `TasksPage.tsx` and `BoardGroupedTasks.tsx` are the only two callers of `filterTasks` and `LabelFilterChips` was independently confirmed by a repo-wide grep — both are exhaustive as stated.
- The Test changes section's claim that no component-level tests exist for `EmptyState`, `LabelFilterChips`, `TaskCard`, or `FocusedTaskCard` was confirmed — `frontend/src/__tests__/` contains only `utils/`-targeted test files, none referencing these components.
- Could not verify runtime/visual behavior (e.g. whether `break-words max-w-full` in item 6 actually reads well inside the `flex flex-wrap` links container at various card widths, or how the centered "New Task" button looks alongside the FAB) — these require running the app, which is out of scope for a plan-file review.

### Suggestions

- Add `matchMode` to the manual verification plan explicitly: after selecting 2+ tags and toggling AND/OR, confirm the *displayed task list* changes without needing to touch the label selection again — this would have caught issue #1 above during manual testing even without a code review.
- Manual verification step 6 tests only the 2+ selected-tags case; consider also verifying the toggle disappears (without resetting the stored mode) when the selection drops back to 0 or 1 tags, per item 5.3's stated visibility condition.
- Consider a one-line note (or follow-up TODO) recording the `TaskCard.tsx` vs. `FocusedTaskCard.tsx`/Archive sort-algorithm divergence (see Issue #3) so it isn't rediscovered from scratch if a second label category is ever introduced.

— *Sneezy*

## Grumpy's response — 2026-08-05

- **Issue 1 (Blocker, missing `matchMode` in `useMemo` deps):** Addressed in the plan. Item 5.4 now explicitly calls out adding `matchMode` to the `TasksPage.tsx` line-173 dependency array, with the reasoning for why `BoardGroupedTasks.tsx`'s equivalent call needs no such change.
- **Issue 2 (Nit, line range):** Addressed. Item 5.4 now cites "lines 333-338" for the `<LabelFilterChips>` JSX.
- **Issue 3 (Gap, sort-algorithm divergence):** Addressed. Item 4 now has an explicit "Known divergence" callout explaining `TaskCard.tsx` vs. the other three views, so it isn't mistaken for a regression if a second label category is ever added.
- **Suggestions:** Manual verification step 6 updated to explicitly test that toggling AND/OR changes the displayed list without touching the label selection, and that the toggle disappears again below 2 selected tags.

Awaiting user approval before implementation begins.
