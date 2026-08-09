# PLAN: feat-clickable-card-date — Make the due-date text on task cards an inline edit link

## Status
**State:** Ready for PR
**Last updated:** 2026-08-09 by Grumpy
**Next step:** PR #76 open at https://github.com/bindaas/tasksAreUs/pull/76 — awaiting review (code-review/test-review/etc. as the user chooses to run them).
**Blocked on:** n/a

All 3 files implemented (`TaskCardBody.tsx`, `TaskCard.tsx`, `FocusedTaskCard.tsx`). `tsc --noEmit` passes clean. Manually verified in-browser (Docker dev stack) per the Test plan section: Board-mode "Target" link opens native picker, commits, and moves the card between columns correctly; Escape reverts without a network call (card unmoved); date-link clicks do not navigate to task detail; Focused/Day-view single badge opens directly for a one-date-set task; **both-dates-set badge now expands into independent "Must do"/"Target" links (confirmed via a real edit: set `must_do_by` past `target_date` — the edited field updated to the picked value and the untouched field stayed put, no silent flip)**, resolving the Sneezy blocker. No console errors observed.

**One implementation deviation from the written Design, recorded per lifecycle step 5:** the plan's prop signature in "State ownership" listed `editingDateField: 'must_do_by' | 'target_date' | null`. Implementation widens this to `'must_do_by' | 'target_date' | 'both' | null` — `'both'` is the transient state meaning "both fields are shown as their own clickable links, neither yet in `<input>` edit mode," needed to represent the both-dates-set expansion from the Sneezy resolution before the user has picked which field to actually edit. `onDateFieldClick`'s signature widens to match. `onDateChange` (the actual mutation callback) is unaffected — it is never called with `'both'`, only with a real field name.

### Sneezy's Review — resolutions (Grumpy, 2026-08-09, approved and folded into Design below)

Presented to user alongside the pre-implementation checklist and approved. Folded into the Design section above (see updated "Per-mode field mapping", "Interaction", and "State ownership" subsections) and answered inline under each Sneezy issue below. Recorded here so a fresh session has them without relying on chat history:

1. **Blocker (effective-mode field ambiguity)** — fix: when the effective-mode badge (`FocusedTaskCard.tsx`) is clicked, if only one of `must_do_by`/`target_date` is set, edit that single field directly (original design — unambiguous). If **both** are set, expand to show both "Must do" and "Target" as separate inline inputs (same layout as `split` mode) instead of guessing which field the user meant to change — this avoids the "edit appears to silently not apply" bug Sneezy found, where editing the minimum field to a later value can make the badge flip to show the other, untouched field's date instead.
2. **Risk (`showPicker()` uncaught throw)** — wrap the call in `try/catch`, not just the `typeof ... === 'function'` existence guard. App has no ErrorBoundary, so an uncaught throw in the mount effect would white-screen the whole tree, not just the card.
3. **Gap (state leak with `isEditing` quick-edit)** — explicitly reset `editingDateField` to `null` in both wrappers' `onEdit`, `onSaved`, and `onCancel` handlers (the ones already passed to `TaskQuickEdit`), so a stale open date-input can't silently reopen when quick-edit closes and `TaskCardBody` remounts.
4. **Gap (no test coverage for field-resolution logic)** — moot for the ambiguous both-set case now that resolution #1 shows both fields instead of guessing; no new pure-utility function is being extracted, so no new unit test is needed per the existing "unit tests target `frontend/src/utils/`" convention.
5. **Nit (empty-string vs null)** — spell out explicitly in the `onChange` handler: a cleared native date input yields `e.target.value === ''`; translate with `e.target.value || null` before calling `onDateChange`/`updateTask`.
6. **Unverified assumption (sort_order omission)** — confirmed intentional: inline date edits via this feature will not send `sort_order`, matching the existing priority-toggle/quick-edit convention (`tasks.ts:58-59` comment) — the server may reposition the task within its new column/group. State this in the Design section as a deliberate choice, not an oversight, when folding this in.

## Overview

User request: "In all view where you see task cards, make the date on the task card a link — you can use this to change the date for task."

