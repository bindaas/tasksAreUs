# PLAN: feat-hide-unhide-columns — Per-column hide/unhide toggle on the "All" kanban board, plus neutral Overdue column background

## Status
**State:** Ready for PR
**Last updated:** 2026-08-22 by Grumpy
**Next step:** Awaiting review chain (Dopey/Sleepy/Bashful/Doc) and merge of PR #83.
**Blocked on:** n/a — PR opened: https://github.com/bindaas/tasksAreUs/pull/83

**Implementation notes:** All 5 design sections implemented in `frontend/src/pages/TasksPage.tsx` exactly as planned, including the `ml-auto` wrapper fix, `aria-label`s, and shared `EyeSlashIcon` (colocated in `TasksPage.tsx` itself since both call sites live there). `tsc -b` clean; all 211 frontend unit tests pass (no new tests needed, per plan). Manually verified in the Docker dev stack via browser automation:
- Hiding "Today" removed its column, remaining columns kept their fixed width (`w-52 sm:w-60`, confirmed via screenshot — no growth), a chip labeled "Today" appeared next to the view-toggle row.
- Accessibility tree confirmed correct `aria-label`s on all new buttons: "Hide Overdue column", "Hide Tomorrow column", "Hide Day After Tomorrow column", "Hide Upcoming column", "Hide No Date column", "Show Today column" — and the chip's `title` (tooltip) is exactly "Today", matching the literal spec.
- Clicking the chip unhid "Today," which reappeared in its correct original position between Overdue and Tomorrow.
- Overdue column confirmed neutral gray border/background/title (matching Today/Tomorrow/etc. exactly), while its one task card ("Apply to Acme Corp") kept its red/pink background — visually distinguishable from the now-neutral column chrome for the first time.

## Overview

User request (verbatim, two asks, both scoped to the web "All" kanban board — `frontend/src/pages/TasksPage.tsx`):
1. Make it possible to hide/unhide a column in the task list. Intent: regain unused horizontal real estate. There must be a visible icon (or similar) indicating a column is hidden, with a tooltip showing that column's name, and a way to unhide it.

   **Resolved during plan review (Sneezy flagged this — see critique below):** columns are fixed-width (`w-52 sm:w-60`) with no `flex-grow`, so hiding a column shrinks the row's total content width rather than making remaining columns visually wider. Confirmed with the user: remaining columns stay their current fixed width — the benefit is less horizontal scrolling to reach the rest of the board, not wider columns. No flex/width changes needed beyond simply not rendering the hidden column.
2. For the Overdue column specifically: make its background neutral, matching the other columns' chrome. The cards inside should continue to have their red/pink background.

**Scope:** Web frontend only, one file: `frontend/src/pages/TasksPage.tsx`. No backend, no data model, no API contract changes, no mobile files touched.

