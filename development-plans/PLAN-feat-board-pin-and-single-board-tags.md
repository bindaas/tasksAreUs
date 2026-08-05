# PLAN: Board pin + single-board tag filter chips

## Status
**State:** Ready for PR
**Last updated:** 2026-08-05 by Grumpy
**Next step:** Open PR against main
**Blocked on:** n/a

### Implementation notes (deviations from plan)
- Local chip-selection reset (Design §2) is implemented as a render-time state adjustment (`labelResetKey` compared during render, per React's documented pattern for "adjusting state when a prop changes") rather than a `useEffect`. A literal `useEffect(() => setSelectedLabelIds(new Set()), [...])` trips this repo's `react-hooks/set-state-in-effect` eslint rule; the render-time-adjustment form is lint-clean and avoids an extra render pass. Behavior is identical to what the plan specifies.
- Pin button uses the 📌 emoji glyph, which does not respond to CSS `color` (unlike the SVG chevron the plan's Design §3 compares it to). Active/inactive is instead conveyed via a background pill + ring (active) vs. dimmed opacity (inactive) on the button itself, verified visually in-browser. Same click behavior as planned.
- All items from Sneezy's review were addressed inline in Design §1/§2 (see "Grumpy's response to Sneezy's review" above) before implementation began.

### Manual verification performed (2026-08-05, local Docker stack)
- Two boards ("Job search", "General tasks") each seeded with one task due today, one carrying a distinct label.
- Confirmed: with both boards visible, no chips render; pinning one board collapses the other and shows chips scoped to only the pinned board's labels (not the other board's).
- Confirmed: clicking the pinned (visible) board's own header unpins without collapsing it (first click), matching Design §1's documented unpin-first behavior.
- Confirmed: "Collapse all" / "Expand all" clears the pin.
- Confirmed: chip filtering narrows the single visible board's tasks (selecting a label the task doesn't have hides it) without affecting the other (collapsed) board's count.
- Confirmed: auto-recovery — completing the pinned board's only qualifying task drops that board out of the view entirely; the remaining board auto-unpins and renders expanded (not collapsed), per the Design §2 auto-recovery effect addressing Sneezy's Issue 2.

Branch: `feat/board-pin-and-single-board-tags`

## Scope

Two related, small UI features for the board-grouped views (Overdue/Focused/Today/Tomorrow — i.e. every `TasksPage` view except "All"). Both are implemented via the same shared component, `BoardGroupedTasks.tsx`, which every one of those four views renders through (`DayView.tsx` / `FocusedView.tsx` both call `<BoardGroupedTasks boards=... viewKey=... />` and need no changes themselves).

1. **Pin a board**: a control per board that collapses every other board in the current view and expands only the pinned one.
2. **Single-board tag chips**: when exactly one board is "effectively visible" in one of these views (not collapsed, and has at least one task), show label/tag filter chips scoped to that board, functioning like the chips already shown in the "All" view.

Explicitly out of scope (per user decision during planning):
- Archive page (`ArchiveBoardGroups.tsx` / `ArchiveBoardTabs.tsx`) — not touched by either feature.
- Persisting pin state to the backend — pin is session-only, exactly like today's board-collapse state.
- A single global pin across views — pin is scoped per view (`ViewKey`), same as collapse.
- **Mobile (`mobile/src/`) — deferred to a follow-up plan.** Originally an oversight (this plan only researched `frontend/src`), caught when the user asked about it. Mobile has its own separate `BoardGroupedTasks.tsx` (`mobile/src/components/BoardGroupedTasks.tsx`) which is architecturally different from web's: there's no `BoardCollapseContext` equivalent — collapse state is plain local `useState` inside `mobile/src/screens/TasksScreen.tsx` (930 lines), passed down as props (`collapsedBoardIds`, `onToggleBoard`, `onSetAllCollapsed`) to a dumb presentational component. There's also no existing label/tag-chip filtering wired into mobile's grouped views. Adding parity there is not a small addendum — it means introducing pin state from scratch (new context or `TasksScreen`-local) and building label-chip filtering into mobile's grouped views for the first time. User decided to ship web-only now and treat mobile as a separate, independently-scoped follow-up plan.

