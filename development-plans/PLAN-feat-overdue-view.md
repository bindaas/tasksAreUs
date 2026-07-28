# Development Plan: Overdue View
**Branch:** `feat-overdue-view`
**Status:** Revision 3 — first-paint gating added per user direction (fixes Sneezy Revision 2's Issue 1); remaining Revision 2 findings addressed inline below.

---

## Overview

Add a new top-level **Overdue** view, at the same level as the existing Focused/Today/Tomorrow/All views (session-only, pill-toggle selectable). This is distinct from the kanban board's existing "Overdue" *column* inside the All view (`frontend/src/pages/TasksPage.tsx`), which is unaffected by this plan.

**Criteria:** a pending task is "overdue" when its effective date — the earliest of `must_do_by`/`target_date` when both are set, otherwise whichever is non-null — is strictly before today. This is the same definition already used by `getColumn`/`getEffectiveDate` in `frontend/src/utils/taskDateUtils.ts` (and the mobile equivalent) to populate the kanban board's Overdue column.

**Placement & defaulting:**
- Pill order: **Overdue | Focused | Today | Tomorrow | All**.
- The Overdue pill is rendered only when the caller has at least one overdue task in any board.
- Default view on page load: **Overdue** if any overdue tasks exist, otherwise **Focused** (unchanged default).

**Data model status:** no new tables/columns. Uses existing `must_do_by`/`target_date`/`state`/`is_deleted` on `tasks`.

**API design (revised from Revision 1):** two view-fetching endpoints, not three. `/focused-view/tasks` stays untouched — it's genuinely different (high-priority-only, and its window comes from a *persisted per-user config* fetched/updated via its own `GET`/`PUT /focused-view/config` endpoints). Today, Tomorrow, and Overdue are structurally identical (cross-board, board-grouped, any-priority) and differ only in one date comparison, so Overdue is folded into the existing `/day-view/tasks` endpoint via a new optional `overdue` query param, rather than a third router file. This is purely additive to a shipped endpoint — old callers that never pass `overdue` keep today's exact-match behavior unchanged (verified: `overdue: bool = False` as a 4th parameter with a default doesn't break `get_day_view_tasks`'s two existing positional 3-arg call sites, and the existing frontend/mobile test assertions on the plain `?reference_date=` URL still pass since the added query fragment is conditional on `overdue`). Net effect: **no new backend files at all** — only `day_view.py` and `focused_view_service.py` are modified.

---

## Backend

### `backend/app/services/focused_view_service.py` (modify)

Refactor the private helper `_query_board_grouped_tasks(db, user_id, boards, window, high_priority_only)` to accept a SQLAlchemy filter clause instead of a fixed `window: List[date]`, since Overdue needs a "before" comparison rather than an "in this set of dates" comparison. This helper is private (`_`-prefixed) with exactly 2 in-file callers (verified via `grep -rn "_query_board_grouped_tasks" backend/`) — both covered by `backend/tests/unit/test_focused_view_service.py`, which mocks at the `db.query(...).filter(...).order_by(...).all()` chain level and never inspects filter *contents*, so the refactor is behavior-preserving for existing tests.

```python
def _query_board_grouped_tasks(db, user_id, boards, date_filter, high_priority_only) -> List[dict]:
    ...
    filters = [
        Task.user_id == user_id,
        Task.board_id.in_(board_ids),
        Task.is_deleted == False,
        Task.state == StateEnum.pending,
        date_filter,
    ]
    ...

def get_focused_tasks(...):
    window = date_window(config.day_range, reference_date)
    date_filter = or_(Task.must_do_by.in_(window), Task.target_date.in_(window))
    return _query_board_grouped_tasks(db, user_id, boards, date_filter, high_priority_only=True)

def get_day_view_tasks(
    db: Session,
    user_id: str,
    reference_date: date,
    overdue: bool = False,
) -> List[dict]:
    boards = db.query(Board).filter(
        Board.user_id == user_id,
        Board.is_deleted == False,
    ).order_by(Board.name.asc()).all()

    if overdue:
        date_filter = or_(Task.must_do_by < reference_date, Task.target_date < reference_date)
    else:
        date_filter = or_(Task.must_do_by == reference_date, Task.target_date == reference_date)

    return _query_board_grouped_tasks(db, user_id, boards, date_filter, high_priority_only=False)
```

`or_(must_do_by < reference_date, target_date < reference_date)` is equivalent to "earliest of the two is before `reference_date`" and correctly excludes rows where a field is NULL (SQL three-valued logic: a NULL comparison is neither true nor false, so `OR` falls through to the other side) — no `LEAST()`/coalescing needed. `overdue=False` (the default) preserves the exact match `==` behavior Today/Tomorrow already rely on in production.

### `backend/app/routers/day_view.py` (modify)

```python
@router.get("/tasks", response_model=FocusedViewTasksOut)
def get_day_view_tasks(
    reference_date: date = Query(...),
    overdue: bool = Query(default=False),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user),
):
    boards = svc.get_day_view_tasks(db, user_id, reference_date, overdue=overdue)
    return FocusedViewTasksOut(boards=boards)
```

`reference_date` stays required (unchanged contract) — the frontend always passes its own local date explicitly regardless of mode (see below), matching how `FocusedView.tsx` already calls `/focused-view/tasks`. No changes to `schemas.py` — reuses `FocusedViewTasksOut`/`FocusedViewBoardGroup` as-is (correcting Revision 1's cited-but-nonexistent `FocusedBoardOut`). No changes to `main.py` — no new router to register.

---

## Frontend (web)

- `frontend/src/utils/viewLabel.ts` — add `'overdue'` to `ViewMode` union and `VIEW_LABELS` (`'Overdue'`).
- `frontend/src/context/BoardCollapseContext.tsx` — add `'overdue'` to `ViewKey` and the initial `collapsed` record, so Overdue gets per-board collapse/expand for free through the already-generic `BoardGroupedTasks`.
- `frontend/src/api/dayView.ts` (modify):
  ```ts
  export async function getDayViewTasks(referenceDate: string, overdue = false): Promise<{ boards: FocusedBoard[] }> {
    const qs = overdue ? '&overdue=true' : '';
    return apiFetch<{ boards: FocusedBoard[] }>(`/day-view/tasks?reference_date=${referenceDate}${qs}`);
  }
  ```
  Default `overdue=false` keeps the existing call sites (Today/Tomorrow) and their test assertions unchanged.
- `frontend/src/components/DayView.tsx` (modify, not a new file) — add two optional props:
  - `overdue?: boolean` (default `false`) — passed through to `getDayViewTasks(referenceDate, overdue)`, and switches the empty-state copy to "No overdue tasks" (vs. "No tasks for this period").
  - `onLoaded?: (hasAny: boolean) => void` — called after every successful fetch (initial load and `onRefresh`) with `result.boards.length > 0`. Only the Overdue call site passes it; Today/Tomorrow ignore it (prop stays optional/unused for them).
  - `viewKey` prop type widens from `Extract<ViewKey, 'today' | 'tomorrow'>` to also allow `'overdue'`.
- `frontend/src/pages/TasksPage.tsx`:
  - `const [hasOverdueTasks, setHasOverdueTasks] = useState(false)`, `const [overdueChecked, setOverdueChecked] = useState(false)`, `const appliedDefaultRef = useRef(false)`.
  - **Single** mount effect (fixes Revision 1's Blocker — see "Sneezy Revision 1 findings addressed" below):
    ```tsx
    useEffect(() => {
      getDayViewTasks(dateOnly(new Date()), true)
        .then((result) => {
          const hasAny = result.boards.length > 0;
          setHasOverdueTasks(hasAny);
          if (!appliedDefaultRef.current) {
            appliedDefaultRef.current = true;
            if (!searchParams.get('view') && hasAny) {
              setView('overdue');
            }
          }
        })
        .catch(() => setHasOverdueTasks(false))
        .finally(() => setOverdueChecked(true));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    ```
    The ref is set to `true` only inside the `.then()` continuation — i.e. only once the fetch has actually resolved and the real value is known — never on synchronous mount. This removes the two-effect race the earlier draft had.
  - **First-paint gating (fixes Sneezy Revision 2's Issue 1 — Focused-view flash + wasted `/focused-view/tasks` fetch):** everything below the static page title (pill toggle, board tabs, and view content) is gated on `overdueChecked`. Until it's `true`, render a single centered spinner (same visual treatment as the existing `viewMode === 'all' && loading` spinner) instead of mounting any view component. Since `overdueChecked` flips via `.finally()` regardless of success or failure, this can't hang indefinitely on a network error. This also incidentally fixes the pre-existing (out-of-scope, unrelated to this plan) flash on bookmarked `?view=today`-style links, since the URL-restore effect's synchronous `setViewMode` call always completes before the network-bound overdue-check does — by the time the gate lifts, `viewMode` already reflects the URL, not the `'focused'` default. `VIEW_ORDER` moves from module scope into a `useMemo` keyed on `hasOverdueTasks`, prepending `{ key: 'overdue', title: 'Overdue' }` when true — safe to compute before the gate lifts since it only affects what's rendered once ungated.
  - URL-restore effect: add `'overdue'` to the accepted `viewParam` values.
  - Render: `{viewMode === 'overdue' && <DayView referenceDate={today} viewKey="overdue" overdue onLoaded={setHasOverdueTasks} />}`.

**Accepted tradeoffs (explicit, not silently decided):**
1. **Duplicate fetch on the common path.** When Overdue ends up as the default view, `TasksPage`'s mount effect and `DayView`'s own mount effect both call `GET /day-view/tasks?...&overdue=true` moments apart — the tab-visibility check and the view's own data currently aren't shared. Not a correctness bug, just one extra GET on the primary path this feature exists for. Declining to add an `initialBoards` seeding prop to avoid this for now, in favor of keeping `DayView` self-contained like every other view component — flag if you'd rather I thread the fetched data through instead.
2. **No live re-check during a session.** `hasOverdueTasks` is set at mount and by `OverdueView`'s own `onLoaded` (only while that view is open) — a task becoming overdue mid-session (midnight rollover, or backdating a task from another view) won't surface the pill until the next full page load. Consistent with the rest of the view system (Focused/Day View don't poll either).
3. **Tab disappearing mid-session.** If the last overdue task is resolved while the user is on that view, they see the empty state rather than being redirected — no auto-switch-away logic added.
4. **A failed initial overdue-check forfeits Overdue-as-default for that session, with no retry.** Since the mount effect only runs once (`[]` deps), a network hiccup during the initial check means `.catch(() => setHasOverdueTasks(false))` runs, `hasAny` is `false`, so `setView('overdue')` is correctly never called — but there's no later opportunity to re-check, even if overdue tasks genuinely exist. The page silently falls back to Focused for the rest of that load. Low severity (matches tradeoff 2's no-live-recheck philosophy) — a full page reload re-triggers the check.

---

## Mobile

- `mobile/src/api/dayView.ts` (modify) — same `overdue` param addition as web.
- `mobile/src/components/DayView.tsx` (modify, not a new file) — same `overdue?: boolean` / `onLoaded?` additions as web, plus the empty-state copy branch.
- `mobile/src/screens/TasksScreen.tsx`:
  - `ViewMode` → add `'overdue'`; `BoardViewKey` → add `'overdue'`; `collapsedBoards` initial state → add `overdue: new Set()`.
  - `VIEW_LABELS` → add `overdue: 'Overdue'`.
  - `hasOverdueTasks` state + `appliedDefaultViewRef` (`useRef(false)`), both driven from inside the existing `useFocusEffect` callback's async flow — **not** a separate reactive effect, since the check-and-apply happens naturally inside the fetch's `.then()`, which structurally can't hit Revision 1's blocker (there's no synchronous code path that could set the ref before the fetch resolves).
  - **First-paint gating (fixes Sneezy Revision 2's Issue 1):** a separate `const [initialGateResolved, setInitialGateResolved] = useState(false)`, set `true` via `.finally()` on the *first* time the overdue-check settles — and never reset afterward, so it only gates the very first render, not every subsequent tab refocus (unlike `appliedDefaultViewRef`, which governs default-*switching*, this one governs first-*paint*; both are one-shot but for different reasons). The screen's existing `if (loading) { return <ActivityIndicator/> }` early return becomes `if (loading || !initialGateResolved)`, reusing the exact spinner already shown while `load()`'s own fetch is in flight — no new UI:
    ```tsx
    getDayViewTasks(todayStr, true)
      .then((result) => {
        const hasAny = result.boards.length > 0;
        setHasOverdueTasks(hasAny);
        if (!appliedDefaultViewRef.current) {
          appliedDefaultViewRef.current = true;
          if (hasAny) setViewMode('overdue');
        }
      })
      .catch(() => {})
      .finally(() => setInitialGateResolved(true));
    ```
  - Pill row: replace the hardcoded `(['focused', 'today', 'tomorrow', 'all'] as const)` with a `useMemo` that conditionally prepends `'overdue'`.
  - Render block: add the `viewMode === 'overdue'` branch analogous to the existing `today`/`tomorrow` branches (`<DayView ... overdue onLoaded={setHasOverdueTasks} />`), wired to `collapsedBoards.overdue` / `toggleBoardCollapse('overdue', id)` / `setAllBoardsCollapsed('overdue', ...)`.
  - `handleCreatePress` needs no change (confirmed by reading it — only special-cases `viewMode === 'all'`, so `'overdue'` falls into the existing default-board branch automatically).

**Mobile-specific accepted tradeoff (corrects Revision 2's finding that this was previously understated):** the duplicate-fetch cost from web's tradeoff 1 above is *heavier* on mobile — because `useFocusEffect` re-runs the overdue-check on every tab refocus (not just app launch), and the Overdue `DayView` instance uses the same `key={focusedViewKey}` remount-on-refocus pattern Today/Tomorrow already use, every single return to the Tasks tab while viewing Overdue fires two back-to-back `GET /day-view/tasks?...&overdue=true` requests, not just one at load. Accepted for the same reason as web (keeping `DayView` self-contained) — flag if this should be optimized (e.g. `DayView` reusing the boards already fetched by the focus-effect's own check).

---

## Test plan

**Backend (`backend/tests/unit/`)**
- `test_day_view_router.py` (modify) — add wiring tests: `overdue=True` in the request reaches `svc.get_day_view_tasks(..., overdue=True)`; omitting `overdue` reaches the service as `overdue=False` (regression guard for existing Today/Tomorrow behavior). Implementation note: the router calls `svc.get_day_view_tasks(db, user_id, reference_date, overdue=overdue)` as a **keyword** argument, unlike this file's 3 existing tests which assert against positional `args[1]`/`args[2]` — the new tests need to read `overdue` off `call_args.kwargs['overdue']` instead.
- `test_focused_view_service.py` (modify) — extend `TestGetDayViewTasks` with a basic overdue-grouping case, plus a new `TestGetDayViewTasksDateFilterClause` class that captures the real SQLAlchemy clause passed to `.filter(...)` and inspects its structure (`<` vs `=`, both fields present, joined by `OR`) — the strongest guarantee obtainable without a real DB. `overdue=False` (default) preserves the existing exact-match behavior (explicit regression test).
- **Post-implementation correction**: the mixed-date "earliest wins" case, plus excludes-today and excludes-future, were originally planned as `test_focused_view_service.py` cases but that file's convention mocks the SQLAlchemy session (`unittest.mock.MagicMock`) — `.filter(...)` returns a canned list regardless of the clause passed to it, so no assertion in that file can actually prove the WHERE clause evaluates correctly against real row data for mixed field combinations. That behavioral coverage belongs in the integration suite (`test_api.py`, real Postgres, Sleepy's domain) instead — flagged to Sleepy during test-review rather than added as a unit test that would pass regardless of whether the underlying logic were correct.

**Frontend**
- `frontend/src/__tests__/viewLabel.test.ts` — add a case for `viewLabel('overdue', ...)` returning `'Overdue'`.
- No dedicated test added for `api/dayView.ts`'s new `overdue` param on web — matches existing precedent (`dayView.ts`/`focusedView.ts` are untested on web; only pure utils and a few CRUD-heavy API modules like `boards.ts`/`tasks.ts` are covered).

**Mobile**
- `mobile/src/__tests__/dayView.api.test.ts` (modify, not a new file) — add a case asserting `getDayViewTasks(date, true)` calls `/day-view/tasks?reference_date=X&overdue=true`; existing case for the 1-arg call continues to assert the unchanged URL (regression guard).

**Integration test file (`backend/tests/test_api.py`):** not touched by this plan — owned exclusively by the `/test-review` skill (Sleepy), addressed in a later review pass.

---

## Deployment order

Railway builds one Docker image containing both the backend and the compiled frontend `dist/`, so web + backend ship atomically in a single deploy — no staggered window between them. Mobile is a separate artifact:
1. Merge this PR → single Railway deploy ships the extended `/day-view/tasks` endpoint and the web UI together.
2. Push a mobile OTA update (`eas update`) any time after — purely additive (new screen state + optional query param), so an old mobile build in the wild before the OTA lands simply never sends `overdue=true`; no compatibility window to manage.

Mobile update type: **OTA** — JS/TS only, no native modules, `app.json`, or `eas.json` changes.

---

## Files to modify/create

No new files anywhere — every change is a modification to an existing file.

**Backend**
- `backend/app/services/focused_view_service.py` (modify — refactor `_query_board_grouped_tasks`, add `overdue` param to `get_day_view_tasks`)
- `backend/app/routers/day_view.py` (modify — add `overdue` query param)
- `backend/tests/unit/test_day_view_router.py` (modify)
- `backend/tests/unit/test_focused_view_service.py` (modify)

**Frontend**
- `frontend/src/utils/viewLabel.ts` (modify)
- `frontend/src/context/BoardCollapseContext.tsx` (modify)
- `frontend/src/api/dayView.ts` (modify)
- `frontend/src/components/DayView.tsx` (modify)
- `frontend/src/pages/TasksPage.tsx` (modify)
- `frontend/src/__tests__/viewLabel.test.ts` (modify)

**Mobile**
- `mobile/src/api/dayView.ts` (modify)
- `mobile/src/components/DayView.tsx` (modify)
- `mobile/src/screens/TasksScreen.tsx` (modify)
- `mobile/src/__tests__/dayView.api.test.ts` (modify)

**Docs** (post-merge, via `arch-review`/`requirements-review` agents per standard flow — not part of this implementation PR)

---

## Open questions for the user (flagged, not decided unilaterally)

1. **Sort order within Overdue** — plan defaults to matching Day View (`is_high_priority desc, updated_at desc`). An alternative is "most overdue first" (oldest effective date first). Neither is implemented pending user preference.
2. **Tab disappearing mid-session** — accepted as-is (see Frontend section above); flag if a different behavior (e.g. auto-switch to Focused) is wanted instead.
3. **No live re-check across a long session / midnight rollover** — accepted as-is, consistent with the rest of the app; flag if you want a periodic re-check instead.
4. **Duplicate fetch on the "Overdue is default" path** — accepted as-is for simplicity (worse on mobile, where it recurs every tab refocus, not just once — see Mobile section); flag if you'd rather thread the tab-visibility check's data into the rendered view to avoid the second GET.
5. **A failed initial overdue-check forfeits Overdue-as-default for that session** (web) — accepted as-is, no retry; a page reload re-triggers the check.

---

## Sneezy's Revision 2 findings — how each was addressed in Revision 3

1. **[Risk] Focused-view flash + wasted `/focused-view/tasks` fetch on the default-to-Overdue path.** Fixed, not accepted — per your direction, both `TasksPage.tsx` (web) and `TasksScreen.tsx` (mobile) now gate first paint behind the overdue-check settling (`overdueChecked` / `initialGateResolved`), reusing each platform's existing spinner treatment. See Frontend/Mobile sections above.
2. **[Risk] Mobile duplicate-fetch cost understated (recurs every focus, not just once).** Corrected — restated explicitly as its own tradeoff in the Mobile section and cross-referenced from open question 4, rather than being folded into the web-framed wording.
3. **[Gap] No test for the mixed-date-fields "earliest wins" case.** Reconsidered during implementation (see "Post-implementation correction" below) — a mocked-session unit test cannot actually exercise this, so real behavioral coverage (mixed dates, excludes-today, excludes-future) was moved to the integration suite (`test_api.py`, Sleepy's domain) instead of `test_focused_view_service.py`.
4. **[Nit] New router wiring tests must assert `call_args.kwargs['overdue']`, not a positional arg.** Noted directly in the Test plan.
5. **[Nit] Failed initial overdue-check silently forfeits Overdue-as-default for the session.** Added as open question 5 / web tradeoff 4, rather than left implicit.

---

## Sneezy's Revision 1 findings — how each was addressed in Revision 2

1. **[Blocker] Web default-application effect's ref-guard timing.** Fixed by removing the second reactive effect entirely — the tab-visibility check, `hasOverdueTasks` update, and default-application now all happen inside one `.then()` continuation of a single mount effect (see Frontend section above). The ref is only ever set after the fetch resolves; there is no synchronous code path that can consume the one-shot guard prematurely. Mobile's equivalent already avoided this pattern (correctly, per Sneezy) and is unchanged in shape.
2. **[Gap] `test_overdue_view_router.py` didn't cover the `None → date.today()` fallback branch.** Moot — Revision 2 keeps `reference_date` required on `/day-view/tasks` (no fallback branch introduced). The new `overdue` param is a plain `bool` with a `False` default at the FastAPI/Pydantic layer, tested directly (see Test plan).
3. **[Risk] Duplicate fetch on the common path.** Still present in Revision 2 (now against `/day-view/tasks?overdue=true` instead of a hypothetical `/overdue-view/tasks`) — stated explicitly as an accepted tradeoff (open question 4) rather than fixed, per the "don't add abstractions beyond what's needed" default; happy to add the `initialBoards`-seeding fix if preferred.
4. **[Gap] No live re-check across a session.** Stated explicitly as open question 3, not fixed — matches the rest of the app's no-live-sync design.
5. **[Nit] `FocusedBoardOut` → `FocusedViewBoardGroup`.** Corrected in Revision 2's Backend section.
6. **[Nit] `main.py` import ordering.** Moot — Revision 2 doesn't touch `main.py` at all (no new router).

---

## Sneezy's Review — 2026-07-27 (Revision 1, superseded above)

**Tier:** FULL — stated at spawn (new router `backend/app/routers/overdue_view.py` + modified service `backend/app/services/focused_view_service.py`, including a refactor of a shared private helper used by two existing view types, both fall under the router/service API-contract area per the mechanical gate). Confirmed correct on inspection — no further escalation needed; the actual blast radius of `_query_board_grouped_tasks` is exactly the 2 in-file callers the plan claims (verified via `grep -rn "_query_board_grouped_tasks" backend/` — 3 total occurrences, all in `focused_view_service.py` itself: the definition and its two callers).

**Verdict:** Changes required

### Issues

1. **[Blocker] Web default-application effect's ref-guard timing is underspecified and, on the most natural reading, silently defeats the entire "default to Overdue" feature.** (`frontend/src/pages/TasksPage.tsx`, new effect described in plan lines 107–111.) The plan describes a single `hasOverdueTasks: boolean` (initialized `false`) plus `appliedDefaultRef` guarding an effect that runs "at most once" once `hasOverdueTasks` "is known." But a `boolean` initialized to `false` cannot distinguish "fetch hasn't resolved yet" from "fetch resolved, no overdue tasks." On initial mount, this new effect necessarily fires once synchronously with `hasOverdueTasks` still `false` (the mount fetch in Effect A is async and hasn't resolved yet). If the ref is set to `true` unconditionally at the top of the effect (the natural way to implement "runs at most once"), that first, premature firing consumes the one-shot guard — and when the fetch later resolves and flips `hasOverdueTasks` to `true` (re-running the effect via its dependency), the guard now blocks it, and `setView('overdue')` never fires. The net effect: Overdue would never become the default view on a fresh load, even when overdue tasks exist — the plan's central UX claim ("Default view on page load: Overdue if any overdue tasks exist") would silently fail. A correct implementation must only set `appliedDefaultRef.current = true` inside the branch that actually decides the outcome (either "an explicit `?view=` param already won" or "`hasOverdueTasks` is true and we just applied it") — never unconditionally at entry. The plan should be updated with this precise sequencing (or add an explicit `hasOverdueTasksLoaded` state) before implementation, since this is exactly the kind of bug that won't surface in a quick manual smoke test (it only shows up on a fresh, no-`?view=`-param load where overdue tasks exist — the primary path the whole feature is meant to serve) and has no error signal.
   Mobile's equivalent ("Default-view application guarded by a `useRef`... checked inside the existing `useFocusEffect` block") does *not* have this specific problem as described, because the check is naturally placed inside the async `.then()` continuation (after the fetch resolves) rather than being driven by a separate effect keyed on a stale-at-mount boolean — worth calling this asymmetry out explicitly in the plan so the web implementation doesn't copy the wrong pattern.

2. **[Gap] Test plan for `test_overdue_view_router.py` doesn't cover the new `reference_date is None → date.today()` fallback branch.** The plan says this file mirrors `test_day_view_router.py` (line 136), but `day-view`'s `reference_date` is *required* (`Query(...)`, no default) — `test_day_view_router.py` has no test for an omitted-parameter path because there isn't one to test. The new `overdue-view` router instead mirrors `focused-view`'s optional-with-fallback pattern (confirmed: `backend/app/routers/focused_view.py` lines 43–44 have the identical `if reference_date is None: reference_date = date.today()` branch) — but there is no `test_focused_view_router.py` in the repo to mirror either (confirmed via `find`/`grep` — no such file exists, and no existing test anywhere exercises this None-fallback branch at the router level). So the plan's stated test list leaves this specific new branch of logic completely untested. Add a case asserting that omitting `reference_date` in the request causes `date.today()` to reach `svc.get_overdue_tasks(...)`.

3. **[Risk] Duplicate `GET /overdue-view/tasks` fetch on the common "no `?view=` param, overdue tasks exist" path.** Once the default-application effect (Issue 1, assuming it's fixed) calls `setView('overdue')`, `TasksPage` re-renders and mounts `<OverdueView onLoaded={setHasOverdueTasks} />`, which independently fetches the same endpoint on its own mount effect — right after `TasksPage`'s own unconditional mount-effect (Effect A) already fetched it moments earlier for tab-visibility purposes. Every fresh page load where Overdue ends up as the default (i.e., the primary case this feature exists for) does two back-to-back identical GETs. On mobile this is worse: since Today/Tomorrow/Focused use `key={focusedViewKey}` to force a remount (and re-fetch) on every tab re-focus, if `OverdueView` follows the same pattern, the tab-visibility check inside `useFocusEffect` *and* `OverdueView`'s own mount fetch will both re-fire together on every single return to the Tasks tab, not just once per app session. Not a correctness bug, but worth a one-line acknowledgment in the plan (or an optimization: seed `OverdueView`'s initial state from the boards already fetched by the tab-visibility check instead of re-fetching).

4. **[Gap] The mirror-image edge case of the one the plan already accepts isn't addressed.** The plan explicitly accepts "tab disappears mid-session" (open question #2) but says nothing about the inverse: `hasOverdueTasks` is only ever set by a mount-only fetch (`[]` deps) plus `OverdueView`'s own `onLoaded` callback (which only fires while the user is actually looking at Overdue). If zero overdue tasks exist at page load, the Overdue pill can never appear for the rest of the session, even if a task becomes overdue (midnight rollover) or is created backdated while the session is open — there's no live re-check. This is consistent with the rest of the app's no-live-sync design (Focused/Day View don't poll either), so it's likely an acceptable, deliberate tradeoff — but it should be stated explicitly alongside open question #2 rather than left implicit, since it's the more likely scenario in practice (long-lived session across a midnight boundary) compared to the currently-documented one.

5. **[Nit]** Plan text (line 86, and referenced in the review-spawn prompt) calls the reused schema `FocusedBoardOut`. No such class exists in `backend/app/schemas.py` — the actual class backing `FocusedViewTasksOut.boards` is `FocusedViewBoardGroup` (schemas.py:243, confirmed via grep — no `FocusedBoardOut` anywhere in the repo). Harmless since the new router code never needs to name it directly, but the plan should use the correct name to avoid a future implementer searching for a class that doesn't exist. (The plan appears to be conflating this with the *frontend* TS interface `FocusedBoard` in `frontend/src/api/focusedView.ts`, which is a different, unrelated type in a different language/layer.)

6. **[Nit]** The proposed `main.py` import line (plan lines 81–82) — `from .routers import beliefs, boards, day_view, focused_view, overdue_view, labels, reports, settings, sync, tasks` — breaks the existing alphabetical ordering of that import statement (confirmed current line is alphabetical: `beliefs, boards, day_view, focused_view, labels, reports, settings, sync, tasks`). `overdue_view` sorts after `labels`, not before. Purely cosmetic, won't affect functionality.

### Unverified assumptions

- **Confirmed correct** (not just unverified — actually checked): the `or_(Task.must_do_by < reference_date, Task.target_date < reference_date)` NULL-handling claim (plan line 58). Walked through SQL three-valued logic for all four NULL combinations: both null → `NULL OR NULL = NULL` (excluded, correct — no effective date); one null → the null side evaluates to `NULL`, so the result reduces to the non-null side's comparison (correct — matches "effective date = whichever field is non-null"); both set → `OR` of two comparisons is true iff the earlier one is before `reference_date`, which is exactly `min(a,b) < reference_date` (correct). The claim holds in all cases; no `LEAST()`/`COALESCE()` is needed as stated.
- **Confirmed correct**: the `_query_board_grouped_tasks` refactor's claim of being behavior-preserving for the two existing callers and their tests. Read `backend/app/services/focused_view_service.py` in full — exactly 2 callers, both private/in-file. Read `backend/tests/unit/test_focused_view_service.py` in full — `TestGetFocusedTasks`/`TestGetDayViewTasks` mock at the `db.query(...).filter(...).order_by(...).all(...)` chain level and never assert on the *contents* of the filter arguments (MagicMock accepts and ignores whatever's passed to `.filter()`), so renaming/reshaping the 4th parameter from a date list to a SQLAlchemy clause is invisible to these tests exactly as claimed.
- **Confirmed correct**: reuse of `FocusedViewTasksOut` and the router pattern — new `overdue_view.py`'s proposed structure is nearly byte-for-byte identical to the real `focused_view.py`'s `/tasks` handler (same `Optional[date]` + `date.today()` fallback pattern), and `day_view.py` was also read in full and confirmed as the no-default-required contrast case the plan correctly describes.
- **Confirmed correct**: `BoardCollapseContext.tsx`'s `ViewKey` type and `BoardGroupedTasks.tsx` are fully generic over `ViewKey` (no `switch`/hardcoded-union handling) — read both in full; adding `'overdue'` to the type and initial `collapsed` record is sufficient to get per-board collapse "for free" exactly as claimed.
- **Confirmed correct**: mobile `handleCreatePress`'s "no change needed" claim (plan line 129) — read `mobile/src/screens/TasksScreen.tsx` in full; the function only special-cases `viewMode === 'all'`, so `'overdue'` automatically falls into the existing default-board branch.
- **Confirmed correct**: deployment-order claim against `CLAUDE.md`'s deploy-trigger section — single Docker image bakes web + backend together (triggers on `backend/app/` or `frontend/` changes), mobile is a separate OTA-only artifact with no native/`app.json`/`eas.json` changes in this plan's file list.
- **Confirmed correct**: test-precedent claims — read `ARCHITECTURE.MD`'s file-by-file test listing; web genuinely has no `dayView.api.test.ts`/`focusedView.api.test.ts` equivalents (only `viewLabel.test.ts`, `client.test.ts`, `boards.api.test.ts`, `tasks.api.test.ts`, plus pure-util tests), while mobile genuinely does test every view's API module (`dayView.api.test.ts`, `focusedView.api.test.ts` both exist).
- **Could not verify / not addressed by the plan**: whether `frontend/src/components/OverdueView.tsx` and `mobile/src/components/OverdueView.tsx`'s exact prop signatures (beyond `onLoaded`) were fully enumerated. The plan says "near-identical to `DayView.tsx`" / "same shape as `mobile/src/components/DayView.tsx`" without spelling out that mobile's `DayView.tsx` requires `onEditPress`, `collapsedBoardIds`, `onToggleBoard`, `onSetAllCollapsed` as non-optional props (confirmed by reading the file) that `OverdueView.tsx` will also need. Not a functional risk — "same shape" is unambiguous enough for an implementer who reads the referenced file — but worth being explicit about in the plan for a cleaner PR diff review.

### Suggestions

- Resolve Issue 1 explicitly in the plan text (either with a corrected ref-guard code sketch, or an added `hasOverdueTasksLoaded` state) before implementation begins — this is the one item that could ship a feature that silently doesn't do its main job.
- Consider factoring the identical "all non-deleted boards for user, ordered alphabetically" query — now duplicated three times across `get_focused_tasks` (the `board_selection == "all"` branch), `get_day_view_tasks`, and the new `get_overdue_tasks` — into a small shared `_get_all_user_boards(db, user_id)` helper. Not required for correctness, just avoids a third copy-paste.
- Correct `FocusedBoardOut` → `FocusedViewBoardGroup` and fix the import-ordering nit (Issues 5–6) when the plan is next revised.
- Optionally address Issue 3's duplicate fetch by having `OverdueView` accept an optional pre-fetched `initialBoards` prop from `TasksPage`'s Effect A result, avoiding the redundant second GET on the default-application path.

— *Sneezy*

---

## Sneezy's Review — 2026-07-27 (Revision 2)

**Tier:** FULL — unchanged from Revision 1 (the plan still modifies `backend/app/routers/day_view.py` and `backend/app/services/focused_view_service.py`, router/service API-contract area per `ARCHITECTURE.MD`). Confirmed correct and *sufficient* on inspection — no further escalation needed. I re-derived the blast radius independently rather than trusting the plan's restated numbers: `grep -rn "get_day_view_tasks" backend/` shows exactly 2 real call sites of the *service* function (the router, and `test_focused_view_service.py`'s 5 test cases) plus the router itself has exactly 1 caller each on web (`frontend/src/components/DayView.tsx`) and mobile (`mobile/src/components/DayView.tsx` + its 1 test file). `_query_board_grouped_tasks` still has exactly 2 in-file callers. This is a narrow, well-understood, already-tested surface for a router/service change — Full tier catches it correctly and no wider escalation (e.g. treating this as "redesign the day-view contract") is warranted.

**Verdict:** Approved with concerns

### Issues

1. **[Risk] Initial-view flash + a wasted `FocusedView` fetch on exactly the "default to Overdue" path this feature exists for.** `frontend/src/context/ViewContext.tsx:14` initializes `viewMode` to `'focused'` unconditionally (`useState<ViewMode>('focused')`), and this isn't touched by the plan (correctly — it doesn't need to change structurally). But that means on a fresh page load with no `?view=` param and overdue tasks present — the primary case Overdue-as-default is built for — `TasksPage.tsx` first renders with `viewMode === 'focused'`, mounting `<FocusedView />`, which fires its own mount-only `GET /focused-view/tasks` fetch (per `DATA_MODEL_AND_API.MD`'s Focused View section). Only after the new mount effect's `getDayViewTasks(dateOnly(new Date()), true)` promise resolves does `setView('overdue')` fire, unmounting `FocusedView` and mounting `<DayView overdue .../>` instead. The user briefly sees the Focused view (and its board grid, if any renders before the switch), and a real network round-trip to `/focused-view/tasks` is issued and discarded. The mobile equivalent has the identical shape: `TasksScreen.tsx:232` also initializes `viewMode` to `'focused'`, and the overdue check lives inside `useFocusEffect` (`TasksScreen.tsx:283-298`), so the same flash + wasted fetch happens on first focus there too. None of the plan's four documented "Accepted tradeoffs" (lines 127-130) address this — all four are about the `/day-view` fetch itself (duplication, no live re-check, tab disappearing), not about the Focused view being mounted, fetched, and discarded first. Worth adding as an explicit tradeoff (with the option of gating first paint on the overdue-check promise, or accepting the flash) so it isn't discovered for the first time during manual QA.

2. **[Risk] Mobile's duplicate-fetch cost is heavier and more frequent than the plan's write-up implies.** The "Sneezy's Revision 1 findings addressed" table (item 3, line 228) says the duplicate-fetch risk is "[s]till present in Revision 2 ... stated explicitly as an accepted tradeoff" — but the accepted-tradeoff text it points to (open question 4, line 220) is phrased entirely in terms of a one-time cost on the "Overdue is default" load, mirroring the web section it lives under. On mobile the mechanics are different and worse, exactly as Revision 1's Issue 3 already flagged for the old 3-endpoint design and which still applies unchanged to Revision 2's 2-endpoint design: the overdue check re-runs on *every* `useFocusEffect` firing (i.e. every tab refocus, not just app launch — see `setFocusedViewKey((k) => k + 1)` at line 296, called unconditionally on every focus), and the plan's own mobile render-block instruction ("analogous to the existing today/tomorrow branches") means the Overdue branch will use the same `key={focusedViewKey}` remount-on-refocus pattern Today/Tomorrow already use. So while `viewMode === 'overdue'` is showing, *every single return to the Tasks tab* fires two back-to-back `GET /day-view/tasks?...&overdue=true` requests, not just once. This mobile-specific severity ("every focus" vs. "once at load") should be restated explicitly rather than folded into the web-framed tradeoff, since it changes the cost-benefit of fixing it (e.g. via a shared `initialBoards` prop, per the plan's own Suggestion in the Revision 1 section).

3. **[Gap] Test plan doesn't cover the "earliest of the two dates" mixed case.** The Overview's stated criterion (line 11) is "the earliest of `must_do_by`/`target_date` when both are set." The implementation is `or_(Task.must_do_by < reference_date, Task.target_date < reference_date)`, which I independently re-derived (same 3-valued-NULL-logic walkthrough as Revision 1's "Confirmed correct" note — still valid since this WHERE-clause shape is unchanged, only which of two clauses gets selected is new) to be equivalent to "min(must_do_by, target_date) < reference_date" for all NULL/non-NULL combinations, so the logic itself is sound. But the Test plan (line 164) only lists: overdue-via-`must_do_by`-alone, overdue-via-`target_date`-alone, excludes-today, excludes-future, and the `overdue=False` regression case. There is no case with *both* fields set where one is before `reference_date` and the other is after it (e.g. `must_do_by` = yesterday, `target_date` = next week) — exactly the "earliest wins" scenario the criteria prose calls out as the interesting case, and exactly the kind of boundary a future refactor of this clause could silently invert without any test catching it. Recommend adding it.

4. **[Nit]** The new `test_day_view_router.py` wiring tests need to read `overdue` off `call_args.kwargs`, not positional `args[n]` — `day_view.py`'s proposed router body calls `svc.get_day_view_tasks(db, user_id, reference_date, overdue=overdue)` (keyword), unlike the file's existing 3 tests which all assert against positional `args[1]`/`args[2]` (confirmed by reading `test_day_view_router.py` in full). Not called out in the Test plan section — a minor implementation detail, but worth a one-line note so whoever writes the new tests doesn't reach for `args[3]` first.

5. **[Nit]** In the new `TasksPage.tsx` mount effect, `.catch(() => setHasOverdueTasks(false))` never sets `appliedDefaultRef.current = true` on fetch failure. This is safe (falls back to the existing Focused default, consistent with the already-accepted "no live re-check" tradeoff) and not a correctness bug, but it's a new edge case introduced by collapsing to a single effect that the plan doesn't mention: a failed initial overdue-check permanently forfeits the Overdue-as-default behavior for the rest of that session (no retry), even though the ref is never actually "applied." Worth a one-line acknowledgment alongside the other accepted tradeoffs.

### Unverified assumptions

- Everything load-bearing in this plan was verified directly against the current source rather than taken on the plan's word — `backend/app/services/focused_view_service.py`, `backend/app/routers/day_view.py`, `backend/tests/unit/test_day_view_router.py`, `backend/tests/unit/test_focused_view_service.py`, `frontend/src/pages/TasksPage.tsx`, `frontend/src/components/DayView.tsx`, `frontend/src/api/dayView.ts`, `frontend/src/context/{ViewContext,BoardCollapseContext}.tsx`, `frontend/src/utils/viewLabel.ts`, `frontend/src/components/BoardGroupedTasks.tsx`, `mobile/src/screens/TasksScreen.tsx`, `mobile/src/components/{DayView,BoardGroupedTasks}.tsx`, `mobile/src/api/dayView.ts`, and `mobile/src/__tests__/dayView.api.test.ts` were all read in full. All of the plan's specific claims held up: the 4-arg `get_day_view_tasks` signature doesn't break either existing call site or `test_focused_view_service.py`'s tests (which mock at the `.filter().order_by().all()` chain level and never inspect filter contents — reconfirmed against the actual test file); the `overdue=false` default produces a byte-identical query string on both web and mobile so the existing mobile `dayView.api.test.ts` assertions stay green (reconfirmed against the actual test file, including the exact string `/day-view/tasks?reference_date=2026-07-01`); `DayView.tsx`'s `viewKey` prop is genuinely `Extract<ViewKey, 'today' | 'tomorrow'>` on web today and needs the claimed widening; `BoardCollapseContext.tsx`'s `ViewKey` type and `BoardGroupedTasks.tsx` (web) are fully generic as claimed; mobile's `BoardGroupedTasks.tsx` takes no `viewKey`-equivalent concept at all (confirmed by reading it), so the plan's omission of it from the mobile files-to-modify list is correct, not an oversight; `main.py` genuinely needs no changes (confirmed via `grep -n "day_view" backend/app/main.py` — router already registered from PR #40); no `frontend/src/__tests__/dayView.api.test.ts` exists (confirmed via directory listing), so the plan's "no dedicated web test" claim is accurate rather than a gap.
- Could not verify at the source level (would require running the app): the actual visual/timing severity of Issue 1's flash — whether it's perceptible in practice depends on fetch latency and React's batching, which I reasoned about from the code but didn't observe at runtime.

### Suggestions

- Consider gating first paint of the Focused/Overdue choice on the overdue-check promise settling (e.g. render nothing or a shared spinner until `hasOverdueTasks` is known, only when there's no explicit `?view=` param), to eliminate Issue 1's flash and wasted `/focused-view/tasks` fetch. This is a bigger change than the plan's current scope, so at minimum, document the flash as an accepted tradeoff if not fixed.
- For Issue 2, consider having mobile's Overdue `DayView` instance reuse the boards already fetched by the `useFocusEffect` overdue-check (same shape as the web `initialBoards` idea already suggested in the Revision 1 section), since on mobile the duplication recurs on every tab focus, not just once.
- Add the mixed-date-fields test case from Issue 3 to `test_focused_view_service.py`'s planned `TestGetDayViewTasks` additions.

— *Sneezy*

---

## Post-merge addendum: perf indexes (Doc's arch-review callout)

Doc's arch-review of the shipped PR flagged that `overdue=true`'s `< reference_date` scan is unbounded and hit unindexed `must_do_by`/`target_date` columns — not urgent at current scale, but the first query in this codebase whose cost scales with total task history rather than a fixed window, and it recurs on every mobile tab refocus. Folded into this same branch as a follow-up, low-risk perf fix (Confidence 5/5, Regression risk 1/5, single-component/backend-only deploy, no test changes needed since behavior is unchanged):

- `backend/app/main.py` — two new partial indexes added to the existing lifespan migration block: `tasks_user_id_must_do_by_pending_idx` and `tasks_user_id_target_date_pending_idx`, both `ON tasks (user_id, <col>) WHERE is_deleted = false AND state = 'pending'` — scoped to exactly the filter set `_query_board_grouped_tasks` already applies.
- `DATA_MODEL_AND_API.MD` — documented both indexes against the `must_do_by`/`target_date` rows.
