# PLAN-fix-overdue-shading-and-tag-filter-scrollbar

## Status
**State:** Ready for PR
**Last updated:** 2026-08-14 by Grumpy
**Next step:** Commit on branch `fix-overdue-shading-and-tag-filter-scrollbar`, push, and open the PR.
**Blocked on:** n/a

Both items implemented. `tsc -b` clean. `vitest run` passes for all new/touched tests (35/35 in `priorityColor.test.ts` + `taskFilters.test.ts`); the one pre-existing failure in `taskDateUtils.test.ts` (`getColumn` "upcoming" test, day-of-week-dependent) reproduces identically on unmodified `main` and is unrelated to this change. Manually verified in the browser (Docker stack): overdue cards render `bg-red-50` regardless of tier (Overdue tab and kanban Overdue column), No Date cards render plain white instead of green, Today/Tomorrow tier cards unchanged, and selecting a previously-off-screen tag chip moves it to the front of the filter row live. The scrollbar padding fix was verified via computed styles (`padding-bottom: 8px` / `margin-bottom: -8px`, canceling out) rather than visually, since this sandbox's Chrome uses overlay scrollbars that don't reproduce the original clipping bug regardless of window width — consistent with Sneezy's Issue 4 caveat.

## Branch
`fix-overdue-shading-and-tag-filter-scrollbar`, cut from up-to-date `main`.

## Scope
Two independent, small UI fixes to the web Tasks page, bundled into one PR because both are frontend-only display bugs in the same page area (the kanban board and its tag-filter header) and bundling saves a second full review-chain round-trip. **Frontend-only** (`frontend/src/`). No backend, API, or data-model changes. Single-component deploy (frontend build only) — triggers a Railway deploy per `CLAUDE.md`.

## Background / current behavior

### Item 1: overdue cards aren't shaded, and Upcoming/No-Date cards are wrongly tinted
PR #73 (priority tiers epic, merged) added `PRIORITY_CARD_BG` (`frontend/src/utils/priorityColor.ts`) mapping `high`→`bg-orange-50`, `medium`→`bg-blue-50`, `normal`→`bg-green-50`, applied as the card background in both `TaskCard.tsx` (kanban board, `frontend/src/components/TaskCard.tsx:68`) and `FocusedTaskCard.tsx` (Today/Tomorrow/Overdue/Focused views, `frontend/src/components/FocusedTaskCard.tsx:100`).

Two problems with this, confirmed by reading `frontend/src/utils/taskPriority.ts` and `frontend/src/utils/taskDateUtils.ts`:
1. **Overdue cards get no distinct shading.** `isPriorityEligible()` (`taskPriority.ts:7-9`) only allows High/Medium tiers for the `today`/`tomorrow`/`day_after_tomorrow`/`monday` columns — the `overdue` column is *not* in that eligible set, but `resolveDropPriority`/`resolveShiftedPriorityTier` never force overdue tasks down to `normal` either, so an overdue task can carry any tier and gets tier-colored (orange/blue/green) rather than a red "this is overdue" shade. There is no visual "overdue" treatment at the card level at all today — only the board's `overdue` *column* container gets `border-red-200 bg-red-50` (`TasksPage.tsx:509-511`), and only in the kanban "All" view; the Overdue tab (`DayView` → `BoardGroupedTasks` → `FocusedTaskCard`) has no red treatment anywhere.
2. **Upcoming/No-Date cards are always tinted green**, because those columns are never priority-eligible (confirmed above), so `splitByPriority` / the task's stored `priority` is always `'normal'` there → always `bg-green-50`. The user's intent is that a card only gets a priority tint when it actually has an assignable priority; Upcoming/No-Date tasks structurally cannot have one, so they should render with no background tint (plain white card, same as the existing `isEditing ? 'bg-white' : ...` white state).

**Fix:** replace the direct `PRIORITY_CARD_BG[task.priority]` lookup with a new pure helper, `taskCardBg(columnKey, priority)`, in `frontend/src/utils/priorityColor.ts`:
```ts
import type { ColumnKey } from './taskDateUtils';

export function taskCardBg(columnKey: ColumnKey, priority: PriorityTier): string {
  if (columnKey === 'overdue') return 'bg-red-50';
  if (columnKey === 'upcoming' || columnKey === 'nodate') return 'bg-white';
  return PRIORITY_CARD_BG[priority];
}
```
`PRIORITY_CARD_BG` itself is unchanged (still exported, still covers the `today`/`tomorrow`/`day_after_tomorrow`/`monday` case via the fallthrough) — existing tests for it keep passing unmodified.