Three clarifying decisions were confirmed with the user before writing this plan (recorded here so a fresh reader doesn't need conversation history):
- **Persistence:** hidden-column state is session-only (plain React state, resets on page reload) — matching the existing precedent of `BoardCollapseContext` and `ColumnPriorityCollapseContext`, neither of which persist across reloads. No localStorage, no backend setting.
- **Indicator location:** the "hidden columns" icon row lives in the page's top header, next to the Overdue/Focused/Today/Tomorrow/All view-toggle buttons (`TasksPage.tsx` around line 349-368) — not directly above the column row — so it stays visible regardless of horizontal scroll position of the board itself.
- **Overdue title text color:** goes fully neutral (`text-gray-700`, matching every other column's title), not kept red. Only the task cards inside the Overdue column keep red/pink — the column chrome (border, background, title) becomes indistinguishable from other columns except by content.

## Current state (confirmed by reading code)

`frontend/src/pages/TasksPage.tsx` renders the "All" view as a 6–7 column kanban board (`COLUMNS`, computed at lines 130-146): `overdue`, `today`, `tomorrow`, `day_after_tomorrow`, `monday` (Friday-only), `upcoming`, `nodate`. Columns are laid out in a `flex gap-3` row inside an `overflow-x-auto` container (lines 424-425) with each column a fixed `w-52 sm:w-60 flex-shrink-0` box — there is no grid or flex-grow, so columns never stretch to fill space; they just sit side by side and the whole row scrolls horizontally if it overflows.

Two render branches exist per column (lines 426-612):
- **Priority columns** (`overdue`, `today`, `tomorrow`, `day_after_tomorrow`, `monday` — anything `isPriorityEligible` or `overdue`): split into High/Medium/Normal collapsible tier zones (lines 433-552).
- **Simple columns** (`upcoming`, `nodate`): flat task list, no priority split (lines 555-611).

The `overdue` column already has one visibility rule: `if (col.key === 'overdue' && colTasks.length === 0) return null;` (line 428) — hidden automatically when empty. This plan adds a second, independent, user-driven hide rule on top of it (any column, not just Overdue, and regardless of task count).

The Overdue column currently gets special-cased chrome:
- Container background/border (lines 507-513): `isOver ? 'border-indigo-400 bg-indigo-50' : isOverdueCol ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'`
- Title text (line 532): `isOverdueCol ? 'text-red-700' : 'text-gray-700'`

Task card backgrounds are computed independently by `taskCardBg(columnKey, priority)` in `frontend/src/utils/priorityColor.ts:16-20`, which already returns `'bg-red-50'` unconditionally for `columnKey === 'overdue'`, regardless of the column container's own styling. This is unit-tested (`frontend/src/__tests__/priorityColor.test.ts:20-22`) and is untouched by this plan — cards will keep their red/pink background exactly as today.

## Design

### 1. Hidden-column state
Add to `TasksPage`:
```ts
const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(new Set());
function toggleColumnHidden(key: ColumnKey) {
  setHiddenColumns((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
}
```
Plain component state, not a Context — `ColumnKey` values (`overdue`/`today`/`tomorrow`/`day_after_tomorrow`/`monday`/`upcoming`/`nodate`) are only rendered by this one page, so there's no cross-component sharing need that would justify a Context (unlike `ColumnPriorityCollapseContext`, which `TasksPage` already consumes for the pre-existing high/medium/normal tier collapse — that one stays as-is and is unrelated to this feature).

### 2. Per-column "hide" button
Add a shared `EyeSlashIcon` component (small named icon component, matching the existing convention of `FolderIcon` in `frontend/src/components/EmptyState.tsx:37+` rather than duplicating inline SVG at each call site — per Sneezy's nit).

Each column header (both the priority-column header block, lines 531-546, and the simple-column header block, lines 583-593) gets a small icon button:
```tsx
<button
  onClick={() => toggleColumnHidden(col.key)}
  title={`Hide ${col.title}`}
  aria-label={`Hide ${col.title} column`}
  className="text-gray-400 hover:text-gray-600 p-0.5"
>
  <EyeSlashIcon className="w-3.5 h-3.5" />
</button>
```
`aria-label` added alongside `title`, matching the existing priority-collapse chevron button convention (`TasksPage.tsx:463-465`) — per Sneezy's nit.

**`ml-auto` conflict (Sneezy's Gap #2), resolved:** the priority-column header already has a conditionally-rendered high-priority-limit warning `<span className="ml-auto ...">` (line 541-545). Two flex children each carrying their own `ml-auto` would split the free space between their margins instead of both hugging the right edge. Fix: wrap the hide button and the warning span in a single shared trailing container that alone carries `ml-auto`:
```tsx
<span className="ml-auto flex items-center gap-2">
  {highTasks.length >= highPriorityDailyLimit && (
    <span className="text-xs text-amber-600 font-medium flex items-center gap-1" title="High-priority limit exceeded">
      ⚠ {highTasks.length}/{highPriorityDailyLimit} high
    </span>
  )}
  <button onClick={() => toggleColumnHidden(col.key)} title={`Hide ${col.title}`} aria-label={`Hide ${col.title} column`} className="text-gray-400 hover:text-gray-600 p-0.5">
    <EyeSlashIcon className="w-3.5 h-3.5" />
  </button>
</span>
```
For the simple-column header (no high-priority warning to share space with), the hide button alone gets `ml-auto`. Neither header `<div>` currently has an `onClick` of its own (only the inner tier strips do, for priority collapse), so no `stopPropagation` is needed.

### 3. Skip rendering hidden columns
In the `COLUMNS.map((col) => {...})` body (line 426 onward), change:
```ts
if (col.key === 'overdue' && colTasks.length === 0) return null;
```
to:
```ts
if (col.key === 'overdue' && colTasks.length === 0) return null;
if (hiddenColumns.has(col.key)) return null;
```
The row is `flex` with fixed-width children (`w-52 sm:w-60 flex-shrink-0`, no `flex-grow`) — not rendering a hidden column's `<div>` shrinks the row's total content width, reducing how far the user has to scroll horizontally to reach the remaining columns. It does **not** make the remaining columns visually wider (confirmed with the user as the intended behavior — see the Overview note above). No flex-basis/width changes needed.

### 4. "Hidden columns" indicator row
In the header block (lines 349-368), inside the existing `overdueChecked && (...)` wrapper, add a second flex group rendered only when `viewMode === 'all' && hiddenColumns.size > 0`:
```tsx
{viewMode === 'all' && hiddenColumns.size > 0 && (
  <div className="flex items-center gap-1">
    {COLUMNS.filter((c) => hiddenColumns.has(c.key)).map((c) => (
      <button
        key={c.key}
        onClick={() => toggleColumnHidden(c.key)}
        title={c.title}
        aria-label={`Show ${c.title} column`}
        className="p-1 rounded border border-gray-200 bg-white text-gray-400 hover:text-gray-600 hover:bg-gray-50"
      >
        <EyeSlashIcon className="w-3.5 h-3.5" />
      </button>
    ))}
  </div>
)}
```
Filtering hidden keys against the *current* `COLUMNS` array (not a static list) means a stale hidden key that no longer corresponds to a rendered column (e.g. `monday` hidden on a Friday, then the page is later viewed on a non-Friday) simply produces no chip — no orphaned/broken indicator. Tooltip text is exactly the column's `title` (e.g. `"Today"`), per the user's literal spec ("Its tool tip should have the name of the column").

Only shown for `viewMode === 'all'` since hidden-column state only has meaning on the kanban board; the Overdue/Focused/Today/Tomorrow single-column views are unaffected and unrelated to this state.

### 5. Overdue column neutral background
Two class-string edits in the priority-column render branch (lines 507-513 and 532), both removing the `isOverdueCol` special case so Overdue falls through to the same neutral classes every other column already uses:
- Line ~507-513: `isOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-gray-50'` (drop the `isOverdueCol ? 'border-red-200 bg-red-50' :` branch entirely)
- Line ~532: `text-gray-700` unconditionally (drop the `isOverdueCol ? 'text-red-700' :` branch entirely)

The `isOverdueCol` variable itself stays — it's still used at line 431 (`isPriorityColumn` check) and inside `renderTierZone`'s empty-zone label (line 485, showing `meta.label` instead of `meta.emptyLabel` for Overdue) — neither of which is a background-color concern and both are unrelated to this change.

Task cards need zero changes: `taskCardBg('overdue', priority)` in `priorityColor.ts` already returns `bg-red-50` independent of the column container's styling.

## Data model / API changes
None. No new endpoints, no schema changes, no new persisted settings.

## Files to modify
- `frontend/src/pages/TasksPage.tsx` — all changes (new state, hide buttons, render-skip condition, header indicator row, two class-string edits for Overdue chrome).

## Test plan
- No unit test changes: no new pure/testable utility function is introduced (hide/unhide is component state + conditional rendering, same pattern as the existing untested `ColumnPriorityCollapseContext` toggle). Existing `frontend/src/__tests__/priorityColor.test.ts` (`taskCardBg`) is unaffected and remains the correct coverage for card background behavior.
- Manual verification in a running dev stack (per project convention for UI changes):
  1. On the "All" view, click each column's hide icon → column disappears; remaining columns keep their current fixed width (no visual growth), and the total board width shrinks so there's less horizontal distance to scroll to reach the rest.
  2. A chip appears in the top header per hidden column, with a native tooltip showing that column's exact name on hover.
  3. Clicking a header chip unhides that column and removes the chip; column reappears in its original `COLUMNS` order (order is driven by `COLUMNS.map`, not by hide/unhide sequence, so no reordering logic is needed).
  4. Hide the Overdue column (when it has tasks) and confirm the chip's tooltip reads "Overdue"; unhide and confirm it reappears with neutral gray border/background and gray title text, while its cards remain `bg-red-50`.
  5. Reload the page → hidden columns reset to all-visible (session-only state, confirmed working as designed, not a bug).
  6. Confirm drag-and-drop onto a still-visible column is unaffected, and that a hidden column cannot be a drop target while hidden (it isn't rendered, so this is automatic).
  7. `tsc -b` clean.

## Deployment order
Single component — frontend only. No backward-compatibility window needed (no API/contract change, no mobile files touched).

## Response to Sneezy's critique

1. **[Gap] Fixed-width overclaim** — Addressed. Confirmed with the user via direct question (with a visual before/after preview of both options): remaining columns stay fixed width; hiding a column only reduces total scroll distance. Reworded the Overview, Design section 3, and Test-plan step 1 accordingly.
2. **[Gap] `ml-auto` double-margin** — Addressed. Design section 2 now wraps the hide button and the high-priority-limit warning in a single `<span className="ml-auto flex items-center gap-2">` so only one element in the row carries `ml-auto`.
3. **[Nit] Missing `aria-label`** — Addressed. Both the per-column hide button and the header indicator chip now specify `aria-label` alongside `title`, matching the existing chevron-button convention.
4. **[Nit] Duplicated inline SVG** — Addressed. Design section 2 now specifies a single shared `EyeSlashIcon` component (colocated in `TasksPage.tsx`, since both call sites are within this one file — no new shared-icons file needed for a single-consumer icon), used at both call sites instead of copy-pasted SVG markup.

All four items resolved; no open disagreements with Sneezy's critique.

---

## Sneezy's Review — 2026-08-22

**Tier:** LIGHT — no proposed file falls under a model/schema/router/API area (only file touched is `frontend/src/pages/TasksPage.tsx`, a page component), Data model changes = none, single-component deployment. Confirmed via `grep -rn "TasksPage"` that the component has exactly one importer (`frontend/src/App.tsx:6,98`, the route mount) — no wide fan-out that would warrant escalation. Tier gate holds; not escalating.

**Verdict:** Approved with concerns

### Issues

1. **[Gap]** The Overview and Design section 3 overclaim what "freed space" means. The board row is `frontend/src/pages/TasksPage.tsx:424-425` (`<div className="flex gap-3" style={{ minWidth: 'max-content' }}>`), and every column `<div>` is `w-52 sm:w-60 flex-shrink-0` (lines 507, 560) with **no `flex-grow`**. Hiding a column removes its fixed-width box and shrinks the row's *total* content width — it does not make the remaining columns wider. But the Overview (line 12: "hiding a column lets the other columns use the freed space"), Design section 3 (line 77: "sufficient for the other columns to close the gap and reclaim the freed horizontal space"), and the Test plan (line 119: "remaining columns shift to fill the freed space") all read as promising remaining columns will visually grow to occupy the vacated space. They won't — the actual, correct effect is: less total scrollable width, so on a viewport where the board currently needs horizontal scroll, hiding a column means less scrolling to see the rest (a legitimate way to "regain real estate"), but the columns themselves stay the same fixed pixel width. This is a real, checkable distinction (verified by reading the actual flex/width classes) that changes what the shipped feature visibly does versus what the plan's own language leads a reader to expect. It wasn't raised in the "three clarifying decisions" section, and should be — either confirm with the user that "less scrolling, same-width columns" is the intended behavior, or reword the plan (and manual test-plan step 1) so it doesn't promise column growth that won't happen.

2. **[Gap]** Design section 2's per-column hide button is specified with `className="ml-auto ..."`, but the priority-column header (`TasksPage.tsx:541-545`) already conditionally renders a high-priority-limit warning `<span className="ml-auto ...">`. Two flex children both carrying `margin-left: auto` in the same row split the available free space between their own left margins per the CSS flex box spec — they do not both end up flush against the right edge as a group. Concretely: when the warning is shown, the hide button (if placed before the warning in JSX, per the plan's "before/around" instruction) will land with a visible gap *before* it, not immediately next to the warning at the row's right edge — an unintended layout wobble that only appears in the `highTasks.length >= highPriorityDailyLimit` case. The plan doesn't address which element should keep `ml-auto` or how the two are meant to co-exist.

3. **[Nit]** The hide-button code sample (Design section 2) sets only a `title` attribute. The codebase's existing icon-button convention for this exact header row — the priority-collapse chevron button at `TasksPage.tsx:463-465` — sets `aria-label` in addition to `title`/tooltip text. The plan should follow that existing convention for both the per-column hide button and the header chip button (section 4) rather than relying on `title` alone.

4. **[Nit]** Both new icon usages (Design sections 2 and 4) are specified as inline "eye-slash SVG" markup, duplicated across two call sites. The codebase's existing convention for small reusable icons (`FolderIcon` in `frontend/src/components/EmptyState.tsx:37+`) is a tiny named component, not copy-pasted inline SVG. Not blocking, but worth extracting a single `EyeSlashIcon` to avoid the two copies drifting.

### Unverified assumptions

None outstanding — every specific, checkable claim in the plan was verified directly against the current source:
- All cited line numbers/ranges (130-146, 426-612, 428, 433-552, 555-611, 507-513, 531-546, 532, 431, 485, 349-368, 541-545) match `frontend/src/pages/TasksPage.tsx` exactly as of this review.
- `taskCardBg('overdue', priority)` in `frontend/src/utils/priorityColor.ts:16-20` does return `'bg-red-50'` unconditionally, and is covered by `frontend/src/__tests__/priorityColor.test.ts:19-23` — confirmed by reading both files.
- `ColumnPriorityCollapseContext` (`frontend/src/context/ColumnPriorityCollapseContext.tsx`) and `BoardCollapseContext` (`frontend/src/context/BoardCollapseContext.tsx`) are both confirmed plain in-memory `useState`, no localStorage/persistence — the plan's precedent claim for session-only hidden-column state holds.
- No existing unit test targets `TasksPage.tsx` directly (only utility-level tests exist under `frontend/src/__tests__/`), consistent with the plan's "no unit test changes" claim.

### Suggestions

- Reword the Overview / Design section 3 / Test plan step 1 to describe the actual effect precisely ("frees up horizontal scroll distance" rather than "other columns use/fill the freed space"), or explicitly confirm with the user that column width should stay fixed rather than grow — this is a one-line clarification that avoids a mismatch between what's promised and what ships.
- Resolve the `ml-auto` double-margin question (Issue 2) explicitly in the plan before implementation: e.g. wrap the hide button and the high-priority warning in a shared `<span className="ml-auto flex items-center gap-2">` container so only the wrapper gets the auto margin.
- Add `aria-label` to both new buttons per Issue 3, and consider extracting a shared `EyeSlashIcon` per Issue 4.

— *Sneezy*
