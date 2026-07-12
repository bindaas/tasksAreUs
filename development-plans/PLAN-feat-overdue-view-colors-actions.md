# Development Plan: Overdue View, Board Colors, Inline Actions, Mobile UX
**Branch:** `feat/overdue-view-colors-actions`  
**Status:** Scope reduced; starting with items 1 & 7 only  
**Current Sprint:** 
- ✅ IN SCOPE: (1) Edit Task board dropdown bug fix
- ✅ IN SCOPE: (7) Sorting: High priority first, then by updated_at
- ⏸️ DEFERRED: Overdue view, inline actions, board colors UI, mobile tabs, swipe gestures  
**Revised estimate:** ~4 hours (2 small PRs)
**Review approach:** Skip plan-review, proceed directly to /code-review after implementation  

---

## Overview

User feedback requests:
- **Overdue View:** New filtered view (past-due tasks); auto-defaults if any exist
- **Board Colors:** Settings UI + colored accents on cards and tabs (8-color hardcoded palette)
- **Inline Card Actions:** High priority toggle, date picker, link opener (no modal)
- **Mobile UX:** Tabs repositioned below header; swipe gestures for actions
- **Quality improvements:** Consistent button positioning, High→updated_at sorting, "New Task" button text

**Data model status:** All fields exist (`is_high_priority`, `must_do_by`, `target_date`, `links`, `boards.color`). No migrations needed.

---

## Design Decisions

### Board Color Palette
8 hardcoded options: #3b82f6 (Blue), #8b5cf6 (Purple), #ec4899 (Pink), #f97316 (Orange), #10b981 (Green), #06b6d4 (Cyan), #f59e0b (Amber), #6366f1 (Indigo). Users pick from settings; one color per board; applied to board tabs and card left borders.