Call-site changes:
- **`FocusedTaskCard.tsx`**: already computes `columnKey` locally via `getColumn(task, today, tomorrow)` (line 43, used for `isPriorityEligible`). Line 100's `PRIORITY_CARD_BG[task.priority]` becomes `taskCardBg(columnKey, task.priority)`. No prop changes — this component is used identically by both `DayView`'s Overdue tab and `BoardGroupedTasks`'s Focused view, so the fix applies to every place overdue tasks render as `FocusedTaskCard`.
- **`TaskCard.tsx`**: does not currently know its column. Add a new required prop `columnKey: ColumnKey`. Line 68's `PRIORITY_CARD_BG[task.priority]` becomes `taskCardBg(columnKey, task.priority)`. Requires adding `import type { ColumnKey } from '../utils/taskDateUtils'` and swapping the existing `import { PRIORITY_CARD_BG } from '../utils/priorityColor'` (line 9) for `import { taskCardBg } from '../utils/priorityColor'`.
- **`TasksPage.tsx`**: `TaskCard` is rendered at two call sites inside the `COLUMNS.map((col) => ...)` loop, both already inside a closure where `col.key` (type `ColumnKey`) is in scope:
  - Line 489 (priority-tiered columns — `today`/`tomorrow`/`day_after_tomorrow`/`monday`/`overdue`, inside `renderTierZone`): add `columnKey={col.key}`.
  - Line 600 (Upcoming/No-Date columns, no priority split): add `columnKey={col.key}`.

No other `TaskCard` call sites exist (confirmed: only `TasksPage.tsx` renders it; no test file renders `TaskCard` directly, so no test call sites need updating).

### Item 2: tag filter chips — selected tags should lead, and the scrollbar clips the buttons
`LabelFilterChips.tsx` renders one scrollable row of tag chips (`frontend/src/components/LabelFilterChips.tsx:59-81`):
```tsx
<div className="overflow-x-auto min-w-0 flex-1 -mx-1 px-1">
  <div className="flex justify-end gap-1.5 min-w-full w-max">
    ...catLabels.map(...)
  </div>
</div>
```
Two problems:
1. **Selected tags aren't visually prioritized.** Chips are sorted purely alphabetically (`.slice().sort((a, b) => a.value.localeCompare(b.value))`, line 62) and the row is right-aligned (`justify-end`). When there are more tags than fit on screen, a selected tag can scroll out of view with no indication it's still active. User wants selected tags to appear first, on the left.
2. **The horizontal scrollbar overlaps the chip row and clips it.** The scrollable div (`overflow-x-auto`) has no reserved space below its content for the scrollbar — on platforms with a non-overlay scrollbar (Windows, or Chrome with overlay scrollbars disabled), the scrollbar renders directly under the last pixels of the chip buttons, visually cutting into their bottom padding/text and making them hard to read, exactly as described.

**Fix:**
1. Add a pure sort helper `sortLabelsForFilter(labels, selectedLabelIds)` to `frontend/src/utils/taskFilters.ts` (alongside the existing `toggleLabelSelection`/`filterTasks` helpers, keeping sort logic testable and out of the component):
   ```ts
   export function sortLabelsForFilter(labels: Label[], selectedLabelIds: Set<string>): Label[] {
     return labels.slice().sort((a, b) => {
       const aSel = selectedLabelIds.has(a.id) ? 0 : 1;
       const bSel = selectedLabelIds.has(b.id) ? 0 : 1;
       if (aSel !== bSel) return aSel - bSel;
       return a.value.localeCompare(b.value);
     });
   }
   ```
   (Requires importing `Label` from `../api/tasks` in `taskFilters.ts`, matching the existing `Task`/`FocusedBoard` type-only imports there.)
2. In `LabelFilterChips.tsx`: replace the inline `.sort((a, b) => a.value.localeCompare(b.value))` (line 62) with `sortLabelsForFilter(catLabels, selectedLabelIds)`, and change `justify-end` → `justify-start` (line 60) so the (now selected-first) chips anchor left instead of right.
3. Give the scroll container its own space for the scrollbar instead of letting it overlap content: add bottom padding to the scrolling div and a matching negative margin so outer spacing is unaffected — `className="overflow-x-auto min-w-0 flex-1 -mx-1 px-1 pb-2 -mb-2"`. Additionally, add a small reusable thin-scrollbar utility class in `frontend/src/index.css` (no scrollbar plugin is installed — confirmed via `tailwind.config.js`, plugins: `[typography]` only) and apply it to the same div, so the scrollbar itself is slimmer and less visually intrusive even where it does show:
   ```css
   .scrollbar-thin-x {
     scrollbar-width: thin; /* Firefox */
   }
   .scrollbar-thin-x::-webkit-scrollbar {
     height: 6px;
   }
   .scrollbar-thin-x::-webkit-scrollbar-thumb {
     background-color: rgb(209 213 219); /* tailwind gray-300 */
     border-radius: 9999px;
   }
   ```
   This is additive global CSS (a new class, no existing selectors touched) — no risk to other scrollable elements (e.g. the kanban board's own `overflow-x-auto` at `TasksPage.tsx:424`, which is left unchanged since it wasn't reported as broken).

