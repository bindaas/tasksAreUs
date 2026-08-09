# PLAN-feat-tag-filter-single-mode

## Status
**State:** Ready for PR
**Last updated:** 2026-08-09 by Grumpy
**Next step:** PR #75 opened (https://github.com/bindaas/tasksAreUs/pull/75). Next: run the `/full-review` chain (Dopey/Sleepy/Bashful/Doc) if/when requested by the user.
**Blocked on:** n/a

Implementation complete: all 7 files in Design §1-§7 done, `npx tsc --noEmit` clean, full Vitest suite passes (175/175, including 21 new tests for `toggleLabelSelection` and `filterTasks`'s SINGLE branch). Manual verification done via dev server + Chrome automation, covering every scenario in the Test plan section: mode switching (including the exactly-1-tag-survives-the-switch case), Clear button enable/disable, per-board persistence across both the All view's board tabs and a pinned view (same board_id, both views agree), and — the key fix from Sneezy's second-pass review — confirmed an off-screen board's multi-tag selection is *not* touched when switching mode while looking at a different board, and only reconciles (clears) the moment that board is actually viewed again. No console errors/warnings observed during the session.

## Requirement

Today the tag filter row offers a 2-way AND/OR match-mode toggle that only appears once 2+ tags are selected, and a "Clear filters" link that only appears once 1+ tags are selected. Tag *selection* itself is also not remembered: switching which board is active/pinned clears whatever tags were checked. The user wants two things:

### A. Three filter modes (Single / And / Or)

1. **Single** — selecting a tag deselects any previously-selected tag (only one tag active at a time). This is the new **default**.
2. **And** — existing multi-tag AND behavior (task must have all selected tags), unchanged.
3. **Or** — existing multi-tag OR behavior (task must have any selected tag), unchanged.

UI changes required:
- The mode control becomes a 3-button group: Single / And / Or.
- It is **always visible** (no longer gated on selection count).
- A "Clear filter" link/button sits next to it, **always visible but disabled/greyed when nothing is selected**.
- This control group is right-aligned on the tag row; the tag chips themselves stay left-aligned. (Note: the original rationale for this — "matches the board-tab buttons above it" — turned out to be based on an inaccurate read of `BoardTabs.tsx`, which is actually right-aligned via `justify-end` when tabs don't overflow. This does not change what's being built — left chips / right controls on the tag row itself, as explicitly requested — it only means that framing is dropped as unsupported.)
- This applies to every view that shows tags, including the pinned single-board view (not just the "All" kanban view).
- The mode (Single/And/Or) is a **session-scoped shared value** across all views for now — true cross-session persistence to the backend is an explicitly deferred future iteration, not part of this plan.

### B. Per-board tag selection persists for the session (added scope, 2026-08-09)

Which specific tags are checked for a given board must be remembered for the lifetime of the browser session, keyed purely by `board_id`, regardless of which view or board-tab you're looking at it from. Example: select Tag-A on board-1, switch to board-2, switch back to board-1 → Tag-A is still selected on board-1. This is **not** persisted to the database (matches the mode's session-scoped-for-now treatment) — a full page reload loses it, same as the mode.