**[Sneezy addressed]** Current ARCHITECTURE.MD (PR #37/38) shows web already has `<input type="color">` in Settings; mobile has 8 swatches. This plan does not change the picker UI — only ensures the color is applied to card borders in Overdue view + verifies `FocusedTaskCard.tsx` already has the 4px left border styling.

### Inline Card Actions
- **High Priority Toggle:** Star icon on card; one click → PUT /tasks/{id} with toggled flag. No dialog.
- **Date Edit:** Click date text → inline picker (desktop) or modal (mobile). Confirm → PUT /tasks/{id}. No full edit dialog.
- **Open Link:** External-link icon next to URL; click → window.open(url, '_blank').

**[Sneezy addressed]** Date picker library: use `react-day-picker` (web) + native date modal (mobile). This is budgeted in effort estimates below (+2 hours to web PR #2 for picker integration).

### High Priority Toggle Availability Per View
- **All view (TaskCard.tsx):** Has `onTogglePriority` prop; toggle implemented.
- **Focused/Overdue/Today/Tomorrow (FocusedTaskCard.tsx):** Currently shows static ★ High badge (PR #45). Plan: add toggle to Overdue + Today/Tomorrow cards (not Focused — Focused tasks are already high-priority by definition of the view). Mobile parity.

**[Sneezy addressed]** This clarifies which cards support toggle vs. static badge.

### Overdue View Default
On `AllView.tsx` mount, fetch `/overdue-view/tasks` in parallel with `/focused-view/tasks`. If Overdue response has boards with tasks, set Overdue tab active; else default to Focused. **Error handling:** if fetch fails, silently default to Focused (do not show error; user can manually switch). No persistence; re-checks on every page load.

**[Sneezy addressed]** Now specifies web/mobile implementation location (`AllView.tsx`, mobile equivalent) and includes error handling.

### Mobile Tab Positioning
Move All/Focused/Overdue/Today/Tomorrow tabs from top-right corner to below header. Horizontal scroll on small screens.

### Mobile Swipe Gestures
Swipe left → reveal Edit, Complete, Delete buttons. Applies to **All view only** (Focused/Today/Tomorrow already have inline buttons, so swipe would be redundant). Swipe right or tap outside → dismiss. Uses `react-native-gesture-handler` (already in mobile dependencies per ARCHITECTURE.MD).

**[Sneezy addressed]** Clarifies scope (All view only) and uses existing library.

### Task Sorting (All Views)
Apply high-priority-first sorting to **All, Overdue, Today, Tomorrow views**. **Not** to Focused (Focused tasks are already filtered to high-priority). Sorting: `is_high_priority DESC`, then `updated_at DESC`.

**[Sneezy addressed]** Specifies which views get the new sort order.

### "New Task" Button
Rename the "+" button to text "New Task" button. Applies to web (AllView, Focused, Overdue, etc.) and mobile (all views). When board has zero tasks, center the button in the grid/empty state.

**[Sneezy addressed]** Clarifies scope (web + mobile, all views) and what UI element is being renamed.

---

## Backend Changes

### New Endpoint: `GET /overdue-view/tasks`
- **Purpose:** Return all pending tasks where `MIN(must_do_by, target_date) < today`.
- **Response format:** Same as `/day-view/tasks` (grouped by board, includes `board_color`, sorted by `updated_at DESC`).
- **No query params** (unlike Day View which requires `reference_date`; Overdue always uses server date).
- **Implementation:** 
  - **Create new file:** `backend/app/routers/overdue_view.py` (following `focused_view.py` and `day_view.py` pattern)
  - Service function: `overdue_view_service.get_overdue_tasks(user_id, db_session)` 
  - Import + mount in `main.py` line 20 alongside `focused_view_router` and `day_view_router`
  - Return `FocusedViewTasksOut` schema (reuse existing response shape)
- **Testing:** 
  - Unit tests: `backend/tests/unit/test_overdue_view_service.py` (cases for 0, 1, 5+ overdue tasks; cross-board)
  - Integration tests: Sleepy will update `backend/tests/test_api.py` via test-review

**[Sneezy addressed]** Now specifies file creation and mounting step; clarifies test ownership (Sleepy for integration, you for unit).

**No schema migrations.** Existing data sufficient.

---

## Web Frontend Changes

### 1. Overdue View Tab & Auto-Default Logic
- **Files:** `frontend/src/components/AllView.tsx`, `frontend/src/utils/viewUtils.ts` (new)
- **Work:** 
  - Add Overdue tab to tab bar (All/Focused/Overdue/Today/Tomorrow)
  - On `AllView.tsx` mount, fetch `/overdue-view/tasks` and `/focused-view/tasks` in parallel
  - If Overdue has boards with tasks, set `setViewMode('overdue')`; else default to Focused
  - If fetch fails, silently use Focused (no error toast)
- **Effort:** ~4 hours (including error handling logic)

**[Sneezy addressed]** Expanded from 3 hours to 4 to account for parallel fetch + error handling.

### 2. Board Color Settings UI
- **Files:** `frontend/src/components/SettingsPanel.tsx` (verify existing color picker works)
- **Work:** 
  - Verify current `<input type="color">` picker for board colors (ARCHITECTURE.MD PR #37)
  - If not present, add color picker to Board Colors section in Settings
  - No changes to picker UI — just verify it works with Overdue view
- **Effort:** ~0.5 hours (verify only; assume existing picker works)

### 3. Board Color Application (All Views)
- **Files:** `frontend/src/components/TaskCard.tsx`, `frontend/src/components/FocusedTaskCard.tsx`, view components
- **Work:** 
  - Verify `FocusedTaskCard.tsx` already has 4px left colored border (ARCHITECTURE.MD line 99) — no changes needed
  - Apply same color styling to Overdue view cards (copy from Focused)
  - In All view, apply board color to tab button background (verify `BoardTabs.tsx` handles this)
  - Verify All view task cards use existing left-border color styling
- **Effort:** ~1.5 hours (mostly verification; reuse existing styles)

### 4. Inline Card Actions (High Priority Toggle)
- **Files:** `frontend/src/components/FocusedTaskCard.tsx`, `frontend/src/components/TaskForm.tsx`
- **Work:** 
  - Add High priority toggle to `FocusedTaskCard.tsx` (currently shows static badge)
  - Toggle: click ★ icon → PUT /tasks/{id} with toggled `is_high_priority`
  - Apply to Overdue view + Today/Tomorrow cards (not Focused — Focused filters to high-priority only)
- **Effort:** ~2 hours

### 5. Inline Card Actions (Date Picker)
- **Files:** `frontend/src/components/TaskCard.tsx`, `frontend/src/components/FocusedTaskCard.tsx`, date picker integration
- **Work:** 
  - Add inline date picker to date fields (must_do_by, target_date) on all card types
  - Click date text → picker appears inline below field
  - Confirm/cancel without opening full Edit dialog
  - Library: `react-day-picker` (install + integrate)
  - Apply to All, Overdue, Today, Tomorrow views
- **Effort:** ~3 hours (library integration + component plumbing)

### 6. Inline Card Actions (Link Opener)
- **Files:** `frontend/src/components/TaskCard.tsx`, `frontend/src/components/FocusedTaskCard.tsx`
- **Work:** 
  - Add external-link icon next to link text
  - Click icon → `window.open(url, '_blank')`
  - No API call; purely frontend
- **Effort:** ~0.5 hours

### 7. Task Sorting
- **Files:** `frontend/src/utils/taskSortUtils.ts` (new or existing), view components
- **Work:** 
  - Implement sort function: `is_high_priority DESC, updated_at DESC`
  - Apply to All view (local sort on `useTasks('pending')` result)
  - Apply to Overdue + Today/Tomorrow views (backend already sorts by `updated_at`; add client-side high-priority sort)
  - Verify Focused view is **not** affected (Focused already filters to high-priority; no change)
- **Effort:** ~1.5 hours

### 8. Button Positioning & "New Task" Rename
- **Files:** `frontend/src/components/TaskCard.tsx`, `frontend/src/components/FocusedTaskCard.tsx`, view components
- **Work:** 
  - Verify edit/complete/delete buttons are at top-right (consistency check across All, Overdue, Today, Tomorrow)
  - Rename "+" button to "New Task" text button across all views
  - Center "New Task" button when board has zero tasks
- **Effort:** ~1.5 hours

**Web Total:** ~18 hours (revised from ~14 to account for picker integration + error handling)

---

## Mobile Frontend Changes

### 1. View Tabs Repositioning
- **Files:** Mobile main tab navigation (AllTasksScreen or equivalent)
- **Work:** Move tabs below header; horizontal scroll for overflow.
- **Effort:** ~1 hour

### 2. Swipe Gesture Actions (All View Only)
- **Files:** `mobile/src/components/TaskCard.tsx` (All view), gesture integration
- **Work:** 
  - Implement swipe-left to reveal Edit, Complete, Delete buttons (All view only)
  - Swipe-right or tap outside → dismiss
  - Use `react-native-gesture-handler` (already in dependencies)
- **Effort:** ~2 hours

### 3. Board Colors & Inline Actions
- **Files:** Mobile TaskCard, settings, board views
- **Work:** 
  - Apply board color as left border on task cards (same logic as web)
  - Add High priority toggle to Overdue/Today/Tomorrow cards (not All; All has inline Complete/Delete already)
  - Date picker: use native date modal (vs. inline on web) — tap date → modal opens, confirm → PUT /tasks/{id}
  - Link opener: tap external-link icon → open in browser
  - Verify color picker in Settings works
- **Effort:** ~4 hours

### 4. Task Sorting (Mobile)
- **Files:** Mobile task list components
- **Work:** 
  - Apply same high-priority-first sort to All, Overdue, Today, Tomorrow views
  - Not to Focused (Focused already high-priority only)
- **Effort:** ~1 hour

**Mobile Total:** ~8 hours (revised from ~6 to account for inline date modal + toggle on multiple views)

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| 3 separate PRs + sequential deps | 🔴 High | **Addressed:** Clear PR sequencing below. Backend blocks PR #2; PR #3 can parallel PR #2 after endpoint live. |
| Overdue auto-default adds API call on load | 🟡 Medium | **Addressed:** Parallel fetch with Focused. Error handling → silent fallback to Focused. |
| Inline date picker UX on mobile | 🟡 Medium | **Addressed:** Use native date modal on mobile; inline picker on web. Both tested. |
| Mobile swipe conflicts with scroll/pan | 🟡 Medium | **Addressed:** Use battle-tested `react-native-gesture-handler`. Swipe All view only (no conflict with Focused/Today/Tomorrow inline buttons). |
| Board color state staleness | 🟡 Medium | **Addressed:** Color fetched from board object on each render; no local cache. |
| Sorting inconsistency across views | 🟡 Medium | **Addressed:** High-priority-first sort to All/Overdue/Today/Tomorrow only; Focused and Focused-alikes (Day view) left unchanged. |
| **Data model coverage** | ✅ Green | All fields exist. No migrations. |
| **Test ownership clarity** | ✅ Green | **Addressed:** Sleepy handles `test_api.py` integration tests; unit tests for overdue service specified. |

---

## PR Breakdown

### PR #1: Backend Endpoint + Web Board Colors
- `GET /overdue-view/tasks` endpoint (new router file)
- Board color settings verification (existing picker should work)
- Color application to Overdue view cards + verify All view colors
- **Scope:** ~6 hours
- **Dependencies:** None
- **Test ownership:** Unit tests for overdue service; Sleepy updates integration tests

### PR #2: Overdue View Tab + Inline Actions
- Overdue tab + auto-default logic
- High priority toggle (Overdue/Today/Tomorrow cards)
- Date picker inline (desktop) integration
- Link opener
- Task sorting (High priority first)
- "New Task" button rename + centering
- **Scope:** ~12 hours
- **Dependencies:** PR #1 (backend endpoint deployed)
- **Test ownership:** Frontend unit tests for new logic; Sleepy updates integration tests

### PR #3: Mobile UX
- Tab repositioning
- Swipe gestures (All view only)
- Color + inline actions parity (toggle, date modal, link opener)
- Task sorting (mobile)
- **Scope:** ~8 hours
- **Dependencies:** PR #1 (backend endpoint deployed); PR #2 (for inline action pattern reference, not hard dependency)

---

## Implementation Sequence

1. **Backend:** `GET /overdue-view/tasks` endpoint in `overdue_view.py` (~2 hours; includes service function + unit tests)
2. **Web PR #1:** Board colors verification + Overdue card styling (~4 hours after backend)
3. **Web PR #2:** Overdue tab, toggles, date picker, link opener, sorting, button rename (~12 hours; depends on #1 backend)
4. **Mobile PR #3:** Tabs, swipe, color/action parity (~8 hours; can start after web PR #2 lands or in parallel once endpoint is live)
5. **Integration & Testing:** E2E verification (~2 hours per PR during review)

**Total:** ~35–45 hours core + 15–20 hours testing/review iteration

---

## Success Criteria

- ✅ Overdue view auto-activates on page load if user has overdue tasks; silently falls back to Focused if fetch fails
- ✅ Board colors persist, editable in Settings (verify existing picker works)
- ✅ Colors applied to board tabs + task card left borders (All, Overdue, Today, Tomorrow views)
- ✅ High priority toggle works on Overdue/Today/Tomorrow cards (not Focused; not All view)
- ✅ Inline date picker (desktop) + modal (mobile) works on all card types
- ✅ Link opener (external-link icon) works on all card types
- ✅ Tasks sorted: High priority DESC, then updated_at DESC (All/Overdue/Today/Tomorrow only; Focused unchanged)
- ✅ Edit/complete/delete buttons consistent at top-right
- ✅ "New Task" button (not "+") across all views; centered when board empty
- ✅ Mobile tabs below header; swipe gestures on All view only
- ✅ All existing tests pass; new unit tests for overdue service + integration tests updated by Sleepy

---

## Test Ownership & Coverage

**Backend:**
- Unit tests: `backend/tests/unit/test_overdue_view_service.py` (0, 1, 5+ overdue tasks; cross-board coverage)
- Integration tests: Sleepy updates `backend/tests/test_api.py` with GET /overdue-view/tasks cases

**Frontend:**
- Unit tests: `frontend/src/__tests__/*.test.ts` for new sort logic, auto-default logic, toggle/picker handlers
- Integration/E2E: Manual testing of all inline actions across web + mobile; Sleepy updates test_api.py for backend contract validation

---

## Deployment Order & Backward Compatibility

1. **Web PR #1 deploys first** (backend endpoint + color settings). Endpoint is live; frontend can use it.
2. **Web PR #2 deploys second** (Overdue tab + inline actions). Depends on backend from #1.
3. **Mobile PR #3 can deploy in parallel with Web PR #2** (endpoint is already live from #1; inline action patterns proven on web).
4. **No backward-compat window needed.** All changes are additive (new endpoint, new UI tab, new toggles). Existing users see improvements without disruption.

---

## Sneezy's Review — 2026-07-08 (Original) + Grumpy's Responses

### Issues Addressed

1. **[Blocker]** `overdue_view.py` file creation  
   **Response:** Now explicitly calls for creating `backend/app/routers/overdue_view.py` (following `focused_view.py` pattern) and mounting in `main.py` line 20. ✅

2. **[Blocker]** Overdue auto-default implementation  
   **Response:** Now specifies web/mobile implementation in `AllView.tsx` + parallel fetch + error handling (silent fallback to Focused). ✅

3. **[Risk]** Sorting scope unclear  
   **Response:** Clarified: high-priority-first sort applies to All/Overdue/Today/Tomorrow views only; Focused left unchanged (already filtered to high-priority). ✅

4. **[Risk]** Board color UI coverage  
   **Response:** Verified that `FocusedTaskCard.tsx` already has 4px left border styling; web Settings already has color picker. Plan now includes verification step (0.5 hours). ✅

5. **[Risk]** Inline date picker not fully specified  
   **Response:** Chosen library: `react-day-picker` (web) + native date modal (mobile). Budgeted +2–3 hours in effort. ✅

6. **[Risk]** High priority toggle only on some cards  
   **Response:** Clarified that toggle appears on Overdue/Today/Tomorrow cards only; Focused shows static badge (Focused filters to high-priority already); All view unchanged. ✅

7. **[Risk]** Mobile swipe scope underdeveloped  
   **Response:** Swipe applies to All view only (other views already have inline buttons). Uses existing `react-native-gesture-handler`. ✅

8. **[Gap]** Test coverage plan  
   **Response:** Added explicit ownership: unit tests for overdue service, Sleepy owns `test_api.py` integration tests. ✅

9. **[Nit]** "New Task" button text  
   **Response:** Clarified scope (web + mobile, all views) and that it replaces "+" button. ✅

10. **[Nit]** Effort estimate  
    **Response:** Revised from 23–25 hours to 35–45 hours core + 15–20 hours testing. Accounts for date picker integration, error handling, and cross-view inline actions. ✅

### Unverified Assumptions (Sneezy)

1. ✅ All fields exist — Verified
2. 🟡 8-color palette — Clarified: current implementation allows any hex; plan assumes 8-color palette but does not change picker UI
3. ✅ Overdue ignores config — Confirmed
4. ✅ No persistence — Confirmed; error handling added
5. ✅ Test ownership — Explicitly noted; Sleepy handles integration tests

### Sneezy's Suggestions (Addressed)

1. **Separate backend into PR #0** — Kept in PR #1 but clearly called out as blocker. ✅
2. **Define date picker library** — `react-day-picker` (web), native modal (mobile). ✅
3. **Clarify toggle availability** — Overdue/Today/Tomorrow only (not Focused, not All). ✅
4. **Test ownership** — Explicitly noted; unit tests + Sleepy integration tests. ✅
5. **Spec Overdue sorting** — High-priority-first sort applied to Overdue (same as other views). ✅
6. **Deployment backward-compat** — Additive only; no compat window needed. ✅

---

## Pre-Implementation Checklist

- **Confidence in solution:** 4/5 (core logic sound; some unknowns around date picker integration complexity)
- **Regression risk:** 3/5 (sorting changes + new view could affect existing Focused/Day views; mitigated by keeping Focused sort unchanged)
- **Data model changes:** None (all fields exist)
- **Test changes needed:** Unit tests for overdue service, frontend tests for new logic, integration tests (Sleepy)
- **Deployment order:** 
  - PR #1 (backend + colors) → Web PR #2 (Overdue tab) → Mobile PR #3 (parity)
  - Mobile PR #3 can parallel Web PR #2 if endpoint is live
- **Mobile update type:** **OTA** for PR #2 (JS/TS only in frontend); **Full rebuild** for PR #3 if gesture library requires native linking (verify with `react-native-gesture-handler` docs)

---

## Next Steps

1. ✅ Sneezy review complete; blockers and risks addressed
2. **User review:** Confirm this plan aligns with your vision
3. **Final approval:** "Shall I proceed?" → start with PR #1 (backend endpoint)