Today, task-card due dates (`must_do_by` / `target_date`) are plain, non-interactive text. The only way to change a task's date is to open the full Edit Task page (`TaskForm.tsx`) or drag the card between date columns on the Board view. This plan makes the date text itself clickable: click it, a native date picker opens in place, pick a new date, it saves immediately — no navigation, no separate Save button.

**Scope decisions, confirmed with user before writing this plan:**
- **Archive view is excluded.** Archive's `CompletionCard` (`frontend/src/components/ArchiveBoardGroups.tsx:18-47`) shows `completed_at` — a historical fact about when a task was finished, not a schedulable due date. It doesn't use `TaskCardBody` today and editing a completion timestamp doesn't fit product semantics. Untouched by this plan.
- **No-date cards are unchanged.** Cards where `must_do_by`/`target_date` are both unset currently render no date element at all (no placeholder). This plan does not add a "+ Add date" affordance for that case — only text that already renders becomes a link. Setting a date on a currently-undated task still goes through the full Edit Task form.

## Current state (confirmed by reading code)

One shared presentational component, `frontend/src/components/TaskCardBody.tsx`, renders the date text for every in-scope view via two thin wrapper components:

- `frontend/src/components/TaskCard.tsx` (Board view, via `TasksPage.tsx` → `BoardGroupedTasks.tsx`) — passes `dateDisplay={{ mode: 'split', mustOverdue }}`. Renders two possible lines: "Must do: `<date>`" (`task.must_do_by`) and "Target: `<date>`" (`task.target_date`, only if different from `must_do_by`). Card is `draggable` (`TaskCard.tsx:59`) and already gates dragging off during the existing quick-edit state (`!isEditing`).
- `frontend/src/components/FocusedTaskCard.tsx` (Focused view + Day view, via `FocusedView.tsx` / `DayView.tsx`) — passes `dateDisplay={{ mode: 'effective', effectiveDate }}` where `effectiveDate = getEffectiveDate(task)` (`frontend/src/utils/taskDateUtils.ts:40-45`: the earlier of the two dates if both set, otherwise whichever is set). Renders one badge. Not draggable.

Both wrappers already own an `isEditing` boolean that swaps `TaskCardBody` out for `TaskQuickEdit.tsx` (title/labels-only inline edit) — this plan follows the same "wrapper owns state, `TaskCardBody` is a controlled child" pattern rather than adding local state inside `TaskCardBody`.

Date mutation already has a working, reused pattern: `updateTask(id, body)` — `PUT /tasks/:id` (`frontend/src/api/tasks.ts:98-103`) — accepts a partial body; sending `{ must_do_by: null }` or `{ target_date: null }` clears a date server-side. Existing call sites doing exactly this: `TasksPage.tsx:308` (clear both on drag to "no date" column), `TasksPage.tsx:310` (set `target_date` on drag to a date column). No React Query — mutations are plain async calls from component handlers, with `try/catch` → `alert(err.message)` on failure, matching `TaskCard.tsx`'s `handleComplete`/`handleDelete` and `TaskQuickEdit.tsx`'s `save()`.

No date-picker library exists in `frontend/package.json` (no `react-datepicker`, no date library at all beyond hand-written `taskDateUtils.ts`). The only existing date-editing UI is native `<input type="date">` in `TaskForm.tsx:322-327` (must_do_by) and `:343-348` (target_date), each with a small "×" clear button. This plan reuses native `<input type="date">` for visual/pattern consistency — no new dependency.

## Design

### Interaction

The date text (in whichever mode) becomes a `<button type="button">` styled as a link (existing text size/color kept, `underline` + `cursor-pointer` added on hover) instead of plain text inside a `<p>`/`<span>`. Clicking it:

