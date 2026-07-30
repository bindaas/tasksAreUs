# PLAN-feat-inline-tag-add

## Scope

Four small UX changes to the Tags section of the Edit/Add Task form (`TaskForm.tsx`):

1. Remove the redundant "Labels" text sitting above the "Tags" section header.
2. Fix the "Tags" sub-header casing — it currently renders as "TAGS" via a Tailwind `uppercase` class; change it to display as "Tags".
3. Sort tag chips alphabetically by value instead of insertion/API order.
4. Add the ability to create a new tag inline from the Edit/Add Task form, instead of requiring a trip to Settings.

## Current state

- `frontend/src/components/TaskForm.tsx` renders a "Labels" `<label>` (line 349), then loops over `CATEGORY_ORDER` (currently just `['type']`) rendering a "Tags" sub-header (`CATEGORY_DISPLAY_NAMES.type = 'Tags'`, displayed uppercase via CSS) followed by a flex-wrap of toggleable chips, in whatever order the `labels` prop arrives in.
- Tags are created today only via `LabelEditor` in `frontend/src/pages/SettingsPage.tsx`, which calls `createLabel(category, value, boardId)` from `frontend/src/api/labels.ts` (`POST /labels`, already exists, returns the created `Label`, 409 on duplicate value within category+board, 400 on empty value).
- `frontend/src/hooks/useLabels.ts` fetches labels for a board into local state but exposes no way to append/mutate that state from outside — `TaskDetailPage.tsx` (the only consumer of `TaskForm`) would need a way to reflect a newly created label without a full refetch.
- `TaskForm`'s own `boardId` state (confirmed via `onBoardIdChange`) is already propagated live to the parent as `liveBoardId`, which `TaskDetailPage` folds into `labelsBoardId` — the same value used to scope the existing label fetch. This value is safe to reuse for the new create call since it always reflects the form's current board selection.

## Data model changes

None. Reuses the existing `Label` model and `POST /labels` endpoint as-is.

## API / contract changes

None. No backend files touched.

## Files to modify

