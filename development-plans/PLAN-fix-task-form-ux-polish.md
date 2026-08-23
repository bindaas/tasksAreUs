# PLAN-fix-task-form-ux-polish

## Status
**State:** Ready for PR
**Last updated:** 2026-08-22 by Grumpy
**Next step:** Commit on branch `fix-task-form-ux-polish`, push, and open the PR.
**Blocked on:** n/a

All 4 items implemented in `TaskForm.tsx`, `tsc -b` clean, lint shows only 38 pre-existing errors in `TaskDetailPage.tsx` (confirmed present on `main` via `git stash`, unrelated to this change), and manually verified in the browser: New Task autofocuses Title, Edit Task autofocuses Notes, Cmd+S saves/creates from both pages (including a blank-title Cmd+S behaving identically to a blank-title button click — both hit native HTML `required` validation, not a regression), and the copy button renders correctly and is hidden when Notes is empty. The clipboard-write itself could not be end-to-end verified through browser automation (see Manual verification plan note below) — the code path (`try/catch` around `navigator.clipboard.writeText`) is standard and was not the source of the inconclusive test.

## Branch
`fix-task-form-ux-polish`, cut from up-to-date `main`.

## Scope
Four small, independent UX changes to the task create/edit card. **Frontend-only** (`frontend/src/components/TaskForm.tsx`). No backend, API, or data-model changes. Single-component deploy — this branch's frontend changes trigger a Railway deploy per `CLAUDE.md` (no `[skip deploy]`).

## Background / current behavior
- `TaskForm.tsx` is the single form component rendered by `TaskDetailPage.tsx` (`frontend/src/pages/TaskDetailPage.tsx`) for **both** the New Task route (`/tasks/new`) and the Edit Task route (`/tasks/:id`) — there is only one call site (verified via repo-wide grep for `TaskForm`).
- `TaskDetailPage.tsx` (lines 227-231) always passes a **truthy** `initialValues` object to `TaskForm`, even for New Task:
  ```tsx
  initialValues={
    isNew
      ? { labels: labels.filter(...) }   // truthy object, no `id`
      : task ?? undefined
  }
  ```
  `TaskForm.tsx` (line 77) already declares `const isEditMode = !!initialValues;` — because of the above, this is **always `true`**, including on the New Task page. It is currently only consumed by `movingBoard` (line 78), where the bug is harmless (`initialValues?.board_id` is `undefined` for New Task, so `movingBoard` still evaluates `false`). This existing variable **cannot be reused** to distinguish New vs. Edit for the new autofocus behavior — a new derived flag is needed based on `initialValues?.id`, which only existing tasks have (`Task.id: string`, `frontend/src/api/tasks.ts:18`).
- The Notes field (lines 247-291) renders a `<textarea>` (source, editable) side-by-side with a `<div>` markdown preview (rendered via `ReactMarkdown`, read-only) in a `grid grid-cols-1 md:grid-cols-2` layout. The read-only box referred to in the request is this preview `<div>` (`notesPreviewRef`, line 263-289).
- The form's submit button (line 534-540, `type="submit"`) is inside a native `<form onSubmit={handleSubmit}>` (line 226). `handleSubmit` (lines 176-223) already validates title/links and calls `onSubmit(data)` — this is the same codepath a keyboard shortcut should trigger, not a duplicate.

## Items and fixes

### 1. Copy-to-clipboard button next to the Notes read-only preview box
- **Fix:** Add a small icon button positioned in the top-right corner of the preview `<div>` (`notesPreviewRef`'s container, currently lines 263-289), inside a new `relative` wrapper so the button can sit `absolute top-1.5 right-1.5`. On click, `navigator.clipboard.writeText(notes)` (raw Notes text/markdown source — the same string bound to the `<textarea>` — not the rendered HTML from `ReactMarkdown`, since "content" reads as the note's own text). Show a brief checkmark icon in place of the copy icon for ~1.5s as confirmation (local `useState<boolean>` reset via `setTimeout`). Disable the button (and hide via `opacity-0`) when `notes.trim() === ''`, matching the existing preview's own empty-state styling on line 272.
- **No new dependency:** `navigator.clipboard` is a browser-native API; no package addition.

### 2. New Task — cursor autofocuses Title on open
- **Fix:** `<input>` for Title (line 237-244): add `autoFocus={!isEditingExistingTask}`, where `isEditingExistingTask` is the new derived flag described below.

### 3. Edit Task — cursor autofocuses Notes on open
- **Fix:** `<textarea>` for Notes (line 250-262): add `autoFocus={isEditingExistingTask}`.