`LabelFilterChips` is rendered from two call sites (`TasksPage.tsx`, `BoardGroupedTasks.tsx`) via the same six-prop interface, which is unchanged — no call-site changes needed for item 2.

## Files to modify
- `frontend/src/utils/priorityColor.ts` (item 1 — new `taskCardBg` helper)
- `frontend/src/components/TaskCard.tsx` (item 1 — new `columnKey` prop)
- `frontend/src/components/FocusedTaskCard.tsx` (item 1 — use new helper)
- `frontend/src/pages/TasksPage.tsx` (item 1 — pass `columnKey` at both `TaskCard` call sites)
- `frontend/src/utils/taskFilters.ts` (item 2 — new `sortLabelsForFilter` helper)
- `frontend/src/components/LabelFilterChips.tsx` (item 2 — use helper, left-align, scrollbar padding)
- `frontend/src/index.css` (item 2 — new `.scrollbar-thin-x` utility class)
- `frontend/src/__tests__/priorityColor.test.ts` (new tests for `taskCardBg`)
- `frontend/src/__tests__/taskFilters.test.ts` (new tests for `sortLabelsForFilter` — file may already exist; add to it if so)

## Data model changes
None.

## API / contract changes
None.

## Test changes
Unit tests only (no integration test file changes — this project's integration suite doesn't cover component-level rendering, consistent with prior UI-only plans in this repo):
- `taskCardBg`: overdue → `bg-red-50` regardless of priority; upcoming/nodate → `bg-white` regardless of priority; today/tomorrow/day_after_tomorrow/monday → falls through to `PRIORITY_CARD_BG[priority]` for each of high/medium/normal.
- `sortLabelsForFilter`: selected label(s) sort before unselected regardless of alphabetical order; ties within the selected group and within the unselected group both fall back to alphabetical; empty `selectedLabelIds` produces pure alphabetical order (matching current behavior).

## Deployment
Single component (frontend only). No staggered/backward-compat concerns — no API contract changes, no mobile files touched.

## Manual verification plan
Run the app locally (`/run` skill), then in the browser, on the kanban ("All") board view and the Overdue tab:
1. A task with a past `must_do_by`/`target_date` renders with a light red card background, regardless of its priority tier.
2. A task in the Upcoming or No Date column renders with a plain white background (no green tint).
3. Today/Tomorrow/day-after-tomorrow/Monday cards still shade by tier as before (orange/blue/green for high/medium/normal).
4. On a board with enough tags to require scrolling the tag-filter row: selected tags appear first (left side); scrolling the row does not clip or obscure the chip text/buttons at the bottom edge. **Force non-overlay scrollbars before testing this step** (macOS: System Settings → Appearance → "Show scroll bars" → Always; or use Chrome DevTools device toolbar) — with default macOS overlay scrollbars the original clipping bug doesn't reproduce, so this step would trivially pass without exercising the fix.
5. Toggling a tag's selection moves it to/from the front of the row live.
6. Match-mode toggle / "Clear filters" button and the tag-chip row remain vertically aligned (`items-center` on the parent) after the `pb-2 -mb-2` change to the scroll container.

---

## Sneezy's Review — 2026-08-14

**Tier:** LIGHT — no proposed file falls under a model/schema/router/API area; plan declares no data-model changes and single-component (frontend-only) deployment. Gate confirmed correct on inspection — nothing in the source touches a model/schema/router/API-contract file, so no escalation to FULL was warranted.

**Verdict:** Approved

### Issues