1. Calls `e.stopPropagation()` (so it doesn't trigger the card's `onClick={() => navigate(...)}` or start a drag).
2. Switches that field into edit mode: the link is replaced by a native `<input type="date">`, pre-filled with the current value, `autoFocus`.
3. On mount, best-effort call `inputRef.current?.showPicker?.()` guarded by both a `typeof inputRef.current?.showPicker === 'function'` existence check AND a `try/catch` around the call itself — `showPicker()` can throw (SecurityError/NotAllowedError) outside a user gesture's transient-activation window even when the method exists. Not required for correctness — without it, the input still has focus and its native calendar affordance is clickable — this is pure UX polish for browsers that support `showPicker()`, and the `try/catch` ensures a throw never escapes the mount effect (this app has no ErrorBoundary, so an uncaught throw here would white-screen the whole tree).
4. `onChange` commits immediately (no separate Save/Cancel button — "click a link to change the date" implies one step): calls the field-specific mutation, then exits edit mode. A cleared native input yields `e.target.value === ''`, not `null` — the handler translates with `e.target.value || null` before calling `onDateChange`/`updateTask`, so clearing a date sends `null` (matching the existing clear-date server contract).
5. `Escape` or blur-without-a-change reverts to link display with no network call.
6. All events on the input (`onClick`, `onChange`, `onKeyDown`) call `e.stopPropagation()` for the same reason as step 1.

### State ownership

`editingDateField: 'must_do_by' | 'target_date' | null` is new local state in **`TaskCard.tsx`** and **`FocusedTaskCard.tsx`** (not inside `TaskCardBody`), matching how `isEditing` already works for quick-edit. `TaskCardBody` becomes a controlled component for this: new props

```ts
editingDateField: 'must_do_by' | 'target_date' | null;
onDateFieldClick: (field: 'must_do_by' | 'target_date') => void;
onDateFieldCancel: () => void;
onDateChange: (field: 'must_do_by' | 'target_date', value: string | null) => Promise<void>;
```

Each wrapper implements `onDateChange` following the existing convention exactly:
```ts
async function handleDateChange(field: 'must_do_by' | 'target_date', value: string | null) {
  try {
    await updateTask(task.id, { [field]: value });
    onRefresh();
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to update date');
  } finally {
    setEditingDateField(null);
  }
}
```

`TaskCard.tsx`'s `draggable` attribute (line 59) gains `&& !editingDateField`, alongside the existing `!isEditing` check — an open native date-input inside a `draggable=true` container risks HTML5 drag hijacking clicks on it. `FocusedTaskCard.tsx` has no `draggable` concern (cards aren't draggable there).

Both wrappers already own an `isEditing` boolean whose "true" branch swaps `TaskCardBody` out for `TaskQuickEdit` — unmounting any open date `<input>` without warning. To prevent a stale `editingDateField` silently reopening a date input when `TaskCardBody` remounts later, both wrappers explicitly reset `editingDateField` to `null` in the existing `onEdit`, `onSaved`, and `onCancel` handlers already passed to `TaskQuickEdit`.

`handleDateChange` deliberately omits `sort_order` from the `updateTask` body — matching the existing priority-toggle/quick-edit convention (`tasks.ts:58-59`). This means the server may reposition the task within its new column/group after an inline date edit, same as those existing call sites; this is an intentional choice, not an oversight.

### Per-mode field mapping

- **`split` mode (`TaskCard.tsx`/Board view):** two independently-clickable links. "Must do: `<date>`" always edits `'must_do_by'`; "Target: `<date>`" always edits `'target_date'`. Only one field editable at a time (single `editingDateField` state — same simplicity tradeoff as the existing single `isEditing` boolean).
- **`effective` mode (`FocusedTaskCard.tsx`/Focused+Day view):** the naive "resolve to whichever field currently equals `effectiveDate`" rule is unsafe when both fields are set — `getEffectiveDate` returns the *minimum* of the two, so editing that field to a later value can make the badge silently flip to show the other, untouched field's date, reading to the user as "my edit didn't save" (confirmed by Sneezy's review, walkthrough below). Resolution:
  - If only one of `must_do_by`/`target_date` is set, clicking the badge edits that single field directly — unambiguous, same as originally designed.
  - If **both** are set, clicking the badge expands it into two separate inline inputs, "Must do" and "Target" — the same layout `split` mode already uses — instead of guessing which field the user meant to change. `editingDateField` becomes non-null in a mode that reveals both rather than picking one.
  - Example this avoids: `must_do_by=2026-08-10`, `target_date=2026-08-20` → badge shows 08-10 (the min). If edited in place to 08-25, `getEffectiveDate` would recompute `min(08-25, 08-20) = 08-20`, silently showing a date the user never picked. Showing both fields when both are set sidesteps this entirely — the user explicitly picks which one to change.

