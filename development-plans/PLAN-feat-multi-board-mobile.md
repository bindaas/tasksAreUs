# Development Plan: Multi-board Mobile Support (PR 3/3)

**Branch:** `feat-multi-board-mobile`
**Status:** Ready for review

---

## Goal

Add multi-board awareness to the React Native / Expo mobile app. Every API call that is board-scoped (tasks, labels, conversations, reports) must pass the active board's ID. Users must be able to switch boards and manage boards from Settings.

---

## Background

- PR #33 (backend): added `boards` table, board-scoped tasks/labels/conversations, `GET/POST/PUT/DELETE /boards` API.
- PR #34 (web frontend): added `BoardContext`, `BoardSwitcher`, board management in `SettingsPage`.
- This PR ports that same capability to the mobile app.

---

## Scope

### New files

| File | Purpose |
|------|---------|
| `mobile/src/api/boards.ts` | `getBoards`, `createBoard`, `updateBoard`, `deleteBoard` |
| `mobile/src/context/BoardContext.tsx` | `BoardProvider`, `useBoard()` — mirrors web `BoardContext` |
| `mobile/src/__tests__/boards.api.test.ts` | 7 Jest unit tests for the boards API (mirrors `frontend/src/__tests__/boards.api.test.ts`) |

### Modified files

| File | Change |
|------|--------|
| `mobile/src/types/index.ts` | Add `Board` interface; add `board_id: string` to `Task` and `Conversation` |
| `mobile/src/navigation/AppNavigator.tsx` | Wrap `Tab.Navigator` in `BoardProvider` (inside the authenticated return branch, after `if (!user)` check) |
| `mobile/src/api/tasks.ts` | `listTasks(state?, boardId?)`, `createTask(body, boardId?)` |
| `mobile/src/api/labels.ts` | `listLabels(category?, boardId?)`, `createLabel(category, value, boardId?)` |
| `mobile/src/api/conversations.ts` | `createConversation(boardId?)` |
| `mobile/src/api/reports.ts` | `getCompletions(from, to, boardId?)` |
| `mobile/src/screens/TasksScreen.tsx` | Board switcher header; pass `activeBoard?.id`; clear filters on board switch |
| `mobile/src/screens/TaskFormScreen.tsx` | Pass `activeBoard?.id` to `createTask` + `listLabels` |
| `mobile/src/screens/ChatScreen.tsx` | Reset conversation on board switch; pass `boardId` to `createConversation` |
| `mobile/src/screens/ReportsScreen.tsx` | Pass `boardId` to `getCompletions` |
| `mobile/src/screens/SettingsScreen.tsx` | Add "Boards" section; scope `listLabels` to `activeBoard?.id` |
| `mobile/src/__tests__/taskFilters.test.ts` | Add `board_id: 'board-1'` to `makeTask` factory |
| `mobile/src/__tests__/taskPriority.test.ts` | Add `board_id: 'board-1'` to `makeTask` factory |
| `mobile/src/__tests__/taskGrouping.test.ts` | Add `board_id: 'board-1'` to `makeTask` factory |

---

## Data model changes

None. Backend already stores and returns `board_id` on all resources. `Task.board_id` is being added to the TypeScript type to match what the API already returns.

---

## API contract changes

All changes are additive optional parameters; no breaking changes:

| API function | Change |
|-------------|--------|
| `listTasks(state?, boardId?)` | Appends `&board_id=<id>` to query |
| `createTask(body, boardId?)` | Includes `board_id` in POST body |
| `listLabels(category?, boardId?)` | Appends `&board_id=<id>` to query |
| `createLabel(category, value, boardId?)` | Includes `board_id` in POST body |
| `createConversation(boardId?)` | Includes `board_id` in POST body |
| `getCompletions(from, to, boardId?)` | Appends `&board_id=<id>` to query |

---

## `BoardContext` design (mobile)

Mirrors the web `BoardContext` with one key difference: mobile has no `FilterContext`, so label-filter clearing on board switch is handled by `TasksScreen` itself via a `useEffect([activeBoard?.id])`.

