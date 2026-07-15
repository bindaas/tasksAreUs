# PLAN: feat-board-collapse-mobile — Collapsible boards in Focused/Today/Tomorrow (mobile)

## Overview

Mobile equivalent of `PLAN-feat-board-collapse-web.md` — same feature (per-board collapse/expand plus a per-view "Collapse all / Expand all" toggle in the board-grouped card layout shared by Focused/Today/Tomorrow), same user-confirmed decisions (session-only state, no DB persistence, no requirement to survive a full app reload, scoped independently per view). Fully independent of the web plan: no shared code between `frontend/` and `mobile/`, no backend involved, no ordering dependency either direction.

**Why the mechanism differs from web, despite the same requirement:** on web, `TasksPage` is unmounted by react-router on navigation to another route (Task Detail, Reports, Settings), so the state has to live in a Context above `<BrowserRouter>`. On mobile, `TasksScreen` is **not** unmounted by tab switches (React Navigation's bottom-tab navigator keeps inactive tab screens mounted) and task editing happens in a `<Modal>` rendered *inside* `TasksScreen`, not a separate screen — this was already verified true for `viewMode`/`activeBoard` when the mobile Tasks-view redesign shipped (`PLAN-feat-tasks-view-redesign-mobile.md`'s "State persistence note" and Sneezy's nit 5 confirming it). So lifting the new collapse state into `TasksScreen`'s own `useState` — exactly the same place `expandedSections` (`mobile/src/screens/TasksScreen.tsx:216-218`) already lives for the All view's kanban section headers — is sufficient; no Context is needed on mobile. This intentionally makes `BoardGroupedTasks.tsx` prop-driven on mobile vs. Context-driven on web for the same feature; called out explicitly here so it doesn't read as an inconsistency during review.

One subtlety worth flagging: `mobile/src/screens/TasksScreen.tsx`'s `useFocusEffect` (lines 275-290) bumps `focusedViewKey` on every tab re-focus specifically to force `FocusedView`/`DayView` to fully remount (so config/board-tab changes are picked up without a manual Retry). That remount would wipe any state that lived *inside* those components — which is precisely why the new collapse state must live one level up in `TasksScreen` and flow down as props on every render, the same reasoning that already put `expandedSections` there instead of inside the kanban `SectionList`'s own tree.

## Data / API Changes

None — same as the web plan, purely client-side in-memory state.

## Files to Modify

**`mobile/src/screens/TasksScreen.tsx`**
- New type and state, added near the existing `expandedSections` (`TasksScreen.tsx:216-218`):
  ```ts
  type BoardViewKey = 'focused' | 'today' | 'tomorrow';
  const [collapsedBoards, setCollapsedBoards] = useState<Record<BoardViewKey, Set<string>>>({
    focused: new Set(),
    today: new Set(),
    tomorrow: new Set(),
  });
  ```
- New handlers, mirroring the existing `toggleSection`/`handleToggleAllSections` pair (`TasksScreen.tsx:376-393`) one-for-one:
  ```ts
  function toggleBoardCollapse(view: BoardViewKey, boardId: string) {
    setCollapsedBoards((prev) => {
      const next = new Set(prev[view]);
      if (next.has(boardId)) next.delete(boardId);
      else next.add(boardId);
      return { ...prev, [view]: next };
    });
  }

  function setAllBoardsCollapsed(view: BoardViewKey, boardIds: string[], collapsed: boolean) {
    setCollapsedBoards((prev) => ({ ...prev, [view]: collapsed ? new Set(boardIds) : new Set() }));
  }
  ```
- Thread the relevant view's Set + the two handlers into the `FocusedView`/`DayView` render sites (`TasksScreen.tsx:736-747`), e.g.:
  ```tsx
  {viewMode === 'focused' && (
    <FocusedView
      key={focusedViewKey}
      onEditPress={handleEditPress}
      collapsedBoardIds={collapsedBoards.focused}
      onToggleBoard={(id) => toggleBoardCollapse('focused', id)}
      onSetAllCollapsed={(ids, collapsed) => setAllBoardsCollapsed('focused', ids, collapsed)}
    />
  )}
  ```
  Spelled out explicitly for the two `DayView` render sites (`TasksScreen.tsx:742-744` and `745-747`) to remove any ambiguity about which `BoardViewKey` literal binds to which:
  ```tsx
  {viewMode === 'today' && (
    <DayView
      referenceDate={today}
      onEditPress={handleEditPress}
      collapsedBoardIds={collapsedBoards.today}
      onToggleBoard={(id) => toggleBoardCollapse('today', id)}
      onSetAllCollapsed={(ids, collapsed) => setAllBoardsCollapsed('today', ids, collapsed)}
    />
  )}
  {viewMode === 'tomorrow' && (
    <DayView
      referenceDate={tomorrow}
      onEditPress={handleEditPress}
      collapsedBoardIds={collapsedBoards.tomorrow}
      onToggleBoard={(id) => toggleBoardCollapse('tomorrow', id)}
      onSetAllCollapsed={(ids, collapsed) => setAllBoardsCollapsed('tomorrow', ids, collapsed)}
    />
  )}
  ```
  Because these three props come from `TasksScreen`'s own state on every render, the `key={focusedViewKey}`-forced remount of the child does not lose any collapse data — only state that lived *inside* the child would be lost, and none does.
- No change to the existing `viewMode === 'all'` "Collapse"/"Expand" button (`TasksScreen.tsx:606-615`) — that one toggles the unrelated kanban date-column sections and stays exactly as-is. This feature's own "Collapse all/Expand all" control is rendered inside `BoardGroupedTasks` itself (see below), visible only when Focused/Today/Tomorrow is the active view, so the two affordances never appear on screen at the same time.

**`mobile/src/components/FocusedView.tsx`**
- Add three new required props — `collapsedBoardIds: Set<string>`, `onToggleBoard: (id: string) => void`, `onSetAllCollapsed: (ids: string[], collapsed: boolean) => void` — threaded straight into `<BoardGroupedTasks>` (currently at `FocusedView.tsx:72`) alongside the existing `boards`/`onEditPress`/`onRefresh`.

**`mobile/src/components/DayView.tsx`**
- Same three new props, threaded into `<BoardGroupedTasks>` (currently at `DayView.tsx:74`).

**`mobile/src/components/BoardGroupedTasks.tsx`** (currently 47 lines, full file)
- Accept the three new props described above.
- Compute `allCollapsed = boards.length > 0 && boards.every((b) => collapsedBoardIds.has(b.board_id))`.
- New top-of-list `TouchableOpacity` — "Collapse all" / "Expand all" text, styled consistently with `TasksScreen.tsx`'s existing "Collapse"/"Expand" header button (`TasksScreen.tsx:606-615`) — calling `onSetAllCollapsed(boards.map((b) => b.board_id), !allCollapsed)`.
- Per-board header row (currently `BoardGroupedTasks.tsx:26-32`): wrap in a `TouchableOpacity` calling `onToggleBoard(board.board_id)`; add a ▾/▸ chevron matching the existing kanban section-header chevron convention (`TasksScreen.tsx:806-808`, `{isExpanded ? '▾' : '▸'}`).
- `board.tasks.map(...)` (currently `BoardGroupedTasks.tsx:33-41`) renders only when `!collapsedBoardIds.has(board.board_id)`; the header (color dot, name, count) always renders.

## Test Plan

- No new unit tests — the toggle logic is a handful of lines of inline `Set` mutation in `TasksScreen.tsx`, matching the existing untested precedent set by `toggleSection`/`handleToggleAllSections` in the same file.
- Manual verification on a simulator/device (per this project's UI-change testing convention):
  - Collapsing a board under Focused hides its task list but keeps the header/count visible; the chevron flips
  - Opening a task (the in-`TasksScreen` edit `Modal`) from a still-expanded board, then Save/Cancel — collapse state is unchanged, confirming the screen never unmounts during an edit (same reasoning already verified for `viewMode`/`activeBoard`)
  - Switching to the Reports or Settings tab and back to Tasks preserves collapse state for all three views (`TasksScreen` isn't unmounted by tab switches)
  - Switching Focused → Today → Tomorrow and back — each view's collapse state is independent
  - "Collapse all" / "Expand all" toggles every board in the current view only, and its label flips correctly
  - A fresh app reload is not required to preserve state (resets to fully expanded) — confirm it doesn't crash, nothing more

## Deployment Order

Mobile update type: **OTA** (`eas update`) — all changes are JS/TS only; no native modules, `app.json`, or `eas.json` changes. Independent of the web PR — no shared backend or contract, so either order is safe.

## PR Structure

**Combined into a single PR with the web changes** (`PLAN-feat-board-collapse-web.md`) — updated 2026-07-15, supersedes the "single PR, mobile only" statement above. Rationale: the two changes are independent (no shared code, no ordering dependency, web triggers Railway/mobile ships OTA) and both are LIGHT-tier, UI-only, low-risk — the token/review overhead of two separate review-agent passes (each re-reading the same governing docs) outweighs the coupling risk of bundling a revert. One PR touching `frontend/` and `mobile/`.

---

## Sneezy's Review — 2026-07-15

**Tier:** LIGHT — all four proposed files (`TasksScreen.tsx`, `FocusedView.tsx`, `DayView.tsx`, `BoardGroupedTasks.tsx`) are presentation-layer only, no model/schema/router/API-contract file touched, Data model changes = none, Deployment order = single component (mobile OTA). No escalation trigger found during review — confirmed below.

**Verdict:** Approved

### Issues

1. **[Nit]** `BoardGroupedTasks.tsx`'s proposed `allCollapsed = boards.length > 0 && boards.every(...)` guard is dead code in practice: both call sites (`FocusedView.tsx:50-65`, `DayView.tsx:57-67`) already early-return before reaching `<BoardGroupedTasks>` when `boards.length === 0`, so `BoardGroupedTasks` is never rendered with an empty array. Harmless defensive style, not worth blocking on.
2. **[Nit]** No unit test is added for `toggleBoardCollapse`/`setAllBoardsCollapsed`. The plan's stated justification (matching the untested precedent of `toggleSection`/`handleToggleAllSections` in the same file, verified real at `TasksScreen.tsx:376-393`) is accurate and consistent with the existing codebase convention, so this isn't dinged as a blocking gap — flagged only so it's a conscious choice, not an oversight.
3. **[Nit]** The plan spells out the full JSX for the `focused` render site but only says "(same pattern for the today/tomorrow DayView instances)" for the other two. Given `DayView` is rendered from two separate call sites (`TasksScreen.tsx:742-744` and `745-747`) that must each bind to a different `BoardViewKey` (`'today'` vs `'tomorrow'`), spelling out both literally in the plan would remove any ambiguity for the implementer, though the intent is unambiguous as written.

### Unverified assumptions

None outstanding — every factual claim in the plan was checked directly against source and confirmed accurate:
- `expandedSections` state at `TasksScreen.tsx:216-218` — confirmed exact.
- `useFocusEffect` remount logic at `TasksScreen.tsx:275-290` — confirmed exact, including the `setFocusedViewKey((k) => k + 1)` remount trigger.
- `toggleSection`/`handleToggleAllSections` at `TasksScreen.tsx:376-393` — confirmed exact.
- `viewMode === 'all'` Collapse/Expand button at `TasksScreen.tsx:606-615` — confirmed exact.
- `FocusedView`/`DayView` render sites at `TasksScreen.tsx:736-747` — confirmed exact.
- Chevron convention at `TasksScreen.tsx:806-808` (`{isExpanded ? '▾' : '▸'}`) — confirmed exact.
- `FocusedView.tsx:72` and `DayView.tsx:74` — both are the `<BoardGroupedTasks boards={boards} onEditPress={onEditPress} onRefresh={load} />` call sites, confirmed exact, and no other file in `mobile/src` imports or renders `FocusedView`, `DayView`, or `BoardGroupedTasks` (grepped the full tree) — no hidden fan-out.
- `BoardGroupedTasks.tsx` is confirmed to be exactly 47 lines; the cited header row (`26-32`) and `board.tasks.map` (`33-41`) ranges are exact.
- `FocusedBoard.board_id: string` (`mobile/src/api/focusedView.ts:5`) confirmed to exist and be typed as expected by the plan's `Set<string>` keying.
- **Core architectural claim — verified true, not just asserted:** `mobile/src/navigation/AppNavigator.tsx:19,82-104` uses `createBottomTabNavigator` with no `unmountOnBlur` or `lazy` override on any `Tab.Screen`, so React Navigation's default (mount once, keep alive on blur) applies — `TasksScreen` is indeed never unmounted by tab switches to Reports/Settings. This independently confirms the plan's central "no Context needed" reasoning. It is also consistent with the prior finding in `PLAN-feat-tasks-view-redesign-mobile.md` (its own "State persistence note" and Sneezy's nit 5 in that plan's review section, both read and cross-checked), which the current plan cites correctly.
- No existing test file renders `TasksScreen`, `FocusedView`, `DayView`, or `BoardGroupedTasks` (only `dayView.api.test.ts`/`focusedView.api.test.ts` exist, and those test the API layer, not component rendering) — adding three new required props to `FocusedView`/`DayView` will not break any existing test.

### Suggestions

- Consider explicitly writing out the `today`/`tomorrow` prop-threading JSX (per Issue 3) rather than leaving it as "same pattern," purely to remove any chance of an implementer swapping the two `BoardViewKey` literals.
- Optional, not required: a one-line comment near the new `collapsedBoards` state noting that stale `board_id` entries left in a view's `Set` after a board is deleted/renamed are inert (never matched again) rather than actively cleaned up — this is fine behaviorally but might save a future reader a moment of "should this be cleaned up?"

— *Sneezy*

## Grumpy's Response to Sneezy's Review — 2026-07-15

| Issue | Response |
|---|---|
| [Nit 1] `allCollapsed` empty-array guard is dead code given call-site early-returns | **No change.** Keeping the defensive guard as-is — harmless, and protects `BoardGroupedTasks` if a future caller ever renders it without the empty-array early-return. |
| [Nit 2] No unit test for `toggleBoardCollapse`/`setAllBoardsCollapsed` | **No change.** Matches the existing untested `toggleSection`/`handleToggleAllSections` precedent in the same file, as the plan already states. |
| [Nit 3] Spell out `today`/`tomorrow` JSX instead of "same pattern" | **Fix.** Explicit JSX for both `DayView` render sites now spelled out above, per Sneezy's suggestion. |

All three items addressed — one code clarification (explicit JSX), two acknowledged as intentional (no change). No blockers remain.