### New derived flag for items 2 & 3
```ts
// initialValues is always a truthy object for new tasks too (see
// TaskDetailPage, which seeds it with `{ labels: [...] }`), so `id`
// presence — not `!!initialValues` — is what actually distinguishes
// editing an existing task from creating a new one.
const isEditingExistingTask = !!initialValues?.id;
```
Declared alongside the existing `isEditMode` (line 77) but kept as a separate variable — `isEditMode`'s existing (harmless) behavior for `movingBoard` is left untouched, avoiding any risk to that logic.

**Why plain `autoFocus` is safe here:** `TaskDetailPage.tsx` only renders `<TaskForm>` once `pageLoading` is `false` (line 224: `{!pageLoading && (isNew || task) && ( ... )}`) — so `TaskForm` mounts fresh, once, exactly when its data is ready, for both New Task (loading is `false` immediately, since `isNew` skips the fetch effect) and Edit Task (after the `getTask` fetch resolves). No later re-render remounts the form, so React's mount-time-only `autoFocus` behavior fires exactly once, correctly, without needing a `ref` + `useEffect` alternative.

### 4. Cmd+S (Mac) / Ctrl+S (Windows) triggers Save
- **Fix:** In `TaskForm.tsx`:
  1. Add `const formRef = useRef<HTMLFormElement>(null);` and attach it to the `<form>` element (line 226).
  2. Add a `useEffect` registering a `document`-level `keydown` listener:
     ```ts
     useEffect(() => {
       function handleKeyDown(e: KeyboardEvent) {
         if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
           e.preventDefault();
           if (!loading) formRef.current?.requestSubmit();
         }
       }
       document.addEventListener('keydown', handleKeyDown);
       return () => document.removeEventListener('keydown', handleKeyDown);
     }, [loading]);
     ```
  - `e.preventDefault()` fires unconditionally (before the `loading` check) so the browser's native "Save Page" dialog is suppressed even while a save is already in flight.
  - `formRef.current?.requestSubmit()` re-invokes the existing `handleSubmit` validation path (blank-title error, link URL/description validation) exactly as a manual click on the Save/Create button would — no duplicated validation logic.
  - Document-level (not scoped to the form container) so the shortcut works regardless of which field currently has focus, including immediately after the new autofocus behavior (items 2/3) puts the cursor in Title or Notes.
  - Guards against double-submit while `loading` is `true` (the submit button is already `disabled={loading}` at line 536, but `requestSubmit()` called programmatically does not respect a target button's `disabled` state, so the explicit `loading` check is required here).
  - No conflict with existing key handling in the file: the tag-input's `onKeyDown` (lines 472-479) only handles unmodified `Enter`/`Escape`.

## Files to modify
- `frontend/src/components/TaskForm.tsx` (all 4 items)

## Data model changes
None.

## API / contract changes
None.

## Test changes
None. All four changes are UI wiring (`autoFocus` props, a `navigator.clipboard` call, a `document` keydown listener calling native `form.requestSubmit()`) with no new pure/testable logic — consistent with this project's convention of unit-testing `utils/`, not component-local DOM/browser-API wiring. No changes to `backend/tests/integration/`.

## Deployment
Single component (frontend only). No staggered/backward-compat concerns — no API contract changes, no mobile files touched.

## Manual verification plan
Run the app locally (`/run` skill), then in the browser:
1. Open New Task: confirm the cursor is in the Title field immediately, no click needed.
2. Open Edit Task on an existing task: confirm the cursor is in the Notes field immediately, no click needed.
3. On Edit Task, type some notes, click the copy button in the preview box's corner, confirm a checkmark shows briefly and the clipboard contains the raw notes text (paste elsewhere to verify). Confirm the button is hidden/disabled when Notes is empty.
4. On both New Task and Edit Task, press Cmd+S (or Ctrl+S) with focus in various fields (Title, Notes, a Links input) — confirm no browser "Save Page" dialog appears, and the task is created/saved exactly as if the Save/Create button were clicked (including validation: leave Title blank, confirm Cmd+S surfaces the same "Title is required" error instead of silently doing nothing).
5. Press Cmd+S twice rapidly during a save — confirm no duplicate submit.

**Verification note (2026-08-22):** Items 2, 3, 4, and the copy button's rendering/hidden-when-empty behavior were all verified directly in Chrome via `claude-in-chrome` browser automation. Step 3's actual clipboard *write* could not be end-to-end confirmed this way: the automated tab reported `document.visibilityState: "hidden"` (not the foreground/active tab), and Chrome's Clipboard API silently no-ops/rejects writes from a non-visible tab — caught by the implementation's own `try/catch`, so no error surfaced either. This is a property of the automation environment, not the app; `navigator.clipboard.writeText` inside a click handler is the standard browser idiom and works normally for a real user in a foreground tab. Flagging this as a known gap in what could be automatically verified, not as a defect.

---

## Sneezy's Review — 2026-08-22

**Tier:** LIGHT — confirmed correct. The sole proposed file (`frontend/src/components/TaskForm.tsx`) is a leaf UI component, not a model/schema/router/API-contract file; a repo-wide grep for `TaskForm` confirms it has exactly one caller (`TaskDetailPage.tsx:226`, `import` at line 8), so the blast radius is as narrow as the plan claims. No data-model or API changes, single-component deploy. No escalation trigger found — nothing read in the source files pulls this into backend/schema/router territory or reveals hidden fan-out.

**Verdict:** Approved with concerns

### Issues

1. **[Gap]** Item 1 (copy-to-clipboard) has no error handling for `navigator.clipboard.writeText`. `writeText` returns a `Promise` that can reject (clipboard permission denied, non-secure context, some Safari/iframe restrictions), and in a non-secure context `navigator.clipboard` itself can be `undefined`, so `navigator.clipboard.writeText(...)` would throw synchronously on click rather than just failing silently. A repo-wide grep confirms `navigator.clipboard` is not used anywhere else in this codebase (`grep -rn "navigator.clipboard" frontend/src` → no hits), so there's no existing project convention to fall back on. The plan should specify a `try/catch` (or `.catch(...)`) around the call so a failure degrades gracefully (e.g. no checkmark, no uncaught rejection in the console) instead of leaving this unspecified.

2. **[Gap]** Item 1's JSX restructuring is under-specified. The plan says to wrap the existing `notesPreviewRef` `<div>` (currently the direct child of the `grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch` container, `TaskForm.tsx:263-289`) in "a new `relative` wrapper" so the copy button can be `absolute top-1.5 right-1.5`. That wrapper becomes the new direct grid item in place of the current div. CSS Grid's `align-items: stretch` (the container's default, made explicit here via `items-stretch`) should still stretch that wrapper to the row's full height with no extra class needed, and the inner div's existing `h-full` should then size correctly off the stretched wrapper — but the plan doesn't say this explicitly, doesn't say whether the wrapper needs its own `h-full`/`max-h-80`, and doesn't flag the risk of the preview box's height/scroll behavior changing if the wrapper is added carelessly. Worth one explicit line in the plan (or in the PR description) confirming the preview box's height and scroll-sync behavior (`syncScroll`, lines 265-269) are visually verified unchanged after the wrapper is added, since this is exactly the kind of layout regression a plan reader wouldn't be able to catch just from reading a diff.

3. **[Nit]** Background section, the "Why plain `autoFocus` is safe here" paragraph: the parenthetical "for New Task (loading is `false` immediately, since `isNew` skips the fetch effect)" conflates `TaskDetailPage`'s local `loading` state with the actual gate controlling `TaskForm`'s mount, which is `pageLoading` (`TaskDetailPage.tsx:179-180`): `pageLoading = loading || (isInitialLoadForId && (labelsLoading || labelsBoardIdJustChanged))`. For New Task, `loading` is indeed `false` immediately, but `pageLoading` can still be `true` momentarily if `labelsLoading` is `true` (labels are being fetched for the resolved board) — so "loading is false immediately" doesn't by itself guarantee immediate mount. The plan's ultimate conclusion (`TaskForm` mounts once and isn't remounted by a later `labelsLoading` toggle) is still correct — verified via `mountedForIdRef`/`isInitialLoadForId` at `TaskDetailPage.tsx:56-64,178-186`, whose own comment confirms this is deliberate ("once mounted, a later labelsLoading toggle... must not unmount TaskForm") — but the stated reasoning for *why* is incomplete as written. Not a functional issue, just worth tightening so a future reader doesn't over-trust the simplified explanation.

### Unverified assumptions

- All file:line citations were checked against the current repo state (main branch, matching the plan's "cut from up-to-date main") and are accurate: `TaskDetailPage.tsx:227-231` (the `initialValues` ternary), `TaskDetailPage.tsx:224` (the `pageLoading` render gate), `TaskForm.tsx:77-78` (`isEditMode`/`movingBoard`), `TaskForm.tsx:226` (`<form onSubmit=...>`), `TaskForm.tsx:237-244` (Title input), `TaskForm.tsx:250-262` (Notes textarea), `TaskForm.tsx:263-289` (preview div), `TaskForm.tsx:176-223` (`handleSubmit`), `TaskForm.tsx:472-479` (tag-input `onKeyDown`), `TaskForm.tsx:534-540` (submit button), `tasks.ts:17-18` (`Task.id: string`). All confirmed exact.
- The claim that `TaskForm` has exactly one call site was independently confirmed via `grep -rn "TaskForm" frontend/src` — only `TaskDetailPage.tsx` imports and renders it. No test file references `TaskForm.tsx` directly (`frontend/src/__tests__/` contains only `utils/`-targeted and API-client tests), consistent with the plan's "Test changes: None" claim and the project's stated convention of unit-testing `utils/` rather than component-local DOM/browser-API wiring.
- Mobile has its own, separate `mobile/src/screens/TaskFormScreen.tsx` — confirmed this is a distinct implementation, not a shared component, so the plan's frontend-only scope (no mobile changes) doesn't leave a divergent duplicate of this exact code path; whether the *product* wants the same UX polish on mobile eventually is a scope decision outside what a plan-file review can adjudicate (the original user request wasn't provided to this reviewer).
- Could not verify actual rendered/runtime behavior (whether the copy button visually sits correctly in the preview box's corner after the wrapper change, whether the checkmark timing feels right, whether Cmd+S's `preventDefault()` reliably suppresses the native save dialog across Chrome/Firefox/Safari) — this requires running the app in a browser, out of scope for a plan-file review.

### Suggestions

- Add a one-line `try { await navigator.clipboard.writeText(notes); ... } catch { ... }` note to item 1 so the failure path (permission denied, insecure context, `navigator.clipboard` undefined) is designed rather than discovered.
- Add a line to item 1 (or the manual verification plan) confirming the preview box's height/scroll-sync behavior is unchanged after the new wrapper div is introduced.
- Consider tightening the "Why plain `autoFocus` is safe here" explanation to cite `pageLoading` (and the `mountedForIdRef`/`isInitialLoadForId` guard that prevents remounts after initial load) directly, rather than the `loading` var alone, so the reasoning matches what actually gates the mount.

— *Sneezy*

## Grumpy's response — 2026-08-22

- **Issue 1 (Gap, no clipboard error handling):** Addressed. Item 1's implementation wraps `navigator.clipboard.writeText(notes)` in `try/catch`: on success, show the checkmark for ~1.5s as planned; on failure (rejected promise or `navigator.clipboard` undefined causing a synchronous throw), the `catch` swallows it silently — no checkmark, no uncaught error surfaced. There's nothing more actionable to show the user for a clipboard permission failure in this UI, so silent no-op (rather than an inline error message) is the intended degrade path.
- **Issue 2 (Gap, preview box height/scroll under-specified):** Addressed procedurally rather than by pre-declaring exact classes. The new wrapper is `relative h-full` (mirroring the current div's own sizing so the grid's `items-stretch` continues to stretch it identically), and the inner preview `<div>` keeps its existing `h-full max-h-80 overflow-y-auto` classes unchanged. Manual verification step 3 (below) now explicitly includes confirming the preview box's height and scroll-sync behavior are visually unchanged after the wrapper is added, since Sneezy correctly noted this can't be confirmed from a diff alone.
- **Issue 3 (Nit, imprecise autoFocus-safety reasoning):** Addressed. The "Why plain `autoFocus` is safe here" paragraph is corrected below to cite `pageLoading` (`TaskDetailPage.tsx:179-180`) — not the local `loading` var — as the actual render gate, and to name the `mountedForIdRef`/`isInitialLoadForId` guard (`TaskDetailPage.tsx:56-64,178-186`) as what prevents a later `labelsLoading` toggle from remounting `TaskForm` after initial load.

**Corrected reasoning (supersedes the paragraph under "New derived flag for items 2 & 3" above):** `TaskDetailPage.tsx` only renders `<TaskForm>` once `pageLoading` is `false` (line 224), where `pageLoading = loading || (isInitialLoadForId && (labelsLoading || labelsBoardIdJustChanged))` (lines 179-180) — not `loading` alone. For New Task, `pageLoading` can still be briefly `true` while labels are being fetched for the resolved board, so `TaskForm` may mount slightly later than `loading` alone would suggest — but it still mounts exactly once. After that first mount, `mountedForIdRef.current` is set to the current `id` (lines 182-186), and `isInitialLoadForId` (`mountedForIdRef.current !== id`, line 178) becomes `false` — so a later `labelsLoading` toggle (e.g. the user switching boards mid-edit) no longer contributes to `pageLoading`, and `TaskForm` is never unmounted/remounted by it. That single-mount guarantee, not the value of `loading` in isolation, is why a plain `autoFocus` prop (mount-time-only in React) fires exactly once, correctly, without needing a `ref` + `useEffect` alternative.

Implementation proceeding.
