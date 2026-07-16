# PLAN: feat-board-collapse-web — Collapsible boards in Focused/Today/Tomorrow (web)

## Overview

Adds per-board collapse/expand to the board-grouped card layout shared by the Focused, Today, and Tomorrow views, plus a "Collapse all / Expand all" toggle per view. State is session-only (React memory, never sent to the backend or DB) but must survive in-app navigation away and back (e.g. opening a task's detail page and returning) — which on web means it can't live in component state, since `TaskDetailPage`/`ReportsPage`/`SettingsPage` are separate routes that fully unmount `TasksPage` (and everything under it) on navigation.

Companion plan: `PLAN-feat-board-collapse-mobile.md` (mobile UI, fully independent — no shared code or backend dependency between the two).

**User-confirmed decisions (this session):**
- Collapse state does **not** need to survive a full page refresh — only in-app navigation. A hard reload resets every view to fully expanded.
- Collapse state is scoped **per view** (Focused/Today/Tomorrow each track their own collapsed boards independently) — collapsing "Work" under Today has no effect on "Work" under Focused or Tomorrow. "Collapse all / Expand all" therefore only ever touches the boards visible in the view it's clicked from.

## Data / API Changes

None. Purely client-side, in-memory UI state — no new endpoints, no schema changes, nothing persisted.

## Files to Modify

**New**
- `frontend/src/context/BoardCollapseContext.tsx` — new context, modeled directly on the existing `FilterContext.tsx` (`frontend/src/context/FilterContext.tsx:13-41`), which already holds a `Set`-based toggle (`toggleLabel`) in plain `useState` with no persistence and no dedicated unit test — same pattern, same precedent for not over-abstracting trivial `Set` mutation into a separately-tested utility module.
  ```ts
  type ViewKey = 'focused' | 'today' | 'tomorrow';

  interface BoardCollapseContextValue {
    isCollapsed: (view: ViewKey, boardId: string) => boolean;
    toggleBoard: (view: ViewKey, boardId: string) => void;
    setAllCollapsed: (view: ViewKey, boardIds: string[], collapsed: boolean) => void;
  }
  ```
  Internal state: `Record<ViewKey, Set<string>>`, initialised to three empty sets (nothing collapsed by default — matches current behavior exactly). `BoardCollapseProvider` wraps children; `useBoardCollapse()` throws if used outside the provider (same guard style as every other context in this file).

**Provider wiring**
- `frontend/src/App.tsx:88-104` — add `BoardCollapseProvider` to the existing provider stack (`FilterProvider` → `BoardProvider` → `ViewProvider` → `BrowserRouter`). Nesting order relative to the other three doesn't matter (fully independent state); it must sit above `<BrowserRouter>` so it survives route changes, exactly like `ViewProvider` already does for the same reason (see `ARCHITECTURE.MD`'s `ViewContext.tsx` entry: "Wrapped around `BrowserRouter` in `App.tsx`... so it survives route changes without being persisted to storage").

**Shared rendering**
- `frontend/src/components/BoardGroupedTasks.tsx` (currently 34 lines, full file) — the one place both Focused and Today/Tomorrow render through (confirmed: `FocusedView.tsx:62` and `DayView.tsx:62` both call `<BoardGroupedTasks boards={boards} onRefresh={load} />`):
  - New required prop `viewKey: ViewKey`.
  - `useBoardCollapse()` for `isCollapsed`/`toggleBoard`/`setAllCollapsed`.
  - Compute `allCollapsed = boards.length > 0 && boards.every((b) => isCollapsed(viewKey, b.board_id))`.
  - New small header row above the boards list: a text button, "Collapse all" when not all collapsed, "Expand all" when they are, calling `setAllCollapsed(viewKey, boards.map((b) => b.board_id), !allCollapsed)`.
  - Per-board header (currently `frontend/src/components/BoardGroupedTasks.tsx:17-23`, a plain `<div>`): wrap in a native `<button onClick={() => toggleBoard(viewKey, board.board_id)} aria-expanded={!isCollapsed(viewKey, board.board_id)}>` (unstyled/reset via CSS to match the existing header row — resolves the keyboard-accessibility gap Sneezy flagged) and add a chevron (▾ expanded / ▸ collapsed) next to the existing count badge.
  - The task grid (`frontend/src/components/BoardGroupedTasks.tsx:24-28`) renders only when `!isCollapsed(viewKey, board.board_id)`; the header (name, color dot, count) always renders regardless of collapsed state, so the count stays visible as a summary.

