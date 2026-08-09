# PLAN-fix-collapsed-priority-drop-target

## Status
**State:** Ready for PR
**Last updated:** 2026-08-09 by Grumpy
**Next step:** Commit, push, open PR.
**Blocked on:** n/a — user manually verified with a real mouse that dropping a task onto a collapsed High/Medium header actually changes its priority (2026-08-09), completing the verification the visual-highlight check alone couldn't cover.

## Branch
`fix-collapsed-priority-drop-target`, cut from up-to-date `main`.

## Background

This is PR1 of a 2-PR sequence addressing four user-reported issues on the All-view/non-All-view task cards. PR2 (separate plan file, not yet written) covers: unified priority badge across views, replacing the star-cycle control with an up/down stepper, and unifying the action-button position between the two card layouts. This plan covers only the first, independent issue:

> "When collapsed, the heading of the [priority] grouping is not a drag-and-drop target. It should be."

## Scope

**Frontend-only** (`frontend/src/pages/TasksPage.tsx`). No backend, API, or data-model changes. Single-component deploy.

## Current behavior — All view kanban, priority tier zones

`TasksPage.tsx`'s `renderTierZone` function (lines 440-498) renders each of the three priority tiers (High/Medium/Normal) within a date column (Today/Tomorrow/Day After Tomorrow/Overdue) as a collapsible header + body:

- The header strip (lines 454-469) is always rendered, even when the zone is collapsed. It already carries `onDragOver={handleZoneDragOver}` (line 456), which calls `e.preventDefault()` and sets `dragOverColumn`/`dragOverPriority` React state to this zone's tier. A code comment at lines 436-439 confirms this was deliberately added so a collapsed zone remains a valid drop target instead of falling through to the column's default (`'normal'`).
- The body (lines 471-495) — task list + empty-state placeholder — only renders when `!collapsed`. It carries the same `handleZoneDragOver`, plus a background-highlight class driven by `isZoneOver` (line 474: `isZoneOver ? meta.zoneOverBg : ''`) and a matching text-color highlight on the empty-state placeholder (line 480).
- The outer column `<div>` (lines 500-526) has its own `onDragOver`/`onDragLeave`/`onDrop`. The actual `onDrop` (lines 519-525) reads `dragOverPriority ?? 'normal'` from state and calls `handleDrop(taskId, col.key, priority)` — this is where the API update actually happens, regardless of which nested element the native `drop` event fired on, since drop events bubble to this ancestor and nothing in between calls `stopPropagation()`.

## Root cause

By code trace, the header **is** already wired to accept a drop and set the correct target tier — `handleZoneDragOver` on the header keeps `dragOverPriority` current, and the browser's native `drop` event bubbles from the header up to the column div, which resolves the drop using that state. Mechanically, dropping directly on a collapsed header's strip should already route to the correct tier.

