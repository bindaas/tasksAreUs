# Development Plan: Enhance All View with Priority Collapse & Date Display

**Branch**: `feat-all-view-priority-collapse`  
**Scope**: All view (kanban board) only — web frontend  
**Deployment**: OTA only (JS/TS changes)

---

## Summary

Enhance the All view (kanban board) with date/day-of-week display, collapsible high-priority/normal-priority task groups in all date columns (Today, Tomorrow, Day After Tomorrow, and Monday if Friday), and per-day high-priority limits.

---

## Requirements

1. **All view column headers with date/day**: Display date and day-of-week for date columns — e.g., "Today (July 27, Sunday)" instead of just "Today"
2. **Day After Tomorrow column gets priority split**: The existing Day After Tomorrow kanban column (currently single zone) gains high-priority and normal-priority task groups with collapsible headers (chevron toggle), matching Today/Tomorrow functionality
3. **Monday column (if Friday)**: When today is Friday, add a Monday column after Day After Tomorrow with high/normal priority split and collapsible headers
4. **Collapsible priority zones**: All date columns (Today, Tomorrow, Day After Tomorrow, Monday if Friday) have collapsible high-priority zones; normal-priority zone always visible. Collapse state per column, session-only
5. **Per-day high-priority limits**: Each day (Today, Tomorrow, Day After Tomorrow, Monday if present) has its own independent high-priority limit (same value from useSettings, applied per day)

---

## Data Model Changes

None. All changes are frontend UI only.

---

## API Changes

None. Existing endpoints used as-is.

---

## Files to Modify

1. **`frontend/src/utils/taskDateUtils.ts`**
   - Extend `ColumnKey` type to include `'monday'`: `type ColumnKey = 'overdue' | 'today' | 'tomorrow' | 'day_after_tomorrow' | 'monday' | 'upcoming' | 'nodate'`
   - Add `formatDateWithDay(dateStr: string): string` — returns e.g. "July 27, Sunday"
   - Add `isFriday(): boolean` — returns `new Date().getDay() === 5`
   - Update `getColumn()` to detect Monday dates when today is Friday: if today is Friday and task date === Monday, return 'monday'
   - Update `getDropDate()` to handle 'monday' column key (return Monday date if today is Friday)

2. **`frontend/src/utils/taskPriority.ts`**
   - Update `isHighPriorityEligible(columnKey: ColumnKey)` to return true for 'day_after_tomorrow' and 'monday' columns (currently only true for 'today' and 'tomorrow')

3. **`frontend/src/pages/TasksPage.tsx`** (All view kanban rendering logic)
   - Add Friday detection state: `const isFriday = useMemo(() => new Date().getDay() === 5, [])`
   - Compute Monday date: `const monday = useMemo(() => { if (!isFriday) return null; const m = new Date(tomorrow); m.setDate(m.getDate() + 1); return dateOnly(m); }, [isFriday, tomorrow])`
   - Update COLUMNS array (lines 40-47):
     - Replace static titles with date/day display: `{ key: 'today', title: `Today (${formatDateWithDay(today)})` }`
     - Conditionally include Monday column when isFriday: `...(isFriday ? [{ key: 'monday', title: `Monday (${formatDateWithDay(monday!)})` }] : [])`
   - Update `columnTasks` memo (line 131) to include 'monday' key in the map when isFriday
   - Add priority collapse state: `const [collapsedPriorityByColumn, setCollapsedPriorityByColumn] = useState<Partial<Record<ColumnKey, boolean>>>({})`
   - Update column rendering logic (lines 330-428):
     - For day_after_tomorrow column: apply same priority-split rendering as Today/Tomorrow (currently doesn't get the `isPriorityColumn` treatment because `isHighPriorityEligible()` doesn't include it)
     - For Monday column (when isFriday): render with high/normal priority zones like Today/Tomorrow
     - Modify high-priority zone to show chevron toggle based on `collapsedPriorityByColumn[col.key]`
     - Add handler: `const togglePriorityCollapse = (columnKey: ColumnKey) => setCollapsedPriorityByColumn(prev => ({ ...prev, [columnKey]: !prev[columnKey] }))`

---

## Implementation Strategy

### Phase 1: Utilities & Helpers
- Update `ColumnKey` type in `taskDateUtils.ts` to include `'monday'`
- Add `formatDateWithDay(dateStr: string): string` helper — formats as "July 27, Sunday" using locale-aware `toLocaleDateString`
- Add `isFriday(): boolean` — returns `new Date().getDay() === 5`
- Update `getColumn()` to route tasks to 'monday' when today is Friday and task date matches Monday
- Update `getDropDate()` to return Monday date for 'monday' column key when today is Friday
- Update `isHighPriorityEligible()` in `taskPriority.ts` to return true for 'day_after_tomorrow' and 'monday'

