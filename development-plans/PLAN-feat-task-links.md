# Plan: Task Links

**Branch:** `feat-task-links` (single branch covering backend + web + mobile — see PR Structure note below)

## Scope

Users can attach up to 3 links to a task, each with a required description. The task list view (web and mobile) shows the description for each link. On web, hovering over the link reveals the URL (native tooltip) and clicking opens it in a new tab. On mobile, tapping the link chip opens the URL directly (no hover equivalent on touch — see Mobile UI Assumption below).

## Data Model Changes

**Table: `tasks`** — additive column, `ALTER TABLE`, backward compatible.

| Column | Type | Notes |
|---|---|---|
| `links` | JSONB | NOT NULL DEFAULT `'[]'::jsonb`. Array of `{"id": string, "url": string, "description": string}`, max 3 elements. `id` is a client-generated UUID string (per link) — added per Sneezy's review so future per-link edit/reorder doesn't require a breaking migration. Cap and URL-scheme validation enforced at the API layer, not a DB constraint. Note: this is the first JSONB array-of-*objects* column in this codebase (`selected_board_ids`/`starter_questions` are arrays of primitive strings) — new territory, not simply "more of the same." |

Migration: `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb` in `main.py`'s lifespan block, alongside the other idempotent `ALTER TABLE` statements. No new table — link count is small and fixed, doesn't warrant a join table.

## API Changes

