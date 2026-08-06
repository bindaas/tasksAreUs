# Development Plan: feat-priority-tiers

## Status
**State:** In progress
**Last updated:** 2026-08-06 by Grumpy
**Next step:** User approved ("yes, proceed"). All 5 of Sneezy's findings have inline "→ Addressed" resolutions in the Review section below. Starting PR1 (backend) on branch `feat-priority-tiers-backend`: models.py, schemas.py, task_service.py, focused_view_service.py, routers/sync.py, main.py migration block, backend unit tests.
**Blocked on:** n/a — implementation underway.

---

## Summary

Today a task has a single boolean, `is_high_priority`. This replaces it with a 3-level `priority` field — `high` / `medium` / `normal` — so users can differentiate more than "urgent vs. everything else." The web All-view kanban board gets a third stacked zone per column; the same column-eligibility rule that currently gates High (only overdue/today/tomorrow/day-after-tomorrow/Friday's-Monday columns) extends to Medium; Normal is unrestricted, exactly like today's non-high tasks. Drag-to-reorder, which today works within the High zone and within the Normal zone, extends to work within the Medium zone too — dragging *between* zones changes a task's tier (same mechanic as today's High↔Normal zone drop), dragging *within* a zone reorders via `sort_order` (unchanged mechanism).

Mobile ships in the same epic (per explicit user decision — see Decisions Locked In) but its "All view" is structurally a grouped `SectionList`, not a kanban board (confirmed by inventory research below) — priority there is a sort key inside each date bucket, not a set of drop zones. Extending it to 3 tiers is a sort-key change plus turning today's single star-toggle into a 3-state tier control; no new drag zones are needed on mobile.

Backend and web frontend deploy together as a single Docker image (per `CLAUDE.md`) — no compatibility window exists between them. Mobile deploys independently via OTA and may lag behind the backend for some period, so the backend keeps `is_high_priority` alive as a mirrored, derived field for that window (see Data Model Changes).

---

## Decisions Locked In (answered by user before this plan was written)

1. **Scope:** Web + mobile together, one epic (3 sequential PRs — see Scope table).
2. **Daily cap:** Only High keeps `user_settings.high_priority_daily_limit`. Medium and Normal stay uncapped, same as Normal is today. No new settings field.
3. **Focused View / Day View:** Keep showing High only in their priority-flagged sections. Medium does not surface there. Their code needs to keep working against the new field, but their filtering *behavior* does not change.

---

## Scope — Three Sequential PRs

| PR | Branch | Scope | Deploy type |
|---|---|---|---|
| 1 | `feat-priority-tiers-backend` | DB migration, model/schema/API changes, cap+eligibility logic, sync compat, backend unit tests | Railway (backend+web image) |
| 2 | `feat-priority-tiers-web` | All-view 3-zone kanban, tier UI on TaskCard/TaskForm, per-tier collapse, frontend unit tests | Railway (same image as PR1, or later — see Deployment Order) |
| 3 | `feat-priority-tiers-mobile` | 3-way tier sort/UI on TasksScreen/TaskCardBody/TaskFormScreen/FocusedTaskCard/FocusedView/SettingsScreen, mobile unit tests | OTA (`eas update`) — JS/TS only, no native modules touched |

**Deployment order:** Backend+Web (PR1, then PR2 — both land in the same Docker image, so PR2 cannot reach production before PR1 is merged, but PR1 merging alone is already deployable and backward-compatible on its own) → Mobile (PR3) any time after PR1 is live, since PR3 only depends on the backend's new `priority` field existing.

**Backward-compat window:** Between PR1 deploying and PR3's OTA update reaching a given device, old mobile builds keep reading/writing `is_high_priority` exactly as before — the backend mirrors it for them. There is no reverse window (mobile can't get ahead of the backend, since OTA requires the JS bundle referencing an API the backend must already serve).

---

## Research Basis (from full-codebase inventory, not re-verified line-by-line in this doc — verify exact line numbers before editing)

**Backend** (`backend/app/services/task_service.py`):
- `HIGH_PRIORITY_DAILY_LIMIT = 3` fallback; `_get_high_priority_limit()` reads `UserSettings.high_priority_daily_limit`.
- `_effective_date()` — earliest of `must_do_by`/`target_date`.
- `_is_hp_eligible_date()` — pure date predicate: `d<=today+1` (today/tomorrow/overdue), `d==today+2` (day-after), Friday-only `d==today+3` (Monday). No task-state dependency — reusable unchanged as the eligibility check for **both** High and Medium.
- `_count_high_priority_for_date()` — queries `Task.is_high_priority==True`, Python-side date filter. Becomes `Task.priority=='high'`.
- `create_task()`: `final_priority = is_high_priority and _is_hp_eligible_date(effective)`, cap-checked before insert.
- `update_task()`: sets priority if passed, then unconditionally auto-resets if the new effective date fails eligibility, then cap-checks only when explicitly setting to the capped tier.
- `reopen_task()` deliberately skips eligibility re-check (documented: `_is_hp_eligible_date()` treats every date `<= today+1` as eligible, so eligibility can only expand as time passes while a task sits `done`) — same reasoning carries over unchanged for a 3-tier field, applied regardless of which tier is set.
- `focused_view_service.py`: `_query_board_grouped_tasks()` filters `Task.is_high_priority==True` when `high_priority_only`, orders `Task.is_high_priority.desc()` then a tiebreak. `get_focused_tasks()` always passes `high_priority_only=True`; `get_day_view_tasks()` passes `False`. Both keep working unchanged as long as "High-only" maps to `priority=='high'`.
- `routers/sync.py`: reads `is_high_priority` on the incoming new-task and update branches, writes it on outbound serialization. No eligibility/cap re-check on the sync path today (pre-existing gap, out of scope to fix here — will persist identically for the new field unless a future plan addresses it).
- `models.py`: `is_high_priority = Column(Boolean...)`. `schemas.py`: `TaskCreate.is_high_priority`, `TaskUpdate.is_high_priority`, `TaskOut.is_high_priority` — all currently `bool`.

