# PLAN: fix-focused-card-parity-and-notes-bug — Notes persistence fix, Focused/Today/Tomorrow card parity, shared card body (web only)

## Overview

Two user-reported issues on web, found during a pause in the mobile redesign work (`PLAN-feat-tasks-view-redesign-mobile.md`):

1. Editing a task's Notes field and saving does not persist the change in some cases.
2. Task cards on Focused/Today/Tomorrow (`FocusedTaskCard.tsx`) are missing features present on All view's cards (`TaskCard.tsx`): no Links section, no Complete/Delete buttons — only Edit.

Root-caused both by reading the code and, for #1, reproducing directly against the running local API (`docker-compose up`, `TEST_AUTH_BYPASS=true`, seeded system user). This plan also addresses the user's question about why the two card components have diverged, by extracting their shared read-only rendering into one component.

Mobile is unaffected by this plan — mobile's `FocusedTaskCard.tsx` doesn't exist yet (its build is covered by `PLAN-feat-tasks-view-redesign-mobile.md`, paused for this fix). Once this web plan ships, the mobile plan will be updated to build its `FocusedTaskCard.tsx` with the same parity from day one, rather than needing a follow-up fix — see "Mobile follow-up" below.

## Root Cause — Notes bug

`frontend/src/components/TaskForm.tsx:157`:
```ts
if (notes.trim()) data.notes = notes.trim();
```
Every other field in this function (`title`, `label_ids`, `is_high_priority`, `links`) is always included in `data`. `notes` is the only field gated behind a truthiness check, so **clearing the Notes textarea to empty omits the key entirely** from the PUT body.

Confirmed against the live backend that this matters: `PUT /tasks/{id}` semantics are "field absent in body → leave unchanged" (`backend/app/services/task_service.py:151-152`: `if notes is not None: task.notes = notes`). Reproduced via curl:
- PUT with `"notes":"hello world"` → persists, confirmed on refetch.
- PUT omitting `notes` entirely (what the JS produces when the field is blanked) → `notes` stays at its old value (`"hello world"`), `updated_at` still bumps — the save "succeeds" with no error, but the notes change is silently dropped. This matches the reported symptom exactly for the clear-to-empty case.

Non-empty-to-non-empty edits are not affected by this specific line (truthy, so included) — if a different persistence path is still broken after this fix, it needs separate repro (not found in this pass).

## Fix — Notes bug

- `frontend/src/components/TaskForm.tsx:157` — remove the conditional; always set `data.notes = notes.trim();`, matching the pattern already used for `title`/`links`. `UpdateTaskBody.notes` is `Optional[str]` (not nullable-to-null like the date fields), so sending `""` correctly clears it server-side without needing a `clear_notes` flag.

## Root Cause — Card parity

`TaskCard.tsx` (All view) and `FocusedTaskCard.tsx` (Focused/Today/Tomorrow) are two independently-maintained implementations of the same concept. They already share `TaskQuickEdit` for the inline-edit state, but the **read-only display body** (badges, title, dates, labels, links, action buttons) is hand-duplicated in each — which is why Links/Complete/Delete were added to `TaskCard.tsx` at some point and never ported to `FocusedTaskCard.tsx`.

Confirmed both have full `Task` objects on hand already (`FocusedBoard.tasks: Task[]` includes `links`, `state`, everything `TaskCard` uses) and both already receive `onRefresh` from their parent (`BoardGroupedTasks.tsx:26` → `FocusedView.tsx:62` / `DayView.tsx`) — so no new prop plumbing is needed to wire Complete/Delete, only the JSX + `completeTask`/`deleteTask` imports.

## Fix — Card parity + shared component

Extract the shared read-only card body into one new component, `frontend/src/components/TaskCardBody.tsx`, used by both `TaskCard.tsx` and `FocusedTaskCard.tsx`. Revised per Sneezy's review to cover every real difference between the two cards:

```ts
interface TaskCardBodyProps {
  task: Task;
  dateDisplay:
    | { mode: 'split'; mustOverdue: boolean }              // TaskCard: must_do_by + target_date separately
    | { mode: 'effective'; effectiveDate: string | null };  // FocusedTaskCard: single effective date
  layout: 'inline' | 'stacked';  // 'inline' = TaskCard's horizontal split (content left, actions right);
                                 // 'stacked' = FocusedTaskCard's vertical stack (badge row, title, date, labels, links, actions)
  priorityBadge: 'toggle' | 'static';  // TaskCard: clickable flag icon; FocusedTaskCard: "★ High" text badge
  onTogglePriority?: () => void;       // only used when priorityBadge === 'toggle'
  renderLabels: (labels: Label[]) => React.ReactNode;  // caller supplies its own sort order + style,
                                                        // so TaskCard's sorted-LabelBadge rendering and
                                                        // FocusedTaskCard's unsorted-inline-color rendering
                                                        // are each preserved exactly, unchanged
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}
```

Resolves Sneezy's issues:
- **#1 (labels not parameterized)** — fixed via `renderLabels` render-prop above; each caller keeps its exact current sort/style.
- **#2/#3 (layout position, Edit relocation)** — fixed via the `layout` prop. The Edit/Complete/Delete (+ optional priority-toggle) action row is now **one single shared implementation** used by both layouts, always positioned at the bottom. This is an intentional, visible change for `FocusedTaskCard.tsx`: **its Edit button moves from its current top-of-card spot into the new bottom action row alongside Complete/Delete** — it no longer lives next to the priority badge. For `'inline'` layout (`TaskCard.tsx`/All view), this matches the current implementation exactly (actions were already in a bottom-right row there) — no change.
- **#5 (title styling nit)** — folded into the `layout` variant: `'stacked'` applies `line-clamp-2 leading-snug mb-2` (current `FocusedTaskCard` style), `'inline'` applies the current `TaskCard` style. No visual change for either.
- **#4 (pending-state gate coupling)** — `TaskCardBody.tsx` keeps the `task.state === 'pending'` gate on the action row (matching `TaskCard.tsx:123` today) and carries a one-line code comment noting that Focused/Today/Tomorrow's backend queries (`get_boards_with_tasks`, shared by `focused_view_service.py` and `day_view.py`) currently only ever return pending tasks — so the gate is presently redundant for `FocusedTaskCard` but must be revisited if that query is ever loosened.

- `TaskCard.tsx` — becomes: drag-handling wrapper + `isEditing` state + `TaskQuickEdit` (unchanged) OR `<TaskCardBody layout="inline" dateDisplay={{mode:'split', mustOverdue}} priorityBadge="toggle" onTogglePriority={...} renderLabels={...sorted LabelBadge...} ... />`
- `FocusedTaskCard.tsx` — becomes: board-color-stripe wrapper + `isEditing` state + `TaskQuickEdit` (unchanged) OR `<TaskCardBody layout="stacked" dateDisplay={{mode:'effective', effectiveDate}} priorityBadge="static" renderLabels={...inline LABEL_COLORS...} onComplete={...} onDelete={...} ... />`, gaining Links, Complete, and Delete for the first time, and losing its top-of-card Edit button in favor of the shared bottom row. `completeTask`/`deleteTask` imported from `../api/tasks`, same try/catch/alert pattern as `TaskCard.tsx:33-52`.

No behavior change intended for `TaskCard.tsx`'s All-view rendering — this is a pure extraction there. `FocusedTaskCard.tsx` gains functionality (Links, Complete, Delete) and relocates its Edit button, to reach parity.

