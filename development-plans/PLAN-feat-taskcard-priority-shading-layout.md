# PLAN-feat-taskcard-priority-shading-layout

## Status
**State:** Ready for PR
**Last updated:** 2026-08-11 by Grumpy
**Next step:** Commit, push, open PR (all pending explicit user go-ahead)
**Blocked on:** n/a

**Implementation notes:** All files implemented as amended. `tsc -b` clean, all 194 frontend unit tests pass (193 pre-existing + 3 new `priorityColor.test.ts` cases; net +1 test file). Manually verified in the browser: Task List "All" kanban (High → orange, buttons top-right/title-below, no "HIGH" text, filter row swapped with tag pills right-aligned) and Overdue view via `FocusedTaskCard` (Normal → green, same layout, edit mode correctly stays `bg-white` per the Sneezy-flagged fix). Medium (blue) not separately screenshotted but exercised by the same code path and covered by the new unit test.

## Scope

Restyle the task card wherever it's rendered via the shared `TaskCardBody` component (Task List kanban board, and Focused/Today/Tomorrow/Overdue views), plus the Task-page tag filter row:

1. Action buttons (priority steppers, edit, complete, delete) move to the top-right corner of the card; the title sits on its own line below, so long titles no longer get squeezed into a narrow wrapped column next to the buttons (confirmed live on `localhost:5173/?view=all` before writing this plan).
2. Card background is tinted by priority: High → light orange (`bg-orange-50`), Medium → light blue (`bg-blue-50`), Normal → light green (`bg-green-50`).
3. The "High"/"Medium" text badge is removed entirely (both tiers) — now redundant with the background tint. Normal never had a badge.
4. On the Tasks page filter row (`LabelFilterChips`, shared across Overdue/Focused/Today/Tomorrow/All): the mode-toggle (Single/AND/OR + Clear filters) moves from the right side to the left side; the tag pill list moves to the right side and right-aligns (hugs the right edge, scrolls horizontally on overflow), mirroring how `BoardTabs` right-aligns board-name pills.

**Out of scope (explicit user decision during planning):**
- Archive's completion cards (`ArchiveBoardGroups.tsx`) are NOT touched. They render a separate `CompletionCard` component that doesn't use `TaskCardBody`, and the backing `CompletionRecord` type/API has no `priority` field at all (separate `/completions` endpoint). Adding priority shading there would require a backend/API contract change, which the user deferred as a follow-up rather than bundling into this frontend-only change.
- Board colors (`utils/boardColor.ts`, `PALETTE` array) are NOT changed. Verified via live DB query (`SELECT id, name, color FROM boards`) that the only board with a custom color is "Job search" (`#ef4444`), and the default `PALETTE` (`#6366f1 #f59e0b #10b981 #ef4444 #3b82f6 #8b5cf6 #ec4899 #14b8a6`) is fully saturated — none of these collide with the pale `-50` tint shades being introduced. No board color needs to change.
- `mobile/src/components/TaskCardBody.tsx` and `mobile/src/components/FocusedTaskCard.tsx` are NOT touched (added per Sneezy's review — see Grumpy's response below). They're independent React Native implementations with the same `layout`/badge pattern, but the user's scope discussion never mentioned mobile, and mobile ships on its own OTA/full-rebuild cadence separate from the Railway frontend build. Treated the same way as Archive: deferred as a follow-up, not silently skipped.

## Background

Original ask was scoped to "the Task card in the Task List" (the kanban board on the Tasks page, `TaskCard.tsx`, which renders `TaskCardBody` with `layout="inline"`). While presenting the plan, the user expanded scope: "these changes should apply in all views — everywhere the Task card appears... including Archive" and asked to drop the priority-tier text badge entirely. Investigation found:
- `FocusedTaskCard.tsx` (used by Focused/Today/Tomorrow/Overdue views via `BoardGroupedTasks.tsx`) already renders `TaskCardBody` with `layout="stacked"` — which already implements "buttons top-right, title below" today. So consolidating `TaskCard.tsx` onto `layout="stacked"` as well means both callers converge on one layout, making the `layout` prop and its `'inline'` branch fully dead code.
- The priority text badge (`priorityIndicator` in `TaskCardBody.tsx`) is rendered identically by both callers, so removing it in one place covers both.
- Archive's card is a structurally different, simpler, read-only component with no priority data available — user confirmed (via clarifying question) to defer it rather than bundle a backend change into this PR.

## Files to modify