**Web frontend:**
- `TaskCardBody.tsx`: `priorityIndicator` derived from `task.is_high_priority`; toggle button (amber star, "Set/Remove high priority") — single boolean toggle today.
- `TaskCard.tsx` passes `priorityBadge="toggle"` + `onTogglePriority`; `FocusedTaskCard.tsx` passes `priorityBadge="static"` (read-only).
- `TaskForm.tsx`: `isHighPriority` state, `highPriorityEligible` gate, single "High priority" checkbox.
- `FocusedView.tsx`: only a static empty-state string references priority — no logic dependency, trivial to leave alone.

**Mobile — structurally different from web, confirmed by inventory:**
- Mobile's "All view" (`TasksScreen.tsx`, per `ARCHITECTURE.MD`) is a grouped `SectionList` by date bucket (Overdue→Today→Tomorrow→DayAfterTomorrow→Upcoming→NoDate), not a 2-zone kanban board. Tasks within a section sort by `is_high_priority DESC` then `sort_order` via `groupTasksForList()` in `taskGrouping.ts`.
- `DraggableTaskRow`'s long-press drag only changes `target_date` on drop — it never touches priority. Priority is toggled independently via a tap on the amber star in `TaskCardBody.tsx` (same single-boolean pattern as web).
- **Implication:** extending "reorder within a tier" to mobile needs no new drop zones — it falls out of `groupTasksForList`'s existing sort-by-priority-then-sort_order once priority has 3 values. Only the priority *toggle* UI must become 3-state, on `TaskCardBody.tsx` and `TaskFormScreen.tsx`.
- `taskPriority.ts` mirrors web's functions (`isHighPriorityEligible`, `splitByPriority`, `canAddHighPriority`) but `splitByPriority` does not appear to be used by the SectionList UX (no high/normal zones exist there) — **verify during implementation whether it's dead code or used elsewhere before deciding its 3-tier replacement's shape.**
- `SettingsScreen.tsx` has the daily-limit stepper UI — unchanged (only High capped).

**Tests referencing the field today** (all need updating, not owned by Sleepy):
- Web: `frontend/src/__tests__/taskPriority.test.ts`, `taskOrder.test.ts` (fixture field only), `taskFilters.test.ts` (fixture field only).
- Mobile: `mobile/src/__tests__/taskPriority.test.ts`, `taskGrouping.test.ts` (sort-order assertions), `taskFilters.test.ts` (fixture field only).
- Backend: no `backend/tests/unit/` test currently references `is_high_priority` by name (unverified in the research pass — grep again before writing new tests, since a hit would mean updating an existing test rather than only adding new ones).
- `backend/tests/integration/` is owned by Sleepy — flag the new tri-state behavior for Sleepy during full-review; do not edit it directly.

---

# PR 1 — Backend

## Data Model Changes

Add `priority` alongside the existing `is_high_priority`, mirrored, via idempotent `ALTER TABLE` in `main.py`'s startup-migration block (same pattern as every other column added there — `ADD COLUMN IF NOT EXISTS`):

```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR NOT NULL DEFAULT 'normal';
UPDATE tasks SET priority = 'high' WHERE is_high_priority = true AND priority = 'normal';
```

The `UPDATE` is safe to run on every startup (idempotent): once a row's `priority` is `'high'`, the `WHERE priority = 'normal'` guard makes it a no-op on subsequent runs.

- Use a plain `VARCHAR`, not a Postgres native `ENUM` type (`CREATE TYPE` + later `ALTER TYPE ADD VALUE` has transactional restrictions and no other column in this codebase's *migrated* set uses a native enum — `state`/`category` use `Enum()` at the SQLAlchemy model level but those tables were never altered after creation). Validate the three allowed values at the Pydantic layer instead (`Literal['high', 'medium', 'normal']`), matching how `board_selection`/`day_range` are validated elsewhere in this codebase.
- **Why a single-statement migration here, unlike `sort_order`'s 3-step add-nullable → backfill → `SET NOT NULL` shape (per Sneezy's Nit):** `sort_order` needed the multi-step form because its value is *computed per-row* (`_sort_order_default()`, a timestamp) — Postgres can't express a per-row computed value as a column `DEFAULT`, so existing rows had to be backfilled via `UPDATE` before the `NOT NULL` constraint could be safely added. `priority`'s default is a *constant* (`'normal'`), which Postgres fills in for all existing rows as part of the same `ADD COLUMN ... DEFAULT ... NOT NULL` statement (a fast metadata-only operation on modern Postgres, no table rewrite) — there is no computed-value step to separate out. The one remaining backfill (`UPDATE tasks SET priority = 'high' WHERE is_high_priority = true ...`) is a distinct, separate correction layered on top of the constant default, not a substitute for it.
- **`is_high_priority` is NOT dropped in this PR.** It becomes a derived/mirrored column: every create/update that changes `priority` also writes `is_high_priority = (priority == 'high')`. This is what lets old mobile builds keep working unmodified during the OTA rollout window. Dropping it is an explicit future follow-up (a 4th PR, out of scope here) once mobile adoption of the new field is confirmed complete — do not attempt it now.
- `models.py`: add `priority = Column(String, nullable=False, default="normal")` to `Task`. Keep `is_high_priority = Column(Boolean, ...)` as-is.