**Not in scope**: adding a priority-toggle button to Focused/Today/Tomorrow (TaskCard has one, FocusedTaskCard doesn't) — not reported as missing by the user, and the badge display convention already differs intentionally (static "★ High" vs. clickable flag) between the two views. If wanted, that's a separate, explicit ask.

## Files to Modify

- `frontend/src/components/TaskForm.tsx` — one-line fix (line 157)
- `frontend/src/components/TaskCardBody.tsx` — new, extracted shared component
- `frontend/src/components/TaskCard.tsx` — refactor to use `TaskCardBody` for its non-editing render path
- `frontend/src/components/FocusedTaskCard.tsx` — refactor to use `TaskCardBody`; gains Links/Complete/Delete

## Data / API Changes

None. Presentation + one client-side payload-construction fix only.

## Test Plan

- `frontend/src/__tests__/`: no existing unit tests target `TaskForm.tsx`, `TaskCard.tsx`, or `FocusedTaskCard.tsx` (these are React components, not pure utility functions — this project's frontend unit-test convention targets `src/utils/`). No unit test changes required or applicable per project convention.
- Manual verification (per project UI-change convention):
  - Edit an existing task's notes to a new non-empty value → save → reload → new value persists (regression check, already worked, must keep working)
  - Edit an existing task's notes to empty → save → reload → notes are actually empty (the bug fix)
  - Create a new task with notes → persists (regression check on the create path, which shares this line)
  - Focused/Today/Tomorrow: a task with links shows them, clicking a link doesn't trigger card navigation
  - Focused/Today/Tomorrow: Complete button completes the task and removes it from view; Delete prompts to confirm and removes it
  - Focused/Today/Tomorrow: Edit button now appears in the bottom action row (with Complete/Delete) instead of top-of-card next to the priority badge — confirm this relocation looks reasonable, not just functional
  - All view: confirm no visual or behavioral change post-refactor (drag, edit, complete, delete, priority-toggle all still work)
- `backend/tests/test_api.py` — unaffected (no backend changes)

## Deployment Order

Single component (frontend only). No backend changes, no mobile changes. `[skip deploy]` not applicable to the deploy-trigger rule in the literal sense since these are `frontend/` files (not `backend/app/`), so per `CLAUDE.md` this does not trigger a Railway deploy regardless — still tag commits `[skip deploy]` per existing convention for non-`backend/app/` changes.

## Mobile follow-up (not part of this PR)

**Correction (2026-07-04, post-merge):** the paragraph originally here claimed mobile was unaffected because "`FocusedTaskCard.tsx` doesn't exist yet" — that was **wrong**. Dopey's code review of this PR (#45) caught it: `mobile/src/components/FocusedTaskCard.tsx` already shipped in production via `PLAN-feat-focused-view-mobile.md`, with the identical missing Links/Complete/Delete gap this PR fixes on web. Dopey also found `mobile/src/screens/TaskFormScreen.tsx:165,174` has the exact same notes-dropping bug (`if (notes.trim()) body.notes = notes.trim();`, in both the create and edit branches) — a live, currently-shipped data-loss bug this web PR does not fix.

Both are now folded into `PLAN-feat-tasks-view-redesign-mobile.md` (see its "Folding in PR #45" section) rather than tracked here, since that plan hasn't started implementation yet and already touches both files.

## PR Structure

Single PR, frontend only.

---

## Sneezy's Review — 2026-07-04

**Tier:** LIGHT — no proposed file falls under a model/schema/router/API area; all changes are in `frontend/src/components/`, plan declares "Data / API Changes: None," and deployment is single-component (frontend only). Confirmed by inspection: none of the four files to modify touch routing, data model, or API contracts. Not escalated.

**Verdict:** Approved with concerns

### Issues

1. **[Gap]** `TaskCardBodyProps` interface (plan lines 43–53) is internally inconsistent with its own prose (line 55). The interface has no prop for label rendering — the only data prop is `task: Task` — yet the prose says "labels ... kept as caller-supplied render props to avoid forcing a visual change neither view asked for." As written, a `task`-only prop means `TaskCardBody` would read `task.labels` itself and render it with one fixed style, which is exactly the forced visual change the prose says it's avoiding. Verified the two current implementations really do diverge here: `TaskCard.tsx:25-26` sorts labels by `LABEL_CATEGORY_ORDER` (mode before type) and renders via `<LabelBadge small />` (`bg-green-100 text-green-800` / `bg-purple-100 text-purple-800`, `LabelBadge.tsx:3-6`); `FocusedTaskCard.tsx:7-10,64-75` renders `task.labels` unsorted via inline `LABEL_COLORS` (`bg-green-100 text-green-700` / `bg-purple-100 text-purple-700` — a different shade, no `LabelBadge` reuse). The plan needs an explicit prop (e.g. `renderLabels: (labels) => ReactNode`, or a `labels`-already-sorted array + a style-variant flag) before this is implementable as described.

2. **[Gap]** The `priorityBadge: 'toggle' | 'static'` prop (plan line 48) captures the interactivity/text difference ("★ High" vs clickable flag) but not the layout difference between the two cards. In `TaskCard.tsx:78-85` the priority badge sits inline in the same flex row as the title (`<div className="flex items-center gap-1.5 flex-wrap">{badge}{title}</div>`). In `FocusedTaskCard.tsx:34-52` the badge sits in its own top row alongside the Edit button, with the title in a separate `<p>` below (`line-clamp-2`, `mb-2`). A single shared `TaskCardBody` render tree, driven only by the `priorityBadge` variant, will not reproduce both layouts without additional structural branching that isn't described. Either this is silently going to change one view's layout (contradicting "No behavior change intended for `TaskCard.tsx`'s All-view rendering," plan line 60) or the plan needs to spell out that `TaskCardBody` branches on layout position too, not just badge content/interactivity.

3. **[Gap]** Related to #2: `FocusedTaskCard.tsx`'s Edit button today lives at the top of the card next to the priority badge (line 40-48), unconditional. `TaskCard.tsx`'s Edit button lives in a bottom-right action row together with Complete/Delete/priority-toggle (lines 140-148), gated by `task.state === 'pending'` (line 123). The plan says `TaskCardBody` renders "the Edit/Complete/Delete (+ optional priority-toggle) button row" as one unit (line 55) — implying Edit moves from its current top-right spot in Focused view down into a bottom action row to sit with the new Complete/Delete buttons. That's a real, visible relocation of an existing control that the plan doesn't call out anywhere as a UI change for `FocusedTaskCard.tsx` (it only lists Links/Complete/Delete as gains, line 60). Worth an explicit line so a reviewer isn't surprised by the diff.

4. **[Risk, verified benign]** The `task.state === 'pending'` gate on `TaskCard.tsx:123` that hides the whole action row for non-pending tasks is not mentioned anywhere in the plan, and if `TaskCardBody` inherits it wholesale (per #3, likely), `FocusedTaskCard.tsx` would newly lose Edit access for any non-pending task. Checked `backend/app/services/focused_view_service.py:124` — `get_boards_with_tasks` (used by both Focused and Day view, `backend/app/routers/day_view.py:9` imports the same service) filters `Task.state == StateEnum.pending` before returning tasks, so in practice `FocusedTaskCard` only ever renders pending tasks today and will continue to. This makes the gate harmless now, but it's an undocumented coupling: if the focused/day-view query is ever loosened to include other states, the shared component silently drops Edit for those cards. Worth one sentence in the plan noting this dependency exists.

5. **[Nit]** Title styling differs (`TaskCard.tsx:84`: `text-sm font-medium` no clamp; `FocusedTaskCard.tsx:50-52`: adds `line-clamp-2 leading-snug mb-2`) and isn't parameterized in the prop interface. Low risk since it's a single className, but combined with #1/#2 it's another place where "shared render, no visual change" doesn't automatically hold without deciding which style wins or adding a variant.

### Unverified assumptions

- Plan line 22-24 backend semantics claim ("field absent in body → leave unchanged," citing `task_service.py:151-152`) — confirmed accurate. `update_task_fields` at line 151-152: `if notes is not None: task.notes = notes`. `TaskUpdate` schema (`backend/app/schemas.py:117-125`) has `notes: Optional[str] = None`, and frontend `UpdateTaskBody.notes` (`frontend/src/api/tasks.ts:45`) is `notes?: string` (optional, not nullable) — matches the plan's claim that no `clear_notes` flag is needed and empty string sent explicitly clears it server-side. Confirmed.
- Plan line 26 ("Non-empty-to-non-empty edits are not affected... if a different persistence path is still broken, it needs separate repro, not found in this pass") — verified there is in fact only one code path in the frontend that ever constructs a `notes` field for create/update: `TaskForm.tsx` (lines 43, 157, 199). `TaskQuickEdit.tsx` (the other task-editing surface, used inline from both card types) has no `notes` field at all — it only edits title/labels. So the plan's claim that this is the sole notes-dropping path is correct; no other path found in this pass either.
- Plan line 36 ("Confirmed both have full `Task` objects on hand already... `FocusedBoard.tasks: Task[]` includes `links`, `state`, everything `TaskCard` uses") — confirmed. `frontend/src/api/focusedView.ts:4-9` types `FocusedBoard.tasks` as `Task[]`; backend `TaskOut` (`backend/app/schemas.py:135-150`) includes `state`, `links`, `labels`, `is_high_priority`, etc. No new prop plumbing needed, matches plan.
- Plan line 36 ("both already receive `onRefresh` from their parent") — confirmed: `BoardGroupedTasks.tsx:26` passes `onRefresh={onRefresh}` to `FocusedTaskCard`, threaded from `FocusedView.tsx:62` (`onRefresh={load}`) and `DayView.tsx:62` (same pattern). Matches.
- Test Plan claim (line 77) that no existing unit tests target `TaskForm.tsx`, `TaskCard.tsx`, or `FocusedTaskCard.tsx` — confirmed by grep across `frontend/src/__tests__/` and the whole `frontend/src` tree for any `.test.ts(x)`/`.spec.ts(x)` file referencing these three components: none found. All 8 existing test files target `src/utils/` or `src/api/` pure modules. Claim holds.
- `TasksPage.tsx` `onTogglePriority` threading (line 36 of plan, implicitly) — confirmed at `TasksPage.tsx:386-387,421-422` (`onTogglePriority={isHighPriorityEligible(col.key) ? () => handleTogglePriority(...) : undefined}`) vs. `TasksPage.tsx:472` (no `onTogglePriority` passed, i.e. `undefined`) — consistent with `TaskCard`'s already-optional prop; no change needed here, plan doesn't claim otherwise.

### Suggestions

- Before implementation, rewrite the `TaskCardBodyProps` interface to include an explicit label-rendering prop (render-prop or pre-sorted array + style variant) so issue #1 doesn't get resolved ad hoc mid-PR.
- Add one sentence to the "Fix — Card parity" section explicitly acknowledging that `FocusedTaskCard.tsx`'s Edit button moves from its current top-of-card position into the shared bottom action row (issues #2/#3), so the PR diff isn't a surprise relative to "gains Links/Complete/Delete" framing.
- Optionally note the `task.state === 'pending'` → focused/day-view-only-returns-pending coupling (issue #4) as a one-line comment in `TaskCardBody.tsx` itself, so a future change to the focused/day-view query doesn't silently regress Edit availability without someone noticing the connection.

— *Sneezy*

---

## Grumpy's Response to Sneezy's Review

| Sneezy item | Status |
|---|---|
| Gap 1 (labels not parameterized, contradicts own prose) | Addressed — added `renderLabels: (labels) => React.ReactNode` render-prop; each caller keeps its exact current sort order and style |
| Gap 2 (layout/position difference not captured) | Addressed — added `layout: 'inline' \| 'stacked'` prop; title styling and top-of-card arrangement now branch on it |
| Gap 3 (Edit button relocation undocumented) | Addressed — plan now states explicitly that `FocusedTaskCard`'s Edit button moves into the shared bottom action row; added a Test Plan bullet to verify it visually |
| Risk 4 (pending-state gate coupling, verified benign) | Addressed — `TaskCardBody.tsx` will carry a one-line comment noting Focused/Today/Tomorrow's backend queries currently only return pending tasks, so the inherited gate is presently redundant there but must be revisited if that changes |
| Nit 5 (title styling not parameterized) | Addressed — folded into the `layout` prop (see Gap 2 resolution) |

Implementation proceeds on this updated plan.