## Data model changes

None. No backend, API, router, or schema changes. Both features are frontend-only, session-scoped UI state (extending the existing in-memory `BoardCollapseContext`), consistent with how board collapse already works today (`Record<ViewKey, Set<string>>`, reset on reload, no cleanup on board delete/rename).

## Design

### 1. Pin (`BoardCollapseContext.tsx`)

Current shape:
```ts
export type ViewKey = 'overdue' | 'focused' | 'today' | 'tomorrow' | 'archive';
collapsed: Record<ViewKey, Set<string>>
isCollapsed(view, boardId)
toggleBoard(view, boardId)
setAllCollapsed(view, boardIds, collapse)
```

New shape adds:
```ts
pinned: Record<ViewKey, string | null>   // all null initially
isPinned(view, boardId): boolean
pinBoard(view, boardId): void            // pinned[view] = boardId
unpinBoard(view): void                   // pinned[view] = null
getPinnedBoardId(view): string | null    // raw accessor, used by BoardGroupedTasks for auto-recovery (see Design §2)
```

Behavior changes to existing functions:
- `isCollapsed(view, boardId)`: if `pinned[view] !== null`, return `boardId !== pinned[view]` (everyone but the pinned board reads as collapsed). Otherwise, unchanged (`collapsed[view].has(boardId)`).
- **The underlying `collapsed[view]` Set is never mutated by pinning/unpinning.** This is the key simplification: unpinning doesn't need to snapshot/restore anything — it just stops overriding, and whatever manual collapse layout existed before the pin reappears untouched.
- `toggleBoard(view, boardId)`: if `pinned[view] !== null`, the click **only clears the pin** (`pinned[view] = null`) and returns — it does not also toggle `boardId`'s membership in the Set on that same click.
  - Rationale (traced through explicitly during planning): combining "unpin + toggle" in one click is ambiguous when the pre-pin state was the default (empty Set = everything expanded). A click meant to "expand this board" would XOR against a Set that already didn't contain it, collapsing it instead — the opposite of what the user just clicked for. Unpin-only-first is unambiguous: first click always reveals the prior layout as-is; a second click behaves as a normal toggle on top of that.
- `setAllCollapsed(view, boardIds, collapse)`: also clears `pinned[view] = null` before applying the bulk Set change (this is an explicit, unambiguous user action — "Expand all"/"Collapse all" — so no special-casing needed here).

Pure/testable logic extracted to `frontend/src/utils/boardVisibility.ts`:
```ts
export function effectiveCollapsed(pinnedBoardId: string | null, collapsedSet: Set<string>, boardId: string): boolean

export function findSingleVisibleBoard<T extends { board_id: string; tasks: unknown[] }>(
  boards: T[],
  isCollapsed: (boardId: string) => boolean,
): T | null
```
`BoardCollapseContext.isCollapsed` calls `effectiveCollapsed`. `BoardGroupedTasks` calls `findSingleVisibleBoard` (see below). Covered by `frontend/src/__tests__/boardVisibility.test.ts` (matches project convention: pure utils are unit-tested, contexts/components are not required to be).

### 2. Single-board tag chips (`BoardGroupedTasks.tsx`)

- After computing today's `filteredBoards` (already search-filtered via `filterBoards`), derive:
  ```ts
  const singleVisibleBoard = findSingleVisibleBoard(filteredBoards, (id) => isCollapsed(viewKey, id));
  ```
  A board qualifies if it's not collapsed *and* has `tasks.length > 0`. Because pinning drives `isCollapsed` the same way manual collapse does, a pinned board with tasks satisfies this automatically — no separate pin-awareness needed in this computation.