**Callers**
- `frontend/src/components/FocusedView.tsx:62` — `<BoardGroupedTasks boards={boards} onRefresh={load} viewKey="focused" />`.
- `frontend/src/components/DayView.tsx` — add a required `viewKey: 'today' | 'tomorrow'` prop to the component's own signature (alongside the existing `referenceDate`), forwarded unchanged to `<BoardGroupedTasks>` at line 62.
- `frontend/src/pages/TasksPage.tsx:308-309`:
  ```tsx
  {viewMode === 'today' && <DayView referenceDate={today} viewKey="today" />}
  {viewMode === 'tomorrow' && <DayView referenceDate={tomorrow} viewKey="tomorrow" />}
  ```

## Test Plan

- No new unit test file — the toggle logic is a few lines of `Set` mutation inside the context, matching the existing untested precedent in `FilterContext.tsx`'s `toggleLabel` (no dedicated test file exists for that either). Nothing pure/complex enough here to warrant extracting into `frontend/src/utils/` per the project's stated unit-test convention.
- Manual browser verification (dev server, per this project's UI-change testing convention):
  - Focused view: collapsing a board hides its task grid but keeps the header/count visible; the chevron flips
  - Click into a task's detail page from a still-expanded board, then navigate back (browser back or in-app back) — the board's collapsed/expanded state from before the navigation is unchanged
  - Switch Focused → Today → Tomorrow and back — each view's collapse state is independent (collapsing "Work" in Today does not collapse it in Focused/Tomorrow)
  - "Collapse all" / "Expand all" toggles every board in the current view only and flips its own label correctly
  - Hard refresh (F5) resets all three views to fully expanded — expected, no persistence layer by design

## Deployment Order

Single component — only `frontend/` files touched, no backend changes, no API/contract change. Triggers a normal Railway deploy (per `CLAUDE.md`'s deploy-trigger rules, `frontend/` changes are not `[skip deploy]`-eligible). No backward-compatibility window to manage since nothing else depends on this state.

## PR Structure

**Combined into a single PR with the mobile changes** (`PLAN-feat-board-collapse-mobile.md`) — updated 2026-07-15, supersedes the "single PR, web only" statement above. Rationale: the two changes are independent (no shared code, no ordering dependency, web triggers Railway/mobile ships OTA) and both are LIGHT-tier, UI-only, low-risk — the token/review overhead of two separate review-agent passes (each re-reading the same governing docs) outweighs the coupling risk of bundling a revert. One PR touching `frontend/` and `mobile/`.

---

## Sneezy's Review — 2026-07-15

**Tier:** LIGHT — spawn reason stated: all six proposed files are presentation-layer only (no model/schema/router/API file under `backend/app/`), Data model changes = none, Deployment order = single component. Verified against the actual files (below); the gate holds, no escalation to FULL.

**Verdict:** Approved with concerns

### Issues

1. **[Gap]** `frontend/src/context/BoardGroupedTasks.tsx`'s spec (plan lines 41, section "Shared rendering") — wrapping the per-board header in a clickable element with `onClick` and `role="button"` but no `tabIndex={0}` and no `onKeyDown` (Enter/Space) handler is not keyboard-operable. `role="button"` on a `<div>` communicates the semantics to assistive tech but does nothing to make it focusable or activatable from a keyboard — this is a well-known a11y half-measure. Either use a native `<button>` wrapper (gets focus + keyboard activation + role for free) or add `tabIndex={0}` + `onKeyDown` handling Enter/Space. An `aria-expanded={!isCollapsed(...)}` attribute would also be expected on this pattern for screen readers and is not mentioned. Not a blocker for a light client-side toggle feature, but worth fixing before merge rather than accepting silently.

2. **[Gap]** The plan's own stated precedent, `FilterContext.tsx:17-21`, clears its `Set` state in a `useEffect` keyed on `user?.uid` specifically "so a label filter scoped to the previous identity's board doesn't leak into the new one" (e.g. anon → authenticated upgrade in place, without a provider remount). `BoardCollapseContext` has no equivalent effect and the plan doesn't discuss whether one is needed or explicitly reason why it's safe to omit. In practice the risk is low — `board_id`s are UUIDs scoped to the owning account, so a stale collapsed-id from a previous identity is very unlikely to collide with a new identity's board — but the plan cites `FilterContext` as its architectural model and then silently drops half of that model's behavior without saying so. Should at least get one sentence of stated reasoning in the plan.

3. **[Nit]** `BoardGroupedTasks.tsx`'s new required prop is typed `viewKey: ViewKey`, but `ViewKey` is defined in the new `BoardCollapseContext.tsx` file (plan line 22) — the plan doesn't call out that this type needs to be imported (or re-exported) into `BoardGroupedTasks.tsx`. Trivial, but worth listing alongside the other import changes so the "Files to Modify" section is self-contained.

4. **[Nit]** Per-view `Set<string>` of collapsed board ids has no cleanup path — if a board is deleted, or temporarily has zero tasks and drops out of the `boards` array, its id lingers in the Set for the rest of the session. Harmless at the scale of a personal task app (a handful of boards), but worth a one-line acknowledgment in the plan since it's a deviation from "nothing persisted" being interpreted as "nothing accumulates."

### Unverified assumptions

- **Verified accurate:** `FilterContext.tsx:13-41` guard style, `toggleLabel` `Set`-mutation pattern, and absence of a dedicated test file for it — confirmed by reading the file and `frontend/src/__tests__/` (no `FilterContext` or context-layer test exists; the only filter-adjacent test, `taskFilters.test.ts`, covers the pure `utils/taskFilters.ts` function, not the context). The plan's central precedent claim holds.
- **Verified accurate:** `App.tsx:88-104` provider stack order (`FilterProvider` → `BoardProvider` → `ViewProvider` → `BrowserRouter`) and the `ViewContext.tsx` citation from `ARCHITECTURE.MD` ("Wrapped around `BrowserRouter`... so it survives route changes without being persisted to storage") — both match the current source exactly.
- **Verified accurate:** `BoardGroupedTasks.tsx` is exactly 34 lines; the cited line ranges (17-23 for the per-board header, 24-28 for the task grid) match the current file precisely.
- **Verified accurate:** `FocusedView.tsx:62` and `DayView.tsx:62` both call `<BoardGroupedTasks boards={boards} onRefresh={load} />` verbatim, and a repo-wide grep confirms these are the *only* two call sites — the plan's "the one place both Focused and Today/Tomorrow render through" claim is exhaustively correct, not just illustrative.
- **Verified accurate:** `TasksPage.tsx:308-309` current content matches the plan's "before" quote exactly, and `DayView`'s current signature (`{ referenceDate }: { referenceDate: string }`) matches the plan's description of what's being extended.
- **Could not verify:** the Test Plan's reference to "this project's UI-change testing convention" for manual browser verification — this exact phrase/convention was not found in `RULES_OF_ENGAGEMENT.MD` (the only project doc read at this tier). It may be documented in `ARCHITECTURE.MD`, which is out of scope for a light-tier review; flagging as unconfirmed rather than incorrect.
- **Judgment call, not fact-checkable:** "Nothing pure/complex enough here to warrant extracting into `frontend/src/utils/`" — reasonable given the `Set`-toggle logic is trivially small and mirrors the untested `FilterContext` precedent, but this is a stylistic judgment rather than a verifiable claim.

### Suggestions

- Prefer a native `<button>` (styled to look like the existing header row) over `<div role="button">` for the collapse toggle — it resolves the keyboard-accessibility gap for free and avoids needing a manual `onKeyDown` handler.
- Consider a short comment in `BoardCollapseContext.tsx` explicitly noting the intentional absence of an identity-reset effect (contrast with `FilterContext.tsx`), so a future reader doesn't wonder if it was simply forgotten.

— *Sneezy*

## Grumpy's Response to Sneezy's Review — 2026-07-15

| Issue | Response |
|---|---|
| [Gap 1] `<div role="button">` not keyboard-operable | **Fix.** Will use a native `<button>` (unstyled, reset via CSS to match the existing header row) instead of `<div onClick role="button">`. Gets focus + Enter/Space activation for free. Will also add `aria-expanded={!isCollapsed(viewKey, board.board_id)}` on that button, as suggested. |
| [Gap 2] No identity-reset effect, unlike `FilterContext` | **Acknowledge, no code change.** `BoardCollapseContext.tsx` will carry a one-line comment: collapsed-board ids are UUIDs scoped to the owning account, so a stale id surviving an anon→authenticated identity switch cannot collide with a different account's board — worst case is a harmless no-op collapse state, not a data leak. Intentionally omitting the reset effect that `FilterContext` has. |
| [Nit 3] `ViewKey` needs export/import | **Fix.** `ViewKey` will be exported from `BoardCollapseContext.tsx` and imported into `BoardGroupedTasks.tsx`; added explicitly to the Files to Modify list above. |
| [Nit 4] No cleanup path for stale collapsed board ids | **Acknowledge, no code change.** One-line comment near the context's state noting stale ids are inert (never rematch) rather than actively cleaned up — acceptable at this app's board-count scale. |

All four items addressed — two code fixes (native `<button>` + `aria-expanded`, `ViewKey` export), two acknowledged-in-comment (identity-reset omission, stale-id inertness). No blockers remain.