This applies to **both** places a board's tags can be filtered:
- The "All" kanban view's board-tab switching (`BoardContext`'s `activeBoard`).
- The pinned/single-board views (`BoardGroupedTasks`'s `singleVisibleBoard`).

It is shared by `board_id` only — not scoped per view/viewKey (so board-1's selected tags look the same whether you're viewing it via the All-view tab or a pinned view).

## Decisions made with the user (do not re-litigate without new input)

1. **Mode scope — session-scoped shared, not yet backend-persisted.** The user was offered "one shared persisted (DB-backed) value" vs "per-view default only." They chose a third option they specified themselves: keep it **session-scoped for now**, but still shared/consistent across views within the session — DB persistence is planned as "the next iteration," not this one. Concretely: mode lives in one shared piece of client state that all views read from (not duplicated per-view local state), but there is no backend column, API change, or localStorage — a page reload resets to the hardcoded default (`SINGLE`), which happens to match the desired default so this is not user-visible as a regression.
2. **Switching to Single with a multi-tag selection active → clear the selection.** User picked "Clear the selection" (not "keep most recently selected tag") to avoid ambiguity about which tag should win. Scoped explicitly to *multi*-tag selections (Sneezy's first-pass review caught that the original design clearing unconditionally — even a single already-valid tag — deviated from this; fixed in the revised Design section below).
3. **Clear filter visibility → always visible, disabled when empty.** User picked this over "only show when active" (today's behavior), specifically because the new mode control is always visible and they want Clear grouped with it as a stable control, not popping in/out.
4. **Per-board tag selection persistence — added scope, both views, keyed by board_id only.** User confirmed (2026-08-09) that: (a) this applies to the "All" view's board-tab switching *and* pinned views, not just pinned views; (b) it's a single memory per `board_id`, not scoped separately per viewKey.

## Current implementation (verified by reading the code, 2026-08-09; expanded 2026-08-09 to include consumers Sneezy's first-pass review found missing)

- `frontend/src/context/FilterContext.tsx` — React Context (`FilterProvider`/`useFilter`), mounted at `frontend/src/App.tsx:90` (app root, reachable by every view). Holds `selectedLabelIds: Set<string>` and `matchMode: 'AND' | 'OR'` (default `'AND'`) in plain `useState`. `toggleLabel` unconditionally toggles membership in the Set. `selectedLabelIds` resets on `user?.uid` change; `matchMode` never resets. No localStorage, no backend call — pure in-memory.
- `frontend/src/context/BoardContext.tsx` (`BoardProvider`/`useBoard`, mounted at app root) — owns `activeBoard: Board | null`, the single "currently active" board for the All view, switched via `setActiveBoard`. **`setActiveBoard` (lines 68-73) calls `clearLabels()` from `useFilter()` whenever the board actually changes** (`if (board.id !== activeBoard?.id) clearLabels();`) — this is the existing, deliberate reset this plan's new per-board persistence (Requirement B) needs to remove, since a per-board memory map makes this reset both unnecessary and actively wrong (it would immediately erase the memory this feature exists to keep).
- `frontend/src/components/BoardGroupedTasks.tsx` — used for pinned/grouped non-"all" views. Keeps its **own independent** `useState<Set<string>>` for `selectedLabelIds` and `useState<'AND'|'OR'>` for `matchMode` (lines 29-30), separate from the context. Both are reset to empty/`'AND'` whenever the "single visible board" changes (lines 37-42, via the React-recommended render-time reset pattern, not an effect — the file's own comment at lines 32-36 explains this is deliberate, to avoid an extra render pass). `toggleLocalLabel` (lines 56-63) duplicates the same unconditional toggle-in-set logic as the context's `toggleLabel`. `LabelFilterChips` is only rendered when `singleVisibleBoard` is truthy (line 82), not gated on label count.
- `frontend/src/components/LabelFilterChips.tsx` (71 lines) — pure presentational component, receives `selectedLabelIds`, `onToggle`, `onClear`, `matchMode`, `onMatchModeChange` as props from whichever caller owns the state; agnostic of where that state lives. Single outer flex row (`mb-4 flex flex-wrap gap-1.5 items-center justify-start`, line 29): mode-toggle pill (lines 30-44, only rendered `{selectedLabelIds.size > 1 && ...}`) → "Clear filters" link (lines 45-49, only rendered `{selectedLabelIds.size > 0 && ...}`) → tag chips (lines 50-68, sorted alphabetically, one button per label).
- `frontend/src/utils/taskFilters.ts:10-28` — `filterTasks(tasks, selectedLabelIds, searchQuery, matchMode: 'AND'|'OR' = 'AND')`. When `selectedLabelIds.size > 0`, filters via `.every(...)` for AND or `.some(...)` for OR (lines 19-21). No existing helper for the label-toggle-on-click logic — that logic lives inline in both `FilterContext.toggleLabel` and `BoardGroupedTasks.toggleLocalLabel`, duplicated.
- `frontend/src/pages/TasksPage.tsx:82-86,215-216,377-386` — reads `matchMode`/`setMatchMode`/`selectedLabelIds`/`toggleLabel`/`clearLabels` from `useFilter()`, and separately reads `boards`/`activeBoard`/`setActiveBoard` from `useBoard()` (line 83) — already has `activeBoard` available, which the revised design (below) needs to key the per-board map. Passes filter state straight through to `LabelFilterChips` and to `filterTasks`. No board-tab row / tag row shared flex container — `BoardTabs` (line 374) and `LabelFilterChips` (line 378) are separate top-level blocks.
- `frontend/src/pages/TaskDetailPage.tsx:25,229` — reads `selectedLabelIds` from `useFilter()` to pre-populate a new task's labels (`labels.filter((l) => selectedLabelIds.has(l.id))`, line 229, only in the `isNew` branch) when creating a task from a filtered view. The relevant board for a new task is `labelsBoardId` (line 41: `liveBoardId ?? (isNew ? defaultBoardId : task?.board_id)`), already computed in this file. Under the revised per-board design this needs to become `labelsBoardId ? getBoardLabelSelection(labelsBoardId) : new Set()` instead of the flat `selectedLabelIds`. *(This consumer, and the `BoardContext.setActiveBoard` one above, were both missed in this plan's first draft — flagged by Sneezy's first-pass review as a session-survivability gap; both are now accounted for in the Design section below.)*
- No mobile equivalent exists (`grep -rl matchMode|LabelFilterChips mobile/` returns nothing; confirmed by Sneezy's first-pass review — `mobile/src/utils/taskFilters.ts` has its own separate, simpler OR-only `filterTasks` with no mode concept at all) — this is a web-frontend-only feature.
- Migration pattern for this project (relevant only because we are explicitly *not* touching it this iteration): `backend/app/main.py` uses idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statements at startup, not Alembic. `user_settings` (`backend/app/models.py:106-113`, `backend/app/routers/settings.py`) is the established pattern for a persisted global user preference and is the template to use *when* mode/selection persistence is implemented in a future PR — noted here for that future work, out of scope now.

## Design (revised 2026-08-09 to add per-board selection persistence and resolve Sneezy's first-pass findings)

### 1. Shared `FilterMode` type + shared toggle helper (`frontend/src/utils/taskFilters.ts`)

Unchanged from the first draft. Add:
```ts
export type FilterMode = 'SINGLE' | 'AND' | 'OR';

export function toggleLabelSelection(prev: Set<string>, id: string, mode: FilterMode): Set<string> {
  if (mode === 'SINGLE') {
    if (prev.has(id) && prev.size === 1) return new Set();
    return new Set([id]);
  }
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
```
- `SINGLE`: clicking any tag replaces the whole selection with just that tag. Clicking the currently-selected tag again clears the selection.
- `AND`/`OR`: unchanged existing toggle-in-set behavior, now factored into one shared function so call sites can't drift.

Widen `filterTasks`'s `matchMode` param to `FilterMode`. No branch logic change: `SINGLE` routes through the existing `some` branch, logically identical to `OR` when the Set has at most one member — a guarantee `toggleLabelSelection` enforces in `SINGLE` mode.

### 2. `frontend/src/context/FilterContext.tsx` — replaces the flat Set with a per-board map (new)

Replace `selectedLabelIds: Set<string>` with a shared, board-keyed map, and centralize the mode-switch-clears-multi-selections logic here (rather than duplicating it per view, and rather than scoping it to only the currently-visible board — see rationale below):

```ts
interface FilterContextValue {
  matchMode: FilterMode;
  setMatchMode: (mode: FilterMode) => void;
  getBoardLabelSelection: (boardId: string) => Set<string>;
  toggleBoardLabel: (boardId: string, labelId: string) => void;
  clearBoardLabelSelection: (boardId: string) => void;
}

const EMPTY_LABEL_SET = new Set<string>(); // stable reference for the "no selection yet" case
```

- `matchMode` default becomes `'SINGLE'` (was `'AND'`).
- `boardLabelSelections: Map<string, Set<string>>` (new internal `useState`), keyed by `board_id`. `getBoardLabelSelection(boardId)` returns `boardLabelSelections.get(boardId) ?? EMPTY_LABEL_SET` — the stable empty-set reference matters because `TasksPage.tsx` feeds this into a `useMemo` dependency array (line 215-216); a fresh `new Set()` per call would defeat memoization for boards with no selection.
- `toggleBoardLabel(boardId, labelId)` reads the board's current set (or empty), applies the shared `toggleLabelSelection(current, labelId, matchMode)`, and writes back into a new `Map` (immutable update). Deletes the map entry entirely if the resulting set is empty, to avoid unbounded growth of empty entries across a long session of board-hopping.
- `clearBoardLabelSelection(boardId)` deletes that board's entry from the map (no-op if absent).
- `setMatchMode` is a **plain setter with no side effects on `boardLabelSelections`** — it does not sweep or touch any board's stored selection. (Revised 2026-08-09, superseding an earlier draft of this section that swept every board's `size > 1` entry on switching to Single — see Sneezy's second-pass Risk finding below: a global sweep would silently mutate a board's remembered selection while the user is looking at a completely different board, with zero on-screen indication, directly undercutting Requirement B's persistence guarantee. The "at most one tag selected" invariant for Single mode is instead enforced locally, only for whichever board is actually being viewed, in §4 and §5 below — a board's memory is never touched while it's off-screen.)
- The whole `boardLabelSelections` map (not just one board's entry) resets to an empty `Map` on `user?.uid` change, same rationale as the old per-Set reset (an identity switch must not leak a previous identity's board-scoped selections).

### 3. `frontend/src/context/BoardContext.tsx` — remove the now-obsolete `clearLabels()` call

- Remove the `useFilter` import and the `clearLabels` destructure (lines 3, 27).
- Simplify `setActiveBoard` to just `setActiveBoardState(board)` — the `if (board.id !== activeBoard?.id) clearLabels()` branch is deleted. The per-board map in `FilterContext` now handles board-to-board isolation naturally (each board's selection lives in its own map entry), so there is nothing to clear when switching boards, and clearing here would actively break Requirement B (it would erase the very memory this feature exists to preserve).

### 4. `frontend/src/components/BoardGroupedTasks.tsx` — consume the shared per-board map, locally reconcile the Single-mode invariant

- Remove the local `useState<Set<string>>` for `selectedLabelIds` (line 29) and the local `useState` for `matchMode` (line 30) — both now come from `useFilter()`.
- Replace the existing render-time reset block (lines 37-42, previously `labelResetKey`/`setSelectedLabelIds(new Set())`/`setMatchMode('AND')`, which ran on every board switch) with a narrower render-time reconcile keyed on **both** the current board and the current mode, since it's now `(board, mode)` pairs that need reconciling, not just board switches:
  ```ts
  const currentBoardId = singleVisibleBoard?.board_id ?? null;
  const EMPTY_LABEL_SET = new Set<string>(); // module-level in this file — not the same object as FilterContext's internal one, and doesn't need to be; stability only matters within this file's own re-renders
  const reconcileKey = currentBoardId ? `${currentBoardId}:${matchMode}` : null;
  const [reconciledFor, setReconciledFor] = useState<string | null>(null);
  if (reconcileKey !== reconciledFor) {
    setReconciledFor(reconcileKey);
    if (matchMode === 'SINGLE' && currentBoardId) {
      const current = getBoardLabelSelection(currentBoardId);
      if (current.size > 1) clearBoardLabelSelection(currentBoardId);
    }
  }
  const selectedLabelIds = currentBoardId ? getBoardLabelSelection(currentBoardId) : EMPTY_LABEL_SET;
  ```
  This only ever touches `currentBoardId` — the board actually being displayed by this component instance — never a different, off-screen board. It fires whenever the visible board changes, whenever mode changes, or both, using the same "React recommended render-time reset" idiom the file's own prior comment (lines 32-36) already established as this codebase's preferred pattern for this kind of derived-state correction (no extra effect-triggered render, per Sneezy's first-pass Nit).
- Pull `matchMode`, `setMatchMode`, `getBoardLabelSelection`, `toggleBoardLabel`, `clearBoardLabelSelection` from `useFilter()`.
- `toggleLocalLabel` becomes `(labelId: string) => singleVisibleBoard && toggleBoardLabel(singleVisibleBoard.board_id, labelId)`.
- `onClear` for `LabelFilterChips` becomes `() => singleVisibleBoard && clearBoardLabelSelection(singleVisibleBoard.board_id)`.
- Net effect: this file still ends up simpler than the first draft despite the larger feature — it no longer owns the *selection* or *mode* values themselves (both come from context), only a small piece of bookkeeping state to know when it's already reconciled a given (board, mode) pair.

**Behavior changes to flag explicitly (both intentional, both requested):**
- Switching the pinned board no longer resets `matchMode` to `'AND'` — mode is shared/session-scoped (decision #1, already flagged in the first draft).
- Switching the pinned board no longer clears tag selection — each board now remembers its own selection for the session (decision #4, this is the new Requirement B behavior), **except** when that board's remembered selection has more than one tag and the shared mode is currently Single, in which case it's cleared the moment this board is actually viewed (not before) — preserving Decision #2 without pre-emptively touching boards nobody's looking at.

### 5. `frontend/src/pages/TasksPage.tsx` — now requires code changes (first draft assumed none; incorrect once the flat Set is replaced)

- Replace the `selectedLabelIds`/`toggleLabel`/`clearLabels` destructured from `useFilter()` with `matchMode`, `setMatchMode`, `getBoardLabelSelection`, `toggleBoardLabel`, `clearBoardLabelSelection`.
- Apply the same local reconcile pattern as §4, keyed on `activeBoard?.id` instead of `singleVisibleBoard?.board_id`, defining its own local `const EMPTY_LABEL_SET = new Set<string>();` in this file (each consuming file gets its own module-level empty-set constant — there is no shared/exported instance to import, per Sneezy's second-pass Nit on this exact wording ambiguity):
  ```ts
  const reconcileKey = activeBoard ? `${activeBoard.id}:${matchMode}` : null;
  const [reconciledFor, setReconciledFor] = useState<string | null>(null);
  if (reconcileKey !== reconciledFor) {
    setReconciledFor(reconcileKey);
    if (matchMode === 'SINGLE' && activeBoard) {
      const current = getBoardLabelSelection(activeBoard.id);
      if (current.size > 1) clearBoardLabelSelection(activeBoard.id);
    }
  }
  const selectedLabelIds = activeBoard ? getBoardLabelSelection(activeBoard.id) : EMPTY_LABEL_SET;
  const toggleLabel = (id: string) => activeBoard && toggleBoardLabel(activeBoard.id, id);
  const clearLabels = () => activeBoard && clearBoardLabelSelection(activeBoard.id);
  ```
- `activeBoard` is already destructured from `useBoard()` at line 83, so no new import needed for that part.
- Everything downstream (the `filterTasks` call at lines 215-216, the `LabelFilterChips` props at lines 377-386) keeps the same local variable names (`selectedLabelIds`, `toggleLabel`, `clearLabels`, `matchMode`, `setMatchMode`), so no further changes ripple past this point.

### 6. `frontend/src/pages/TaskDetailPage.tsx` — small update for the same reason

- Replace `const { selectedLabelIds } = useFilter();` (line 25) with `const { getBoardLabelSelection } = useFilter();`.
- Line 229 becomes `labels: labels.filter((l) => labelsBoardId ? getBoardLabelSelection(labelsBoardId).has(l.id) : false)` — `labelsBoardId` (line 41) is already computed and is the correct board to key off (the board the new task will be created against).

### 7. `frontend/src/components/LabelFilterChips.tsx`

Unchanged from the first draft — this component is agnostic of where its props' state lives, so the per-board map change (§2-§6) doesn't touch it:
- Prop types widen `matchMode: FilterMode`, `onMatchModeChange: (mode: FilterMode) => void`.
- Mode-toggle pill: drop the `{selectedLabelIds.size > 1 && ...}` gate — always rendered. Button list becomes `(['SINGLE', 'AND', 'OR'] as const)`, labeled "Single" / "AND" / "OR".
- "Clear filters": drop the `{selectedLabelIds.size > 0 && ...}` gate — always rendered, with `disabled={selectedLabelIds.size === 0}` and disabled visual treatment (reduced opacity, `cursor-not-allowed`, no hover state, no-op click).
- Layout: replace the single `justify-start` row with two flex groups inside one `justify-between` row, so chips wrap and stay left-packed while the mode+clear group stays right-aligned:
  ```
  <div class="mb-4 flex flex-wrap items-center justify-between gap-1.5">
    <div class="flex flex-wrap items-center gap-1.5">{/* chips */}</div>
    <div class="flex items-center gap-1.5 shrink-0">{/* mode pill + clear */}</div>
  </div>
  ```

## Risks / edge cases

- The mode+clear control now renders even for a board with zero tags/labels (no chips to show, just an idle Single/And/Or/Clear group). Not gating on label count, to keep "always visible" literal per the user's requirement. Low impact — most boards have at least one tag in practice (unverifiable from code alone, per Sneezy's first-pass review).
- No backend persistence this iteration, for either the mode or the per-board selections: both are lost on a full page reload. For mode this happens to match the hardcoded `SINGLE` default so it looks unchanged; for per-board selections, a reload will show every board as unselected again — this is the explicitly deferred part of Requirement B, not a bug.
- The `boardLabelSelections` map grows one entry per board the user has touched in the session (bounded by number of boards visited, entries removed when a board's selection returns to empty) — not a real memory concern at any realistic board count, noted only for completeness. Deleting a board (`BoardContext.deleteBoard`) does not proactively prune its map entry either — an orphaned entry for a deleted board simply sits unused for the rest of the session, harmless for the same reason (bounded by boards ever touched, never read again since the board no longer exists to be viewed). Flagged per Sneezy's second-pass review; no design change made, consistent with the existing "not a real memory concern" framing.
- Because the Single-mode "at most one tag" invariant is now enforced locally, only for the board actually being viewed (§4, §5) rather than swept globally on mode switch, a board with a stale multi-tag selection that nobody has viewed since the switch to Single mode will still show that multi-tag selection the moment it's next viewed — it just gets reconciled (cleared, if `size > 1`) at that moment rather than pre-emptively. This is intentional: the alternative (a global sweep) was found by Sneezy's second-pass review to silently mutate a different, off-screen board's remembered selection with zero indication, which directly conflicts with Requirement B's persistence guarantee. The local-only approach means the invariant "Single mode shows at most one active chip" always holds for whatever's on screen, without ever touching data the user isn't looking at.
- `filterTasks`'s default parameter value (`matchMode: FilterMode = 'AND'`) should probably change to `'SINGLE'` for consistency with the new default, though every call site now always passes `matchMode` explicitly, so this is cosmetic/defensive only.
- Removing `BoardContext`'s `clearLabels()` call changes behavior for the "All" view specifically: previously, switching board tabs always started with a clean tag filter; now it restores whatever was last selected for that board. This is exactly Requirement B's intent, but it's a bigger behavioral change to the All view than the pinned-view case, since the All view's clear-on-switch has existed since before this plan and was presumably deliberate at the time — flagged here for visibility, not as an objection (user explicitly confirmed this scope in the "Both views" decision).

## Files to modify

- `frontend/src/utils/taskFilters.ts` — add `FilterMode` type, add `toggleLabelSelection` helper, widen `filterTasks`'s `matchMode` param type
- `frontend/src/context/FilterContext.tsx` — replace flat `selectedLabelIds` with per-board `Map<string, Set<string>>`; 3-way mode, default `SINGLE`; `setMatchMode` is a plain setter with no side effects on stored selections
- `frontend/src/context/BoardContext.tsx` — remove the `clearLabels()` call in `setActiveBoard` (now obsolete/harmful)
- `frontend/src/pages/TasksPage.tsx` — derive `selectedLabelIds`/`toggleLabel`/`clearLabels` from `activeBoard.id` via the new per-board API; local render-time reconcile of the Single-mode invariant for `activeBoard` only
- `frontend/src/pages/TaskDetailPage.tsx` — use `getBoardLabelSelection(labelsBoardId)` instead of the flat `selectedLabelIds` when prefilling a new task's labels
- `frontend/src/components/BoardGroupedTasks.tsx` — consume the shared per-board map and shared mode instead of local state; replace the old unconditional board-switch reset with a narrower render-time reconcile of the Single-mode invariant for `singleVisibleBoard` only
- `frontend/src/components/LabelFilterChips.tsx` — always-visible 3-way control, always-visible/disabled-when-empty Clear, right-aligned control group layout (unchanged from first draft)

No backend files, no model/schema/router files touched. Still all under `frontend/src/`.

## Test plan

- `frontend/src/__tests__/` (Vitest), targeting the new pure utility functions in `frontend/src/utils/taskFilters.ts`:
  - `toggleLabelSelection`: SINGLE mode replaces selection; SINGLE mode deselects on re-click of the already-selected tag; AND/OR mode toggles membership unchanged.
  - `filterTasks`: SINGLE mode with 0 or 1 selected label matches existing AND/OR behavior for that same selection size.
- New: since `FilterContext`'s per-board map and each view's local reconcile logic are no longer pure functions but they are the load-bearing logic for both the blocker Sneezy's first pass found and the new Requirement B, add explicit manual-verification steps (React Testing Library component tests are not an established pattern in this codebase per the existing `frontend/src/__tests__/` contents, which target pure utils only — following that convention rather than introducing a new test style unilaterally):
  - Select 2 tags on board-1 in AND mode, switch to Single → both tags clear, 0 selected.
  - Select exactly 1 tag on board-1 in AND mode, switch to Single → the 1 tag stays selected (this is the exact scenario Sneezy's first-pass review flagged as broken in the original design).
  - Select a tag on board-1, navigate to board-2, select a different tag there, navigate back to board-1 → board-1's original tag is still selected, board-2's is unaffected. Repeat once via the All view's board tabs and once via a pinned view, per Requirement B's "both views" scope.
  - Select 2 tags on board-1 while in AND mode, navigate to board-2 (without touching board-1 again), switch mode to Single while board-2 is visible → confirm board-1's selection is **still 2 tags** at this point (not silently cleared while off-screen — validates Sneezy's second-pass fix). Then navigate back to board-1 → confirm it clears to 0 selected *at that point*, when it's actually viewed under Single mode.
- No integration test changes — `backend/tests/integration/` is untouched (Sleepy's file, not this PR's concern) since no backend code changes.

## Deployment

Single component (frontend only, under `frontend/`) — triggers a Railway deploy per `CLAUDE.md`'s deploy-trigger rules. No `[skip deploy]` tag. No backend involved, so no staggered-deploy/backward-compat concerns.

---

## Sneezy's Review — 2026-08-09 (first pass, on the pre-per-board-map design)

**Tier:** LIGHT — no proposed file falls under a model/schema/router/API-contract area (all four files are under `frontend/src/`), plan declares "Data model changes: none," and deployment order is single-component (frontend only). Confirmed accurate on inspection; no escalation triggers found.

**Verdict:** Changes required

### Issues

1. **[Blocker]** `frontend/src/context/FilterContext.tsx` (Design §2) and `frontend/src/components/BoardGroupedTasks.tsx` (Design §3) both propose clearing `selectedLabelIds` on **any** transition into `'SINGLE'` mode, regardless of how many tags are currently selected. But Decision #2 in this plan is explicitly scoped: *"Switching to Single with a **multi-tag** selection active → clear the selection... to avoid ambiguity about which tag should win."* When 0 or exactly 1 tag is selected there is no ambiguity — the plan's own stated rationale for clearing doesn't apply. As designed, a user with exactly one tag selected in AND/OR mode who clicks "Single" will lose that (already valid) selection instead of keeping it. This is a concrete, user-visible deviation from the explicitly recorded decision, not a documentation nit — the wrapped `setMatchMode` in §2 and the new `useEffect` in §3 both need a size check (`selectedLabelIds.size > 1`) added before clearing, or the decision's scope needs to be explicitly re-litigated with the user. Note the Test Plan doesn't exercise this path either — the only planned tests target the pure `toggleLabelSelection`/`filterTasks` helpers, not the component-level clear-on-mode-switch behavior — so this gap would ship undetected by the stated test plan.
   **Resolution (2026-08-09):** Fixed in the revised Design §2 — the mode-switch sweep now only clears map entries with `size > 1`, exactly matching Decision #2's scope. Also added an explicit manual-verification step for the "exactly 1 tag survives the switch" case in the Test plan.

2. **[Risk]** The requirement section and Design §4 justify the new right-aligned control group by "matching the existing left-aligned board-tab buttons above them" (line 21) / "chips wrap and stay left-packed" to mirror the tab row. But `frontend/src/components/BoardTabs.tsx:11-12` renders tabs as `<div className="overflow-x-auto mb-4 -mx-1 px-1"><div className="flex justify-end gap-1.5 min-w-full w-max">` — `justify-end` combined with `min-w-full`/`w-max` means that whenever the boards don't overflow the container (the common case with a handful of boards), the tab buttons render **right-aligned**, not left-aligned as the plan claims. The plan's stated visual rationale for the new layout is built on an inaccurate premise. This doesn't block the FilterMode logic itself, but the concrete layout in Design §4 (chips left / mode+clear right) may not actually visually align with the row above it the way the plan intends — worth re-confirming the desired look with the user (or fixing the description) before implementing the exact markup.
   **Resolution (2026-08-09):** Inaccurate "matches board tabs" framing removed from the Requirement section. Concrete layout (chips left, controls right on the tag row itself) is unchanged, since that's what the user explicitly asked for independent of `BoardTabs`'s own alignment.

3. **[Gap]** The "Current implementation" section, despite being explicitly framed as "verified by reading the code," omits two real consumers of the exact `FilterContext` state this plan modifies: `BoardContext.tsx`'s `clearLabels()` call in `setActiveBoard`, and `TaskDetailPage.tsx`'s read of `selectedLabelIds` to prefill a new task's labels.
   **Resolution (2026-08-09):** Both are now documented in "Current implementation" and directly addressed in Design §3 and §6 respectively — in fact, the `BoardContext.tsx` finding turned out to be central to the newly-added Requirement B (its `clearLabels()` call had to be removed, not just documented).

4. **[Nit]** The new `useEffect(() => { if (matchMode === 'SINGLE') setSelectedLabelIds(new Set()); }, [matchMode])` proposed for `BoardGroupedTasks.tsx` (Design §3) is an effect-based clear, inconsistent with the file's existing render-time reset pattern, and causes an extra render on mount.
   **Resolution (2026-08-09):** Superseded entirely — the revised design (§2, §4) centralizes the clear-on-switch-to-single logic inside `FilterContext.setMatchMode` as a one-time sweep over the shared map, so `BoardGroupedTasks` no longer needs any reset logic (effect-based or render-time) at all.

### Unverified assumptions

- "Low impact — most boards have at least one tag in practice" — still an open, code-unverifiable assumption, carried forward unchanged.
- Mobile-equivalent check — verified accurate, carried forward unchanged.

### Suggestions

- Addressed: size guard added, BoardTabs framing corrected, missing consumers documented, effect-based reset removed.

— *Sneezy*

---

## Sneezy's Review — 2026-08-09 (second pass, on the revised per-board-map design)

**Tier:** LIGHT — re-verified independently rather than trusting the plan's own claim. All seven "Files to modify" (`taskFilters.ts`, `FilterContext.tsx`, `BoardContext.tsx`, `TasksPage.tsx`, `TaskDetailPage.tsx`, `BoardGroupedTasks.tsx`, `LabelFilterChips.tsx`) are under `frontend/src/`, none is a model/schema/router/API-contract file. "Data model changes: none" holds up — every mechanism described (React `useState`/`Map`/`Set` in a context, no `fetch`/`api/` calls added) is pure client-side state; confirmed by reading all seven files in full, plus `hooks/useLabels.ts` and `hooks/useTasks.ts`. Deployment is genuinely single-component (frontend only), matching `CLAUDE.md`'s deploy-trigger rule. No escalation triggers found.

**Verdict:** Approved with concerns

### Issues

1. **[Risk]** Design §2's centralized mode-switch sweep — clearing every board's `size > 1` entry in `boardLabelSelections` when switching to Single, not just the currently-visible board — is technically necessary and correctly scoped by tag count (verified: `filterTasks` routes `SINGLE` through the same `.some(...)` / OR branch per §1, so a stale multi-tag entry left un-swept on an off-screen board would silently behave as OR instead of Single the next time that board is viewed — the global sweep is the right fix for that specific correctness gap). However, the plan's own citation of "Decision #2" as authorizing this is a stretch: Decision #2 ("switching to Single with a multi-tag selection active → clear the selection") was made *before* Requirement B (per-board memory) existed in this plan — at the time, there was only one shared selection, so "clear the selection" could only ever have meant "clear what's currently visible." Silently mutating a *different*, currently-invisible board's remembered selection is new scope that Decision #2 never spoke to, and it directly cuts against Requirement B's whole premise (durable, silent, per-board memory) in a way the user hasn't explicitly signed off on. Concretely: a user selects 2 tags on board-2, navigates to board-1 (or a pinned board-3), clicks "Single" there — board-2's memory is wiped with zero on-screen indication at the moment it happens, and this is reachable from *either* view (TasksPage's mode control per §5 or BoardGroupedTasks's per §4), so a pinned-view mode click can silently mutate the "All" view's `activeBoard` entry and vice versa. The plan's own "Risks / edge cases" section (lines 147-153) does not mention this specific consequence at all, and while the Test Plan's fourth manual-verification bullet (line 176) does exercise the mechanics of the sweep, it validates that the sweep *works as designed*, not whether the design itself was actually agreed to. Recommend either an explicit one-line re-confirmation with the user (this is materially new scope beyond Decision #2, now that per-board memory exists) or, at minimum, adding this behavior to the Risks section so it's a documented, intentional tradeoff rather than a silent side effect discovered later.

2. **[Nit]** Design §4's "or an equivalent stable empty-set constant local to this file, matching whatever `FilterContext` exports/uses" is vague to the point of being slightly misleading: the `EMPTY_LABEL_SET` shown in §2's code block is a plain module-level `const`, not marked `export`, so `BoardGroupedTasks.tsx` and `TasksPage.tsx` cannot literally import and share `FilterContext`'s instance — each needs its own local module-level `const EMPTY_LABEL_SET = new Set<string>()`. This turns out to be harmless (verified: in both consumer files, `selectedLabelIds` is never placed in a `useMemo`/dependency comparison against a value produced by a *different* module's constant — `TasksPage.tsx`'s `useMemo` at lines 215-216 only needs stability across its own re-renders, which a same-module `const` provides regardless of whether it's `===` to `FilterContext`'s copy), but the prose as written could send an implementer looking for a non-existent export. Suggest rewording to explicitly say "define a local `const EMPTY_LABEL_SET = new Set<string>()` in this file as well."

3. **[Nit]** The Risks section (line 151) notes map entries are "removed when a board's selection returns to empty" but doesn't mention that deleting a board (via `BoardContext.deleteBoard`) leaves that board's `boardLabelSelections` entry orphaned in the map for the rest of the session — nothing in the design ties board deletion to map cleanup. Consistent with the plan's own "not a real memory concern at any realistic board count" framing elsewhere, so not worth a design change, but the plan is otherwise thorough about naming even low-impact edge cases explicitly (e.g. the empty-map-entry pruning it does describe) and this one slipped through.

### Unverified assumptions

- "Low impact — most boards have at least one tag in practice" (Risks, line 149) — still open and code-unverifiable, carried forward unchanged from the first pass.
- Requirement B's core cross-view guarantee ("board-1's selected tags look the same whether you're viewing it via the All-view tab or a pinned view") depends on `FocusedBoard.board_id` (read by `BoardGroupedTasks`, sourced from `api/focusedView.ts`) and `Board.id` (read by `TasksPage`/`BoardContext`, sourced from `api/boards.ts`) being the same underlying board UUID. Both are typed `string` and nothing in the frontend code contradicts this, but the plan doesn't trace them back to a shared backend source, and this review didn't read the backend router/serializer that produces `FocusedBoard.board_id` to confirm it. Very likely correct — no evidence otherwise, and the app already correlates pin/collapse state and board colors across the same two ID spaces elsewhere — but flagged since the entire cross-view value proposition of Requirement B rests on it.

### Suggestions

- Surface Issue #1 (off-screen sweep) to the user as an explicit confirmation, or add it verbatim to the Risks/edge cases section — it's the one behavior in this design that can quietly undo the exact persistence guarantee Requirement B exists to provide.
- Tighten §4/§5's `EMPTY_LABEL_SET` wording per Issue #2.
- All four first-pass Resolutions were independently re-verified against the actual current source (not just the plan's claims) and hold up: (1) the size>1 guard is present and correctly scoped in §2; (2) `BoardTabs.tsx:11-12` was re-read and confirmed still `justify-end`, so the corrected framing in the Requirement section remains accurate; (3) a fresh grep for `useFilter` across `frontend/src/` turns up exactly the three call sites the plan now documents (`BoardContext.tsx`, `TaskDetailPage.tsx`, `TasksPage.tsx`) — no missed consumer; (4) `BoardGroupedTasks.tsx`'s claimed simplification is genuinely safe — `useLabels(singleVisibleBoard?.board_id ?? '')` refetches off its own `boardId`-keyed effect independent of the deleted reset block, and the new `selectedLabelIds` is derived fresh from the context map each render rather than cached in local state, so there is no longer any local state to desync in the first place.

— *Sneezy*

### Resolutions (2026-08-09, applied by Grumpy)

1. **[Risk] Off-screen sweep.** Design §2's global sweep removed entirely — `setMatchMode` is now a plain setter with no side effects on `boardLabelSelections`. The "Single mode ⇒ at most one tag" invariant is instead enforced locally in §4 (`BoardGroupedTasks`) and §5 (`TasksPage`), each via a render-time reconcile keyed on `(currentBoardId, matchMode)` that only ever reads/clears the board that component is actually displaying — never a different, off-screen board. Added a Risks/edge-cases bullet spelling out the resulting tradeoff explicitly (a stale multi-tag selection on an unviewed board persists until that board is next viewed, then reconciles at that moment) so it's a documented, intentional design choice rather than a side effect discovered later. Test plan's fourth manual-verification bullet rewritten to actually prove the off-screen board is *not* touched (previously it proved the opposite — that the sweep *did* touch it).
2. **[Nit] `EMPTY_LABEL_SET` wording.** §4 and §5 now each spell out explicitly that this is a local, file-scoped `const`, not a shared export from `FilterContext` — no ambiguity about where it comes from.
3. **[Nit] Orphaned map entry on board deletion.** Added to Risks/edge cases: deleting a board doesn't prune its `boardLabelSelections` entry; harmless (unreachable dead entry, bounded by boards ever visited), no design change made, consistent with the plan's existing "not a real memory concern" framing for map growth generally.

No third Sneezy pass requested — the second pass returned "Approved with concerns" (not "Changes required"), all three items were concrete and had unambiguous fixes (two of which Sneezy's own Suggestions section proposed directly), and the fixes don't introduce new files, new consumers, or any change to tier/deployment/data-model classification. Proceeding to present to the user for implementation approval.
