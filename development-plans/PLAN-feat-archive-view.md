# PLAN: Rename Reports → Archive, add date-range presets and board filtering

Branch: `feat-archive-view`

## Requirement (as given by user)

1. Rename "Reports" to "Archive".
2. Add ability to filter by date, with standard presets: This month, Last month, Last three months (in addition to the existing manual From/To range).
3. Add the option to filter by boards or a specific board, via a board-tabs UI similar to the one under "All view".
4. The result should look like "Today view": multiple boards, following board order, collapsible sections, task cards using the same color scheme.

Scope confirmed with user: **web + mobile**, and the route/screen path renames from `/reports` to `/archive` (not just the label).

## Current state (as found)

- Web: `/reports` route → `ReportsPage.tsx`. Nav label "Reports" in `Layout.tsx`. Fetches `getCompletions(from, to, boardId)` from `api/reports.ts`, hitting `GET /reports/completions`. Always scoped to the single `activeBoard` from `BoardContext`; no board-tabs UI on the page itself.
- Mobile: `ReportsScreen.tsx`, same API shape, same single-board scoping, registered in `AppNavigator.tsx`.
- Backend: `backend/app/routers/reports.py` → `GET /reports/completions?from=&to=&label_ids=&board_id=`. `board_id` optional; omitted means "the user's default board" (via `board_svc.resolve_board_id`) — **not** "all boards". Query logic lives inline in the router (no `reports_service.py`).
- "Today view" grouping pattern (what we're asked to match) lives in `focused_view_service.get_day_view_tasks` (backend) + `BoardGroupedTasks.tsx` / mobile `BoardGroupedTasks.tsx` (frontend):
  - Backend orders boards by `Board.sort_order.asc(), Board.created_at.asc()`, groups tasks per board, **drops boards with zero matching items**.
  - Frontend renders one collapsible section per board (`useBoardCollapse` on web, screen-local `Set` state on mobile), header dot colored via `getBoardColor(board.color, idx)` (board's own hex color, else an 8-color fallback `PALETTE` indexed by position), with an Expand-all/Collapse-all control.
- `BoardTabs.tsx` (web + mobile) is bound to the **global** `BoardContext.activeBoard`/`setActiveBoard`, shared with the "All" kanban view. Reusing it as-is for Archive would mean picking a board in Archive also flips the board shown in the "All" kanban tab — an unwanted side effect.

## Design decisions

- **"All boards" is additive, not a change of default.** Omitting `board_id` today means "the default board" — an existing behavior other callers may depend on. Rather than repurpose that, add a new explicit `all_boards: bool = false` query param. `all_boards=true` ignores `board_id` and returns all boards grouped; anything not sending it gets today's exact behavior. Fully backward compatible — safe for mobile clients that haven't picked up the change yet.
- **Board filter uses local state, not `BoardContext`.** New `ArchiveBoardTabs` components (web + mobile) hold their own `selectedBoardId: string | 'all'` state instead of writing through `setActiveBoard`, so Archive's board selection never leaks into the "All" kanban view.
- **Grouped rendering only applies to "All boards".** Selecting one specific board renders today's flat list (nothing to group). Selecting "All boards" (the default) renders the Today-view-style grouped/collapsible layout.
- **"Last three months" = rolling window including the current partial month**: 1st of the month two months back → today (confirmed with user).
- Extract the router's query logic into `backend/app/services/reports_service.py`, mirroring the existing `focused_view_service.py` split (thin router, testable service function) — needed to unit-test the new grouping logic without a DB.
- **Date preset math must use local-date arithmetic**, not `toISOString()`. Both `dateRangePresets.ts` files build boundary dates the same way `dateOnly()` does in `frontend/src/utils/taskDateUtils.ts:5-10` (local `getFullYear()/getMonth()/getDate()`), not the UTC-based pattern the current `ReportsPage.tsx` uses. (Sneezy #2)
- **All-boards flat `completions` ordering**: stays pure `Task.completed_at.asc()` across all matched boards (not grouped-then-sorted) — same ORDER BY as today's single-board query, just with a wider `board_id IN (...)` filter. `boards[].completions` (the grouped field) is what's board-ordered/grouped; the flat field's contract is genuinely unchanged. (resolves Sneezy's "Unverified assumption" #1)

## API contract changes

- `GET /reports/completions`: new optional query param `all_boards: bool = false`. Existing `from`, `to`, `label_ids`, `board_id` unchanged. If `all_boards=true`, `board_id` is ignored server-side (no validation error on sending both — the frontend will never send both, so this is a non-issue in practice, not a real ambiguity).
- `CompletionsReport` response: new optional field `boards: Optional[List[BoardCompletions]] = None`, where `BoardCompletions = { board_id: str, board_name: str, board_color: Optional[str], completions: List[CompletionItem] }`. Populated only when `all_boards=true`; `None` otherwise. Existing `completions` (flat, all matched items) and `total` stay populated exactly as today in both modes, so any caller ignoring `boards` is unaffected.
- Purely additive — old mobile builds and any other untouched client continue to work unmodified.

## Data model changes

None. No new tables or columns. Reuses existing `Board.sort_order` (ordering) and `Board.color` (coloring, with existing palette fallback).

## Files to modify

**Backend**
- `backend/app/routers/reports.py` — add `all_boards` param, delegate to new service function.
- `backend/app/services/reports_service.py` (new) — `get_completions(db, user_id, from_date, to_date, label_ids, board_id, all_boards)`: single-board path unchanged logic moved here; new all-boards path calls `board_svc.ensure_board_seeded(db, user_id)` first (mirrors `resolve_board_id`'s None-branch, keeps seed-on-first-touch consistent — Sneezy #4/suggestion), then queries user's non-deleted boards ordered by `sort_order.asc(), created_at.asc()`, filters completions across those board ids, groups in Python preserving board order, skips boards with zero matches (same convention as `_query_board_grouped_tasks`). Flat `completions` field stays ordered by `Task.completed_at.asc()` across all matched boards regardless of mode.
- `backend/app/schemas.py` — add `BoardCompletions` model **defined above `CompletionsReport`** (avoids forward-ref/ordering issue — Sneezy #5); add `boards: Optional[List[BoardCompletions]] = None` to `CompletionsReport`.
- `backend/tests/unit/` (new test file, e.g. `test_reports_service.py`) — mocked-session unit tests for the new grouping function.

**Frontend (web)**
- `frontend/src/App.tsx` — route `/reports` → `/archive`, `ReportsPage` → `ArchivePage`.
- `frontend/src/components/Layout.tsx` — nav item label "Reports" → "Archive", `to: '/archive'`.
- `frontend/src/pages/ReportsPage.tsx` → renamed `frontend/src/pages/ArchivePage.tsx` — rewritten: keep manual From/To inputs, add 3 preset buttons, add `ArchiveBoardTabs`, branch rendering on `response.boards` (grouped) vs flat list.
- `frontend/src/utils/dateRangePresets.ts` (new) — pure functions for This month / Last month / Last three months → `{from, to}` ISO strings, built with `dateOnly()`-style local-date arithmetic, not `toISOString()` (Sneezy #2).
- `frontend/src/components/ArchiveBoardTabs.tsx` (new) — "All boards" pill + one pill per board (from `BoardContext.boards`, already sort_order-ordered), local state only, styled like `BoardTabs.tsx` via `getBoardColor`.
- `frontend/src/components/ArchiveBoardGroups.tsx` (new) — mirrors `BoardGroupedTasks.tsx`'s collapsible-section/color/order/Expand-all pattern, rendering completion cards (today's card markup, plus a board-color left accent) instead of `FocusedTaskCard`.
- `frontend/src/context/BoardCollapseContext.tsx` — extend `ViewKey` union with `'archive'`, add to initial state.
- `frontend/src/api/reports.ts` — `getCompletions(from, to, { boardId?, allBoards? })`; add `BoardCompletions` type; `CompletionsReport.boards?`.

**Frontend (mobile)**
- `mobile/src/screens/ReportsScreen.tsx` → renamed `mobile/src/screens/ArchiveScreen.tsx` — same additions as web (screen-local collapsed-board `Set` state, following `TasksScreen.tsx`'s existing pattern rather than a new context).
- `mobile/src/navigation/AppNavigator.tsx` — screen/tab registration "Reports" → "Archive".
- `mobile/src/api/reports.ts` — mirror the web signature/type change.
- `mobile/src/types/index.ts` — add `BoardCompletions` type; add `boards?: BoardCompletions[]` to `CompletionsReport` (this is where the mobile types actually live, per `mobile/src/api/reports.ts` importing from here rather than defining them — Sneezy #1).
- `mobile/src/components/ArchiveBoardTabs.tsx` (new) — local-state variant, `BoardTabs.tsx` left untouched (still used by the kanban "All" view).
- `mobile/src/components/ArchiveBoardGroups.tsx` (new) — mirrors mobile `BoardGroupedTasks.tsx`'s pattern for completion cards.
- `mobile/src/utils/dateRangePresets.ts` (new) — straight copy of the web version (same "copy, don't share" convention as the rest of mobile's utils), same `dateOnly()`-equivalent local-date arithmetic (Sneezy #3/suggestion).

## Test plan

- **Backend unit tests** (`backend/tests/unit/`): new file covering `reports_service.get_completions` all-boards path — multiple boards with completions in board order, a board with zero completions excluded, `label_ids` filter still applied, single-board path behavior unchanged (regression check).
- **Frontend unit tests** (`frontend/src/__tests__/`): new file for `dateRangePresets.ts` — boundary correctness for all 3 presets, including a January "last three months" case (crosses a year boundary).
- **Mobile unit tests** (`mobile/src/__tests__/`): matching `dateRangePresets.test.ts` for the mobile copy, same cases including the year-boundary case (Sneezy #3).
- **`backend/tests/test_api.py`**: not modified by me — flagged for Sleepy (`/test-review`) in the PR review chain, per test ownership rules in `CLAUDE.md`.
- **Manual**: use the `run` skill to start the app locally; click through both presets and board-tab filtering in the browser, confirm grouped/collapsible rendering visually matches Today view (order, colors, collapse behavior).

## Deployment order

- Backend + web frontend ship as one Docker image (per `CLAUDE.md`) — no staggering risk between those two.
- Mobile deploys independently. The API change is additive/backward-compatible, so mobile can lag the backend/web deploy indefinitely with no compatibility window concern.
- **Mobile update type: OTA** (`eas update`) — all mobile changes are JS/TS (screens, components, API client); no native modules, `app.json`, or `eas.json` changes.
- Safe order: backend+web deploy (single image) → mobile OTA whenever convenient.

## Pre-implementation checklist

- Confidence in solution: 4/5
- Regression risk: 2/5 (additive API change; existing single-board path logic is relocated, not altered — covered by new unit tests + Sleepy's integration pass)
- Data model changes: none
- Test changes needed: new backend unit test file (`reports_service`), new frontend unit test file (`dateRangePresets`); `test_api.py` changes deferred to Sleepy
- Deployment order: backend+web single image → mobile OTA, no compatibility window concern (additive contract)
- Mobile update type: OTA (`eas update`)

---

## Sneezy's Review — 2026-08-02

**Tier:** FULL — stated at spawn: "Files to modify" includes `backend/app/routers/reports.py` (router area) and `backend/app/schemas.py` (API-contract area), a new API param (`all_boards`) and response field (`boards`), plus a new service file `backend/app/services/reports_service.py`.

**Verdict:** Approved with concerns

### Issues

1. **[Gap]** `mobile/src/api/reports.ts` does not define `CompletionsReport`/`CompletionRecord` itself — it imports them from `mobile/src/types/index.ts` (confirmed: `mobile/src/types/index.ts:84-94` has `CompletionRecord`/`CompletionsReport`; `mobile/src/api/reports.ts` only has `getCompletions()` and imports the type). The plan's "Files to modify" list for mobile only says `mobile/src/api/reports.ts — mirror the web signature/type change`, but the new `boards?: BoardCompletions[]` field and `BoardCompletions` interface actually need to land in `mobile/src/types/index.ts`, which isn't on the list at all. As written, implementing exactly what's listed leaves `ArchiveBoardGroups.tsx` (mobile) with no typed way to read `response.boards` and would fail type-checking.

2. **[Risk]** The plan's new `frontend/src/utils/dateRangePresets.ts` doesn't specify which date-formatting approach to use, and the codebase has a documented, twice-fixed bug class here. The *current* `ReportsPage.tsx` (`frontend/src/pages/ReportsPage.tsx:6-8`) computes date strings via `date.toISOString().split('T')[0]` — UTC-based, and off by one day for users west of UTC around local midnight. The project already has an established fix for exactly this: `dateOnly()` in `frontend/src/utils/taskDateUtils.ts:5-10`, which builds the string from local `getFullYear()/getMonth()/getDate()`, used everywhere else (`FocusedView.tsx`, `DayView.tsx`). ARCHITECTURE.MD documents this same UTC-vs-local bug being hit and fixed twice already (PR #56's Day-After-Tomorrow/Monday date bugs). If "This month"/"Last month"/"Last three months" boundary math in the new file follows the old `ReportsPage`-local pattern instead of `dateOnly()`, it reintroduces the same bug class in a new file. The plan should explicitly say the new presets file must build on local-date arithmetic (`dateOnly()` or equivalent), not `toISOString()`.

3. **[Gap]** No mobile equivalent of `dateRangePresets.ts` is listed, and the Test Plan's only date-preset test ("boundary correctness for all 3 presets, including a January … case") is scoped to the web file only. Per ARCHITECTURE.MD's stated convention ("Utility Code … copied from `frontend/src/` rather than extracted into a shared module — deliberate no-monorepo decision"), mobile's `ArchiveScreen.tsx` needs its own preset-boundary logic to satisfy requirement #2 on mobile (scope is confirmed web **and** mobile at the top of the plan). Neither the Files-to-modify list nor the Test plan accounts for where this logic lives on mobile or how it's tested — the year-boundary edge case gets unit coverage on web and none on mobile.

4. **[Nit]** The new `all_boards=true` backend path (per the plan's description in `services/reports_service.py`) queries the user's non-deleted boards directly, unlike the existing single-board path which goes through `board_svc.resolve_board_id(db, user_id, board_id)` — and when `board_id` is `None`, `resolve_board_id` calls `ensure_board_seeded()` (confirmed: `backend/app/services/board_service.py:30-45`), lazily creating a default board + labels for brand-new users. A brand-new user who opens Archive first (default "All boards") before ever hitting `GET /boards` or any task/label endpoint would get back `boards: []` rather than being seeded. Harmless in practice (there's nothing to show either way), but it's an inconsistency with the seed-on-first-touch convention used everywhere else in this codebase, and worth a one-line acknowledgment in the plan.

5. **[Nit]** In `backend/app/schemas.py`, `CompletionsReport` (currently defined at line 191, before `FocusedViewBoardGroup`/`FocusedViewTasksOut` at lines 246-254) will need `BoardCompletions` defined above it (or referenced via forward ref) once `boards: Optional[List[BoardCompletions]]` is added — trivial, but worth calling out so the new class doesn't get appended after `CompletionsReport` by accident.

### Unverified assumptions

- The plan states the existing flat `completions` field "stay[s] populated exactly as today in both modes" but doesn't specify its ordering when `all_boards=true` — today's single-board query orders by `Task.completed_at.asc()` (confirmed `backend/app/routers/reports.py:40`); it's unverified whether the all-boards flat list is intended to keep pure `completed_at` ordering across all boards, or something else (e.g. board-grouped-then-completed_at). Worth pinning down explicitly during implementation since the plan calls this field's behavior unchanged.
- "Confidence in solution: 4/5" / "Regression risk: 2/5" are the author's self-assessment and weren't independently re-derived here beyond the specific gaps above; the rest of the plan's design decisions (additive `all_boards` param, local-state board tabs, grouped-only-for-all-boards rendering) check out against the current code and are sound.

### Suggestions

- Consider having `reports_service.get_completions()`'s all-boards path call `board_svc.ensure_board_seeded(db, user_id)` first (mirroring `resolve_board_id`'s None-branch) purely for consistency with the rest of the codebase's seed-on-first-touch convention, even though it has no visible effect on this endpoint's output.
- Add `mobile/src/utils/dateRangePresets.ts` (a straight copy of the web version, per this codebase's established "copy, don't share" pattern for cross-platform utils) plus a matching `mobile/src/__tests__/dateRangePresets.test.ts`, so the year-boundary case gets the same coverage on both platforms.
- Explicitly name `dateOnly()` (or an equivalent local-date builder) as the required implementation approach for the new preset math, to close off the UTC-off-by-one risk before it's written rather than catching it in review.

— *Sneezy*

---

## Grumpy's Response — 2026-08-02

User approved with these fixes folded in (all now reflected in the sections above, not just noted here):

1. **[Gap] Mobile types file** — Addressed. Added `mobile/src/types/index.ts` to the mobile file list, with the `BoardCompletions` type + `CompletionsReport.boards?` addition landing there instead of (incorrectly) in `mobile/src/api/reports.ts`.
2. **[Risk] UTC date-math bug class** — Addressed. Design decisions and both `dateRangePresets.ts` file entries now explicitly require `dateOnly()`-style local-date arithmetic, not `toISOString()`.
3. **[Gap] No mobile date-preset util/tests** — Addressed. Added `mobile/src/utils/dateRangePresets.ts` (copy of web) and `mobile/src/__tests__/dateRangePresets.test.ts` to the mobile file list and test plan.
4. **[Nit] Board-seeding inconsistency** — Addressed. `reports_service.py`'s all-boards path now calls `board_svc.ensure_board_seeded(db, user_id)` first, matching `resolve_board_id`'s None-branch.
5. **[Nit] Schema ordering** — Addressed. `BoardCompletions` is now explicitly specified as defined above `CompletionsReport` in `schemas.py`.
- **Unverified assumption: flat `completions` ordering** — Pinned down. Stays `Task.completed_at.asc()` across all matched boards in both modes; only `boards[].completions` is board-grouped/ordered.
- **Unverified assumption: self-assessment scores** — Not re-scored; Sneezy's spot-check of the design decisions found them sound, no change needed.
- All 3 suggestions — folded into the fixes above (seed call, mobile preset util+test, explicit `dateOnly()` naming).

No open items remain. Proceeding to implementation on branch `feat-archive-view`.

— *Grumpy*
