# Plan: Fix Edit Task form — board dropdown reset & stuck "Saving…" button

**Branch:** `fix/edit-task-dropdown-and-saving-bug`
**Status:** Awaiting user approval to proceed

## User report

From the WebUI (mobile app unaffected):
1. Go to All view → edit a task currently on Board A. The Board dropdown shows A, as expected.
2. Pick Board B from the dropdown. Immediately (before clicking Save), the dropdown reverts to showing A.
3. Separately: after any successful edit, "Save Changes" flips to "Saving…" and stays disabled forever, even though the save succeeded (a "Task saved successfully" banner does flash and disappear, and the change is actually persisted).

## Root cause — Bug A (dropdown reverts to A)

`TaskForm` is an uncontrolled component: its `boardId` (and title/notes/dates/labels) live in local `useState`, initialized once from the `initialValues` prop.

Labels are board-scoped, so `TaskForm` reports every board change up to the parent via `onBoardIdChange` (`TaskForm.tsx:70-71`) so `TaskDetailPage` can re-scope `useLabels()` to the newly picked board. That refetch sets `labelsLoading = true` for its duration.

`TaskDetailPage.tsx:139` computes:
```ts
const pageLoading = loading || labelsLoading;
```
and line 183 uses it to gate whether `<TaskForm>` renders at all:
```tsx
{!pageLoading && (isNew || task) && ( ... <TaskForm ... /> ... )}
```
So switching the board **unmounts** `TaskForm` while the new board's labels load, then remounts it once they arrive. On remount, `TaskForm` re-initializes all of its local state from `initialValues={task}` (line 186-190) — but `task` is still the original, unsaved task object (board A), since nothing has been saved yet. The remount silently discards the in-progress board selection (and would discard any other in-progress edits — title, notes, dates — the same way, though the user only noticed the dropdown).

## Root cause — Bug B (stuck "Saving…")

`handleSubmit` (`TaskDetailPage.tsx:95-112`):
```ts
async function handleSubmit(data) {
  setSaving(true);
  setError(null);
  setSuccess(false);
  try {
    if (isNew) {
      await createTask(data as CreateTaskBody);
      navigate(-1);
    } else {
      const updatedTask = await updateTask(id!, data as UpdateTaskBody);
      setTask(updatedTask);
      setSuccess(true);
      // missing: setSaving(false)
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to save task');
    setSaving(false);
  }
}
```
The edit-mode success path never resets `saving` back to `false` — only the `catch` block does. The `isNew` branch doesn't need it (it navigates away), but the edit branch stays on the page, so the button is left permanently disabled/"Saving…" after every successful save.

## Fix

**Bug B:** Add `setSaving(false);` immediately after `setSuccess(true);` in the edit branch.

**Bug A:** Stop unmounting `<TaskForm>` for a board-switch-triggered labels reload — only the very first load (task + labels for the initial board) should show the full-page spinner in place of the form. Once the form has mounted once, subsequent label reloads (from the user picking a different board) should leave the form mounted and untouched, with a small inline "Loading labels…" message shown in place of the label buttons in the Labels section, per user's confirmed UX preference (rest of the form — title, notes, dates, board dropdown — stays exactly as the user left it; the existing "Moving to a different board will clear this task's labels" behavior is unchanged).

Implementation approach:
- `TaskDetailPage.tsx`: track whether the form has completed its first mount for the *current* `id` (a ref storing the `id` it last mounted for, reset alongside the existing `id`-keyed fetch effect at line 44 — not a bare boolean), and only include `labelsLoading` in the render-gating condition before that point for this `id`. After first mount, `<TaskForm>` always renders once `task` (or `isNew`) is available, regardless of `labelsLoading`. Keying the tracking off `id` (rather than a plain boolean) means a future same-instance task-to-task navigation would still correctly show the full-page spinner for the new task's initial load, instead of silently relying on today's routing (which always unmounts the page between tasks) to make that edge case unreachable.
- Pass `labelsLoading` down to `TaskForm` as a new prop.
- `TaskForm.tsx`: in the Labels section, render "Loading labels…" in place of the category/label buttons while `labelsLoading` is true; otherwise render as today.

## Files to modify

- `frontend/src/pages/TaskDetailPage.tsx` — render-gating logic (Bug A) + `setSaving(false)` (Bug B)
- `frontend/src/components/TaskForm.tsx` — accept `labelsLoading` prop, inline loading state for Labels section

## Data model changes

None.

## API / contract changes

None — purely frontend state/render logic.

## Test plan

- No backend change, so no `test_api.py` changes needed (owned by `/test-review`, out of scope here).
- This project's frontend Vitest suite (`frontend/src/__tests__/`) targets pure utility functions in `frontend/src/utils/`; this fix is component state/render behavior, not a pure utility, so it doesn't have a natural automated-test home under current conventions. **Known coverage hole:** this leaves the "remount wipes in-progress form state" bug class without a regression guard — a future refactor could reintroduce it silently. Verification will be manual in the browser for now:
  1. Edit a task on Board A, switch dropdown to Board B — confirm dropdown stays on B and "Loading labels…" appears briefly, then B's labels appear.
  2. Confirm other in-progress fields (title/notes/dates) survive a board switch.
  3. Save an edit — confirm "Save Changes" returns to its normal (enabled, non-"Saving…") state after the success banner appears, and remains clickable for a subsequent edit.
  4. Repeat for the "New Task" flow (`isNew`) to confirm no regression there, since it shares the same `TaskForm`/`useLabels` wiring.

## Deployment order

Single component — frontend only. Standard Railway deploy on merge (no `[skip deploy]`).