## API Changes

`schemas.py`:
- `TaskCreate`: add `priority: Literal['high', 'medium', 'normal'] = 'normal'`. Keep `is_high_priority: Optional[bool] = None` as a **legacy input path** — see resolution rule below.
- `TaskUpdate`: add `priority: Optional[Literal['high', 'medium', 'normal']] = None`. Keep `is_high_priority: Optional[bool] = None` as legacy input.
- `TaskOut`: add `priority: str`. Keep `is_high_priority: bool` — computed as `priority == 'high'` before serialization (not stored redundantly on the response model logic — the DB mirror already guarantees this, but double-check they can't drift on the read path too).

**Field-resolution rule (both create and update), in `task_service.py`:**

**Revised per Sneezy's Blocker finding (see Review section below) — the original rule 2 was unsafe.** Both `TaskFormScreen.tsx` (mobile) and web's `TaskForm.tsx` unconditionally resend `is_high_priority` on *every* save, not just when the user changes priority, and `routers/sync.py`'s inbound update branch has the same unconditional-if-present shape. A naive "legacy bool present → map to high/normal" rule would silently demote a Medium task to Normal on any unrelated edit (title, notes, dates, …) made from an old client during the compat window. The rule below closes that gap:

1. If the request includes `priority`, use it — this is the new-client path (web, updated mobile). Ignore any `is_high_priority` also present in the same payload.
2. Else if the request includes only legacy `is_high_priority` **and the task's current stored `priority` is not `'medium'`**, map `True → priority='high'`, `False → priority='normal'` — this reproduces exactly today's boolean toggle behavior for a task that was already High or Normal.
3. Else (legacy `is_high_priority` present, but the task's current stored `priority` is `'medium'`) — **leave `priority` unchanged.** An old client has no way to express or intend a change to Medium, so a bare legacy write must not clobber it; the task stays Medium until it's edited from an updated client (web, or mobile post-OTA) that can send `priority` explicitly. This applies identically on create (a brand-new task from an old client can only ever be created as High or Normal — there is no pre-existing `'medium'` state to protect on create, so create only ever exercises rules 1–2, never 3).
4. Whichever branch resolves the target `priority`, write `is_high_priority = (priority == 'high')` to keep the mirror in sync for any client still reading the legacy field — this holds for all three branches, including branch 3, where `priority` stays `'medium'` and the mirror correctly stays `False`.

This same three-branch rule applies verbatim in `routers/sync.py`'s inbound handling (see below) — do not implement a different, simpler version there under time pressure; the sync path is exactly as exposed to this bug as the REST path.

**Eligibility (generalizes `_is_hp_eligible_date`):**
- High and Medium both require `_is_hp_eligible_date(effective_date)` to be true (same date window as today's High-only rule: overdue/today/tomorrow/day-after-tomorrow/Friday's-Monday).
- Normal has no date restriction — settable on any task regardless of date, exactly like today's non-high tasks.
- Auto-reset: if the resolved `priority` is `'high'` or `'medium'` and the effective date fails eligibility, reset to `'normal'` (generalizes today's "auto-reset `is_high_priority` to `false`" rule to both gated tiers).
- `reopen_task()`: continues to skip eligibility re-check entirely, regardless of which tier is set — same reasoning as today, unchanged.

**Cap check (only High, per locked-in decision):**
- Only run `_count_high_priority_for_date` / the 422 cap error when the resolved `priority` is being explicitly set to `'high'` (mirrors today's "only when explicitly setting to `True`" condition). Medium and Normal never hit this check.
- **Resolved per Sneezy's Risk finding (see Review section below) — verified directly against `task_service.py`'s current code, not deferred.** `_is_hp_eligible_date()` returns `True` for any `d <= today + 1`, which includes every past (overdue) date — there is no separate "overdue" branch in the eligibility check. The cap-check block in `update_task()` fires whenever the caller explicitly passes `is_high_priority is True` (the raw param) AND `_is_hp_eligible_date(effective)` is true — and since overdue dates are always eligible by this definition, **the actual code re-runs the cap check for an overdue task any time a client resends `is_high_priority=True`**, e.g. via `TaskForm.tsx`'s unconditional resend on every save (the same client behavior implicated in the Blocker fix above). This means the current, shipped behavior does not fully match `DATA_MODEL_AND_API.MD`'s documented claim that "the cap re-engages only when the task is moved to a current or future date" — in practice it can also re-engage on a plain re-save of an already-overdue task. This is a **pre-existing discrepancy in today's boolean-field code, not something introduced by this migration.** Decision: **carry the current code's actual behavior forward unchanged for the High tier** (bug-for-bug compatible) rather than attempting an undocumented behavior fix as a side effect of this migration — reconciling the doc against the real behavior is a separate, out-of-scope concern (candidate for a `Doc`/arch-review pass, not this feature). Pin this down with an explicit backend unit test (see Backend Unit Tests below) so the tri-state generalization is verified against the *actual* behavior, not the aspirational doc description.

`focused_view_service.py`: change `Task.is_high_priority == True` / `.desc()` references to `Task.priority == 'high'` / an equivalent ordering expression (e.g. `case()` ranking `'high'` first, or keep ordering on the mirrored `is_high_priority` column if simpler — either is correct since the two are always in sync after PR1; prefer `priority` for consistency going forward).

`routers/sync.py`: apply the same field-resolution rule as above on the inbound new-task/update branches; outbound serialization includes both `priority` and `is_high_priority` (mirrored) so old cached mobile sync payloads keep decoding correctly.

## Backend Unit Tests (`backend/tests/unit/`)

Grep for existing `is_high_priority` references first (research pass found none, but re-verify — don't assume). Add tests (mocked SQLAlchemy session, per project convention) covering:
- `priority='high'` and `priority='medium'` both auto-reset to `'normal'` when the effective date is outside the eligibility window.
- Cap check fires only for `priority='high'`, never for `'medium'`.
- **An overdue task already at `priority='high'` re-triggers the cap check (and can hit the 422) when its priority is explicitly resent as `'high'` on an unrelated save** — pins down the pre-existing discrepancy from the Cap check section above as the actual, intended-to-be-preserved behavior, not a regression to fix.
- Legacy `is_high_priority=True`/`False` payloads (no `priority` field) resolve correctly per the field-resolution rule.
- **A legacy `is_high_priority` payload (any value) sent against a task whose current stored `priority` is `'medium'` leaves `priority` unchanged (does not demote to `'normal'`)** — the Blocker fix from Sneezy's review; this is the single most important new test in this PR.
- The same legacy-payload-vs-`'medium'` case, exercised via the `/sync` update path (`routers/sync.py`), not just the REST `PUT /tasks/{id}` path — the two code paths must not diverge.
- `is_high_priority` mirror stays in sync with `priority` after create/update, including the branch where `priority` stays `'medium'` (mirror must resolve to `False`).

## Files to Modify (PR1)
- `backend/app/models.py`
- `backend/app/schemas.py`
- `backend/app/services/task_service.py`
- `backend/app/services/focused_view_service.py`
- `backend/app/routers/sync.py`
- `backend/app/main.py` (migration block)
- `backend/tests/unit/` (new/updated tests)

## Pre-Implementation Checklist (PR1)
- Confidence in solution: 4/5
- Regression risk: 3/5 — the field-resolution rule and cap/eligibility auto-reset ordering are the riskiest part; get this exactly right or old mobile clients silently misbehave.
- Data model changes: add `tasks.priority VARCHAR NOT NULL DEFAULT 'normal'`, backfilled from `is_high_priority`; `is_high_priority` retained as a mirrored column, not dropped.
- Test changes needed: new backend unit tests (see above); no integration test edits (Sleepy's domain — flag for full-review).
- Deployment order: single component (backend; web ships in the same image but is PR2, a separate branch/PR).
- Mobile update type: n/a (no mobile files touched in this PR).

---

# PR 2 — Web Frontend

## What this PR delivers
1. `utils/taskPriority.ts`: generalize `isHighPriorityEligible` → a tier-aware eligibility check usable for both High and Medium (Normal always eligible, no check needed); generalize `splitByPriority` → returns `{ high, medium, normal }`; keep `canAddHighPriority`/`HIGH_PRIORITY_DAILY_LIMIT` High-specific (only High is capped).
2. `TasksPage.tsx`: each priority-eligible column (today/tomorrow/day-after-tomorrow/monday/overdue) renders **3 stacked zones** instead of 2 — High (capped, existing amber styling), Medium (new visual treatment — pick a distinct color, e.g. blue/indigo, not competing with High's amber or the column's own drag-over indigo highlight), Normal (uncapped, existing styling). **Revised per follow-up user direction: all three zones are independently collapsible** (not just High as originally scoped) — each gets its own header/toggle strip (title + count + chevron), matching today's High-zone pattern, extended to Medium and Normal. Upcoming/No Date columns stay flat single-zone (implicitly Normal-only, no tier split, no collapse toggle), unchanged from today — the 3-zone/collapse treatment only applies to priority-eligible columns.
   - `dragOverPriority` state widens from `'high' | 'normal'` to `'high' | 'medium' | 'normal'`.
   - `handleDrop`/`handleTogglePriority` generalize to a `setPriorityTier` operation; dropping into a zone on an eligible column sets that tier (subject to eligibility + cap); dropping into a zone on Upcoming/No Date is not possible since those columns don't render tier zones (matches today's constraint that those columns never show a High zone either).
   - **Collapsed zones must still accept drops for their tier.** Today's High zone has this gap already: the zone's `onDragOver` (which sets `dragOverPriority`) lives only on the zone *body* div, which is unmounted entirely when collapsed (`{!isPriorityCollapsed(col.key) && (<div onDragOver=... >...</div>)}`) — the header/toggle strip above it has no drag handlers of its own. Dropping onto a collapsed zone today therefore falls through to the outer column's `onDrop`, where `dragOverPriority` defaults to `'normal'` regardless of which collapsed header was actually hovered — i.e. today, dropping on a collapsed High header silently misfiles the task as Normal instead of High. **This must be fixed as part of extending collapse to 3 tiers, not carried forward:** move an `onDragOver` (setting `dragOverColumn` + `dragOverPriority` to that zone's tier) onto each tier's header/toggle strip itself, so it fires whether the zone is expanded or collapsed. This makes "drop on the collapsed marker" a real, tier-correct drop target for High, Medium, and Normal alike, rather than a silent Normal fallback.
3. `ColumnPriorityCollapseContext.tsx`: collapse state widens from one bool per column to one bool per **(column, tier)**, now for **all three tiers** — High, Medium, and Normal (not just High/Medium as originally scoped; Normal is no longer permanently expanded). **`isCollapsed`/`toggleColumn` both currently take a single `columnKey` argument — widen both to take `(columnKey, tier)`.** Thread the second argument through every existing call site in `TasksPage.tsx`, and note the call-site count roughly **triples** versus the original 2-zone estimate, since Normal now needs its own header/toggle/collapse-icon/body-conditional block mirroring High's and Medium's — budget PR2's estimate accordingly, this is a bigger UI change than the original "High only" collapse toggle.
4. `TaskCardBody.tsx`/`TaskCard.tsx`: the single amber-star boolean toggle becomes a 3-state control. **Recommended default (confirm during Sneezy review / user sign-off, not a locked decision):** click cycles Normal → Medium → High → Normal, with a distinct color/icon per tier, preserving today's "click to toggle" muscle memory rather than introducing a dropdown or long-press menu.
5. `TaskForm.tsx`: the single "High priority" checkbox becomes a 3-way selector (segmented control or radio group: Normal/Medium/High), gated by the same eligibility rule — High/Medium options disabled or hidden when the task's date is ineligible, Normal always available.
6. `FocusedTaskCard.tsx`/`FocusedView.tsx`: trivial field-name updates only (`task.priority === 'high'` instead of `task.is_high_priority`) — no behavior change, since Focused/Day View keep showing High only (locked-in decision).
7. `api/tasks.ts`: `Task` type gains `priority: 'high' | 'medium' | 'normal'`. Web can fully cut over to `priority` and stop referencing `is_high_priority` anywhere in its own code — web and backend deploy atomically in the same image, so there's no compat window on this side (unlike mobile).

## Frontend Unit Tests (`frontend/src/__tests__/`)
- `taskPriority.test.ts`: rewrite for the 3-way split/eligibility functions.
- `taskOrder.test.ts`: update the `makeTask` fixture's field from `is_high_priority: false` to `priority: 'normal'`.
- `taskFilters.test.ts`: same fixture update.

## Files to Modify (PR2)
- `frontend/src/utils/taskPriority.ts`
- `frontend/src/pages/TasksPage.tsx`
- `frontend/src/context/ColumnPriorityCollapseContext.tsx`
- `frontend/src/components/TaskCard.tsx`
- `frontend/src/components/TaskCardBody.tsx`
- `frontend/src/components/TaskForm.tsx`
- `frontend/src/components/FocusedTaskCard.tsx`
- `frontend/src/components/FocusedView.tsx`
- `frontend/src/api/tasks.ts`
- `frontend/src/__tests__/taskPriority.test.ts`, `taskOrder.test.ts`, `taskFilters.test.ts`

## Pre-Implementation Checklist (PR2)
- Confidence in solution: 4/5 — mechanical extension of an existing 2-zone pattern to 3 zones; main open question is the tier-toggle UI interaction (cycle vs. selector), flagged above as a recommendation, not a lock.
- Regression risk: 3/5 — `TasksPage.tsx` is 600+ lines with nontrivial drag-and-drop state; touching the zone-rendering block risks subtle drop-target regressions if not tested manually across all eligible columns.
- Data model changes: none (consumes PR1's API).
- Test changes needed: see above.
- Deployment order: single component (web; depends on PR1 already merged and deployed, since it consumes the `priority` field).
- Mobile update type: n/a.

---

# PR 3 — Mobile

## What this PR delivers
1. `types/index.ts`: `Task` type gains `priority: 'high' | 'medium' | 'normal'`.
2. `utils/taskPriority.ts`: same generalization as web's PR2 — tier-aware eligibility, 3-way split. **Before replacing `splitByPriority`, confirm whether it's actually consumed anywhere (research pass found no SectionList usage) — if dead, remove it instead of generalizing dead code; if it has a live caller not yet found, generalize it.**
3. `utils/taskGrouping.ts`: **`groupTasksForList()`'s three buckets are not uniform today — verified directly, per-bucket (Sneezy's Gap finding, resolved here rather than left as a generalization risk):**
   - The **`else` branch** (today/tomorrow/day_after_tomorrow/nodate) is the only bucket that currently tiebreaks on `is_high_priority DESC, sort_order ASC` — this is the only branch that gets the 3-way tier rank (`high` < `medium` < `normal`) substituted in, then `sort_order ASC` unchanged.
   - The **`overdue` bucket** tiebreaks on `updated_at` descending (`localeCompare`), not `sort_order` — deliberately mirroring the backend's `focused_view_service.py` Overdue-vs-Today/Tomorrow distinction (`order_by_sort_order=not overdue`). **Leave this bucket's tiebreak untouched** — do not substitute the tier rank in here; only its priority-grouping (if any) would need field-name updates, not its sort logic.
   - The **`upcoming` bucket** has no priority tiebreak at all — sorts only by `target_date`. **Leave this bucket untouched entirely.**
   - No new UI zones on any bucket — reordering within a tier on the `else` branch already "falls out" of its sort once the 3-way key is in place, satisfying the reorder-extension requirement on mobile without new drag-drop code.
4. `components/TaskCardBody.tsx`: the single-tap amber-star boolean toggle becomes the same 3-state control designed in PR2 (Normal → Medium → High → Normal cycle, or whatever interaction PR2 settles on — keep mobile and web visually/behaviorally consistent).
5. `screens/TaskFormScreen.tsx`: single checkbox → 3-way selector, mirroring web's `TaskForm.tsx` shape.
6. `components/FocusedTaskCard.tsx`/`components/FocusedView.tsx`: trivial field-name updates only, no behavior change (High only, locked-in decision).
7. `screens/SettingsScreen.tsx`: daily-limit stepper UI unchanged (only High capped).
8. `screens/TasksScreen.tsx`: no drop-zone changes needed (confirmed structurally different from web — grouped `SectionList`, not kanban); `DraggableTaskRow`'s drag-and-drop continues to only change `target_date`, untouched by this PR.

Mobile can fully cut over to `priority` in its own code, same as web — but unlike web, an **already-installed** old mobile build (pre-OTA-update) will keep sending/receiving `is_high_priority` until it picks up this OTA update, which the backend's PR1 mirror accommodates.

## Mobile Unit Tests (`mobile/src/__tests__/`)
- `taskPriority.test.ts`: rewrite for the 3-way functions (or delete assertions for confirmed-dead code, per point 2 above).
- `taskGrouping.test.ts`: update sort-order assertions for the 3-way tier rank.
- `taskFilters.test.ts`: fixture field update.

## Files to Modify (PR3)
- `mobile/src/types/index.ts`
- `mobile/src/utils/taskPriority.ts`
- `mobile/src/utils/taskGrouping.ts`
- `mobile/src/components/TaskCardBody.tsx`
- `mobile/src/screens/TaskFormScreen.tsx`
- `mobile/src/components/FocusedTaskCard.tsx`
- `mobile/src/components/FocusedView.tsx`
- `mobile/src/screens/TasksScreen.tsx` (verify no changes needed beyond confirming the sort-key change in `taskGrouping.ts` is sufficient)
- `mobile/src/__tests__/taskPriority.test.ts`, `taskGrouping.test.ts`, `taskFilters.test.ts`

## Pre-Implementation Checklist (PR3)
- Confidence in solution: 3/5 — the "no new drop zones needed" conclusion rests on the inventory research's read of `TasksScreen.tsx`; verify this directly (not just trust the research summary) before starting, since being wrong here would mean this PR is scoped too small.
- Regression risk: 2/5 — smaller surface than web (no drag-zone rewrite), but touches the same field across 8 files.
- Data model changes: none (consumes PR1's API).
- Test changes needed: see above.
- Deployment order: single component (mobile; depends on PR1 merged and deployed — does not depend on PR2 at all, can ship before or after web).
- Mobile update type: **OTA** (`eas update`) — all changes are JS/TS only, no native modules, `app.json`, or `eas.json` touched.

---

## Out of Scope / Explicit Follow-Ups
- Dropping the `is_high_priority` mirror column and its legacy-field-resolution code once mobile adoption of `priority` is confirmed complete (needs its own future plan — not part of this epic).
- Adding eligibility/cap validation to the sync path (`routers/sync.py`) — the pre-existing gap (stale offline clients can push unchecked values) is not fixed here, since it predates this feature and fixing it is a separable concern.
- A per-Medium daily cap — explicitly declined by the user for this epic.
- Surfacing Medium in Focused View / Day View — explicitly declined by the user for this epic.

---

## Sneezy's Review — 2026-08-06

**Tier:** FULL — plan touches `models.py`/`schemas.py`/`routers/sync.py`/`task_service.py` (model/schema/router/API-contract area) and declares a non-none data model change (`tasks.priority`); both independently trigger Full per `ARCHITECTURE.MD`'s code-structure gate. Confirmed correct — no escalation needed, tier was already maximal.

**Verdict:** Changes required

### Issues

1. **[Blocker] Field-resolution rule's core backward-compat claim is false — verified against `mobile/src/screens/TaskFormScreen.tsx:226-234` and `:238-244`.** The plan's rule 2 (line 104) asserts an old mobile client's legacy `is_high_priority` writes will "never disturb a task that's already Medium unless the old client explicitly touches that task." I read the actual save handler: both the create body (line 238-244) and the update body (line 226-234) construct `is_high_priority: highPriorityEligible && isHighPriority` as a required, unconditional field — it is sent on **every** save from the Edit Task screen, including edits to title, notes, dates, labels, or links that have nothing to do with priority. There is no "only if the user touched priority" branch in this code. Combined with the plan's own field-resolution rule 2 (any payload with `is_high_priority` and no `priority` maps `False → priority='normal'`), the real consequence is: **any edit to a Medium-priority task made through an old (pre-OTA) mobile Edit Task screen — for any reason — silently demotes it to Normal**, for the entire compat window between PR1's backend deploy and that specific device's OTA update landing. This is not a rare corner case; it is the single most common interaction (editing a task) on a plausible, ordinary path (a user who sets Medium on web or an already-updated phone, then edits the same task from a phone that hasn't updated yet). The same risk applies via `POST /sync` for a stale mobile client's queued offline edits — `routers/sync.py:135` (`server_task.is_high_priority = t_data.get("is_high_priority", server_task.is_high_priority)`) has the identical unconditional-if-present shape. This needs a real fix (e.g., the mobile OTA update — PR3 — landing before or atomically with PR1's mirror-write behavior for any device that might touch Medium tasks, or a resolution rule that only demotes via legacy writes when the *previous* server-side priority was itself `high`/unset, never silently overwriting an existing `medium`) before this plan is safe to implement as written.

   **→ Addressed.** Field-resolution rule rewritten in the API Changes section (3-branch version): a legacy `is_high_priority` write only toggles High↔Normal when the task's current stored `priority` isn't already `'medium'`; if it is, the write is a no-op on `priority`. Applied identically on both the REST update path and `routers/sync.py`. New backend unit tests added specifically for this case (both paths).

2. **[Risk] The "cap re-engages only when moved to current/future date" edge case is real, already fragile pre-PR1, and the plan defers rather than resolves it.** Verified in `backend/app/services/task_service.py`: `_is_hp_eligible_date()` (lines 31-43) returns `True` for any `d <= today + 1`, which includes **all past (overdue) dates**, not just today/tomorrow. In `update_task()` (lines 174-191), the cap check fires whenever `is_high_priority is True` (the raw param) — and since `TaskFormScreen.tsx`/web's `TaskForm.tsx` both unconditionally resend the checkbox's current value on every save (see Issue 1), an overdue High-priority task that is merely re-saved via the Task Form (no drag involved) **will** re-run the daily cap check against its own (past) effective date, contradicting `DATA_MODEL_AND_API.MD`'s documented "cap does not re-engage until moved to a current/future date." I confirmed there is no integration test covering this interaction (`grep -i overdue backend/tests/integration/test_high_priority.py` returns zero hits), so today's behavior in this exact area is unverified by the test suite, not just undocumented. The plan (line 115) correctly flags this as needing verification but explicitly punts it to implementation time ("verify this behavior against the current `update_task()` code path before generalizing") rather than resolving it now — for the plan's own stated riskiest area, this should have been nailed down during planning, especially since generalizing an already-ambiguous 2-tier rule to 3 tiers doubles the number of tier-transition edge cases (normal→medium, medium→high, high→medium, etc.) that inherit the same ambiguity.

   **→ Addressed.** Traced the exact mechanism in the Cap check section: overdue dates are always `_is_hp_eligible_date`-true, so the cap check does re-fire whenever a client resends `is_high_priority=True`, contradicting the doc. Decision: preserve this exact (buggy relative to docs) behavior unchanged for High, rather than fixing an undocumented pre-existing issue as a side effect of this migration. New backend unit test added to pin the actual behavior down for the tri-state field. Doc/code reconciliation flagged as a separate, out-of-scope follow-up.

3. **[Gap] `mobile/src/utils/taskGrouping.ts`'s sort-key generalization is described uniformly but the current code is not uniform.** The plan (Research Basis line 64, PR3 point 3 line 193) describes the sort as "`is_high_priority DESC, sort_order ASC`" generalizing to "a 3-way tier rank... then `sort_order ASC`" for the whole function. I read `groupTasksForList()` (lines 42-65): only the `else` branch (today/tomorrow/day_after_tomorrow/nodate, lines 57-64) matches that description. The `overdue` bucket (lines 43-49) tiebreaks on `updated_at.localeCompare` (descending), not `sort_order` — deliberately mirroring the backend's own Overdue-vs-Today/Tomorrow distinction (`focused_view_service.py`'s `order_by_sort_order=not overdue`). The `upcoming` bucket (lines 50-56) has no priority tiebreak at all, sorting only by `target_date`. If an implementer follows the plan's literal "extends to a 3-way tier rank then `sort_order` ASC" description without independently re-deriving the per-bucket branching from the actual file, the Overdue bucket's tiebreak would silently flip from `updated_at DESC` to `sort_order ASC` — an unscoped behavior change not mentioned or justified anywhere in the plan.

   **→ Addressed.** PR3's `taskGrouping.ts` bullet now treats the three buckets separately: only the `else` branch gets the 3-way tier rank; `overdue` keeps its `updated_at` tiebreak and `upcoming` keeps its date-only sort, both explicitly called out as untouched.

4. **[Nit] Single-statement `NOT NULL DEFAULT 'normal'` migration deviates from this codebase's established multi-step pattern without explanation.** `main.py`'s existing migrations for `sort_order` (`tasks` and `boards`) all use the 3-step add-nullable → backfill → `SET NOT NULL` shape (confirmed via grep — lines ~221-234) because their defaults are computed per-row. The plan's proposed `priority` migration (lines 85-86) does it in one `ALTER TABLE ... ADD COLUMN IF NOT EXISTS priority VARCHAR NOT NULL DEFAULT 'normal'` statement. This is actually fine — a constant default on modern Postgres is a fast, non-rewriting metadata operation, unlike a computed backfill — but the plan doesn't say why it's diverging from the codebase's own established precedent, which will read as an inconsistency to a future reader comparing this migration against `ARCHITECTURE.MD`'s catalogued ones.

   **→ Addressed.** Rationale added to the Data Model Changes section: `sort_order` needed the 3-step form because its default is per-row computed (a timestamp); `priority`'s constant default doesn't need that, so the single-statement form is correct, not an inconsistency.

5. **[Nit] `ColumnPriorityCollapseContext`'s widened (column, tier) signature has un-enumerated call-site fan-out.** `isCollapsed(columnKey)` / `toggleColumn(columnKey)` are currently single-argument (confirmed in `ColumnPriorityCollapseContext.tsx` and called at 5+ sites in `TasksPage.tsx`: lines 436, 438, 441, 452, 473, 483, 514). Both files are already in PR2's file list, so this isn't a missing-file gap, but the plan's one-line description ("collapse state widens... to one bool per (column, tier)") doesn't flag that every existing call site needs a second argument threaded through — worth a one-line implementation note so it isn't missed mid-refactor.

   **→ Addressed, and expanded further per follow-up user direction.** PR2's `ColumnPriorityCollapseContext` bullet now explicitly widens `isCollapsed`/`toggleColumn` to `(columnKey, tier)` and calls out the call-site fan-out. Subsequently, the user also asked to make Normal collapsible (originally scoped as permanently expanded) — this roughly triples the fan-out versus even Sneezy's estimate, since Normal now needs its own header/toggle/collapse-icon/body-conditional block. Also fixed, while touching this code: a related pre-existing bug where dropping onto a *collapsed* zone fell through to the outer column handler and silently misfiled the task as Normal — each tier's header/toggle strip now carries its own drag-over handler so collapsed zones remain correct drop targets.

### Unverified assumptions

- **Mobile's central "no new drag-drop zones" claim (line 15, 198) — verified TRUE, not just trusted.** I read `mobile/src/screens/TasksScreen.tsx` directly: it is a `SectionList` (imported line 5, rendered line 835), and `DraggableTaskRow`'s `performDrop()` (lines 563-613) sends only `{ target_date: newDate }` on drop — it never reads or writes `is_high_priority`. The plan's structural claim holds up under direct inspection; PR3's Confidence 3/5 caveat about verifying this "directly... before starting" can be resolved now — it's already confirmed correct, modulo Issue 3 above (the sort-tiebreak nuance the same research pass missed).
- **Mobile `splitByPriority`'s dead-code status (line 67, 192) — verified DEAD, not just suspected.** `grep -rn splitByPriority mobile/src` shows its only references are in its own test file (`mobile/src/__tests__/taskPriority.test.ts`) — it is never imported by `TasksScreen.tsx`, `taskGrouping.ts`, or any component. (Contrast: web's `splitByPriority` is actively used in `TasksPage.tsx:255` and `:386` — a live, load-bearing function there.) The plan should commit to removing it on mobile rather than generalizing it; no further "verify during implementation" hedging is needed on this specific point.
- **The claim that Focused/Day View "keep working unchanged as long as High-only maps to `priority=='high'`" (line 53) — verified consistent, with one unstated tradeoff.** `focused_view_service.py`'s `_query_board_grouped_tasks()` orders by `Task.is_high_priority.desc()` then a tiebreak (line 132), which the plan says is fine to leave as-is post-PR1 since `is_high_priority` and `priority=='high'` stay mirrored. That's correct for the High/not-High split, but it also means Medium tasks get no distinct visual precedence over Normal ones in Day View's ordering (both read as `is_high_priority=False`) — the plan frames the `is_high_priority` vs. `priority` ordering choice as "either is correct," which is true only if Medium is never meant to outrank Normal in that view's tiebreak. Not explicitly a bug (Medium isn't required to surface with special ordering anywhere per the locked-in decisions), but worth a one-line explicit call rather than "either is fine."

### Suggestions

- Resolve Issue 1 before implementation — it is the one finding that actually breaks the plan's stated backward-compatibility guarantee, not just an edge case within it. A concrete fix path: have PR1's legacy-mapping branch only apply when the *current stored* priority is not already `medium` (i.e., a bare legacy `is_high_priority` write can freely toggle between `high`/`normal` — old semantics — but is not allowed to silently clobber an existing `medium`, which the old client has no concept of and therefore no intent to change).
- Add an explicit backend unit test for the overdue+cap interaction (Issue 2) as part of PR1's test list — today it's a documentation claim with no test backing it, and the plan is about to generalize it to twice the number of tier-transition cases.
- Add a one-line note in PR3's file list next to `taskGrouping.ts` clarifying that the `overdue` and `upcoming` buckets keep their existing (non-`sort_order`) tiebreaks — only the `else` branch's tiebreak needs the 3-way tier rank applied to it.

— *Sneezy*