```typescript
// mobile/src/context/BoardContext.tsx
interface BoardContextValue {
  boards: Board[];
  activeBoard: Board | null;
  setActiveBoard: (board: Board) => void;
  createBoard: (name: string) => Promise<Board>;
  renameBoard: (id: string, name: string) => Promise<void>;
  setDefaultBoard: (id: string) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}
```

`fetchBoards()` uses a functional updater to preserve the active board across mutations (same as web). `setLoading(true)` at the top of `fetchBoards()`.

---

## `TasksScreen` board switcher design

Header row:
```
[ Board Name ▾ ]         [Collapse] [☰] [+]
```

"Board Name ▾" is a `TouchableOpacity`. Tapping it opens an inline dropdown overlay (absolute-positioned `View` below the header, `z-index` above content). The dropdown lists all boards; tapping one calls `setActiveBoard()` and closes. No separate route — stays fully within `TasksScreen`.

Board change flow in `TasksScreen`:
1. `useEffect([activeBoard?.id])` — clears `selectedLabelIds`, `searchQuery`, resets `showDone` → fires on every board change
2. `useFocusEffect(useCallback(..., [load, activeBoard?.id]))` — re-fetches tasks + labels + settings on tab focus AND on board change while tab is focused; guarded: exits early if `!activeBoard`

`load` is refactored to accept `boardId?` as a param (avoids stale-closure issues with `useCallback`).

---

## `SettingsScreen` boards section

New "Boards" card inserted at the top (before Labels). Shows:
- Board count badge: `N/5`
- List of boards with: default star ★, inline rename, set-default, delete
- Inline "Add board" input (appears below list on tap)
- Delete is guarded: cannot delete the only remaining board (backend enforces; error surfaced as inline text)

Labels section: `listLabels('mode', activeBoard?.id)` and `listLabels('type', activeBoard?.id)` — scoped to the active board.

---

## Test plan

### New tests
- `mobile/src/__tests__/boards.api.test.ts` — 7 tests:
  - `getBoards` calls `GET /boards`
  - `createBoard` calls `POST /boards` with name
  - `updateBoard` with name calls `PUT /boards/:id`
  - `updateBoard` with `is_default: true` calls `PUT /boards/:id`
  - `deleteBoard` calls `DELETE /boards/:id`
  - error propagation (non-2xx)
  - empty board list

### Updated tests
- `makeTask` in `taskFilters.test.ts`, `taskPriority.test.ts`, `taskGrouping.test.ts` — add `board_id: 'board-1'` (required field)

### Not tested (no unit-testable pure logic)
- `BoardContext.tsx` — stateful React context; verified via integration test
- Screen-level board integration — covered by Sleepy's integration tests

---

## Deployment order