- `TaskOut` gains `links: list[TaskLink]` where `TaskLink = {id: str, url: str, description: str}`.
- `TaskCreate` gains `links: list[TaskLink] = []` — **non-optional, default empty list**, matching the `label_ids: List[str] = []` convention (corrected per Sneezy nit #12; a new task has no prior links, so there's no "leave unchanged" case to support).
- `TaskUpdate` gains `links: list[TaskLink] | None = None`. Providing `links` (including `[]`) **fully replaces** the existing array — this is the same convention `label_ids` already uses in `routers/tasks.py` (`None` = omitted/unchanged is the only sentinel; any list, including empty, means replace). Corrected per Sneezy nit #10: this does **not** use `model_fields_set` or the date-clearing mechanism — that citation in the original draft was inaccurate.
- **Client contract**: both web and mobile forms must **always** include `links` in the update payload (never conditionally omit it based on truthiness/emptiness) — mirroring how `label_ids` is unconditionally sent today. Added per Sneezy risk #5: under full-replace semantics, an unsent `links` field means "leave unchanged," so a form that skips the field when the array is empty would silently fail to remove a user's last link.
- Validation logic lives in one shared function (e.g. `validate_task_links()` in `schemas.py`), called both by the `TaskLink`/`TaskUpdate` Pydantic validators **and** manually from `sync.py` (see below — sync bypasses Pydantic entirely):
  - Max 3 items in `links` — else `400` (a Pydantic-level reject, not a silent truncate like `starter_questions` — corrected per Sneezy nit #11, this is not actually "consistent" with that precedent, just a similar API-layer-not-DB approach).
  - `url` must match `^https?://` — rejects `javascript:`, `data:`, `mailto:`, etc. Required because clicking is a direct, no-confirmation action (XSS/scheme-injection risk otherwise).
  - `url` non-empty, reasonable max length (2048 chars).
  - `description` non-empty (trimmed), reasonable max length (200 chars).
  - `id` present (client-generated UUID string).
- `GET /tasks`, `GET /tasks/{id}`, `POST /tasks`, `PUT /tasks/{id}` responses include `links`.
- **`POST /sync` requires explicit handling — corrected per Sneezy blockers #1 and #3.** `sync.py` enumerates task fields by hand on both the push-apply path and the pull-response construction; `links` must be added to both explicitly (same reason `recurrence_group_id` needed explicit removal — see `DATA_MODEL_AND_API.MD`). Additionally, `SyncChanges.tasks` is `List[Dict[str, Any]]` (raw dicts) — sync pushes bypass `TaskCreate`/`TaskUpdate` Pydantic validation entirely, so the ingestion code in `sync.py` must call the shared `validate_task_links()` function manually before persisting, or a sync client could push a `javascript:` URL, an oversized field, or more than 3 links unchecked.
- **Out of scope**: `ai_service.py` (conversational task creation) is not modified. AI-created tasks default to `links: []`. Called out explicitly per Sneezy gap #8.

## Files to Modify

**Backend**
- `app/models.py` — `Task.links` column (JSONB, `nullable=False`, `default=list`)
- `app/schemas.py` — `TaskLink` model (id/url/description); shared `validate_task_links()` function; `field_validator` on `TaskLink`; `links` added to `TaskCreate`, `TaskUpdate`, `TaskOut`
- `app/main.py` — idempotent `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS links ...`
- `app/services/task_service.py` — `create_task()` defaults `links=[]`; `update_task()` replaces `links` wholesale when the caller passes a non-`None` value, otherwise leaves unchanged
- **`app/routers/tasks.py`** (added per Sneezy blocker #2) — `create_task()` and `update_task()` currently pass every field as an explicit kwarg to `svc.create_task(...)`/`svc.update_task(...)`; `links=body.links` must be added to both call sites or the field validates and is silently discarded
- **`app/routers/sync.py`** (added per Sneezy blocker #1) — thread `links` through the push-apply block and the pull-response `task_dicts` construction; call `validate_task_links()` manually on push since `SyncChanges.tasks` bypasses Pydantic validation (Sneezy blocker #3)
- `tests/unit/test_task_service.py` — tests: create with links, update replaces links, update omitting links preserves existing
- New: `tests/unit/test_schemas.py` (or fold into an existing schema/validation test file) — `TaskLink`/`validate_task_links()`: rejects non-http(s) scheme, rejects >3 items, rejects empty description, rejects missing `id`
- New: router-level test (added per Sneezy suggestion) with a mocked `task_service` asserting `body.links` is actually threaded into the service call — pure `task_service` unit tests wouldn't have caught blocker #2
- `backend/tests/test_api.py` — **not touched by Grumpy**; Sleepy adds integration coverage during test-review per test ownership rules

**Frontend (web)**
- `src/api/tasks.ts` — `Task` interface gains `links: TaskLink[]`; `createTask`/`updateTask` always pass `links` through (never conditionally omitted — see API Changes client contract note)
- New: `src/utils/taskLinks.ts` — `MAX_TASK_LINKS = 3`, `isValidLinkUrl(url): boolean` (http/https only)
- `src/components/TaskCard.tsx` — render each link as `<a href={url} title={url} target="_blank" rel="noopener noreferrer">{description}</a>`, description truncated via CSS (`max-width` + `text-overflow: ellipsis`) to control card height — full text remains available via the native hover tooltip (`title`). Added per Sneezy gap #9; the 200-char backend cap is unchanged, this is display-only.
- `src/components/TaskForm.tsx` — link editor: up to 3 description+URL row pairs (each with a client-generated UUID `id`), add/remove (add disabled at 3), client-side validation before submit; `links` state always included in the submit payload, even when empty
- New: `src/__tests__/taskLinks.test.ts` — unit tests for `isValidLinkUrl`

**Mobile**
- `src/types/index.ts` — `Task.links: TaskLink[]`
- `src/api/tasks.ts` — always pass `links` through create/update
- New: `src/utils/taskLinks.ts` — duplicated from web (`MAX_TASK_LINKS`, `isValidLinkUrl`), per the project's no-shared-module convention
- `src/screens/TaskFormScreen.tsx` — same link editor UI as web (3 row pairs, add/remove, validation); `links` always included in the submit payload
- `src/screens/TasksScreen.tsx` (`TaskRow`) — render link descriptions as small `Pressable` chips (text truncated via `numberOfLines={1}`), `onPress` calls `Linking.openURL(url)` after re-validating the scheme. **Gesture-conflict risk (Sneezy risk #6)**: `TaskRow` is a `TouchableOpacity` wrapped by `DraggableTaskRow`'s `GestureDetector` running `Gesture.Pan().activateAfterLongPress(500)`. Nesting a new `Pressable` inside this stack is not guaranteed to isolate cleanly — a tap on the chip could bubble into `onEditPress` or get contested by the pan recognizer. This is called out as a dedicated manual-QA step (see Test Plan); if it misbehaves, compose gestures explicitly (`Gesture.Exclusive`/`Gesture.Native()`) rather than relying on default RN responder resolution.
- New: `src/__tests__/taskLinks.test.ts` — unit tests

### Mobile UI Assumption (flagged for review — unchanged from original draft, user approved)

The requirement ("mouse over reveals the link, click opens new tab") is a hover-based interaction with no direct touch equivalent. Mobile will show the description as a tappable chip that opens the URL immediately on tap — there is no intermediate "reveal" step. This is a deliberate deviation from a literal reading of the spec, adapted for touch input.

## Test Plan

- Backend unit tests (`tests/unit/`): link create/replace/omit-preserves semantics in `task_service`; `TaskLink`/`validate_task_links()` validation (bad scheme, >3 items, empty description, missing id, oversized fields); router-level test asserting `links` reaches `task_service` (Sneezy suggestion, catches blocker #2's class of bug); sync push/pull round-trip test for `links` (catches blocker #1's class of bug)
- Web unit tests (`src/__tests__/`): `isValidLinkUrl`
- Mobile unit tests (`src/__tests__/`): `isValidLinkUrl` (duplicated)
- `test_api.py` integration coverage: added by Sleepy during test-review, not by Grumpy
- Manual verification (both platforms): add a task with 3 links, confirm 4th is rejected client- and server-side; web hover shows tooltip + click opens new tab; mobile tap opens link; verify a non-http(s) URL is rejected with a clear error; **remove all links and save — confirm they actually clear** (Sneezy risk #5 regression check); **mobile: tap a link chip on a draggable row and confirm it opens the link without triggering edit mode or the drag gesture** (Sneezy risk #6 regression check); sync two devices and confirm links propagate both directions

## Deployment Order

1. **Backend + web** deploy as a **single unit** — corrected per Sneezy risk #7. Per the root `Dockerfile`/`railway.toml`, the web frontend is built and copied into the same Docker image as the backend, served by one `uvicorn` process as one Railway service. There is no independent "web deploys after backend" step; they are the same deploy event by construction. The change is additive/backward-compatible regardless.
2. **Mobile** is the only genuinely independent deploy — ships separately via EAS, any time after the backend+web deploy (mobile talks to the already-updated API).
3. Mobile update type: **OTA** (`eas update`) — JS/TS only, no native module, `app.json`, or `eas.json` changes.

## PR Structure

**Single PR** for backend + web + mobile — this recommendation is *strengthened*, not just retained, by the deployment-order correction above: backend and web already ship as one atomic unit regardless of PR boundaries, so splitting them into separate PRs would add process overhead without adding any real deployment safety. Only mobile is independent, and it's a small enough addition to not warrant its own PR here. This deviates from the 3-PR-per-component precedent used for larger multi-week efforts (multi-board, focused-view), which involved much larger, more independently-evolving change sets.

---

## Grumpy's Response to Sneezy's Review

All 3 blockers, 4 risks, 2 gaps, and 3 nits are addressed inline in the sections above (Data Model, API Changes, Files to Modify, Mobile section, Test Plan, Deployment Order, PR Structure). Summary:

| Sneezy item | Status |
|---|---|
| Blocker 1 (sync.py field passthrough) | Addressed — `sync.py` added to Files to Modify, both push and pull paths |
| Blocker 2 (tasks.py router wiring) | Addressed — `routers/tasks.py` added to Files to Modify; router-level test added |
| Blocker 3 (sync bypasses Pydantic validation) | Addressed — shared `validate_task_links()` called manually in `sync.py` |
| Risk 4 (no per-link id) | Addressed — `TaskLink.id` (client UUID) added to the schema |
| Risk 5 (omit-vs-empty footgun) | Addressed — client contract states `links` always sent; manual test step added |
| Risk 6 (mobile gesture nesting) | Addressed as a flagged manual-QA step; will resolve with explicit gesture composition if manual testing shows contention |
| Risk 7 (deployment order wrong) | Addressed — corrected to reflect backend+web as one Railway deploy unit |
| Gap 8 (AI scope unstated) | Addressed — explicitly out of scope, `ai_service.py` untouched |
| Gap 9 (card density) | Addressed — CSS/`numberOfLines` truncation in display, no data cap change |
| Nit 10 (model_fields_set mischaracterization) | Addressed — corrected to describe actual `label_ids`-style full-replace semantics |
| Nit 11 (starter_questions consistency overstated) | Addressed — claim removed, reject-with-400 behavior stated on its own merits |
| Nit 12 (TaskCreate.links should be non-optional) | Addressed — `TaskCreate.links: List[TaskLink] = []`, matching `label_ids` |

Implementation proceeds on this updated plan.

---

## Sneezy's Review — 2026-07-01

**Verdict:** Changes required

### Issues

1. **[Blocker] `POST /sync` is not field-agnostic — the plan's "no separate sync handling needed" claim is false.** `backend/app/routers/sync.py` does not passthrough arbitrary `Task` fields. Push handling (lines 39–95) and pull-response construction (lines 161–176) both enumerate fields explicitly (`title`, `notes`, `state`, `is_deleted`, `is_high_priority`, `must_do_by`, `target_date`, `completed_at`, plus `label_ids` handled via a separate `label_updates` dict). This is the same mechanism that made `recurrence_group_id` need to be *explicitly* dropped/ignored when it was removed (see `DATA_MODEL_AND_API.MD`: "The sync router silently ignores `recurrence_group_id`..."). Without adding `links` to both the incoming-apply block and the outgoing `task_dicts` construction in `sync.py`, links created/edited on one device will (a) never be pushed to the server via sync and (b) never come back down in the pull response — silently dropped in both directions. `app/routers/sync.py` must be added to "Files to Modify."

2. **[Blocker] `app/routers/tasks.py` is missing from "Files to Modify" but must change.** `create_task()` and `update_task()` in `tasks.py` (lines 57–76 and 89–110) call `svc.create_task(...)` / `svc.update_task(...)` with each field passed explicitly as a keyword argument (`title=body.title, notes=body.notes, ...`). There is no `**body.model_dump()` passthrough. Unless `links=body.links` (plus whatever replace/omit logic is chosen) is added to both call sites, `TaskCreate`/`TaskUpdate` will accept and validate a `links` payload via Pydantic but it will never reach `task_service`, and never be persisted — the API will appear to accept links and then silently discard them. This is the single most important concrete gap in the plan.

3. **[Blocker] The sync ingestion path bypasses `TaskCreate`/`TaskUpdate` validation entirely, undermining the stated XSS/scheme mitigation.** `SyncChanges.tasks` is typed as `List[Dict[str, Any]] = []` (`schemas.py` line 193) — sync push payloads are raw dicts, not validated through `TaskLink`'s `field_validator`s. Even after fixing issue #1, whatever code is added to `sync.py` to ingest `links` must re-apply the max-3 / `^https?://` / length checks manually, or a sync client can push a task with a `javascript:` URL, an oversized description, or more than 3 links, completely bypassing every protection the plan designs for `POST`/`PUT /tasks`. The plan should call this out explicitly rather than relying on "no separate sync handling needed."

4. **[Risk] `TaskLink` has no per-item identifier, which the user-facing prompt specifically flagged as a future-needs concern.** Every existing JSONB array column in this codebase (`selected_board_ids`, `starter_questions`) is an array of primitive strings — there is no existing precedent for an array of *objects* in a JSONB column. Without a stable `id` on each `TaskLink` (even a client-generated UUID string), individual link edit/delete/reorder can only ever be implemented as "resend the whole array," and any future drag-and-drop reordering of links (consistent with the app's existing drag-and-drop conventions for tasks) would require a breaking schema change to retrofit IDs onto existing data. Cheap to add now, expensive to add later.

5. **[Risk] The plan doesn't specify that the client must *always* include `links` in the update payload, and the existing code sets a bad precedent for exactly this mistake.** Both `frontend/src/components/TaskForm.tsx` (line 81: `if (notes.trim()) data.notes = notes.trim();`) and `mobile/src/screens/TaskFormScreen.tsx` (line 127: `if (notes.trim()) body.notes = notes.trim();`) conditionally omit fields when they're empty/falsy — which is correct for `notes` (omission ≠ explicit clear is not a concern there) but would be a real bug for `links`: under full-replace semantics, omitting `links` means "leave unchanged," so if the link editor is implemented by analogy to `notes` (skip the field when the array is empty), a user who removes all 3 links and saves will find them silently un-removed. The plan should explicitly state that `links` must always be sent, the same way `label_ids: Array.from(selectedLabelIds)` is unconditionally included today in both `TaskCard.tsx`'s quick-edit and `TaskForm.tsx`/`TaskFormScreen.tsx`'s full save.

6. **[Risk] Mobile "tap opens immediately" chip is not evaluated against the existing drag-and-drop gesture stack.** `mobile/src/screens/TasksScreen.tsx`: `TaskRow` (lines 64–131) is a `TouchableOpacity` with `onPress={() => onEditPress(task.id)}`, and it is wrapped by `DraggableTaskRow` (lines 162–224) inside a `GestureDetector` running `Gesture.Pan().activateAfterLongPress(500)`. Nesting a new `Pressable` link chip inside this stack (as the plan proposes) is not free — RNGH's `GestureDetector` and RN's built-in `TouchableOpacity`/`Pressable` responder system can interact unpredictably when nested, and there's a real risk that tapping a link chip either (a) also fires the parent row's `onPress` (navigating into edit mode) or (b) gets contested by the Pan gesture recognizer. The plan should call out a concrete approach (e.g. `Gesture.Native()`/`Gesture.Exclusive()` composition, or testing that a quick tap on the chip does not bubble to `onEditPress`) rather than leaving it implicit.

7. **[Risk] "Web and mobile deploy independently after backend" mischaracterizes the actual deploy topology.** Per the root `Dockerfile` and `railway.toml`, backend and web frontend are built and shipped as a **single Railway service** — a multi-stage Docker build compiles the React app and copies `dist/` into the Python image's `static/` directory, and one `uvicorn` process serves both `/api/v1/*` and the SPA. Web cannot deploy "independently after backend" — it is the *same deploy event* as backend, by construction. Only mobile (via a separate EAS/OTA channel) is genuinely independent. This doesn't create a real safety problem for this specific additive change, but the deployment-order reasoning as written is factually wrong, and `RULES_OF_ENGAGEMENT.MD` requires deployment order to be stated "with dependency reasoning" — reasoning built on an incorrect premise isn't reliable for the next plan that reuses it. (Note: this actually *strengthens* the case for a single PR, since backend+web already ship atomically regardless of PR boundaries — only the mobile-independence part of the argument is doing real work.)

8. **[Gap] AI/conversational scope is unstated.** `ai_service.py` (`_format_task_line()`, the `create_task` tool schema used in the Claude tool-use loop) is not mentioned anywhere in the plan. That's probably fine — AI-created tasks simply default to `links=[]` — but the plan should say so explicitly rather than leaving it to be discovered later whether the assistant is expected to be link-aware.

9. **[Gap] No plan for link display density on compact views.** `TaskCard.tsx` (the web kanban card) already renders title, HP badge, two dates, and a wrapped row of label badges in a small card; `TaskRow` on mobile is similarly compact. Up to 3 links, each with up to a 200-char description, rendered inline could make cards significantly taller/noisier than anything currently in the UI. The plan doesn't address truncation, a max visible-links-before-"+N more," or moving link display to the detail view only.

10. **[Nit] Line 23's "model_fields_set check, same pattern as date-clearing" conflates two different existing patterns.** `label_ids` in `tasks.py` (line 104) is passed straight through from `body.label_ids` with no `model_fields_set` involvement — `None` (omitted or... `None` is the only sentinel) means "leave unchanged," any list (including `[]`) means "replace." Date-clearing (lines 105–106) is a genuinely different mechanism: `'must_do_by' in body.model_fields_set and body.must_do_by is None`. If `links` is implemented the way the plan actually describes functionally (full replace when provided, matching `label_ids`), it does **not** need or use `model_fields_set` at all — the citation of "same pattern as date-clearing" is inaccurate and could mislead whoever implements this into building unnecessary `clear_links` plumbing.

11. **[Nit] "Consistent with existing patterns (`starter_questions` capped at 5...)" overstates the similarity.** `PUT /settings` (`routers/settings.py` line 43) enforces the cap by silently truncating (`body.starter_questions[:5]`) — there is no validator and no error raised. The plan proposes a Pydantic validator that rejects with `400` for `links` > 3. Enforcing at the API layer rather than the DB is consistent; silently-truncate vs. explicitly-reject is not the same behavior, and framing this as matching precedent isn't accurate (reject-with-400 is arguably the better UX for an explicit "attach a link" action — just don't call it consistent with the cited example).

12. **[Nit] `TaskCreate.links` proposed as `Optional[List[TaskLink]] = None` is inconsistent with the sibling field it's modeled after.** `TaskCreate.label_ids` is `List[str] = []` (non-optional, defaults to empty list directly) — not `Optional[...] = None`. Minor stylistic inconsistency worth aligning for a reviewer scanning the diff.

### Unverified assumptions

- **"`POST /sync`: ... no separate sync handling needed"** (line 30) — checked against `backend/app/routers/sync.py`; found to be **false**. See Issue #1.
- **"Web and mobile deploy independently after backend, in either order"** (Deployment Order §2) — checked against `Dockerfile`/`railway.toml`; found to be **false for web** (backend+web are one Docker image/one Railway service). True for mobile. See Issue #7.
- **"Cap and URL-scheme validation enforced at the API layer... consistent with existing patterns (`starter_questions` capped at 5, `selected_board_ids`)"** — the "API layer, not DB constraint" part is accurate; the implied behavioral consistency (reject vs. truncate) is not. See Issue #11. Also note: both cited precedents are JSONB arrays of *primitive strings*; there is no existing precedent in this codebase for a JSONB array of *objects*, which `links` would be the first instance of — this is new territory, not simply "more of the same."
- **"Providing `links` fully replaces the existing array (matches `label_ids` full-replace semantics)... same `model_fields_set` check, same pattern as date-clearing"** — the full-replace-when-provided behavior does plausibly match `label_ids`; the specific mechanism cited (`model_fields_set`, "date-clearing pattern") does not match how `label_ids` is actually implemented. See Issue #10.
- Could not verify any test file currently exercises router-level wiring (i.e., that a field present in `TaskUpdate`/`TaskCreate` actually reaches `task_service`) — the planned unit tests target `task_service` directly with mocked sessions, which would not catch the exact class of bug in Issue #2.

### Suggestions

- Add `app/routers/tasks.py` and `app/routers/sync.py` to "Files to Modify" explicitly, with the specific wiring changes each needs.
- Give each `TaskLink` a stable `id` (e.g. client-generated UUID string) even though the MVP doesn't need per-link CRUD yet — cheap now, avoids a future breaking migration if reordering or single-link edit is ever requested.
- State explicitly, in the API Changes section, that clients must always send `links` (never conditionally omit it based on truthiness) — mirroring how `label_ids` is always included today.
- Add at least one test (even a thin router-level test with a mocked `task_service`) asserting that `body.links` is actually threaded into the service call — pure `task_service` unit tests won't catch a router wiring gap.
- Consider a lower description cap for card-display contexts, or an explicit truncation/"+N more" strategy for `TaskCard.tsx` and mobile `TaskRow`, given up to 3 × 200-char descriptions in an already-compact card.
- Correct the Deployment Order section to reflect that backend+web are a single deploy unit; reframe the PR-structure rationale accordingly (the single-PR recommendation still holds, arguably more strongly).
- Explicitly state whether `ai_service.py` (conversational task creation) is in or out of scope for this feature, rather than leaving it unmentioned.
- Have `sync.py`'s `links` ingestion (once added) re-apply the same max-3/scheme/length validation that `TaskCreate`/`TaskUpdate` apply, since `SyncChanges.tasks` bypasses Pydantic model validation for task fields.

— *Sneezy*
