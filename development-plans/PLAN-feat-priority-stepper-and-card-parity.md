# PLAN-feat-priority-stepper-and-card-parity

## Status
**State:** Ready for PR
**Last updated:** 2026-08-09 by Grumpy
**Next step:** Commit, push, open PR.
**Blocked on:** n/a — implementation complete. `tsc -b` clean at both checkpoints; full unit suite (186 tests, including 12 new/rewritten `taskPriority.test.ts` cases) passes. Verified live in browser: All-view stepper (Normal→Medium single/double-up, Medium→High/Normal, High→Medium/Normal — including the previously-impossible High→Medium step) all work with correct colors; Today-tab (non-All) cards now show the same orange High / blue Medium badges, the same stepper, and edit/complete/delete at the top, matching All view exactly.

## Branch
`feat-priority-stepper-and-card-parity`, cut from up-to-date `main` (independent of PR1, `fix-collapsed-priority-drop-target` — no file overlap).

## Background

This is PR2 of a 2-PR sequence addressing four user-reported issues on task cards. PR1 (merged/in-review separately, `development-plans/PLAN-fix-collapsed-priority-drop-target.md`) fixed the collapsed drag-target visual bug. This plan covers the remaining three, which the user and Grumpy agreed to bundle into one PR because they all touch the same code region (`TaskCardBody.tsx`'s priority-indicator and action-button rendering):

1. "It's not very obvious looking at the cards — which group they belong to. Make it visually obvious that these are High priority cards vs Medium or Normal. I want this to be consistent across all views. In non-all views, we use the word 'high'. and there is no distinction between normal and medium."
2. "If I need to move a card from one priority zone to another, I have to use the star in a ladder manner. Instead I want to show an up and down arrow in medium card which allows me to go up and down in priority; for High and Low, I need a similar mechanism to change one level or two levels in one step. Maybe a small arrow and a bigger arrow? ... I want the same ability to be available in non-all views as well." User's chosen design (via AskUserQuestion in the parent conversation): up/down chevrons, single vs. double chevron for the two-level jump.
3. "In the non-all views the delete, edit and complete button appear at the bottom while in the all view they appear at the top. I need the appearance of cards to be identical. Aren't we reusing the code? why the drift?"

## Current behavior (all three items root-caused by code trace)

All task cards funnel through one shared component, `frontend/src/components/TaskCardBody.tsx`, called from two thin wrappers:
- `TaskCard.tsx` — All-view kanban cards, passes `layout="inline"`, `priorityBadge="toggle"`.
- `FocusedTaskCard.tsx` — Focused/Today/Tomorrow/Overdue cards (used inside `BoardGroupedTasks.tsx`), passes `layout="stacked"`, `priorityBadge="static"`, and — critically — never passes `onTogglePriority` at all today, so these views have **zero** priority-control UI currently, not even the star.

**Item 1 root cause** — `TaskCardBody.tsx:133-155`:
```tsx
// Focused/Day View badges intentionally show High only — Medium never surfaces
// there (locked-in product decision), so 'static' mode ignores Medium entirely.
const priorityIndicator = priorityBadge === 'static'
  ? task.priority === 'high'
    ? <span className="... text-amber-600 bg-amber-50 ...">★ High</span>
    : null
  : task.priority === 'high'
    ? <span className="... text-orange-600 bg-orange-50 border-orange-200 ...">High</span>
    : task.priority === 'medium'
      ? <span className="... text-blue-600 bg-blue-50 border-blue-200 ...">Medium</span>
      : null;
```
This is a deliberate, commented decision to withhold Medium in non-All views. **This plan reverses that decision** per the user's explicit request — flagging it here because it's not a bug fix, it's a product-behavior change, and the comment marking it "locked-in" is being overridden on direct instruction.

**Item 2 root cause** — the only priority control today is a single star button (`TaskCardBody.tsx:280-296`), rendered only when `priorityBadge === 'toggle' && onTogglePriority` (i.e., only in the All view). It calls `onTogglePriority()` with no argument, which resolves via `frontend/src/utils/taskPriority.ts`'s `PRIORITY_CYCLE` (`normal→medium`, `medium→high`, `high→normal`) and `resolveNextPriorityTier`. **Important existing-behavior detail:** this cycle is asymmetric — clicking the star on a High-priority task jumps directly to Normal; there is no way to reach Medium from High via today's UI at all. The requested up/down stepper is not just a reskin of the existing cycle; it adds a previously-unreachable High↔Medium transition.

**Item 3 root cause** — `TaskCardBody.tsx:327-353`, the two layout branches place `actionsEl` (edit/complete/delete, and previously the star) differently:
```tsx
if (layout === 'stacked') {
  return (<>
    {priorityIndicator && <div className="flex mb-1.5">{priorityIndicator}</div>}
    {titleEl}{dateEl}{renderLabels(...)}{linksEl}
    {actionsEl && <div className="flex justify-end mt-2">{actionsEl}</div>}  {/* bottom */}
  </>);
}
return (<>
  <div className="flex items-center justify-between gap-2">
    <div className="flex-1 ...">{priorityIndicator}{titleEl}</div>
    {actionsEl}  {/* top, same row as title */}
  </div>
  {dateEl}{renderLabels(...)}{linksEl}
</>);
```
No comment marks this as deliberate — it's organic drift between the two layouts, confirmed by a prior plan (`PLAN-fix-focused-card-parity-and-notes-bug.md`) that already fixed a related parity gap (missing Links/Complete/Delete buttons in `FocusedTaskCard`) without touching button position.

## Scope decisions (flagging for explicit sign-off, not proceeding silently)

1. **Reversing the "High only" badge decision** — per user's direct request in the parent conversation; noted above.
2. **Action-button position: unifying on TOP (matching today's All-view/`inline` position)**, not bottom. Rationale: more compact, and the `stacked` cards have vertical room to spare. This only moves the actions row — `stacked` layout keeps its full-width, 2-line-clamped title below the top row; it does not otherwise merge the two layouts. Grumpy recommended this in the parent conversation; the user did not object but also didn't explicitly confirm the direction — reconfirming here since this plan is the actual point of commitment.
3. **Mobile is explicitly out of scope for this PR.** `mobile/src/components/TaskCardBody.tsx` and `mobile/src/components/FocusedTaskCard.tsx` are separate files (React Native, not shared with `frontend/`) that currently mirror the *exact* pre-fix pattern being changed here (same `priorityBadge: 'toggle'|'static'` split, same amber "★ High" static badge, same star toggle). This PR does not touch them. Per this repo's established practice (`PLAN-fix-focused-card-parity-and-notes-bug.md` deferred an analogous mobile gap the same way), mobile needs its own follow-up PR after this one ships, so its from-scratch build (if any redesign work is still pending there) picks up the same parity from day one rather than needing a second fix. Not filing that follow-up plan now — just flagging it exists.
4. **Overdue-column eligibility is left exactly as today (fully locked, no stepper at all)** — rather than allowing "downward-only" moves (Normal has nothing below it anyway; only High/Medium tasks parked in Overdue could theoretically demote). Today, Overdue cards have zero priority-control UI (the star is never wired for `col.key === 'overdue'`, since `isPriorityEligible('overdue')` is `false`). This plan preserves that exactly: the entire stepper (both up and down arrows) is gated on the same `isPriorityEligible`/eligible-column check the star used, with no new "downward moves are always safe" carve-out for ineligible columns. Kept simple deliberately — expanding Overdue's capabilities wasn't requested and would be scope creep; if wanted, it's a natural small follow-up.

## Design

### 1. Priority badge — always shown, same everywhere

Remove the `priorityBadge: 'toggle' | 'static'` prop and its branch entirely. `priorityIndicator` becomes unconditional and, per Sneezy's dedup suggestion, is now driven by the same `TIER_ACCENT` map the stepper buttons use (see Design §2 below — defined once, used by both):
```tsx
const priorityIndicator = task.priority === 'high' || task.priority === 'medium'
  ? <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 shrink-0 ${TIER_ACCENT[task.priority].badge}`}>
      {task.priority === 'high' ? 'High' : 'Medium'}
    </span>
  : null;
```
(This reads out to exactly today's `toggle`-mode badge, now used unconditionally. The amber "★ High" static-mode badge is deleted. `TIER_ACCENT` must be defined — see §2 — before this line, since both now depend on it as the single color-mapping source instead of two independent hardcoded mappings.)

### 2. Priority stepper — replaces the star everywhere

**`frontend/src/utils/taskPriority.ts` changes:**
- Delete `PRIORITY_CYCLE` and `resolveNextPriorityTier` (dead code once the star is gone — nothing else references them).
- Add:
  ```ts
  const TIER_ORDER: PriorityTier[] = ['normal', 'medium', 'high']; // ascending severity

  /** Shifts `current` by `steps` positions along the ordered tier ladder, clamped at both ends. */
  export function shiftPriorityTier(current: PriorityTier, steps: number): PriorityTier {
    const idx = TIER_ORDER.indexOf(current);
    const clamped = Math.min(TIER_ORDER.length - 1, Math.max(0, idx + steps));
    return TIER_ORDER[clamped];
  }

  /**
   * Resolves the stepper's target tier: shifts `current` by `steps`, then — for an
   * UPWARD shift only — demotes to Normal if the result isn't eligible for `columnKey`'s
   * date. Downward shifts are never gated: you already held an equal-or-higher tier, so
   * stepping down never newly requests an elevated tier that needs eligibility.
   */
  export function resolveShiftedPriorityTier(current: PriorityTier, steps: number, columnKey: ColumnKey): PriorityTier {
    const next = shiftPriorityTier(current, steps);
    if (steps > 0 && (next === 'high' || next === 'medium') && !isPriorityEligible(columnKey)) {
      return 'normal';
    }
    return next;
  }
  ```
- This is a defensive fallback matching the existing pattern in the code it replaces (comment on the old `resolveNextPriorityTier` said the same: "the toggle is only wired up on eligible columns today, but this keeps the resolution correct if that wiring ever changes"). Per the Scope decision above, this PR's actual UI never offers an upward arrow on an ineligible column at all — the gating happens at button-visibility time, not just here.

**`TaskCardBody.tsx` changes** — replace the `TaskCardBodyProps` fields `priorityBadge: 'toggle' | 'static'` and `onTogglePriority?: () => void` with a single `onPriorityStep?: (steps: number) => void`. Presence/absence of this prop is the sole eligibility signal (mirrors today's `onTogglePriority !== undefined` convention exactly — no separate boolean needed). Replace the star block (lines 280-296) with:
```tsx
{onPriorityStep && (
  <div className="flex items-center gap-0.5 shrink-0">
    {(task.priority === 'normal'
      ? [{ steps: 1, dir: 'up', double: false, toTier: 'medium' as const }, { steps: 2, dir: 'up', double: true, toTier: 'high' as const }]
      : task.priority === 'medium'
        ? [{ steps: 1, dir: 'up', double: false, toTier: 'high' as const }, { steps: -1, dir: 'down', double: false, toTier: 'normal' as const }]
        : [{ steps: -1, dir: 'down', double: false, toTier: 'medium' as const }, { steps: -2, dir: 'down', double: true, toTier: 'normal' as const }]
    ).map(({ steps, dir, double, toTier }) => (
      <button
        key={steps}
        onClick={(e) => { e.stopPropagation(); onPriorityStep(steps); }}
        className={`p-1 rounded-full transition-colors ${TIER_ACCENT[toTier].button}`}
        title={`Priority: ${task.priority} — ${dir === 'up' ? 'raise' : 'lower'} to ${toTier}`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          {dir === 'up' ? (
            double
              ? <><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 18.75l7.5-7.5 7.5 7.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l7.5-7.5 7.5 7.5" /></>
              : <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          ) : (
            double
              ? <><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 5.25l7.5 7.5 7.5-7.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 11.25l7.5 7.5 7.5-7.5" /></>
              : <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          )}
        </svg>
      </button>
    ))}
  </div>
)}
```
with a small module-scope color map added near the top of the file (replacing both the inline orange/blue/gray conditional the old star button used, and the separately-hardcoded badge colors — per Sneezy's dedup suggestion, one map now drives both the badge in §1 and these buttons):
```ts
const TIER_ACCENT: Record<PriorityTier, { badge: string; button: string }> = {
  high: { badge: 'text-orange-600 bg-orange-50 border border-orange-200', button: 'bg-orange-50 hover:bg-orange-100 text-orange-600' },
  medium: { badge: 'text-blue-600 bg-blue-50 border border-blue-200', button: 'bg-blue-50 hover:bg-blue-100 text-blue-600' },
  normal: { badge: '', button: 'bg-gray-50 hover:bg-gray-100 text-gray-500' },
};
```
Each button is colored by the tier it leads *to*, reinforcing what it does. Exact Tailwind values and SVG path coordinates above are a reasonable starting point, not pixel-locked — adjust during implementation if they don't read cleanly at card size.

**Required top-of-file import changes in `TaskCardBody.tsx`** (flagged by Sneezy as missing from the diffs above — the shown code doesn't work without these):
- Remove `import { PRIORITY_CYCLE } from '../utils/taskPriority';` (line 4 today) — dead once the star block above is replaced; leaving it in place after `PRIORITY_CYCLE` is deleted from `taskPriority.ts` is a straight TS2305 build break.
- Change `import type { Task, Label } from '../api/tasks';` to also import `PriorityTier` — needed for the `TIER_ACCENT: Record<PriorityTier, ...>` type annotation, which isn't otherwise in scope in this file today.

**`TaskCard.tsx` (All view) changes:** replace the `onTogglePriority?: () => void` prop with `onPriorityStep?: (steps: number) => void`, threaded straight through to `TaskCardBody`. At the `<TaskCardBody>` call site (line ~104 today), **also delete the `priorityBadge="toggle"` line entirely** — `TaskCardBodyProps` no longer has that field (Design §1), so leaving it in the JSX is a TypeScript excess-property error once the prop is removed from the interface (flagged by Sneezy).

**`TasksPage.tsx` changes:** replace `handleTogglePriority(taskId, columnKey)` with `handlePriorityStep(taskId, columnKey, steps)`:
```ts
async function handlePriorityStep(taskId: string, columnKey: ColumnKey, steps: number) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return;
  const nextTier = resolveShiftedPriorityTier(task.priority, steps, columnKey);
  if (nextTier === task.priority) return; // clamped at the ladder's end, no-op
  if (nextTier === 'high') {
    const allHighForColumn = tasks.filter((t) => t.priority === 'high' && getColumn(t, today, tomorrow) === columnKey);
    if (!canAddHighPriority(allHighForColumn, task, highPriorityDailyLimit)) {
      setDropError(`High priority is limited to ${highPriorityDailyLimit} tasks per day.`);
      return;
    }
  }
  try {
    await updateTask(taskId, { priority: nextTier });
    setDropError(null);
    refetch();
  } catch (err) {
    setDropError(err instanceof Error ? err.message : 'Failed to update priority');
  }
}
```
This is the same body as today's `handleTogglePriority`, just parameterized by `steps` instead of hardcoding a single-step cycle, and using `resolveShiftedPriorityTier` instead of `resolveNextPriorityTier`. The daily high-priority cap check is unchanged. The call site (inside `renderTierZone`, currently `onTogglePriority={isPriorityEligible(col.key) ? () => handleTogglePriority(task.id, col.key) : undefined}`) becomes `onPriorityStep={isPriorityEligible(col.key) ? (steps) => handlePriorityStep(task.id, col.key, steps) : undefined}`.

**Required import change in `TasksPage.tsx`** (flagged by Sneezy as an obvious-but-unstated consequence): the top-of-file import `import { isPriorityEligible, splitByPriority, canAddHighPriority, resolveNextPriorityTier, resolveDropPriority } from '../utils/taskPriority';` must swap `resolveNextPriorityTier` for `resolveShiftedPriorityTier`, matching the `handlePriorityStep` body above.

**`FocusedTaskCard.tsx` changes** (this is the view that currently has *no* priority control at all): add
```ts
const { today, tomorrow } = useMemo(() => {
  const now = new Date();
  const tom = new Date(now);
  tom.setDate(tom.getDate() + 1);
  return { today: dateOnly(now), tomorrow: dateOnly(tom) };
}, []);
const columnKey = useMemo(() => getColumn(task, today, tomorrow), [task, today, tomorrow]);
const eligible = isPriorityEligible(columnKey);

async function handlePriorityStep(steps: number) {
  const nextTier = resolveShiftedPriorityTier(task.priority, steps, columnKey);
  if (nextTier === task.priority) return;
  try {
    await updateTask(task.id, { priority: nextTier });
    onRefresh();
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to update priority');
  }
}
```
and pass `onPriorityStep={eligible ? handlePriorityStep : undefined}` to `TaskCardBody`. At the `<TaskCardBody>` call site (line ~72 today), **also delete the `priorityBadge="static"` line entirely** — same excess-property reasoning as `TaskCard.tsx` above.

**Why per-task `getColumn`, not the page's own view identity (Today/Tomorrow tab):** the day-view backend query (`get_day_view_tasks` in `backend/app/services/focused_view_service.py`) matches tasks where *either* `must_do_by` or `target_date` equals the reference date — an OR. A task with `must_do_by` = today but `target_date` = yesterday would appear on the "Today" tab, but its *effective* date (`getEffectiveDate` = min of the two) is yesterday, so the All view's own column logic would classify it as `overdue`, not `today` — meaning it should NOT be eligible for a new High/Medium grant, matching All view's rule. Computing eligibility from the task's own dates (exactly what `TasksPage.tsx` already does for the All view) handles this edge case correctly instead of trusting the tab you're viewing; a viewKey-based shortcut would get this case wrong.

**Daily high-priority cap in `FocusedTaskCard`:** no client-side pre-check is added (unlike `TasksPage`, `FocusedTaskCard` has no access to the full task list to count same-day high-priority tasks, and plumbing it through `BoardGroupedTasks` would expand this PR's footprint for a `today`-tab call it does daily rather than the common failure case here). The backend enforces the cap authoritatively (`task_service.py::update_task`, HTTP error with a `detail` message like "High-priority tasks are limited to N per day…"); `apiFetch` (`frontend/src/api/client.ts:23-30`) already surfaces that `detail` string as `Error.message`, so the existing `alert(err.message)` pattern in `FocusedTaskCard` will show it verbatim on failure. This is a deliberately accepted, disclosed inconsistency with `TasksPage`'s proactive banner — not silently glossed over.

### 3. Action-button position — unify on top

In `TaskCardBody.tsx`'s `stacked` branch, move `actionsEl` into the same row as `priorityIndicator` (not the title, which stays on its own full-width, 2-line-clamped line below — this is the smallest change that satisfies "actions always at the top," without restructuring `stacked`'s title placement):
```tsx
if (layout === 'stacked') {
  return (
    <>
      {(priorityIndicator || actionsEl) && (
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div>{priorityIndicator}</div>
          {actionsEl}
        </div>
      )}
      {titleEl}
      {dateEl}
      {renderLabels(task.labels)}
      {linksEl}
    </>
  );
}
```
(Drops the old trailing `{actionsEl && <div className="flex justify-end mt-2">{actionsEl}</div>}`.) The `inline` branch is untouched — it already puts `actionsEl` at the top.

## Files to modify

- `frontend/src/utils/taskPriority.ts` — remove `PRIORITY_CYCLE`/`resolveNextPriorityTier`, add `shiftPriorityTier`/`resolveShiftedPriorityTier`.
- `frontend/src/components/TaskCardBody.tsx` — unconditional priority badge; replace star with stepper buttons; move `stacked` layout's actions row to the top.
- `frontend/src/components/TaskCard.tsx` — prop rename `onTogglePriority` → `onPriorityStep`.
- `frontend/src/components/FocusedTaskCard.tsx` — add column-eligibility computation and `handlePriorityStep`, wire `onPriorityStep`.
- `frontend/src/pages/TasksPage.tsx` — rename/generalize `handleTogglePriority` → `handlePriorityStep`; update the `renderTierZone` call site.
- `frontend/src/__tests__/taskPriority.test.ts` — remove the `PRIORITY_CYCLE`/`resolveNextPriorityTier` describe blocks **and** strip both names from the top import line (`import { isPriorityEligible, isFormPriorityEligible, splitByPriority, canAddHighPriority, HIGH_PRIORITY_DAILY_LIMIT, PRIORITY_CYCLE, resolveNextPriorityTier, resolveDropPriority } from '../utils/taskPriority';` — replace the two removed names with `shiftPriorityTier, resolveShiftedPriorityTier`); add coverage for both new functions (clamping at both ends, upward-only eligibility gating, e.g. `resolveShiftedPriorityTier('medium', -1, 'upcoming')` must return `'normal'` ungated, `resolveShiftedPriorityTier('normal', 1, 'upcoming')` must return `'normal'` gated).

**Not modified:** `mobile/` (explicitly out of scope, see Scope decisions), `backend/` (no API contract change — same `PUT /tasks/{id}` endpoint, `{ priority: <tier> }` body, already accepts any of the three tiers today), `backend/tests/integration/` (Sleepy's domain, no backend change to test).

## Test plan

- Per Sneezy's suggestion, given this plan's unusual size for a light-tier PR (5 source files + 1 test file, a control replacement, and an intentional behavior reversal): run `tsc -b` immediately after editing `TaskCardBody.tsx`, `TaskCard.tsx`, and `FocusedTaskCard.tsx` — before moving on to `TasksPage.tsx` — to catch any dangling-import/excess-prop issue at that checkpoint rather than at the end.
- Update `frontend/src/__tests__/taskPriority.test.ts` per above (unit tests, Grumpy's to write — not Sleepy's domain).
- No integration test changes — no backend/API surface touched.
- Manual verification required (UI-level, not covered by the utility unit tests):
  - All view: for a Normal-priority task in an eligible column, confirm both up-arrows appear (single → Medium, double → High) and both work; for Medium, confirm one up (→High) and one down (→Normal); for High, confirm one down (→Medium, previously impossible via the old star) and one double-down (→Normal).
  - Same checks on Today/Tomorrow (non-All) cards, confirming the stepper now appears there at all (it doesn't exist today).
  - Confirm the daily high-priority cap still blocks a new High grant in both All view (banner) and Today/Tomorrow (alert), and that the two error-presentation styles are the accepted, disclosed inconsistency noted above, not a bug.
  - Confirm Overdue cards still show no priority controls at all (unchanged from today).
  - Confirm the Medium badge now appears on Today/Tomorrow/Focused cards (previously only High showed, and it used a different — amber, star-decorated — style than All view's orange).
  - Confirm edit/complete/delete buttons now render at the top of Today/Tomorrow/Focused cards, matching All view.

## Deployment order

Single component (frontend only). No backward-compatibility window needed — no API contract change, and this only touches `frontend/src/` (deploy-triggering per `CLAUDE.md`, so this PR **does** trigger a Railway deploy — do not add `[skip deploy]`).

## Data model changes

None.

## Mobile update type

N/A for this PR — explicitly out of scope (see Scope decisions above). A follow-up PR is needed for `mobile/src/components/TaskCardBody.tsx` and `FocusedTaskCard.tsx`, which currently mirror the exact pattern being changed here.

---

## Sneezy's Review — 2026-08-09

**Tier:** LIGHT — per Grumpy's stated rationale: every proposed file is under `frontend/src/`, none fall under a model/schema/router/API-contract area, and the plan declares no data-model change and single-component deployment. I checked the gate condition myself (Step 2) and found no reason to escalate: the daily-cap discrepancy and the eligibility-gating logic are frontend-only UX/behavior concerns, not schema/API-contract issues, so LIGHT tier stands.

**Verdict:** Changes required

### Issues

1. **[Blocker]** `frontend/src/components/TaskCardBody.tsx:4` — `import { PRIORITY_CYCLE } from '../utils/taskPriority';` is not mentioned anywhere in the plan's file-by-file diff for `TaskCardBody.tsx`. The plan deletes `PRIORITY_CYCLE` from `taskPriority.ts` (Design §2) and separately claims "nothing else references [`PRIORITY_CYCLE`/`resolveNextPriorityTier`]" as justification for calling them dead code (Design §2, first bullet). That claim is false as of today's code: `TaskCardBody.tsx` imports and uses `PRIORITY_CYCLE` directly (also at line 290, inside the star button's `title` attribute, which the plan does show replacing). The plan's shown replacement code for the star block removes the *usage*, but never mentions removing the *import statement* at line 4. If an implementer copies the shown diffs literally, the file is left with `import { PRIORITY_CYCLE } from '../utils/taskPriority';` pointing at a symbol that no longer exists — a straight TS2305 module-has-no-exported-member build break.

2. **[Blocker]** `frontend/src/components/TaskCardBody.tsx` — the plan's new `TIER_ACCENT: Record<PriorityTier, { button: string }>` map (Design §2) requires the `PriorityTier` type, which is not currently imported in this file (current import is `import type { Task, Label } from '../api/tasks';` — no `PriorityTier`). The plan's "Files to modify" bullet for `TaskCardBody.tsx` doesn't call out adding this import. Same build-break class as #1.

3. **[Blocker]** `frontend/src/components/TaskCard.tsx:104` and `frontend/src/components/FocusedTaskCard.tsx:72` both currently pass `priorityBadge="toggle"` / `priorityBadge="static"` to `<TaskCardBody>`. Design §1 explicitly removes the `priorityBadge` field from `TaskCardBodyProps` entirely ("Remove the `priorityBadge: 'toggle' | 'static'` prop and its branch entirely"). TypeScript's excess-property check on JSX attributes will reject an unrecognized `priorityBadge` prop once it's dropped from the interface. The plan's stated diff for `TaskCard.tsx` ("replace the `onTogglePriority?: () => void` prop with `onPriorityStep?: (steps: number) => void`, threaded straight through") and for `FocusedTaskCard.tsx` ("add column-eligibility computation and `handlePriorityStep`, wire `onPriorityStep`") never says to delete the `priorityBadge="..."` line at either call site. Two more build breaks if followed literally.

4. **[Gap]** `frontend/src/pages/TasksPage.tsx:30` — the import line `import { isPriorityEligible, splitByPriority, canAddHighPriority, resolveNextPriorityTier, resolveDropPriority } from '../utils/taskPriority';` needs `resolveNextPriorityTier` swapped for `resolveShiftedPriorityTier` to match the plan's shown `handlePriorityStep` body. Not itemized in "Files to modify," though it's an obvious consequence of the shown code — lower severity than #1–#3 since the shown function body makes the needed import unambiguous, but still worth stating explicitly per this repo's session-survivability requirement (a fresh agent implementing from the plan text alone could plausibly miss it, though less likely than #1–#3 since it's a single symbol swap in a one-line import).

5. **[Gap]** `frontend/src/__tests__/taskPriority.test.ts:2` — the import line pulls in `PRIORITY_CYCLE, resolveNextPriorityTier` alongside the other still-valid exports. The plan says to "remove the `PRIORITY_CYCLE`/`resolveNextPriorityTier` describe blocks" but doesn't explicitly say to also strip them from this shared import statement (and add `shiftPriorityTier`/`resolveShiftedPriorityTier` to it). Same class as #4 — low severity, but explicit is better than implied given this is the one file in the plan Grumpy (not Sleepy) owns and writes directly from the plan text.

6. **[Nit]** Design §2's new stepper buttons hardcode tier colors via a new `TIER_ACCENT` map, while the unconditional priority badge added in Design §1 keeps its own separately hardcoded orange/blue Tailwind classes inline. Both encode the same High=orange/Medium=blue mapping in two places now (three, counting the old star's inline ternary being replaced). Not a bug, but a missed dedup opportunity introduced by this very diff — worth a `Suggestions` note rather than blocking.

### Unverified assumptions

- **"Locked-in" badge decision reversal and the new High↔Medium transition** — both correctly root-caused. Verified against `TaskCardBody.tsx:133-155` (badge) and the star button/`PRIORITY_CYCLE` at lines 280-296 — line numbers and described behavior match the current code exactly, including the claim that the old cycle has no High→Medium path.
- **Item 3 root cause (action-button position drift)** — verified against `TaskCardBody.tsx:327-353`; the `stacked` vs `inline` branches match the plan's description exactly, including which one places `actionsEl` at top vs bottom.
- **`resolveShiftedPriorityTier` correctness** — verified by hand-tracing: clamping at both ends, the two example test cases in the plan (`resolveShiftedPriorityTier('medium', -1, 'upcoming')` → `'normal'` ungated, and `resolveShiftedPriorityTier('normal', 1, 'upcoming')` → `'normal'` gated) both check out against the shown implementation. The "downward shifts never gated" rationale is sound: since the UI only ever renders `onPriorityStep` when the column is currently eligible (gated at the call site, not just inside the resolver), a task already holding an elevated tier in an eligible column can only downward-shift within that same eligible context.
- **FocusedTaskCard's per-task `getColumn`-based eligibility, and the `must_do_by`-today/`target_date`-yesterday edge case** — verified sound. Confirmed `getColumn`/`dateOnly` in `taskDateUtils.ts` behave as described, and traced through the day-view's OR-query semantics: a task appearing on the Today/Tomorrow tab can only have an effective date at or before the reference date, so `getColumn` can yield `'today'`/`'tomorrow'`/`'overdue'` for such tasks but never `'upcoming'` or `'nodate'` — the plan's edge-case reasoning holds and its scope (only the overdue-demotion case) is complete.
- **`FocusedTaskCard` is indeed used for Overdue cards too** — confirmed via `BoardGroupedTasks.tsx:115`, single call site, used across Today/Tomorrow/Overdue `viewKey`s. So the Overdue-lockout scope decision (§4) does correctly apply there, gated by `eligible = isPriorityEligible(columnKey)` evaluating false for `'overdue'`.
- **Mobile mirrors the exact pre-fix pattern, unaffected by this PR** — confirmed: `mobile/src/components/TaskCardBody.tsx` and `FocusedTaskCard.tsx` both still have `priorityBadge`, `onTogglePriority`, and the amber "★ High" static badge, byte-for-byte the same shape being removed here. Claim holds; scope exclusion is correctly described.
- **`apiFetch` surfaces backend `detail` as `Error.message`** — confirmed at `frontend/src/api/client.ts` (the JSON-parse-and-extract-`detail` fallback is at lines ~23-30 as cited). Claim holds.
- **Backend cap error message / `task_service.py::update_task`** — not fully read (backend is out of scope for LIGHT tier and not a file this plan modifies), but a quick grep confirms `HTTPException(..., detail=f"High-priority tasks are limited to {high_priority_limit} per day...")` exists in `backend/app/services/task_service.py`, consistent with the plan's citation. Treated as confirmed via lightweight check, not a full read.
- **"Nothing else references [`PRIORITY_CYCLE`/`resolveNextPriorityTier`]"** — this specific phrase in Design §2 is contradicted by the actual current code (see Issue #1): `TaskCardBody.tsx` does reference `PRIORITY_CYCLE` today. The plan's overall intent (remove it as part of this same diff) is fine — the problem is only that the phrase is used to justify skipping explicit mention of the necessary import cleanup, and that cleanup then goes unmentioned in the file-by-file diff.

### Suggestions

- Add an explicit line to the `TaskCardBody.tsx` bullet under "Files to modify": "also update the top-of-file import — drop `PRIORITY_CYCLE`, add `type { PriorityTier }`."
- Add an explicit line to the `TaskCard.tsx` and `FocusedTaskCard.tsx` bullets: "also remove the now-invalid `priorityBadge=\"...\"` prop from the `<TaskCardBody>` call site."
- Consider deriving the priority badge's Tailwind classes from the same `TIER_ACCENT`-style map used for the stepper buttons (or vice versa), rather than maintaining two independent hardcoded color mappings for the same three tiers in the same file.
- Since this plan is unusually large for LIGHT tier (5 source files + 1 test file, a control replacement, and an intentional behavior reversal), consider having whoever implements this run `tsc -b` immediately after the `TaskCardBody.tsx`/`TaskCard.tsx`/`FocusedTaskCard.tsx` edits, before moving on to `TasksPage.tsx` — the dangling-import/prop issues above are exactly the kind of thing a compile pass catches for free.

— *Sneezy*

## Grumpy's response to Sneezy's review — 2026-08-09

1. **[Blocker] Dangling `PRIORITY_CYCLE` import in `TaskCardBody.tsx` — addressed.** Added an explicit "Required top-of-file import changes" callout in Design §2 stating the import must be removed.
2. **[Blocker] Missing `PriorityTier` type import for `TIER_ACCENT` — addressed.** Same callout also states this import must be added.
3. **[Blocker] Stale `priorityBadge="..."` props at both call sites — addressed.** Both the `TaskCard.tsx` and `FocusedTaskCard.tsx` Design-section paragraphs now explicitly instruct deleting that line.
4. **[Gap] `TasksPage.tsx` import swap — addressed.** Added an explicit callout after the `handlePriorityStep` code block.
5. **[Gap] `taskPriority.test.ts` import-line swap — addressed.** "Files to modify" bullet now states the exact import-line change alongside the describe-block removal.
6. **[Nit] Duplicate color mapping — addressed, adopted rather than just noted.** Merged into one `TIER_ACCENT` map (now `{ badge, button }` per tier) that both Design §1's badge and Design §2's stepper buttons read from, replacing what would have been three independent hardcoded color mappings (old star, old badge, new stepper).
7. **[Suggestion] Incremental `tsc -b` checkpoint — adopted.** Added to the Test plan.

All six issues were plan-text completeness gaps (the shown code snippets were individually correct but omitted the surrounding import/prop cleanup needed to compile) — no design logic was found to be wrong. No re-scoping was needed.

**Awaiting user approval before implementation.**