1. Backend (PR #33) — already merged and live
2. Web frontend (PR #34) — already merged and deployed
3. **Mobile (this PR)** — OTA update via `eas update`

No staggered deployment concern: backend is already board-aware; adding `board_id` params to mobile API calls is backwards-compatible (backend defaults to the user's default board when omitted).

**Mobile update type: OTA** — JS/TS only. No native modules, `app.json`, or `eas.json` changes.

---

## Risks

1. **`TasksScreen` is ~800 lines** — large file; drag-drop logic is untouched but nearby. Careful to not break the drag-drop gesture handler references.
2. **Double-fetch on initial load** — `useFocusEffect` may fire once with `activeBoard = null` (returns early) and then again when boards load. Acceptable.
3. **ChatScreen conversation reset** — clearing `conversationIdRef` on board change means in-flight messages could lose their conversation. This is the correct behavior (web does the same) and the window is very short.
4. **Board deletion from SettingsScreen** — if the user deletes the active board from Settings while on the Settings tab, `BoardContext.fetchBoards()` will reset `activeBoard` to the new default. Tasks/labels will re-fetch on next focus. Acceptable.

---

## Sneezy's Review — 2026-06-28

**Verdict:** Approved with concerns

### Issues

1. **[Blocker] `mobile/src/types/index.ts` — `Task` interface is missing `board_id`; plan does not add it to `Conversation`.** The current `Task` interface (verified at `mobile/src/types/index.ts` lines 9–22) has no `board_id` field. The plan correctly lists adding `board_id: string` to `Task`. However, the `Conversation` interface (line 51–54) also lacks `board_id` — the web frontend's `Conversation` type (`frontend/src/api/conversations.ts` line 5) has `board_id: string`, and the backend returns it per `DATA_MODEL_AND_API.MD`. Since `createConversation()` is being changed to accept `boardId?` and `ChatScreen` will reset on board change, the mobile `Conversation` interface must also gain `board_id: string` so the returned value is typed correctly. The plan's scope table only lists `board_id: string` on `Task`, not on `Conversation`.

2. **[Blocker] `App.tsx` wrap order — `BoardProvider` must render inside `AuthProvider`, but also needs `GestureHandlerRootView` to remain outermost.** The current `mobile/App.tsx` wraps `<AuthProvider>` around `<AppNavigator>`. The plan says "Wrap `AppNavigator` in `BoardProvider`". `BoardProvider` calls `getBoards()` which calls `apiFetch`, which requires an authenticated Firebase user. If `BoardProvider` is placed inside `AuthProvider` but outside `AppNavigator`, it will fire `fetchBoards()` on mount before `useAuth`'s `onAuthStateChanged` has resolved — a race that always loses on cold start (the user is `null`). The web frontend avoids this because `BoardProvider` is rendered inside `AppRoutes` which is gated on `user !== null`. The plan does not address where exactly `BoardProvider` is placed relative to the auth gate in `AppNavigator`. If it is placed in `App.tsx` directly inside `AuthProvider`, unauthenticated calls will occur. The correct placement is inside `AppNavigator`'s authenticated branch (the tab navigator block at line 80 of `AppNavigator.tsx`), not in `App.tsx` at all — but the plan says `App.tsx` is the file to modify.

3. **[Risk] `load` refactor in `TasksScreen` — plan adds `boardId?` param to `load`, but `load` is currently a `useCallback` with an empty dependency array (`[]`) that reads `showDoneRef` via a ref.** If `boardId` is added as a parameter, callers (`useFocusEffect`, `RefreshControl.onRefresh`, `handleFormSave`, `handleComplete`, `handleDeletePress`, `toggleShowDone`, `clearFilters`) must all be updated to pass it. The plan mentions this refactor but does not enumerate all the call sites. At minimum six internal call sites in `TasksScreen` (lines ~288, 335, 353, 367, 410, 419) call `load()` or `load(true)` without arguments; each must be updated to pass `activeBoard?.id` or the board-scoping will silently be absent on those code paths.

4. **[Risk] `SettingsScreen` — `createLabel` and `deleteLabel` API calls are not listed as changing.** The plan lists `listLabels('mode', activeBoard?.id)` and `listLabels('type', activeBoard?.id)` as the scoped calls in `SettingsScreen`. But `createLabel(category, value)` (line 9 of `mobile/src/api/labels.ts`) does not accept `boardId`. Creating a new label from `SettingsScreen` while a non-default board is active will silently create the label on the user's default board, not the active board. The web `POST /labels` API accepts an optional `board_id`; the mobile `createLabel` function must gain that parameter too, and `SettingsScreen`'s `handleAdd` callback must pass it. This is a missing change.

5. **[Risk] `BoardProvider` has no `FilterContext` on mobile — `setActiveBoard` on web calls `clearLabels()` from `FilterContext`.** The plan acknowledges this and says `TasksScreen` handles it via `useEffect([activeBoard?.id])`. However, `ChatScreen` and `ReportsScreen` currently have no mechanism to know the active board changed — they only re-fetch on tab focus via their own `useEffect`/`useFocusEffect`. The plan says `ChatScreen` resets `conversationIdRef` on board switch, but if the user switches boards from `TasksScreen` (which is only possible within `TasksScreen` per the proposed design), and then navigates to `ChatScreen`, the `ChatScreen` has no board-change `useEffect`; it only resets on mount. The plan says the reset happens "in `ChatScreen`" but `ChatScreen` does not have `useFocusEffect` — it has a single `useEffect([], [])` on mount. This means if a conversation is already open and the user switches boards via the `TasksScreen` board switcher and then goes to Chat, the old conversation id (scoped to the old board) may still be in `conversationIdRef`. The plan needs to explicitly address how the board change propagates to non-Tasks screens.

6. **[Gap] `mobile/src/__tests__/boards.api.test.ts` — the plan says 7 tests but the test plan descriptions only match 5 distinct assertions.** Counting: `getBoards` returns boards (1), `createBoard` with name (2), `updateBoard` with name (3), `updateBoard` with `is_default: true` (4), `deleteBoard` (5), error propagation (6), empty board list (7). The "empty board list" test is actually covered by the `getBoards` mock returning `{ boards: [] }` in the "calls GET /boards" test in the web reference — so test 7 is valid, but note that the web `boards.api.test.ts` is 78 lines and covers only 5 `describe` blocks (not 7 standalone `it` blocks). The count discrepancy is minor but the plan should clarify whether "7 tests" means 7 `it()` blocks or grouped into fewer `describe` blocks.

7. **[Gap] `mobile/src/api/labels.ts` — `createLabel` and the `board_id` parameter on `POST /labels` are not mentioned in the modified-files table.** The `labels.ts` API modification is partially described (only `listLabels` signature change), but the `POST /labels` endpoint accepts an optional `board_id`. If `SettingsScreen` should create labels in the active board, `createLabel` must accept `boardId?` and include it in the request body. This is omitted from both the scope table and the API contract changes table.

8. **[Nit] `TasksScreen` board switcher described as an "inline dropdown overlay" with `z-index`.** NativeWind v4 treats `z-index` as `zIndex` via inline `style` props — plain Tailwind `z-*` classes may not work in NativeWind. This is consistent with the existing pattern in the codebase (e.g. the ghost overlay at line 798 uses `zIndex: 999` in an `Animated.View` style), but the plan does not note this gotcha. The implementer must use inline `style={{ zIndex: 50 }}`, not a Tailwind class.

9. **[Nit] The plan's `BoardContext` interface lists `setDefaultBoard(id)` but the web `BoardContext` exports the same function under the same name.** The mobile `Conversation` type (line 51–54 of `mobile/src/types/index.ts`) does not include `board_id` — this is a separate type gap from Issue #1 above but reinforces it.

### Unverified assumptions

- **"Backend already stores and returns `board_id` on all resources"** — Confirmed for tasks and conversations via `DATA_MODEL_AND_API.MD` and `ARCHITECTURE.MD`. The API response shape includes `board_id` on tasks per the GET /tasks response example. Confirmed.

- **"Mobile update type: OTA"** — Confirmed: no `app.json`, `eas.json`, or native module changes. All changes are JS/TS. OTA via `eas update` is correct.

- **"Adding `board_id` params to mobile API calls is backwards-compatible"** — Confirmed: `DATA_MODEL_AND_API.MD` explicitly documents that `board_id` is optional on all endpoints and defaults to the user's default board when omitted. Backward-compatibility claim holds.

- **"`TasksScreen` is ~800 lines"** — Confirmed: `wc -l` returns 804 lines.

- **"Web `BoardContext` uses a functional updater to preserve the active board across mutations"** — Confirmed by reading `frontend/src/context/BoardContext.tsx` lines 33–39. The pattern is faithfully described.

- **"No separate route — stays fully within `TasksScreen`"** — The board switcher dropdown design (inline overlay, no navigation) is sound given the existing `TaskFormScreen`-as-Modal pattern. However, the plan does not address how the `TasksScreen` board switcher communicates the board change to other tabs (`ChatScreen`, `ReportsScreen`). This is only possible via a shared context (`BoardContext`), which is correct, but see Issue #5.

- **"PR #33 (backend) and PR #34 (web frontend) are already merged and live"** — Cannot verify git history from the working tree, but `ARCHITECTURE.MD` and `PRODUCT_REQUIREMENTS_DOCUMENT.MD` both document boards API as shipped, and `ARCHITECTURE.MD` line 55 references the plan files for #33 and #34 as complete. Assumed correct.

- **"mobile `FilterContext` does not exist"** — Confirmed by reading `mobile/src/context/` which contains only `AuthContext.tsx`. No `FilterContext` exists. The plan's mitigation (handle in `TasksScreen` via `useEffect`) is the only option.

### Suggestions

1. **Move `BoardProvider` into `AppNavigator`'s authenticated branch**, not into `App.tsx`. Place it as a wrapper around the `Tab.Navigator` block (line 82 of `AppNavigator.tsx`) so it only mounts when `user` is non-null. This eliminates the auth race condition (Issue #2) without requiring changes to `App.tsx`.

2. **Enumerate all `load()` call sites** in the plan before implementation — there are at least 6 in `TasksScreen.tsx` (pull-to-refresh, `handleFormSave`, `handleComplete`, `handleDeletePress`, `toggleShowDone`, `clearFilters`). Each must receive `activeBoard?.id` to ensure board scoping is consistent.

3. **Add `boardId?` to `createLabel` in `mobile/src/api/labels.ts`** and update the scope table to include this change. Without it, label creation from `SettingsScreen` always goes to the default board regardless of which board is active.

4. **Add a `board_id` field to the mobile `Conversation` interface** in `mobile/src/types/index.ts` alongside the `Task.board_id` addition.

5. **Clarify board-change propagation to `ChatScreen` and `ReportsScreen`**: if the board switcher only lives in `TasksScreen`, the plan should note that switching boards in `TasksScreen` will cause a stale conversation on the next `ChatScreen` visit unless `ChatScreen` adds a `useFocusEffect` that compares its conversation's `board_id` to `activeBoard?.id` and resets if they differ.

— *Sneezy*

---

## Grumpy's Responses to Sneezy's Review

**[Blocker 1 — Conversation.board_id missing]** — Addressed. `mobile/src/types/index.ts` scope updated: `Conversation.board_id: string` added alongside `Task.board_id`. `createConversation(boardId?)` return value is already typed as `Conversation`, so this fixes the typing gap.

**[Blocker 2 — BoardProvider auth race condition]** — Addressed. `App.tsx` is no longer the target file. `BoardProvider` will be placed in `mobile/src/navigation/AppNavigator.tsx`, wrapping `Tab.Navigator` inside the final authenticated return branch (after the `if (!user) return <LoginScreen/>` guard at line 72). Auth is fully resolved by that point — `loading` is false, `user` is non-null. Scope table updated accordingly.

**[Risk 3 — load() call sites]** — Acknowledged and will be addressed. The 6 internal call sites in `TasksScreen` that must pass `activeBoard?.id` are:
- `useFocusEffect` callback (initial + focus re-fetch)
- `RefreshControl.onRefresh` (pull-to-refresh)
- `handleFormSave` (after task create/edit)
- `handleComplete` (optimistic complete silent re-fetch)
- `toggleShowDone` (filter toggle)
- `clearFilters` (if showDone was active)

All will be updated to pass `activeBoard?.id`.

**[Risk 4 — createLabel missing boardId]** — Addressed. `mobile/src/api/labels.ts` scope updated to include `createLabel(category, value, boardId?)`. `SettingsScreen`'s `handleAddLabel` will pass `activeBoard?.id`. Scope table and API contract table both updated.

**[Risk 5 — ChatScreen stale conversation on board switch]** — Addressed. `ChatScreen` will add `useEffect(() => { conversationIdRef.current = null; setMessages([]); }, [activeBoard?.id])` so switching boards (from any screen, via shared `BoardContext`) resets the conversation. `ReportsScreen` already uses `useFocusEffect` (or equivalent) keyed on its "Go" button; it will re-pass `activeBoard?.id` when re-fetching.

**[Gap 6 — test count]** — Noted. 7 `it()` blocks is the correct interpretation. The test file will have 7 individual `it()` assertions mirroring the 7 listed in the plan.

**[Gap 7 — createLabel in scope table]** — Addressed (same fix as Risk 4 above).

**[Nit 8 — zIndex as inline style]** — Acknowledged. Board switcher dropdown will use `style={{ zIndex: 50 }}`, not a Tailwind `z-*` class, consistent with the existing ghost overlay pattern in `TasksScreen`.

**[Nit 9 — Conversation.board_id redundant note]** — Covered by Blocker 1 fix above.