1. **[Nit]** `frontend/src/components/TaskCard.tsx` — the plan doesn't spell out the two new imports the fix requires (`import type { ColumnKey } from '../utils/taskDateUtils'` for the new prop type, and `taskCardBg` alongside/replacing the existing `PRIORITY_CARD_BG` import from `../utils/priorityColor` at line 9). Trivial, but the plan was explicit about this same detail for `taskFilters.ts` ("Requires importing `Label`...") and not for `TaskCard.tsx`, so it's an inconsistency in documentation thoroughness rather than a functional gap.
2. **[Nit]** Verified `TIER_META` in `TasksPage.tsx:38-58`: the overdue column's per-tier zone headers (`bg-orange-100`/`bg-blue-100`/`bg-green-100` with matching border/text) are unaffected by this plan and will continue to render above cards that are now uniformly `bg-red-50` regardless of tier. This is a real visual consequence the plan doesn't mention, but it's an extension of a pattern that already exists today (the overdue column container itself is already `bg-red-50`/`border-red-200` at `TasksPage.tsx:509-511`, sitting under the same tier-colored zone headers), so the severity is low — flagging for awareness, not as a blocker.
3. **[Gap]** The manual verification plan doesn't ask the reviewer to check vertical alignment of the tag-filter row against the match-mode buttons/"Clear filters" button after adding `pb-2 -mb-2` to the scroll container (`LabelFilterChips.tsx:59`). By the CSS box model this should be a no-op for cross-axis alignment (padding added and margin subtracted by equal amounts cancel out on the margin box, and the parent at line 36 is `items-center`), but it's cheap to eyeball and isn't currently a verification step.
4. **[Gap]** The manual verification plan doesn't note that the scrollbar-clipping bug being fixed may not be reproducible on macOS with default overlay scrollbars (the bug report is specific to non-overlay scrollbar platforms, per the plan's own diagnosis in the Background section). A reviewer testing only on macOS could "pass" step 4 without ever exercising the actual bug. Worth a one-line note to force non-overlay scrollbars (macOS System Settings → Appearance → "Always" show scrollbars, or Chrome DevTools) before signing off on that step.

### Unverified assumptions

None — every factual claim in the plan (line numbers, call-site counts, existing test coverage, absence of other `TaskCard`/`PRIORITY_CARD_BG` consumers, `LabelFilterChips` call sites, `taskFilters.ts` current imports, `index.css` current contents, and the `tailwind.config.js` plugins list) was independently verified by reading the actual source files and cross-checked with grep, and all matched the plan's description exactly:
- `taskPriority.ts:7-9` (`isPriorityEligible` excludes `overdue`) — confirmed.
- `TaskCard.tsx:68` and `FocusedTaskCard.tsx:100` (`PRIORITY_CARD_BG[task.priority]` inline in the `isEditing` ternary) — confirmed.
- `TasksPage.tsx:489` and `:600` (the two `TaskCard` call sites, both inside the `COLUMNS.map` closure with `col.key: ColumnKey` in scope) — confirmed; `columnTasks` (`TasksPage.tsx:222-255`) is bucketed via the same `getColumn(task, today, tomorrow)` used to key `COLUMNS`, so passing `col.key` as the new `columnKey` prop is guaranteed consistent with each task's actual computed column.
- No other `TaskCard` call sites and no test file renders `TaskCard` directly — confirmed via grep.
- `LabelFilterChips.tsx:59-81` structure, `LabelFilterChips` called from exactly `TasksPage.tsx` and `BoardGroupedTasks.tsx` with the same 6-prop interface — confirmed.
- `taskFilters.ts` currently imports only `Task`/`FocusedBoard` (type-only) — confirmed, so the plan's proposed `Label` import addition is consistent with existing style.
- `tailwind.config.js` plugins list is `[typography]` only, no scrollbar plugin — confirmed.
- Existing unit test files (`priorityColor.test.ts`, `taskFilters.test.ts`) exist and only test the current exports; no component-level test files exist for `TaskCard`, `FocusedTaskCard`, or `LabelFilterChips` — confirmed, consistent with the project's stated convention (frontend unit tests target pure utility functions).

### Suggestions

- Consider adding the two import lines explicitly to the "Fix" section for `TaskCard.tsx` (see Issue 1) purely for plan completeness/session-survivability, per this project's plan-lifecycle requirement that a plan be resumable by a fresh agent with zero prior context.
- Consider adding a short note to the manual verification plan about forcing non-overlay scrollbars when testing on macOS (see Issue 4), so the fix for item 2.2 is actually exercised during sign-off rather than trivially passing.

— *Sneezy*

## Grumpy's response — 2026-08-14

- **Issue 1 (Nit, missing `TaskCard.tsx` import detail):** Addressed. The item 1 fix section now spells out both new imports (`ColumnKey` type import, `taskCardBg` replacing `PRIORITY_CARD_BG`).
- **Issue 2 (Nit, tier-colored zone headers above uniformly-red overdue cards):** Acknowledged, no plan change — this is an existing visual pattern (the overdue column container is already `bg-red-50`/`border-red-200` under the same tier headers today), not a regression introduced by this change, and out of scope for these two bug reports.
- **Issue 3 (Gap, alignment check missing from verification plan):** Addressed. Added manual verification step 6 (match-mode/Clear-filters row stays vertically aligned with the chip row after the `pb-2 -mb-2` change).
- **Issue 4 (Gap, macOS overlay scrollbars could mask the bug):** Addressed. Manual verification step 4 now explicitly calls out forcing non-overlay scrollbars before testing.

Proceeding to implementation.
