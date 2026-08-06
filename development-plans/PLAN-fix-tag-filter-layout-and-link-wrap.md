# PLAN-fix-tag-filter-layout-and-link-wrap

## Status
**State:** Ready for PR
**Last updated:** 2026-08-05 by Grumpy
**Next step:** Commit on branch `fix-tag-filter-layout-and-link-wrap`, push, and open the PR.
**Blocked on:** n/a

Both items implemented, `tsc --noEmit` and `vitest run` clean (153/153, no new tests needed per plan), and manually verified in the browser: filter row is left-aligned in AND/OR-toggle → Clear-filters → chips order, AND is the default mode, link descriptions now wrap using the card's full width (confirmed "Second link"/"Third link" now share a row that previously each occupied its own line), and the `items-center` alignment fix keeps the action icons vertically centered against title blocks of varying line counts.

## Branch
`fix-tag-filter-layout-and-link-wrap`, cut from up-to-date `main` (PR #70 / `fix-board-tag-ux-polish` is already merged — do not stack on it).

## Scope
Two follow-up UX fixes on the web Tasks page, both regressions/gaps noticed after PR #70 shipped. **Frontend-only** (`frontend/src/`). No backend, API, or data-model changes. Single-component deploy (frontend build only) — triggers a Railway deploy per `CLAUDE.md`.

## Background / current behavior
PR #70 (merged, commit range `742c012..11a5573`) added a tag-filter row (chips + AND/OR toggle + "Clear filters") to `LabelFilterChips.tsx`, and changed a task-card link description's CSS from `truncate max-w-[10rem]` to `break-words max-w-full` in `TaskCardBody.tsx` intending to let long descriptions wrap and use the card's available width. Both shipped, but neither behaves as intended once viewed in the browser against real data.

## Items and fixes

### 1. Tag filter row: wrong side, wrong order
- **Problem:** `LabelFilterChips.tsx` line 29 renders `<div className="mb-4 flex flex-wrap gap-1.5 items-center justify-end">`, and inside it, the JSX order is: tag chips (lines 30-48) → AND/OR toggle (lines 49-63) → "Clear filters" (lines 64-68). `justify-end` right-aligns the whole row. User wants the row left-aligned, in the order: AND/OR toggle, then "Clear filters", then the tag chips.
- **Fix:** in `LabelFilterChips.tsx`:
  1. Line 29: `justify-end` → `justify-start`.
  2. Reorder the three JSX blocks so the AND/OR toggle block (currently lines 49-63) renders first, the "Clear filters" block (currently lines 64-68) renders second, and the `CATEGORIES.map(...)` chip block (currently lines 30-48) renders last.
- No prop or behavior changes — this is a pure JSX-order and alignment-class change. Both call sites (`TasksPage.tsx` and `BoardGroupedTasks.tsx`) consume this component via the same props interface, unaffected by internal reordering.

### 2. Link description on task cards wraps too soon, despite available space
- **Problem:** PR #70 changed `TaskCardBody.tsx` line 91's link-description `<a>` className from `truncate max-w-[10rem]` to `break-words max-w-full`, intending to let descriptions use the card's full width. In the browser, a long description still wraps at ~100-120px inside a ~208-240px-wide kanban card, with visibly empty space to its right (confirmed via a zoomed screenshot on `main` at http://localhost:5173, board `General tasks`, task "Test navigation task EDITED").
  - **Root cause is not the `<a>`'s own className** — it's the surrounding layout. The `'inline'` layout branch of `TaskCardBody.tsx` (lines 163-176, used by `TaskCard.tsx`/kanban board; the `'stacked'` branch used by `FocusedTaskCard.tsx` is unaffected and out of scope) wraps **title, date, labels, and links together** in one `<div className="flex-1 min-w-0">` (line 165), sitting as a flex sibling of `actionsEl` (the edit/complete/delete icon buttons, lines 103-148) inside an outer `<div className="flex items-start justify-between gap-2">` (line 164). In CSS flexbox, a flex item's width is fixed for the full height of the row it participates in — so `actionsEl`'s reserved ~90-110px-wide column applies to the *entire* `flex-1` sibling's height, not just the title line where the icons visually appear. This silently narrows the date, label, and link rows by the same amount as the title row, even though the icons only render once at the top.
- **Fix:** in `TaskCardBody.tsx`, restructure the `'inline'` layout return (lines 163-176) so only the title (+ `priorityIndicator`) row shares horizontal space with `actionsEl`; `dateEl`, `renderLabels(task.labels)`, and `linksEl` move to be siblings *outside* that constrained row, using the card's full available width:
  ```tsx
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          {priorityIndicator}
          {titleEl}
        </div>
        {actionsEl}
      </div>
      {dateEl}
      {renderLabels(task.labels)}
      {linksEl}
    </>
  );
  ```
  This is a pure structural change (moving the `flex-1 min-w-0` wrapper to only cover the title row instead of the whole content stack) — no new classes are introduced beyond what already existed on the title's own inner row (`flex items-center gap-1.5 flex-wrap`, previously at line 166, now merged onto the same div as `flex-1 min-w-0`). The parent `<TaskCardBody>` caller in `TaskCard.tsx` renders it directly inside a padded card `<div>`, so returning a Fragment instead of a single wrapping `<div>` is a safe, layout-neutral change.
  **Post-review adjustment (addresses Sneezy's Issue #1 below):** the outer row's alignment changes from `items-start` to `items-center`. Previously `items-start` didn't matter because `actionsEl` was always shorter than its sibling (the whole content stack); after this fix, on a short single-line title with no priority badge, `actionsEl` (~26-28px) can be taller than the title row (~19-20px) — `items-center` keeps both vertically centered against each other regardless of which one ends up taller, avoiding a lopsided gap in either direction.
- **Scope check:** `'stacked'` layout (lines 150-160, used only by `FocusedTaskCard.tsx`) already renders `dateEl`/`renderLabels`/`linksEl` as top-level siblings with no such shared-column constraint — it needs no change and was not the layout shown to be broken.

## Files to modify
- `frontend/src/components/LabelFilterChips.tsx` (item 1)
- `frontend/src/components/TaskCardBody.tsx` (item 2)

## Data model changes
None.

## API / contract changes
None.

## Test changes
None. Both fixes are pure JSX structure/CSS-class changes to presentational components with no existing unit-test coverage (component-level rendering isn't unit-tested in this project — consistent with PR #70's own test-changes rationale) and no new pure-utility logic is introduced.

## Deployment
Single component (frontend only). No staggered/backward-compat concerns — no API contract changes, no mobile files touched.

## Manual verification plan
Run the app locally (`/run` skill), then in the browser:
1. Select 2+ tags on a board with a search/filter present; confirm the row is left-aligned and reads, left to right: AND/OR toggle, "Clear filters", tag chips.
2. On a kanban (All view) card with a link whose description is longer than ~15 characters, confirm the text now wraps using the card's true available width (i.e. wraps roughly where the card's right edge is, not where the action-icon column used to end), with no unused whitespace to its right.
3. Confirm the Focused/Today/Tomorrow card layout (`FocusedTaskCard.tsx`, `'stacked'` layout) is visually unchanged.
4. On a kanban card with a short, single-line title and no high-priority badge, confirm there's no new visible gap (or lopsided misalignment) between the title/action-icon row and the date/label rows below it.

---

## Sneezy's Review — 2026-08-05

**Tier:** LIGHT — both proposed files (`frontend/src/components/LabelFilterChips.tsx`, `frontend/src/components/TaskCardBody.tsx`) are presentational frontend components, not under any model/schema/router/API-contract area; the plan declares no data-model changes and single-component (frontend-only) deployment. Reading both files in full and their call sites (`TasksPage.tsx`, `BoardGroupedTasks.tsx`, `TaskCard.tsx`, `FocusedTaskCard.tsx`) confirmed nothing crosses into backend, routing, or shared type-contract territory. No escalation to FULL warranted.

**Verdict:** Approved with concerns

### Issues

1. **[Gap]** `TaskCardBody.tsx`, item 2's restructured `'inline'` return — the fix changes what the outer flex row's height is computed from. Today, `actionsEl` (a single row of icon buttons, ~26–28px tall given `p-1.5` padding around `w-3.5`/`w-4` icons) sits beside the *entire* `flex-1 min-w-0` content stack (title + date + labels + links), which is almost always taller than `actionsEl`, so `actionsEl`'s height never determines the row's height. After the fix, `actionsEl` sits beside *only* the title row. For a short, single-line title (`text-sm leading-snug` ≈ 19–20px line height) with no `priorityIndicator`, `actionsEl` (~26–28px) is now the taller flex item, so the row's height becomes `actionsEl`'s height rather than the title's. Because `dateEl`/labels/`linksEl` are now siblings *outside* that flex row (not absorbed into a taller shared box as before), this can introduce a few px of extra vertical gap between the title and the date/label/link rows on cards with short titles — a minor visual side effect the plan doesn't call out or add to the manual verification plan. Not a functional bug, but worth an explicit check (e.g. a short-title, non-high-priority task card) alongside the long-description case already in verification step 2.
2. **[Nit]** The Background section states PR #70's commit range as `742c012..11a5573`. Verified via `git log`: `742c012` is the prior merge commit (PR #69) and `11a5573` ("fix: board/tag UX polish batch (#70)") is a linear, single squash commit directly on top of it — so the range is accurate as a diff range, though `11a5573` itself is not a merge commit (no second parent), just a squash-merged PR commit. This doesn't affect anything in the plan; noted only for precision.

### Unverified assumptions

- All file:line citations were checked against the current `main` (post-PR #70, post-PR #70-docs, at commit `d23bd7e`) and are accurate exactly as stated: `LabelFilterChips.tsx:29` (`justify-end` div), `:30-48` (chip block), `:49-63` (AND/OR block), `:64-68` (Clear filters block); `TaskCardBody.tsx:91` (link `<a>` className), `:103-148` (`actionsEl`), `:150-161` (`'stacked'` branch), `:163-176` (`'inline'` branch), `:165` (`flex-1 min-w-0` wrapper div). No discrepancies found — main was correctly re-checked rather than relying on a stale cache.
- Item 1's claim that both call sites (`TasksPage.tsx:334-341`, `BoardGroupedTasks.tsx:83-90`) pass the identical six-prop interface was independently confirmed by reading both call sites — reordering the internal JSX blocks is safe and prop-order-independent as claimed.
- Item 2's flexbox root-cause claim ("a flex item's width is fixed for the full height of the row it participates in, so `actionsEl`'s reserved column narrows the date/label/link rows by the same amount as the title row") was verified as technically correct CSS reasoning by reading the actual JSX/class structure, and the proposed fix (moving `dateEl`/`renderLabels`/`linksEl` outside the `flex-1 min-w-0` wrapper) does resolve it given that `TaskCard.tsx:52` wraps `<TaskCardBody>` in a plain block `<div>` (not itself a flex/grid item requiring `min-w-0` on its children) — so no overflow risk from removing that ancestor's `min-w-0` scope. The specific pixel figures in the problem statement ("~100-120px inside a ~208-240px-wide kanban card", "confirmed via a zoomed screenshot") could not be independently verified since that requires a running browser, which is out of scope for a static plan review — but they are consistent with the code-level reasoning and not implausible.
- The "no existing unit-test coverage" claim for both components was confirmed: `frontend/src/__tests__/` contains no files referencing `TaskCardBody` or `LabelFilterChips`.
- The claim that the `'stacked'` layout (lines 150-161, `FocusedTaskCard.tsx` only) needs no change was confirmed — its `actionsEl` is already a separate block-level sibling (`<div className="flex justify-end mt-2">`) placed *after* `linksEl`, not sharing a flex row with the content stack at all, so it was never subject to the width-narrowing bug in the first place.

### Suggestions

- Add a fourth manual verification step: on a kanban card with a short, single-line title and no high-priority badge, confirm there's no new visible gap between the title and the date/label rows (addresses Issue #1).
- Consider whether `actionsEl`'s icon-row height and the title row's line height could be visually reconciled (e.g. `items-center` instead of `items-start` on the outer row) if Issue #1 turns out to be noticeable in practice — not necessary to decide now, just worth having in mind if the manual check surfaces a visible gap.

— *Sneezy*

## Grumpy's response — 2026-08-05

- **Issue 1 (Gap, potential vertical misalignment on short titles):** Addressed. Item 2's fix now changes the outer row from `items-start` to `items-center`, per Sneezy's suggestion, so the title row and `actionsEl` stay vertically centered against each other regardless of which is taller. Added a 4th manual verification step covering a short-title, non-high-priority card.
- **Issue 2 (Nit, commit-range precision):** Acknowledged, no plan change needed — `11a5573` being a squash commit rather than a merge commit doesn't affect anything the plan relies on.

Awaiting user approval before implementation begins.