1. **`frontend/src/utils/priorityColor.ts`** (NEW — moved out of `TaskCardBody.tsx` per Sneezy's testability suggestion, mirroring the existing `boardColor.ts` pattern):
   - `export const PRIORITY_CARD_BG: Record<PriorityTier, string> = { high: 'bg-orange-50', medium: 'bg-blue-50', normal: 'bg-green-50' }`.

2. **`frontend/src/__tests__/priorityColor.test.ts`** (NEW, per Sneezy's suggestion): trivial Vitest assertion that each of the three `PriorityTier` values maps to its expected class — cheap insurance against a copy-paste tier mix-up.

3. **`frontend/src/components/TaskCardBody.tsx`** — shared by `TaskCard.tsx` and `FocusedTaskCard.tsx`.
   - Remove the `layout: 'inline' | 'stacked'` prop from `TaskCardBodyProps` and the corresponding branch/prop from the function signature. Only one render path remains (what is today's `'stacked'` branch); collapse the `if (layout === 'stacked') {...} return (...)` structure into a single return.
   - Remove `priorityIndicator` (the "High"/"Medium" span) entirely, in both its computation and its one remaining usage.
   - Remove the now-unused `badge` field from the `TIER_ACCENT` map's type and values; keep `button` (still used by the priority-stepper arrow buttons).
   - The former top row (`<div>{priorityIndicator}</div>` + `actionsEl`, `justify-between`) becomes `actionsEl` alone, right-aligned: `{actionsEl && (<div className="flex justify-end mb-1.5">{actionsEl}</div>)}`.
   - `titleEl` simplifies to the single style currently used by the `'stacked'` branch (`'text-sm font-medium text-gray-800 line-clamp-2 leading-snug mb-2'`) — no more inline/stacked ternary.
   - (No longer owns `PRIORITY_CARD_BG` — that moved to `utils/priorityColor.ts`, addressed below.)

4. **`frontend/src/components/TaskCard.tsx`** (Task List / kanban board):
   - Drop the `layout="inline"` prop passed to `TaskCardBody` (prop no longer exists).
   - Import `PRIORITY_CARD_BG` from `utils/priorityColor` and apply it to the container **conditionally**: `isEditing ? 'bg-white' : PRIORITY_CARD_BG[task.priority]` — addressed per Sneezy's review (see below); keeps the inline `TaskQuickEdit` form on its assumed white backdrop instead of unconditionally tinting behind it.

5. **`frontend/src/components/FocusedTaskCard.tsx`** (Focused / Today / Tomorrow / Overdue views):
   - Drop the `layout="stacked"` prop passed to `TaskCardBody` (prop no longer exists — behavior is now the only path).
   - Import `PRIORITY_CARD_BG` from `utils/priorityColor` and apply the same conditional (`isEditing ? 'bg-white' : PRIORITY_CARD_BG[task.priority]`) as `TaskCard.tsx`.

6. **`frontend/src/components/LabelFilterChips.tsx`**:
   - Swap block order inside the outer `flex ... justify-between` row: the mode-toggle + Clear-filters block renders first (left); the tag-pill block renders second (right).
   - Wrap the tag-pill block the way `BoardTabs.tsx` wraps its pills: `overflow-x-auto` outer + `flex justify-end gap-1.5 min-w-full w-max` inner — **plus `min-w-0` and `flex-1` on the outer wrapper** (addressed per Sneezy's review, see below), since it's a flex-item sibling of the mode-toggle block rather than `BoardTabs`' top-level container, and without `min-w-0` a flex child won't shrink below its content width to actually trigger the scroll behavior.
   - Verify the result in the browser after implementing (not just by code inspection), per Sneezy's flagged risk.

## Data model changes

None.

## API/contract changes

None. No backend files touched; `Task.priority` (already returned by the existing tasks API) is the only data used, and it's already present on every task object consumed by `TaskCard`/`FocusedTaskCard`.

## Test plan

- New: `frontend/src/__tests__/priorityColor.test.ts` asserting `PRIORITY_CARD_BG`'s three tier→class mappings (added per Sneezy's suggestion — `priorityColor.ts` is a pure utility, in scope for this project's unit-test convention).
- No test coverage needed for `TaskCardBody`, `TaskCard`, `FocusedTaskCard`, or `LabelFilterChips` themselves — layout/styling components, not pure utility functions.
- Manual verification: reload the running dev server (`localhost:5173`) and visually check all affected views (Task List "All" kanban, Focused, Today, Tomorrow, Overdue) for card layout/color, the filter-row alignment, and specifically the `LabelFilterChips` scroll/right-align behavior flagged by Sneezy's review.

## Deployment order

Single component — frontend only (`frontend/` files under Railway's bundled build). No backend or mobile files touched. Mobile update type: n/a.

## Risk

Low. Pure frontend styling/layout consolidation:
- The kept render path (former `'stacked'` branch) is already live in production today via `FocusedTaskCard`, so its correctness is already proven — this change extends its use to `TaskCard` rather than introducing new untested markup.
- Removing the `layout` prop and `'inline'` branch is safe because, after this change, both call sites pass no conflicting layout — grep confirmed only these two call sites set the `layout` prop anywhere in the codebase.
- `PRIORITY_CARD_BG` only changes a Tailwind class computed from `task.priority`, an already-required, always-present field on every `Task` object.
- Known accepted cosmetic tradeoff (already flagged to and accepted by the user): the priority-stepper buttons in `TIER_ACCENT.button` use `bg-orange-50`/`bg-blue-50` for their hover/rest state, same hue family as the new card background — slightly lower contrast for those specific icon buttons on a same-toned card, not being addressed since it wasn't asked for.
- Accessibility note (per Sneezy's suggestion): dropping the "High"/"Medium" text badge in favor of background-tint-only removes the sole non-color signal of priority tier. This was an explicit, informed user decision (asked directly in the pre-implementation clarifying question, user chose "drop both"), not an oversight — recorded here for the record rather than acted on further, since no `aria-label`/`title` alternative was requested.

---

## Sneezy's Review — 2026-08-11

**Tier:** LIGHT — no proposed file falls under a model/schema/router/API area, and the plan declares single-component (frontend-only) deployment with no data model changes. Confirmed on inspection: all four files are presentational components with narrow, verified fan-out (`layout=` prop has exactly 2 call sites codebase-wide, grep-confirmed independently). No escalation to FULL warranted.

**Verdict:** Approved with concerns

### Issues

1. **[Risk]** `TaskCard.tsx:67` and `FocusedTaskCard.tsx:99` — the container `className` that currently has an unconditional `bg-white` is also the background rendered behind `<TaskQuickEdit>` when `isEditing` is true (`TaskCard.tsx:92-98`, `FocusedTaskCard.tsx:105-110`). The plan's instruction to "replace the container's `bg-white` with `PRIORITY_CARD_BG[task.priority]`" is unconditional, so the tinted background will now also show behind the inline quick-edit form (text input, label toggle pills, save/cancel buttons — all of which assume a white backdrop per `TaskQuickEdit.tsx:87-130`). The plan's live-verification note ("confirmed live on `localhost:5173/?view=all`") only covers the read-mode layout change, not this edit-mode interaction. Not necessarily wrong visually, but it's an unverified, unstated behavior change that should be either confirmed intentional or scoped out (e.g. keep `bg-white` while `isEditing`).

2. **[Risk]** `LabelFilterChips.tsx:36-57` — the plan says to wrap the tag-pill block "the way `BoardTabs.tsx` wraps its pills" (`overflow-x-auto` outer + `flex justify-end gap-1.5 min-w-full w-max` inner). This pattern is verified to work in `BoardTabs.tsx:9-10` — but there it's the component's own top-level container, not competing for width with a sibling. In `LabelFilterChips.tsx`, the pill block is one of two children inside a shared `flex flex-wrap items-center justify-between` row (line 36) alongside the mode-toggle block. Nesting `overflow-x-auto`/`w-max` inside a flex item without also setting `min-w-0` on that item is a well-known Tailwind/flexbox gotcha: a flex child's default `min-width: auto` lets it grow to fit its content instead of being constrained to trigger the scrollbar, and the parent's `flex-wrap` may instead just drop the two blocks onto separate lines when combined width overflows — rather than producing the intended "hugs the right edge, scrolls horizontally" behavior. The plan should call out `min-w-0` explicitly (or verify empirically) rather than assuming the pattern transplants unchanged into a different flex context.

3. **[Gap]** Mobile parity is never addressed. `mobile/src/components/TaskCardBody.tsx` and `mobile/src/components/FocusedTaskCard.tsx` are independent React Native implementations (not shared code) that carry the same `layout: 'inline' | 'stacked'` prop and the same "High"/"Medium" text-badge pattern being removed here. The user's expanded scope request was "these changes should apply in all views — everywhere the Task card appears," and the plan's Background section explicitly records a scoping decision for Archive (deferred, with reasoning) but is silent on mobile — it's not clear whether mobile was considered and intentionally excluded, or simply not noticed. Worth an explicit note (even if the answer is "mobile follow-up deferred, same as Archive") so this doesn't read as an oversight later. Not a blocker since no mobile files are in the plan's file list and none are being touched.

4. **[Nit]** Risk section's contrast callout ("same hue family... slightly lower contrast") is correct but worth double-checking precisely: button color is keyed to `toTier` (the tier a step would move *to*), never to the task's current tier, so a stepper button's background never exactly equals its own card's tint (verified against `TaskCardBody.tsx:269-273` combined with the new `PRIORITY_CARD_BG` map) — confirmed the plan's characterization holds, not overstated. No action needed, noted only because it was worth checking rather than taking on faith.

### Unverified assumptions

- "Confirmed live on `localhost:5173/?view=all` before writing this plan" (buttons top-right / title-below layout) — could not be independently verified without running the dev server, but the underlying claim (that this is today's `'stacked'` branch behavior) checks out by reading `TaskCardBody.tsx:326-341` directly.
- "Verified via live DB query (`SELECT id, name, color FROM boards`)... only board with a custom color is 'Job search'" — could not be verified without DB access; irrelevant to this plan's actual file changes regardless, since board colors are out of scope and untouched.
- "Grep confirmed only these two call sites set the `layout` prop anywhere in the codebase" — independently verified true (`grep -rn "layout=" frontend/src` returns exactly `TaskCard.tsx:102` and `FocusedTaskCard.tsx:123`).
- "The backing `CompletionRecord` type/API has no `priority` field at all" — independently verified true (`frontend/src/api/reports.ts:4-9`).
- "`badge` field... unused" after removal — independently verified true; `TIER_ACCENT[...].badge` has exactly one call site (`TaskCardBody.tsx:138`), which is the code being deleted.
- No existing unit test covers `TaskCardBody`/`TaskCard`/`FocusedTaskCard`/`LabelFilterChips` — independently verified true against `frontend/src/__tests__/` listing.

### Suggestions

- Since `PRIORITY_CARD_BG` is a small, pure, exported mapping (fits this project's "pure utility function" unit-test convention per `CLAUDE.md`), consider a trivial unit test asserting the three tier→class mappings — cheap insurance against a copy-paste mix-up (e.g. `high`/`medium` swapped) that a quick visual check might not catch.
- Removing the "High"/"Medium" text badge entirely in favor of background-only tinting drops the only non-color signal of priority tier. This was an explicit user decision, not a plan defect, but flagging for the record: color-only differentiation (orange/blue/green pastels) may be harder to distinguish for colorblind users than the previous badge+color combination. Worth a one-line acknowledgment in the plan (or an `aria-label`/`title` attribute on the card) if accessibility wasn't part of the explicit tradeoff conversation.

— *Sneezy*

---

## Grumpy's response to Sneezy's review — 2026-08-11

1. **[Risk] Unconditional tint behind `TaskQuickEdit`** — Addressed. Changed the plan (Files to modify §4–5) to apply `PRIORITY_CARD_BG[task.priority]` only when `!isEditing`, keeping `bg-white` during edit mode so the quick-edit form's inputs/pills/buttons keep their assumed white backdrop. No behavior change to the edit form itself.

2. **[Risk] `min-w-0` / flex-context mismatch in `LabelFilterChips`** — Addressed. Changed the plan (Files to modify §6) to add `min-w-0 flex-1` to the tag-pill block's outer wrapper, and added an explicit instruction to verify the scroll/right-align behavior live in the browser after implementing, rather than assuming the `BoardTabs` pattern transplants unchanged.

3. **[Gap] Mobile parity not addressed** — Addressed by explicit exclusion, not by implementing. Added a line to the plan's "Out of scope" section: `mobile/src/components/TaskCardBody.tsx` and `mobile/src/components/FocusedTaskCard.tsx` are independent React Native code with the same pattern, deliberately deferred as a follow-up (same treatment as Archive), not silently missed. Will flag to the user as a known follow-up when reporting completion.

4. **[Nit] Contrast callout precision** — No action needed; Sneezy confirmed the existing plan text already holds up.

**Suggestions:**
- Trivial `PRIORITY_CARD_BG` unit test — Adopted. Moved the map to a new `frontend/src/utils/priorityColor.ts` (mirrors `boardColor.ts`) specifically so it qualifies as a pure-utility per this project's test convention, and added `frontend/src/__tests__/priorityColor.test.ts` to the file list.
- Accessibility acknowledgment — Adopted. Added a line to the plan's Risk section recording that badge removal was an explicit, directly-asked user decision, not an oversight.

**Status:** Approved with concerns → all concerns addressed in the plan. Proceeding to implementation.

— *Grumpy*