### Files to modify

1. `frontend/src/components/TaskCardBody.tsx` — `TaskCardBodyProps` gains the four props above; `dateEl` construction changes from static text to link/input-toggle per field, for both `mode` branches.
2. `frontend/src/components/TaskCard.tsx` — new `editingDateField` state + `handleDateChange`; wire the four new props; extend `draggable` gate.
3. `frontend/src/components/FocusedTaskCard.tsx` — same wiring; when only one date field is set, edit it directly on badge click; when both are set, expand to the two-field (`split`-style) inline layout instead of guessing which field to edit (see "Per-mode field mapping" above).

No other card renderer touches dates (confirmed by search — `ArchiveBoardGroups.tsx`'s `CompletionCard` is the only other date-showing card, out of scope per above).

## Data model / API changes

None. Reuses existing `PUT /tasks/:id` via `updateTask()`, which already accepts partial `{ must_do_by?: string | null, target_date?: string | null }` and already supports clearing via `null` (proven by existing call sites in `TasksPage.tsx:308/310`).

## Test plan

- No backend change, so no integration test changes (and that file is Sleepy-owned regardless — not touched directly).
- No new frontend unit test: per `CLAUDE.md`, frontend unit tests target pure utility functions in `frontend/src/utils/`; this change is component interaction wiring, not a pure utility, so it falls outside that convention's scope.
- Manual verification in-browser (dev server) before calling this done: click each of "Must do" / "Target" (Board view) and the single badge (Focused view, Day view), confirm the native picker opens, confirm a picked date saves and re-renders correctly, confirm clearing a date removes the line/badge, confirm Escape/blur-without-change cancels cleanly, confirm clicking a date link does not navigate to the task detail page or start a card drag.

## Deployment order

Single component: frontend-only change (`frontend/src/components/*.tsx`). Per `CLAUDE.md`, frontend changes always trigger a Railway deploy — no `[skip deploy]` tag on commits touching these files.

## Risks

- HTML5 native drag on `TaskCard.tsx`'s container could hijack a click/drag gesture starting on the date input if the `draggable` gate is missed — mitigated by explicitly adding `!editingDateField` to the `draggable` expression.
- `showPicker()` is unsupported in some older browsers — guarded with a `typeof` check; degrades to focus-only (user can still open the calendar via the input's native affordance or keyboard).
- Native `<input type="date">` styling/behavior differs slightly across browsers (notably Safari) — acceptable, this already ships unchanged in `TaskForm.tsx`.

---

## Sneezy's Review — 2026-08-09

**Tier:** LIGHT — no proposed file falls under a model/schema/router/API-contract area, plan declares no data model changes, single-component (frontend-only) deployment. Confirmed correct; not escalated. (Spot-checked `backend/app/routers/tasks.py:104-108` for cross-field date validation that could invalidate the "reuses existing PUT" claim — none found, no contradiction with the LIGHT gate.)

**Verdict:** Changes required

### Issues

1. **[Blocker]** The "effective" mode field-resolution rule (line 75) does not actually match `getEffectiveDate`'s tie-break as claimed, and more importantly the design has a real, non-edge-case UX bug. `getEffectiveDate` (`frontend/src/utils/taskDateUtils.ts:40-45`) returns the **minimum** of `must_do_by`/`target_date` when both are set (confirmed by the existing test `frontend/src/__tests__/taskDateUtils.test.ts:100-101`, which documents that on a tie it resolves toward `target_date`). The plan's proposed resolution expression, `task.must_do_by && task.must_do_by === dateDisplay.effectiveDate ? 'must_do_by' : 'target_date'`, picks whichever field currently *equals* the effective date — but because `effectiveDate` is a MIN, editing that field to a value that crosses past the *other*, unedited, invisible-in-this-mode field silently produces a displayed badge that does **not** show the date the user just picked. Concrete walkthrough: `must_do_by=2026-08-10`, `target_date=2026-08-20` → badge shows 08-10, resolves to `'must_do_by'`. User clicks it, picks `2026-08-25`. `onDateChange` sends `{must_do_by: '2026-08-25'}`. After refresh, `getEffectiveDate` recomputes `min(08-25, 08-20) = 08-20` (the untouched `target_date`) — the badge now shows **08-20**, a date the user never picked, and the just-picked 08-25 is invisible. This reads to the user as "my edit didn't save." This isn't a rare edge case: Focused view (where `effective` mode is used) surfaces high-priority tasks, which commonly carry both dates set. The plan needs an explicit design answer here — e.g. also mirror the change onto the other field when it would otherwise become the new minimum, disable single-badge editing when the two dates differ, or show both fields once editing starts — not just the current single-field write.
2. **[Risk]** `showPicker()` (Design > Interaction step 3, line 40) is guarded only by `typeof inputRef.current?.showPicker === 'function'`, which checks the method exists but not that calling it succeeds. Per spec, `showPicker()` throws (SecurityError/NotAllowedError) when invoked outside a user gesture's transient-activation window; calling it from a `useEffect` that fires after a click-triggered state update/re-render risks landing outside that window in some browsers. The plan calls this "pure UX polish" that "degrades" gracefully without it — but an uncaught throw inside a mount effect is not a graceful degradation. I checked and this app has **no ErrorBoundary anywhere** (`grep -rl "ErrorBoundary\|componentDidCatch" frontend/src` → no matches), so an uncaught exception here would not be contained to the card — by React's default behavior it would unmount the whole tree (white screen). The `typeof` guard should be paired with a `try/catch` around the actual call, not just an existence check.
3. **[Gap]** State leak between the new `editingDateField` and the existing `isEditing` (quick-edit) state. Both `TaskCard.tsx` and `FocusedTaskCard.tsx` render `isEditing ? <TaskQuickEdit/> : <TaskCardBody ... />`, so `TaskCardBody` — and any date `<input>` open inside it — unmounts the instant `isEditing` becomes true. Nothing in the plan resets `editingDateField` when that happens. The pencil "Edit" button in `actionsEl` (`TaskCardBody.tsx:133-141`) is reachable regardless of `editingDateField`'s value, so a user can open a date field, then click Edit before committing, leaving `editingDateField` stale. When the quick-edit is later saved/cancelled and `TaskCardBody` remounts, the previously-open date field reopens unprompted (re-triggering the `showPicker()` mount effect too). Fix is simple (clear `editingDateField` in the wrapper's `onEdit`/`onSaved`/`onCancel`) but isn't mentioned.
4. **[Gap]** Test plan (lines 89-93) declares no new unit test is needed because this is "component interaction wiring, not a pure utility." That's fair for the click/toggle wiring, but the field-resolution logic in Issue 1 is pure computation with a non-obvious, demonstrably-wrong tie-break — exactly the kind of logic `frontend/src/__tests__/taskDateUtils.test.ts` already covers for `getEffectiveDate`. As scoped, the bug in Issue 1 would ship with zero test coverage able to catch it.
5. **[Nit]** Design step 4 ("Clearing the native input... sends `null`") elides the actual mechanics: a cleared `<input type="date">` yields `e.target.value === ''`, not `null` — the `onChange` handler needs an explicit `value || null` (or equivalent) translation before calling `onDateChange`/`updateTask`. Worth spelling out given this plan is meant to be resumable by a fresh session with zero conversation context.

### Unverified assumptions

- Line 75's claim that effective-field resolution is "resolved the same way `getEffectiveDate`'s tie-break already works" — checked directly against `taskDateUtils.ts:40-45` and `taskDateUtils.test.ts:100-101`; the claim does not hold (see Issue 1).
- Cross-browser behavior of `showPicker()` combined with Escape-key handling (does the native calendar popup swallow Escape before it reaches the input's own `onKeyDown`, does opening the popup count as a blur for the "blur-without-change reverts" rule) cannot be confirmed by reading code — the plan's own manual-verification step is the right mechanism to check this, but the plan's framing that it "degrades gracefully" is unverified and, per Issue 2, may not hold.
- "No other card renderer touches dates" (line 83) — spot-checked via `grep -rln "must_do_by\|target_date\|formatDate(" frontend/src/components frontend/src/pages`; only `TaskCard.tsx`, `TaskCardBody.tsx`, `TasksPage.tsx` (drag-drop mutation only, not a card renderer), and `TaskForm.tsx` (already excluded, full edit form) matched. Claim holds.
- All cited line numbers (`TaskCardBody.tsx`, `TaskCard.tsx` line 59, `FocusedTaskCard.tsx`, `taskDateUtils.ts:40-45`, `tasks.ts:98-103`, `TasksPage.tsx:308/310`, `TaskForm.tsx:322-327/343-348`) were verified against the current files and are accurate.
- `UpdateTaskBody`'s partial-update / null-clearing contract (`frontend/src/api/tasks.ts:49-68`) matches the plan's description exactly, including the "omit `sort_order` → server decides, possibly auto-reset to bottom" behavior the plan doesn't call out — worth noting: an inline date edit via this feature will *not* pin the task's position the way a drag-drop does, since the plan's `handleDateChange` never sends `sort_order`. Likely fine (matches quick-edit/priority-toggle convention per the comment at `tasks.ts:58-59`), but not stated in the plan as an intentional choice.

### Suggestions

- Extract the "which field is effective" resolution into `taskDateUtils.ts` as an exported pure function (e.g. `getEffectiveField`) alongside `getEffectiveDate`, with unit tests in `taskDateUtils.test.ts` covering the both-set/crossing-values case from Issue 1. This would have caught the bug before implementation.
- Explicitly design and state the intended behavior when both dates are set and the user edits the effective-mode badge, rather than leaving it as an implicit consequence of "whichever field currently equals effectiveDate."
- Wrap the `showPicker()` call in `try/catch`, not just a `typeof` existence guard.
- Explicitly reset `editingDateField` to `null` when `isEditing` is entered (or when `onComplete`/`onDelete` fire), to avoid the stale-reopen behavior in Issue 3.
- Note in the plan, as an intentional decision, that inline date edits omit `sort_order` and will let the server auto-reset the task's position within its new column/group — so a fresh reader doesn't have to re-derive this from `tasks.ts`.

— *Sneezy*

---

## Response to Sneezy's Review (Grumpy, 2026-08-09)

User approved implementation with these resolutions; each is folded into the Design section above and confirmed here per DEVELOPMENT PLAN LIFECYCLE step 4:

1. **[Blocker] Effective-mode field-resolution bug** — **Addressed.** Design > "Per-mode field mapping" rewritten: single-field-set case still edits that field directly; both-fields-set case expands to the two-input `split`-style layout instead of guessing, eliminating the silent-badge-flip bug entirely (no min/max resolution logic is needed at edit time since the ambiguous case no longer picks a single field).
2. **[Risk] `showPicker()` uncaught throw** — **Addressed.** Design > "Interaction" step 3 now wraps the call in `try/catch` in addition to the existing `typeof` guard.
3. **[Gap] State leak with `isEditing`** — **Addressed.** Design > "State ownership" now explicitly resets `editingDateField` to `null` in both wrappers' `onEdit`, `onSaved`, and `onCancel` handlers.
4. **[Gap] No test coverage for field-resolution logic** — **Addressed by design change, not by adding a test.** Since resolution #1 removes the guessing logic (both-set case shows both fields instead of resolving to one), there is no new pure-utility function to extract or unit-test. Matches the existing convention that frontend unit tests target `frontend/src/utils/` pure functions only.
5. **[Nit] Empty-string vs null** — **Addressed.** Design > "Interaction" step 4 now spells out the `e.target.value || null` translation explicitly.

Unverified assumption (sort_order omission) — confirmed intentional and now stated explicitly in Design > "State ownership."