**What's actually missing:** the header strip's own className (line 457) is static — `meta.headerBg`/`meta.headerBorder` never change based on `isZoneOver`. Only the body (which doesn't exist while collapsed) gets the hover highlight. So a collapsed zone gives **zero visual feedback** while something is dragged over it — no color change, no "drop here" cue — even though the drop target is (by code trace) functionally live underneath. This reads to the user as "not a drop target" even if the underlying mechanics work.

**Verification caveat:** I attempted to confirm this live (created a test task on the `General tasks` board dated today, collapsed the Today column's High Priority zone, and tried to drop the task onto the collapsed header). Real mouse-drag simulation through Chrome's CDP `Input.dispatchMouseEvent` does not synthesize genuine OS-level HTML5 drag sessions, so no `dragstart`/`dragover`/`drop` events fired that way. I then tried dispatching synthetic `DragEvent`s with a manually constructed `DataTransfer` directly via JS — Chrome silently withheld the `dataTransfer` payload on the untrusted `drop` event (a browser anti-automation restriction on synthetic events), so the drop had no observable effect either way. Neither test is conclusive proof the underlying mechanism works — this diagnosis rests on code trace alone. **A manual, real-mouse verification pass (before vs. after the fix) is required during implementation**, not just automated testing, to confirm both (a) the drop actually lands on the correct tier today, and (b) the fix's visual feedback appears correctly.

Incidentally, this session also surfaced a minor unrelated flakiness: navigating via a hard browser URL load (not in-app client-side routing) can reset the local dev anonymous auth session, making board data appear to vanish/swap momentarily. Not investigated further — out of scope for this plan, noting only in case it resurfaces during manual testing.

## Fix

In `renderTierZone` (`TasksPage.tsx`), give the header strip (lines 454-469) a hover treatment that reacts visibly when `isZoneOver` is true. Per Sneezy's review (see below), a plain `headerBg` → `zoneOverBg` swap is too subtle for High/Medium (both go 100-level → 50-level pastel of the same hue — reads as fading, not highlighting). Instead, pair the existing `zoneOverBg` tint with a fixed-color ring, mirroring the same indigo accent the outer column already uses for its own `isOver` state (`border-indigo-400 bg-indigo-50`) — this guarantees a perceptible change regardless of a given tier's base hue:

```tsx
<div
  onClick={() => togglePriorityCollapse(col.key, tier)}
  onDragOver={handleZoneDragOver}
  className={`px-2 py-1 flex items-center gap-1.5 border-b cursor-pointer transition-colors ${
    isZoneOver ? `${meta.zoneOverBg} ring-2 ring-inset ring-indigo-400` : meta.headerBg
  } ${meta.headerBorder}`}
  title={collapsed ? 'Expand' : 'Collapse'}
>
```

If the manual verification step above reveals the drop itself doesn't actually land on the right tier when collapsed (not just a missing-visual-feedback issue), the fix will additionally need an explicit `onDrop` handler on the header itself (calling the same drop-resolution logic the column-level handler uses) rather than relying on bubbling — this plan will be updated in place if that turns out to be necessary.

**Explicitly out of scope:** auto-expanding a zone after a successful drop onto its collapsed header. Not requested by the user; adding it would be scope creep beyond "make the collapsed header a working, visible drop target."

## Files to modify

- `frontend/src/pages/TasksPage.tsx` — `renderTierZone` header className (and possibly an explicit `onDrop`, pending manual verification per above).

## Test plan

- No unit test changes — this repo's frontend unit tests target pure utility functions (`frontend/src/utils/`), and this change is purely presentational JSX, not business logic.
- **Manual verification is required and must be performed by a human with a real mouse in a running browser** — during investigation, Claude's browser automation tooling was confirmed unable to simulate genuine HTML5 drag-and-drop: CDP's synthetic mouse events don't trigger a real OS-level drag session, and manually dispatched `DragEvent`s have their `dataTransfer` payload withheld by Chrome as an anti-automation measure. Claude will implement the fix and ask the user (or a human tester) to run this check before merge:
  - Collapse each of the three tier zones in a priority-eligible date column (Today/Tomorrow/Day After Tomorrow) with at least one existing task in a different tier, drag that task onto each collapsed header, and confirm (a) the hover highlight is **perceptibly distinguishable** from the header's resting color — not merely "a different class is applied" — for all three tiers, especially High and Medium where the base and hover colors share a hue, and (b) the task's priority actually updates to match the tier dropped on, matching the same-column behavior that already works when zones are expanded.
  - The Overdue column is intentionally excluded from this check: its tier zones render for display (`isPriorityColumn` includes `isOverdueCol`) but Overdue isn't in `isPriorityEligible`'s date list, so `resolveDropPriority` silently demotes any High/Medium drop there to Normal — meaning a collapsed High/Medium header in Overdue will show "drop here" hover feedback that doesn't reflect what actually happens on drop. This is pre-existing behavior in the expanded body too (not introduced or fixed by this plan), so it's out of scope here.
- No integration test changes — `backend/tests/integration/` is Sleepy's domain and this change has no backend/API surface.

## Deployment order

Single component (frontend only). No backward-compatibility window needed — no API contract change.

## Data model changes

None.

## Mobile update type

N/A — no mobile files touched.

---

## Sneezy's Review — 2026-08-09

**Tier:** LIGHT — the only proposed file, `frontend/src/pages/TasksPage.tsx`, is a page component with no model/schema/router/API-contract surface, and the plan declares single-component deployment with no data model changes. Gate confirmed correct; no escalation to FULL.

**Verdict:** Approved with concerns

### Issues

1. **[Risk] Visual-feedback claim is likely overstated.** `TIER_META` (TasksPage.tsx:38-78) defines `headerBg` at the 100-level for every tier (`bg-orange-100`, `bg-blue-100`, `bg-gray-100`) and `zoneOverBg` at the 50-level (`bg-orange-50`, `bg-blue-50`) — except `normal`, whose `zoneOverBg` is `bg-indigo-50`, a different hue from its `headerBg` (`bg-gray-100`). The body's existing hover effect goes from *no background* (`''`) to `zoneOverBg` — an "appears from nothing" transition that reads clearly as a highlight. The fix instead swaps the header from `headerBg` (100) to `zoneOverBg` (50) — for High and Medium this is a same-hue shift from a darker pastel to a *lighter* one, a much subtler change than the body's transition, and arguably reads as the header "fading" rather than "lighting up." The plan's claim that this makes the header "react exactly like hovering over an expanded zone's body" (line 42) is not accurate as a pixel-for-pixel description of the transition, even if both are nominally driven by `isZoneOver`. This should be called out explicitly in the required manual-verification pass (line 36/66) — verify the header hover state is actually perceptible, not just present in the DOM/class list, particularly for High and Medium tiers.
2. **[Nit] Line-number citations are off by ~2.** The plan cites the header strip as "lines 452-469" (Background section, line 24, and Fix section, line 42). In the current file, line 452 is the `return (` and line 453 is the `<div key={tier}>` wrapper; the header `<div>` itself starts at line 454. Everything else cited (comment 436-439, header `onDragOver` at 456, body 471-495, `isZoneOver` background at 474, empty-state text at 480, column div 500-526, column `onDrop` 519-525) checks out exactly against the current file. Not a blocker, just a minor drift worth a quick recount before editing so the diff context lines up.

### Unverified assumptions

- **"Real mouse-drag verification required" — could not be independently confirmed or refuted.** I did not attempt to reproduce the plan's own CDP/synthetic-DragEvent verification attempts described in the Root Cause section; I only verified the claim by static code trace (grep for `stopPropagation` across `TasksPage.tsx` and `TaskCard.tsx` returned zero hits, and `TaskCard.tsx` has no `onDrop` handler of its own — both confirm nothing between the header and the column `onDrop` would block bubbling). This supports the plan's code-trace conclusion but is not proof the browser's real drag-and-drop session behaves identically; the plan is correct to keep manual verification as a required step rather than treating the code trace as sufficient.
- **"No unit test changes" — confirmed accurate.** Checked `frontend/src/__tests__/` (LIGHT tier does not require this, but it was cheap to confirm): no file references `TasksPage`, `renderTierZone`, `isZoneOver`, or `handleZoneDragOver`. The claim holds.
- **Scope isolation — confirmed accurate.** `renderTierZone` and the `zoneOverBg` field only exist in `TasksPage.tsx` (grep across `frontend/src/`); `DayView.tsx` has no analogous collapsed-header/tier-zone pattern, so there is no sibling file silently sharing this bug that the plan should have also listed.
- **`computeInsertSortOrder` stale-state interaction — checked, not a bug.** `handleZoneDragOver` (used by both header and body) never resets `dragOverTaskId`/`dragOverEdge`, so a stale card id from a previously-hovered tier could in principle leak into a drop resolved against a different tier's header. Read `frontend/src/utils/taskOrder.ts:9-26`: `computeInsertSortOrder` does `siblings.findIndex(...)`, and falls back to appending at the end of the list when the id isn't found (idx === -1) — so this is defensively handled already and not a risk introduced or exposed by this plan. Noting it only because it's exactly the kind of stale-drag-state issue this plan's fix touches; no action needed.

### Suggestions

- Consider making the manual verification checklist (Test plan section) explicit that "visual feedback" means *perceptibly distinguishable*, not merely "a different class is applied" — given the 100→50 same-hue swap noted in Issue 1, a reviewer eyeballing the collapsed High/Medium headers might reasonably disagree on whether the hover state is obvious enough, and it'd be better to catch that disagreement during this PR's manual pass than after merge.
- Since `resolveDropPriority` (`frontend/src/utils/taskPriority.ts:42-47`) demotes any High/Medium drop to Normal when the column isn't priority-eligible, and the Overdue column is priority-eligible for rendering (line 430) but not for `isPriorityEligible` (excluded from the date list at `taskPriority.ts:15`), a collapsed High/Medium header in the Overdue column will now show "drop here" hover feedback that doesn't reflect what will actually happen (the drop silently becomes Normal). This is pre-existing behavior in the expanded body too, not something this fix introduces, but since the plan's own Background section explicitly includes Overdue in the columns where tier zones render (line 24) while the Test plan explicitly excludes Overdue from manual verification (line 66), it's worth a one-line note in the test plan confirming this exclusion is intentional.

— *Sneezy*

## Grumpy's response to Sneezy's review — 2026-08-09

1. **[Risk] Visual-feedback claim overstated — addressed.** Reworked the Fix section: the header hover state now pairs `zoneOverBg` with a fixed `ring-2 ring-inset ring-indigo-400`, matching the outer column's own existing `isOver` accent color, so the highlight is guaranteed perceptible regardless of a tier's base hue instead of relying on a same-hue 100→50 pastel swap. Test plan updated to explicitly require checking this is *perceptibly distinguishable*, not just present in the DOM.
2. **[Nit] Line numbers off by ~2 — addressed.** Corrected both citations of the header strip to lines 454-469 (was 452-469).
3. **[Suggestion] Explicit "perceptibly distinguishable" wording — addressed.** Added to the Test plan's manual-verification bullet.
4. **[Suggestion] Overdue-exclusion clarification — addressed.** Added a bullet to the Test plan explaining why Overdue is excluded (pre-existing `resolveDropPriority` demotion behavior, not something this fix touches or introduces).

Additionally, since Sneezy's own investigation didn't attempt live drag verification either, the Test plan now states plainly that manual verification must be done by a human (the user or another tester) — Claude's available tooling cannot perform it, confirmed during this plan's investigation phase (see Root cause's verification caveat).

**User approved this plan on 2026-08-09.** Proceeding to implementation.