- **Auto-recovery for a vanished pin target** (added in response to Sneezy's review — see below): a `useEffect` in `BoardGroupedTasks` reads `getPinnedBoardId(viewKey)` and, whenever it's non-null but no longer present in `filteredBoards.map(b => b.board_id)` (board deleted, or its tasks rescheduled out of this view's date window), calls `unpinBoard(viewKey)`. This prevents a stale pin from silently collapsing every remaining board in the view with no visible affordance to recover — "Expand all" remains a manual escape hatch too, but this makes it automatic in the common case (pin target simply stops qualifying) rather than relying on the user finding "Expand all."
- When `singleVisibleBoard` is non-null, fetch its labels via the existing hook: `useLabels(singleVisibleBoard?.board_id ?? '')`. Passing `''` (not `undefined`) is deliberate — `useLabels`'s `usingOverride` check is `boardIdOverride !== undefined`, so passing `''` keeps `usingOverride` true and skips the hook's fallback to the globally active board (`BoardContext.activeBoard`, which drives the unrelated "All" tab and has no relation to whichever board happens to be the lone visible one in this view). The hook's own `if (!boardId) return` guard then naturally skips fetching when there's no qualifying board. No changes to `useLabels.ts` needed.
- Selected label IDs for this feature are **local state inside `BoardGroupedTasks`**:
  ```ts
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  function toggleLocalLabel(labelId: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      next.has(labelId) ? next.delete(labelId) : next.add(labelId);
      return next;
    });
  }
  ```
  not the shared `FilterContext`. Reason: `FilterContext.selectedLabelIds` is one global `Set` used by the "All" view, scoped implicitly to whatever board is active there. Sharing it here would let a label ID selected against one board silently leak into a grouped view showing an unrelated board, producing a filter that matches nothing with no visible explanation. A `useEffect` resets `selectedLabelIds` to empty whenever `singleVisibleBoard?.board_id` changes (covers the case where collapse/pin state changes which board qualifies). `toggleLocalLabel` is passed as `LabelFilterChips`'s `onToggle` prop (see placement snippet below); `() => setSelectedLabelIds(new Set())` is passed as `onClear`.
- Filtering applied via the existing `filterTasks(board.tasks, selectedLabelIds, '')` from `utils/taskFilters.ts` (search is already applied upstream by `filterBoards`, so pass `''` for the query here) — same filter function the "All" view uses, applied to just the single visible board's task list before rendering `FocusedTaskCard`s. Concretely, inside the existing `filteredBoards.map((board, idx) => { ... })` loop (`BoardGroupedTasks.tsx:40`), the task list handed to `.map(FocusedTaskCard)` (currently `board.tasks`, line 59) becomes:
  ```ts
  const displayTasks = board.board_id === singleVisibleBoard?.board_id
    ? filterTasks(board.tasks, selectedLabelIds, '')
    : board.tasks;
  ```
  i.e. every other board in the loop renders unfiltered exactly as today; only the single qualifying board's own row is narrowed by the local chip selection.
- Chip UI is extracted from `TasksPage.tsx`'s inline block (lines ~341-378) into a small shared component, since it's now needed verbatim in two places:
  ```ts
  // frontend/src/components/LabelFilterChips.tsx
  function LabelFilterChips({
    labelsByCategory: Record<string, Label[]>,
    selectedLabelIds: Set<string>,
    onToggle: (labelId: string) => void,
    onClear: () => void,
  })
  ```
  `CATEGORIES`/`CATEGORY_COLORS` (currently module-level constants in `TasksPage.tsx:34-42`) move into `LabelFilterChips.tsx` as internal constants, not props — decided in response to Sneezy's review (see below). This matches today's reality (a single `'type'` category) without inventing a props API nothing currently needs; if a second category is ever added to this view, promoting them to props is a one-file change at that point. The component also preserves the existing `a.value.localeCompare(b.value)` sort of labels within each category (currently `TasksPage.tsx:345`), so neither call site's visual order regresses.

  `TasksPage.tsx` swaps its inline block for `<LabelFilterChips labelsByCategory=... selectedLabelIds={selectedLabelIds} onToggle={toggleLabel} onClear={clearLabels} />` (from `FilterContext`, unchanged). No visual/behavioral change to the existing "All" view.

  **Placement in `BoardGroupedTasks.tsx`:** rendered conditionally, between the existing "Expand all"/"Collapse all" row (`BoardGroupedTasks.tsx:31-39`) and the `filteredBoards.map(...)` board list (line 40) — i.e. inside the outer `<div className="space-y-6">` (line 30), as a sibling immediately after the `<div className="flex justify-end">...Expand/Collapse all...</div>` block:
  ```tsx
  <div className="space-y-6">
    <div className="flex justify-end">{/* Expand all / Collapse all — unchanged */}</div>
    {singleVisibleBoard && (
      <LabelFilterChips
        labelsByCategory={labelsByCategory}
        selectedLabelIds={selectedLabelIds}
        onToggle={toggleLocalLabel}
        onClear={() => setSelectedLabelIds(new Set())}
      />
    )}
    {filteredBoards.map((board, idx) => { /* unchanged */ })}
  </div>
  ```
  Mirrors the "All" view's layout (chips row sits above the task-bearing content, below any board-level controls).

### 3. Pin button UI (`BoardGroupedTasks.tsx`)

- The board header is currently a single `<button onClick={toggleBoard}>` wrapping the chevron, color dot, name, and count. It becomes a `<div className="flex items-center gap-2 mb-3">` containing:
  - The existing chevron/dot/name/count as a `<button className="flex-1 ...">` (collapse toggle, same `onClick={() => toggleBoard(viewKey, board.board_id)}`).
  - A new pin `<button>` (📌 glyph, color toggles active/inactive like other icon toggles in this codebase, e.g. the priority-collapse chevron) with `onClick={() => isPinned(viewKey, board.board_id) ? unpinBoard(viewKey) : pinBoard(viewKey, board.board_id)}` and `aria-pressed={isPinned(...)}`.
  - Two sibling `<button>`s instead of a nested button, which is required regardless (a `<button>` cannot contain another `<button>`).

## Files touched

| File | Change |
|---|---|
| `frontend/src/utils/boardVisibility.ts` | new (~20 lines) |
| `frontend/src/__tests__/boardVisibility.test.ts` | new |
| `frontend/src/context/BoardCollapseContext.tsx` | extend (57 → ~95 lines) |
| `frontend/src/components/BoardGroupedTasks.tsx` | extend (69 → ~140 lines) |
| `frontend/src/components/LabelFilterChips.tsx` | new, extracted (~35 lines) |
| `frontend/src/pages/TasksPage.tsx` | small edit: replace inline chip block with `<LabelFilterChips>` |

No changes to `DayView.tsx`, `FocusedView.tsx`, `ArchiveBoardGroups.tsx`, `ArchiveBoardTabs.tsx`, or any backend file.

## Test plan

- New unit test `boardVisibility.test.ts` covering `effectiveCollapsed` (no pin / pinned-self / pinned-other) and `findSingleVisibleBoard` (zero qualifying, one qualifying, multiple qualifying, qualifying-but-zero-tasks).
- Manual verification in-browser (dev server) per `/run` skill: pin/unpin across Focused/Today/Tomorrow/Overdue, verify chips appear only when exactly one board is visible, verify chip filtering narrows that board's tasks, verify "Expand all"/"Collapse all" clears pin, verify switching views resets local chip selection (component remounts). Also: pin a board, then reschedule/remove its only qualifying task so it drops out of the view — confirm the remaining boards auto-recover rather than staying fully collapsed (per Sneezy's review, addressed in Design §1/§2 above).
- No integration test changes anticipated (`backend/tests/integration/` is backend-only and untouched; this is a frontend-only feature).

## Deployment order

Single component (frontend only). Frontend changes are baked into the Docker image at build time (no separate frontend host per `CLAUDE.md`), so this ships as one Railway deploy. No backward-compatibility window needed — no API contract changes.

---

## Sneezy's Review — 2026-08-04

**Tier:** LIGHT — no proposed file falls under a model/schema/router/API area; plan declares no data-model changes and single-component (frontend-only) deployment. Confirmed on inspection: all six touched files are under `frontend/src/{context,components,pages,utils,__tests__}`, none of them import from or export to `backend/app/`. No escalation warranted.

**Verdict:** Approved with concerns

### Issues

1. **[Gap]** `LabelFilterChips.tsx`'s proposed prop signature (plan lines 72-79: `labelsByCategory`, `selectedLabelIds`, `onToggle`, `onClear`) omits any parameter for which categories to iterate or how to style/order them per category. The current inline block being extracted (`frontend/src/pages/TasksPage.tsx:34-42`) drives this off module-level `CATEGORIES: LabelCategory[] = ['type']` and `CATEGORY_COLORS: Record<LabelCategory, {active, inactive}>`. The plan doesn't say whether these constants move into `LabelFilterChips.tsx` (hardcoded there, fine today since there's only one category, but silently couples a "shared" component to `type`-specific styling) or become new props. An implementer has to invent this; worth deciding explicitly before implementation so the "All" view's rendering doesn't subtly change.
2. **[Risk]** `effectiveCollapsed`'s all-others-collapse-when-pinned behavior (plan lines 43, 51) has a failure mode the plan doesn't discuss: if the pinned board's id (`pinned[view]`) is no longer present in `filteredBoards` — board deleted, or (more likely in practice) its tasks simply reschedule out of this view's date window so the board itself stops appearing in `boards` — then for every remaining board `boardId !== pinned[view]` is true, so **all boards read as collapsed** and the view renders fully collapsed with no visible task cards. Because the vanished board's header (and thus its pin button) no longer renders, there is no per-board affordance to unpin. Recovery does exist — "Expand all" clears `pinned[view]` per plan line 47 — but this specific scenario (pin target silently disappearing from the view rather than the user explicitly clicking "Expand all") isn't called out, and the manual test plan (line 105) only exercises the general "Expand all clears pin" path, not "board I pinned vanished out from under me."
3. **[Nit]** Per the documented `toggleBoard` behavior (plan lines 45-46), clicking *any* board's header while a pin is active — including the one board currently visible because it's the pinned one — only clears the pin on that click; it does not also collapse the clicked board. So a user looking at the one expanded (pinned) board who clicks its header expecting it to collapse will instead see it unpin (and typically stay expanded, since the underlying Set likely still doesn't contain it), requiring a second click to actually collapse. This is a direct, reasoned consequence of the rationale already in the plan (lines 46), but the specific "user clicks the board they can already see" case isn't named, and could read as the button being unresponsive on first click. Worth a one-line UX note or acceptance in the plan.
4. **[Nit]** The inline chip block currently sorts each category's labels via `a.value.localeCompare(b.value)` (`TasksPage.tsx:345`) before rendering. The plan's extraction doesn't mention preserving this ordering; worth stating explicitly in `LabelFilterChips`'s contract so neither call site's visual order regresses.

### Unverified assumptions

- Plan lines 6-7 ("`DayView.tsx`/`FocusedView.tsx` ... need no changes") — **verified true**: both components only pass `viewKey`/`boards`/`searchQuery`/`onRefresh` through to `BoardGroupedTasks` and never call `isCollapsed`/`toggleBoard`/`setAllCollapsed` themselves.
- Plan lines 67 (`useLabels`'s `usingOverride` / `boardIdOverride !== undefined` / `if (!boardId) return` guard) — **verified true**, matches `frontend/src/hooks/useLabels.ts:6-20` exactly.
- Plan line 19 / lines 40-41 ("no cleanup on board delete/rename... worst case is a harmless no-op") — this framing is accurate for the *existing* `collapsed` Set (a stray id there only affects that one board's own toggle state), but the plan reuses the same framing to justify not handling the *new* `pinned[view]` field the same way. As shown in Issue 2, a stray `pinned[view]` id is not equivalently harmless — it collapses every other board in the view, not just itself. This isn't confirmed broken by the plan (there's a recovery path), but the "harmless no-op" framing doesn't fully transfer to the new field and should be reconsidered rather than assumed.
- Plan lines 90 ("`ArchiveBoardGroups.tsx` ... not touched") — **verified true and verified safe**: `ArchiveBoardGroups.tsx:50,52,58,67` calls `useBoardCollapse()` and always passes the literal `'archive'` view key; since no UI ever calls `pinBoard('archive', ...)`, `pinned['archive']` stays `null` forever and `isCollapsed('archive', boardId)` falls through to the unchanged `collapsed['archive'].has(boardId)` path. Archive is genuinely unaffected.
- Line-count estimates in the "Files touched" table (57→~95, 69→~140, ~35 lines new) are unverifiable projections — not a concern, just noting they're approximate by nature.

### Suggestions

- Resolve Issue 1 by deciding up front whether `CATEGORIES`/`CATEGORY_COLORS` move into `LabelFilterChips.tsx` as internal constants (simplest, matches "only one category today") or become explicit props (more future-proof if a second label category is ever added to this view). Either is fine; the plan should just say which.
- Consider having `pinBoard`/the pin-click handler defensively no-op or the view auto-recover (e.g., treat a `pinned[view]` id absent from the current `boards` list the same as `null`) rather than relying solely on "Expand all" as the escape hatch for Issue 2 — cheap to add given `BoardGroupedTasks` already has `boards` in scope where `isCollapsed` is consulted.
- Add one manual test-plan line explicitly for "pin a board, then cause it to drop out of the current view (e.g. reschedule its only qualifying task elsewhere) — confirm the remaining boards are still reachable via Expand all."

— *Sneezy*

---

## Grumpy's response to Sneezy's review — 2026-08-04

1. **[Gap] `LabelFilterChips` prop contract** — Addressed. `CATEGORIES`/`CATEGORY_COLORS` stay as internal constants inside `LabelFilterChips.tsx` rather than becoming props, and the component's contract now explicitly states it preserves the existing `localeCompare` sort. See updated Design §2 above.
2. **[Risk] Stale pin collapsing the whole view** — Addressed. Added `getPinnedBoardId(view)` to `BoardCollapseContext`'s public API and a `useEffect` in `BoardGroupedTasks` that auto-unpins when the pinned id is no longer present in `filteredBoards`. See updated Design §1 and §2 above. The "harmless no-op" framing for stray ids (plan line 19) is retained for the `collapsed` Set only — it does not extend to `pinned`, per Sneezy's Unverified-assumptions note; `pinned` gets its own explicit recovery instead.
3. **[Nit] First click on the visible pinned board only unpins, doesn't collapse** — Not changed; accepted as intended behavior. This is the direct consequence of the unpin-first design already reasoned through in Design §1 (a combined "unpin + toggle" is ambiguous when the pre-pin Set state was empty). Noting it explicitly here so it's not mistaken for a bug during review: clicking the one visible (pinned) board's header first clears the pin; a second click then collapses it normally.
4. **[Nit] Preserve label sort order in extraction** — Addressed, folded into item 1 above.

Test plan addition (per Sneezy's suggestion): the manual test plan now includes pinning a board, then rescheduling/removing its only qualifying task so it drops out of the view, and confirming the remaining boards auto-recover (no longer relying solely on "Expand all").