- `frontend/src/hooks/useLabels.ts` — add an `addLabel(label: Label)` function to the hook's return value that appends to local `labels` state (avoids a refetch after creating a tag).
- `frontend/src/pages/TaskDetailPage.tsx` — destructure `addLabel` from `useLabels`; add a `handleCreateLabel(value: string): Promise<Label>` that calls `createLabel('type', value, labelsBoardId)` then `addLabel(label)` then returns the label; pass it to `TaskForm` as a new `onCreateLabel` prop.
- `frontend/src/components/TaskForm.tsx`:
  - Remove the `<label>Labels</label>` element.
  - Drop the `uppercase` class on the "Tags" sub-header.
  - Sort `catLabels` by `label.value` (locale compare) before rendering chips.
  - Add `onCreateLabel?: (value: string) => Promise<Label>` prop.
  - Add local state (`addingTag`, `newTagValue`, `addTagBusy`, `addTagError`) and a small inline "+ Add" control next to the "Tags" header, matching the visual pattern already used by `LabelEditor` in `SettingsPage.tsx`. Enter submits, Escape/Cancel dismisses. Submit is disabled while `!newTagValue.trim()` or busy (matching `SettingsPage.tsx:384`'s pattern), to avoid an avoidable round trip to the 400 the backend already returns for an empty value.
  - Restructure the per-category render block (currently `if (!catLabels || catLabels.length === 0) return null;`) so the "Tags" header and "+ Add" control always render once `onCreateLabel` is provided, independent of whether the board has any existing tags yet. The chip list itself still renders nothing when `catLabels` is empty. This matters because the empty-board case is exactly where inline-add is most needed (a freshly created board, or a user's very first tag) — gating the whole section on existing tags would make the new feature unreachable in that case.
  - On successful creation, add the new label's id to `selectedLabelIds` (auto-select the tag being added, since the user is adding it to use it on this task) and clear the inline input.
  - Surface API errors (duplicate/empty value) inline under the input, reusing the message text `apiFetch` throws (e.g. "Label already exists").
  - Note: `onCreateLabel`'s shape (`(value: string) => Promise<Label>`, no category param) is coupled to the fact that `CATEGORY_ORDER` currently only contains `'type'` — fine today, would need revisiting if a second label category is ever added to this form.

## Test plan

- No changes to `backend/tests/test_api.py` — no backend files touched.
- No frontend unit test changes — there are no existing `TaskForm` tests, and the new logic (inline add state, alphabetical sort) is UI-bound rather than a pure utility function, so per project convention (`frontend/src/__tests__/` targets pure utils) nothing here is a natural extraction candidate.
- Manual verification: `/run` skill to start the app, exercise New Task and Edit Task flows — add a tag inline, confirm it appears alphabetically sorted, is auto-selected, persists on save, and duplicate/empty submissions show an inline error. Also verify the zero-existing-tags case specifically (a board with no tags yet, or a fresh account) — the "Tags" header and "+ Add" control must still render and work.

## Deployment order

Single component — frontend only (`frontend/`). No backend or mobile changes. Standard Railway deploy on merge (no `[skip deploy]`, since `frontend/` files are touched).

---

## Sneezy's Review — 2026-07-29

**Tier:** LIGHT — no proposed file falls under a model/schema/router/API-contract area, plan declares "Data model changes: none" / "API / contract changes: none", and deployment is single-component (frontend-only). Confirmed on inspection; no escalation to FULL warranted (no data-model/API coupling found).

**Verdict:** Changes required

### Issues

1. **[Blocker]** `frontend/src/components/TaskForm.tsx:354-357` — the per-category render block has an early return: `if (!catLabels || catLabels.length === 0) return null;`. This means when the current board has **zero existing tags** (e.g. a freshly created board, or the very first tag a user ever adds), the entire "Tags" section — header and everything inside it — renders nothing at all. The plan (line 36) describes adding the inline "+ Add" control "next to the 'Tags' header," which places it inside this same gated block. As written, the plan's own feature (item 4: add a tag inline without a trip to Settings) is **unreachable in exactly the case where a user most needs it** — a board with no tags yet. The user would have to go to Settings to create the first tag, then come back to use the inline add for subsequent tags, which defeats the stated goal. The "Files to modify" list for `TaskForm.tsx` does not mention restructuring this conditional. This needs an explicit fix: render the "Tags" header + Add affordance unconditionally (or at least whenever `onCreateLabel` is provided), independent of `catLabels.length`.

2. **[Gap]** The manual test plan (line 44) does not include verifying the zero-existing-tags scenario (new board / first-ever tag). This is precisely the case Issue 1 would have surfaced — worth adding explicitly once Issue 1 is addressed, to prevent regression.

3. **[Nit]** The plan doesn't mention a client-side guard to prevent submitting an empty/whitespace-only value (e.g. disabling the submit control the way `LabelEditor` does at `frontend/src/pages/SettingsPage.tsx:384`, `disabled={busy || !newValue.trim()}`). Not a blocker — the backend already 400s on empty value (`backend/app/routers/labels.py:51-52`) and the plan says to surface API errors inline — but it's an avoidable round trip and diverges from the established local pattern.

4. **[Nit]** `onCreateLabel?: (value: string) => Promise<Label>` implicitly hardcodes category to `'type'` (via `TaskDetailPage`'s `handleCreateLabel` calling `createLabel('type', value, labelsBoardId)`). Fine today since `CATEGORY_ORDER` only contains `'type'` (`TaskForm.tsx:30`), but worth a one-line acknowledgment in the plan that this prop shape is coupled to the single-category assumption.

### Unverified assumptions

- All line-number citations in the plan were checked and are accurate: `TaskForm.tsx:349` is indeed the `<label>Labels</label>` element; the `uppercase` class is at `TaskForm.tsx:359`; `CATEGORY_ORDER`/`CATEGORY_DISPLAY_NAMES` are at `TaskForm.tsx:30-33`.
- "TaskDetailPage.tsx (the only consumer of TaskForm)" — confirmed via repo-wide grep; the only other hit for `TaskForm` is an unrelated type reference in `api/tasks.ts`.
- "`useLabels.ts` ... exposes no way to append/mutate that state" — confirmed; the hook currently returns only `{ labels, labelsByCategory, loading, error }` (`useLabels.ts:48`).
- "This value is safe to reuse for the new create call since it always reflects the form's current board selection" (re: `labelsBoardId`) — confirmed against `TaskDetailPage.tsx:39-41`; the derivation and fallback chain match the plan's description.
- The example error text "Label already exists" — confirmed exact match against `backend/app/routers/labels.py:62` (409 on duplicate category+board+value).
- "No existing `TaskForm` tests" — confirmed; `frontend/src/__tests__/` contains no file referencing `TaskForm`.
- Edge case not addressed by the plan (low risk, not blocking): if `labelsBoardId` is ever `undefined` when `handleCreateLabel` fires (e.g. before any board has resolved), `createLabel` sends the request without `board_id`. Verified this is handled server-side — `board_service.resolve_board_id` falls back to the user's seeded default board when `board_id` is `None` (`backend/app/services/board_service.py:36-37`) — so this is not a functional risk, just worth knowing it relies on that server-side fallback rather than an explicit client-side guarantee.

### Suggestions

- Fix Issue 1 by making the "Tags" header + Add control render whenever `onCreateLabel` is supplied, regardless of `catLabels.length` (e.g. move the early-return check to only gate the chip list, not the header/add-control wrapper).
- Add the zero-existing-tags path to the manual verification steps once Issue 1 is fixed.
- Consider mirroring `LabelEditor`'s disabled-when-empty submit guard for UX consistency (optional, non-blocking).

— *Sneezy*

---

## Grumpy's response to Sneezy's review — 2026-07-29

1. **[Blocker] Empty-board early-return** — Addressed. Updated "Files to modify" for `TaskForm.tsx` to restructure the per-category block so the "Tags" header and "+ Add" control render unconditionally (whenever `onCreateLabel` is provided), independent of `catLabels.length`. Only the chip list itself stays gated on having tags to show.
2. **[Gap] Zero-tags case missing from test plan** — Addressed. Added it to the manual verification steps.
3. **[Nit] No disabled-when-empty submit guard** — Addressed. Added `disabled={busy || !newTagValue.trim()}` on the Add control, matching `LabelEditor`'s pattern, to avoid an avoidable round trip to the backend's 400.
4. **[Nit] `onCreateLabel` shape coupled to single-category assumption** — Addressed via a one-line note in the plan; no code change needed since this only matters if a second label category is ever added to this form, which is out of scope here.
5. **Edge case: `labelsBoardId` undefined at create time** — No action needed; Sneezy confirmed this is already handled server-side via `board_service.resolve_board_id`'s default-board fallback.