---

## Sneezy's Review — 2026-07-12

**Tier:** LIGHT — proposed files (`TaskDetailPage.tsx`, `TaskForm.tsx`) are neither model/schema/router/API-contract areas, the plan declares no data-model/API impact, and deployment is single-component. Confirmed correct on inspection; no escalation needed.

**Verdict:** Approved with concerns

### Issues

1. **[Risk]** `TaskDetailPage.tsx:44-69` — the effect that resets `liveBoardId` and refetches on `id` change does **not** reset `task` to `null` before the new fetch starts (no `setTask(null)` before `getTask(id!)`). The plan's proposed "has the form mounted once" ref (Fix, Bug A) is a single ref with no dependency on `id`. If a future navigation path ever moves between two different task-edit sessions without unmounting `TaskDetailPage` (current app only reaches `/tasks/:id` via list/card clicks that unmount the page first, per `TaskCard.tsx:57` and `FocusedTaskCard.tsx:40`, so this is not reachable today), the ref would stay `true` across the `id` change and the render gate would stop hiding the form during the new task's *initial* label load — the "Loading labels…" placeholder would show correctly, but the transition would skip the full-page spinner for the brand-new task, which the plan doesn't describe as intended for that case. Low likelihood given current routing, but the plan should note the ref is scoped to the component instance, not to `id`, so this doesn't quietly become a bug if a "next/prev task" navigation feature is added later.
2. **[Gap]** No automated regression test is proposed for either bug, and none is required by current convention (Vitest suite only covers pure utilities per `CLAUDE.md`). That convention gap is pre-existing and not this plan's fault, but this specific bug class (remount-wipes-in-progress-state) is exactly the kind of thing that regresses silently under a future refactor with no test to catch it. Worth a one-line callout that this is a known coverage hole, not just "no natural test home."
3. **[Nit]** The plan's implementation sketch ("a ref set once `!pageLoading` is first true") doesn't specify exactly when the ref flips to `true` relative to the render that first shows the form — i.e. whether the flag-flip and the gate-relaxation land in the same render or one render apart. Both are actually fine here (the old gate is correct for that first transition either way), but it's worth being explicit in the implementation to avoid an off-by-one-render flash.

### Unverified assumptions

- The plan's line citations were checked against the current files and are accurate: `TaskDetailPage.tsx:139` (`pageLoading` computation), `:183` (render gate), `:186-190` (`initialValues` prop), `:95-112` (`handleSubmit`, including the missing `setSaving(false)` on the edit success path) all match verbatim or near-verbatim. `TaskForm.tsx:69-71` (the `onBoardIdChange` effect, cited as 70-71) also matches.
- Confirmed via `frontend/src/hooks/useLabels.ts:14-38` that `loading` is set `true`/`false` around every fetch triggered by a `boardId` change (not just the initial fetch) — this is the mechanism the plan relies on for "switching the board unmounts `TaskForm`," and it holds up.
- Confirmed `TaskForm` has exactly one consumer (`TaskDetailPage.tsx`) via a repo-wide grep — the plan's "Files to modify" list is complete; no other component needs updating for the new `labelsLoading` prop.
- Confirmed the existing "Moving to a different board will clear this task's labels" behavior (`TaskForm.tsx:76-83`, `prevBoardIdRef`) is independent of the parent's mount/unmount gating and will continue to fire correctly once the form stops unmounting — the plan's claim that this behavior is unchanged holds up.
- Not independently verified: that the isNew ("New Task") flow suffers from the identical bug (losing title/notes on a board switch mid-creation) prior to this fix. The plan's root-cause section describes the mechanism generically enough that it should apply equally to `isNew`, and the test plan (item 4) implicitly relies on this, but the plan never states outright that Bug A also affects new-task creation today — only that the fix must not regress it. Worth confirming during manual testing that the "before" state on `isNew` was actually broken the same way, not just checking "no regression" after the fix.

### Suggestions

- Consider having the "has mounted once" tracking key off `id` (e.g. store the id alongside the boolean, or reset the ref inside the existing `id`-keyed effect at `TaskDetailPage.tsx:44`) so the fix is inherently safe against a future same-instance task-to-task navigation, rather than relying on today's routing behavior to make the edge case unreachable.
- Given the coverage hole noted in Issue 2, a small React Testing Library test asserting that `TaskForm`'s title/board-select value survives a `labelsLoading` toggle (mocking `useLabels`) would meaningfully guard this specific regression class going forward, even though it falls outside the current "pure utilities only" Vitest convention.

— *Sneezy*

## Response to Sneezy's Review

1. **[Risk] Ref not scoped to `id`** — Addressed. The "Fix" section above now specifies keying the mounted-tracking to the current `id` (reset alongside the existing `id`-keyed fetch effect), per Sneezy's suggestion, closing the edge case outright rather than relying on today's routing to make it unreachable.
2. **[Gap] No automated regression test** — Partially addressed. Added an explicit "known coverage hole" callout to the Test plan. Not adding an automated React Testing Library test in this pass, since it would deviate from this project's stated Vitest convention (pure utilities only, per `CLAUDE.md`) — flagging this as a call for the user rather than deciding it unilaterally.
3. **[Nit] Off-by-one-render ambiguity** — Addressed at the prose level (see updated Fix section: the tracking ref is set alongside the existing `id`-keyed effect, not derived from a render timing check). Exact placement will be pinned down during implementation.
4. **Unverified: does `isNew` already have this bug today** — Will confirm during manual testing (test plan item 4) before/after the fix, not just "no regression after."