### Phase 2: All View (Kanban Board)
- Add Friday detection in TasksPage: `const isFriday = useMemo(() => new Date().getDay() === 5, [])`
- Compute Monday date when Friday: `const monday = useMemo(() => { if (!isFriday) return null; const m = new Date(tomorrow); m.setDate(m.getDate() + 1); return dateOnly(m); }, [isFriday, tomorrow])`
- Update COLUMNS array to:
  - Replace static titles with dynamic ones using `formatDateWithDay()` (e.g., "Today (July 27, Sunday)")
  - Conditionally include Monday column when isFriday (appears after Day After Tomorrow)
- Add priority collapse state: `useState<Partial<Record<ColumnKey, boolean>>>({})` — tracks which columns have collapsed high-priority zones
- Modify column rendering (lines 330-428) to:
  - Show collapsible header with chevron for high-priority zone (instead of static zone)
  - Render high-priority tasks only when not collapsed
  - Add click handler to toggle collapse state
  - Render normal-priority zone always (never collapsed)
- **Monday column lifecycle**: Only renders when `isFriday === true`; disappears immediately after Friday ends (as the day rolls over at midnight locally). Tasks assigned to Monday remain on Monday in the backend; the UI column just becomes unavailable after Friday.

### Phase 3: Unit Tests
- **`frontend/src/__tests__/taskDateUtils.test.ts`**: 
  - Test `formatDateWithDay()` output format (e.g., "July 27, Sunday")
  - Test `isFriday()` on Friday vs other days
  - Test `getDropDate('monday')` returns Monday date when today is Friday
  - Test `getColumn()` returns 'monday' for Monday dates when today is Friday
  - Test `getColumn()` returns 'day_after_tomorrow' for day-after-tomorrow dates
- **`frontend/src/__tests__/taskPriority.test.ts`**:
  - Test `isHighPriorityEligible('day_after_tomorrow')` returns true
  - Test `isHighPriorityEligible('monday')` returns true
- **Manual testing (All view only)**:
  - Verify date/day display on Today, Tomorrow, Day After Tomorrow columns (e.g., "Today (July 27, Sunday)")
  - Verify Day After Tomorrow column now has high/normal priority zones (was previously missing)
  - Verify Monday column appears on Friday only, disappears after
  - Verify priority zones are collapsible: chevron toggles collapse state, high-priority zone hides when collapsed
  - Verify normal-priority zone always visible (never collapses)
  - Verify drag-drop works for Today, Tomorrow, Day After Tomorrow, and Monday columns
  - Verify each day's high-priority limit is enforced independently
  - Verify collapse state is session-only (resets on page reload)

---

## Backward Compatibility

✅ No API changes, no database changes, no breaking changes to component contracts.

---

## Deployment Order

Single component, single deployment:
1. Merge PR to main
2. Railway auto-deploys on main push (Dockerfile builds frontend + backend)

---

## Edge Cases & Behaviors

- **Leap year / month boundaries**: `getDropDate()` uses native Date math (handles correctly)
- **Timezone**: Uses local browser timezone (consistent with existing logic)
- **Collapse state reset**: Priority collapse state is session-only React state (in `TasksPage` and `DayView` components); resets on page reload (expected)
- **Monday column after Friday ends**: Only renders when `today.getDay() === 5` (evaluated on render). Column disappears immediately after midnight rolls over to Saturday locally (no manual dismissal needed). Tasks already assigned to Monday remain on Monday in the backend; they just become unreachable from the UI until Friday comes around again.
- **High-priority limit per-day**: Each day uses the same limit value from `useSettings().highPriorityDailyLimit`, but the limit is applied independently per day (no carryover between days)

---

## Success Criteria

- ✅ All view kanban columns (Today, Tomorrow, Day After Tomorrow) show date and day-of-week in headers (e.g., "Today (July 27, Sunday)")
- ✅ Day After Tomorrow column now has high-priority and normal-priority task zones (previously lacked this split)
- ✅ Priority zones in all date columns are collapsible: high-priority group has chevron toggle; normal-priority zone always visible
- ✅ Friday detection works correctly; Monday column appears when today is Friday, disappears after
- ✅ Monday column supports drag-drop, priority split/collapse, and per-day high-priority limits
- ✅ Per-day high-priority limits enforced independently (Today, Tomorrow, Day After Tomorrow, Monday each have their own limit)
- ✅ Collapse state is session-only per column; resets on page reload
- ✅ Mobile responsive (All view already handles overflow-x auto)

---

## Risk Assessment

- **Regression risk**: 3/5 (modifying TasksPage column layout + DayView structure)
- **Complexity**: Medium (priority split logic exists, reusing + extending it)
- **Testing**: Manual UI testing required; no unit test changes needed

---

## Approval — 2026-07-27

✅ Plan approved by user. All view only — no DayView/Today/Tomorrow/Focused changes.

**Key clarifications**:
- Day After Tomorrow is an existing kanban column (not a new view mode) that now gains priority-split capability
- Priority collapse state is session-only React `useState` in TasksPage
- Monday column appears only on Friday, disappears after midnight rolls over locally
- Each day enforces the same high-priority limit value independently (no cross-day carryover)
- Monday column format: "Monday (July 31, Wednesday)" using locale-aware date formatting
