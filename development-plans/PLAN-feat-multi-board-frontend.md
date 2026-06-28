# PLAN: feat-multi-board-frontend

**Branch**: `feat-multi-board-frontend`
**PR**: 2/3 of multi-board feature
**Depends on**: `feat-multi-board-backend` (PR #33, merged)

---

## Scope

Frontend (web) only. The backend API is fully shipped — boards table, board-scoped tasks/labels/conversations, and all CRUD endpoints exist. This PR wires those endpoints into the React web client and adds board switching UI.

No DB changes. No backend changes. No mobile changes (PR 3/3).

---

## Goals

1. Fetch and display the user's boards on login.
2. Track an **active board** in client-side state (reset to default board on every app open — never persisted).
3. Scope all data fetches (tasks, labels, conversation start, reports) to the active board by passing `board_id` to API calls.
4. Board switcher UI in the sidebar (desktop) and header (mobile) — lets the user navigate between boards.
5. Board management in SettingsPage — create, rename, set default, delete boards.
6. Clear label filters when switching boards (labels from Board A don't exist in Board B).

---

## Non-goals

- Drag-and-drop board ordering
- Moving tasks between boards
- Any mobile (React Native) changes — that is PR 3/3

---

## New files

| File | Purpose |
|------|---------|
| `frontend/src/api/boards.ts` | `Board` type + `getBoards`, `createBoard`, `updateBoard`, `deleteBoard` |
| `frontend/src/context/BoardContext.tsx` | `BoardProvider` + `useBoard` hook |
| `frontend/src/components/BoardSwitcher.tsx` | Dropdown UI for switching + creating boards |

---

## Modified files

| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Inside `AppRoutes`, add `<BoardProvider>` between `<FilterProvider>` and `<BrowserRouter>` |
| `frontend/src/components/Layout.tsx` | Embed `<BoardSwitcher>` in desktop sidebar header and mobile top header |
| `frontend/src/api/tasks.ts` | Add `board_id` to `Task` type; add optional `boardId` param to `listTasks`, `createTask` |
| `frontend/src/api/labels.ts` | Add optional `boardId` param to `listLabels`, `createLabel` |
| `frontend/src/api/conversations.ts` | Add optional `boardId` param to `createConversation`; add `board_id` to `Conversation` type |
| `frontend/src/api/reports.ts` | Add optional `boardId` param to `getCompletions` |
| `frontend/src/hooks/useTasks.ts` | Read `activeBoard.id` from BoardContext; pass as `boardId` to `listTasks` |
| `frontend/src/hooks/useLabels.ts` | Read `activeBoard.id` from BoardContext; refetch when board changes |
| `frontend/src/pages/TaskDetailPage.tsx` | Pass `activeBoard.id` to direct `createTask` and `listTasks` calls |
| `frontend/src/pages/ChatPage.tsx` | Reset `conversationId` state to `null` when `activeBoard.id` changes |
| `frontend/src/pages/ReportsPage.tsx` | Guard on-mount fetch — skip until `activeBoard` is non-null; add `activeBoard.id` as `useEffect` dep |
| `frontend/src/pages/SettingsPage.tsx` | Add "Boards" section; scope existing label management calls to `activeBoard.id` |

---

## BoardContext design

```ts
export interface Board {
  id: string;
  name: string;
  is_default: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

interface BoardContextValue {
  boards: Board[];
  activeBoard: Board | null;   // null only while initial fetch is in flight
  setActiveBoard: (board: Board) => void;
  createBoard: (name: string) => Promise<Board>;
  renameBoard: (id: string, name: string) => Promise<void>;
  setDefaultBoard: (id: string) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}
```

**Initialisation**: `BoardProvider` calls `GET /boards` on mount (after auth is confirmed). Sets `activeBoard` to the board where `is_default === true`. Every subsequent app open resets to the default board — this matches the product requirement ("when they close the application and come back again, the system sends them back to default board").

**Board switch**: `setActiveBoard(board)` updates local state only — no API call. The `FilterContext.clearLabels()` is also called to avoid stale label-filter selections from the previous board.

**CRUD mutations**: each calls the API, awaits the response, then calls `GET /boards` to refresh the full list. This keeps the list and the `is_default` flag consistent without manual local patching.

---

## BoardSwitcher UI

### Desktop sidebar (inside `<aside>`)

Current sidebar header: `tasksAreUs` title + border-b.
After change: title stays; board switcher goes below the title.

```
┌──────────────────────────────┐
│  tasksAreUs                  │
│  General tasks  ▾            │  ← board switcher button
├──────────────────────────────┤
│  ◉ Tasks                     │
│  ◉ Chat                      │
│  ...                         │
```

Clicking the button opens a dropdown (portal or absolute-positioned div, z-50):

```
┌──────────────────────────────┐
│  ✓ General tasks  ★          │  ← active + default indicator
│    Job search                │
│  ──────────────              │
│  + New board                 │
└──────────────────────────────┘
```

- Clicking a board calls `setActiveBoard` and closes the dropdown.
- "New board" opens an inline input in the dropdown for a name, then calls `createBoard`.
- Star (★) = is_default indicator, not a click target here (managed in Settings).

### Mobile header

Current header: `tasksAreUs` title only.
After change: title on left, board name (truncated) on right as a tappable chip.

```
┌───────────────────────────────────┐
│ tasksAreUs       General tasks ▾  │
└───────────────────────────────────┘
```

Tapping the chip opens the same dropdown as desktop.

---

## SettingsPage — Boards section

New section at the top of SettingsPage, above the existing Labels section.

```
── Boards ──────────────────────────────────────
  ★ General tasks          [rename] [can't delete — default]
    Job search             [rename] [delete]
  + Add board
────────────────────────────────────────────────
```

- **Rename**: inline edit on click — PUT /boards/{id} with `{name}`.
- **Set default**: clicking the star on a non-default board calls PUT /boards/{id} with `{is_default: true}`. The star on the current default is disabled.
- **Delete**: calls DELETE /boards/{id}. Server returns 400 if board has tasks or labels — show the error message to the user. Disabled for the default board and for the only board.
- **Add board**: shows an inline input at the bottom of the list — calls POST /boards.

---

## Data flow when switching boards

```
user clicks board B in switcher
  → setActiveBoard(boardB)
  → FilterContext.clearLabels()       ← avoid stale label filters
  → BoardContext re-renders
  → useTasks reads activeBoard.id (boardB.id) → refetches GET /tasks?board_id=boardB.id
  → useLabels reads activeBoard.id (boardB.id) → refetches GET /labels?board_id=boardB.id
  → TasksPage re-renders with boardB's tasks and labels
```

Chat and Reports pages read `activeBoard.id` at the point of their own API calls:
- `ChatPage`: passes `boardId` to `createConversation()` when starting a new chat.
- `ReportsPage`: passes `boardId` to `getCompletions()`.

---

## API changes (frontend-side only)

All changes are additive — existing call sites that don't pass `boardId` continue to work (backend defaults to user's default board).

```ts
// boards.ts (new)
getBoards(): Promise<{ boards: Board[] }>
createBoard(name: string): Promise<Board>
updateBoard(id: string, body: { name?: string; is_default?: boolean }): Promise<Board>
deleteBoard(id: string): Promise<void>

// tasks.ts — Task type gets board_id field; listTasks/createTask accept optional boardId
listTasks(state?, boardId?): Promise<{ tasks: Task[] }>
createTask(body, boardId?): Promise<Task>

// labels.ts
listLabels(category?, boardId?): Promise<{ labels: Label[] }>

// conversations.ts — Conversation type gets board_id field
createConversation(boardId?): Promise<Conversation>

// reports.ts
getCompletions(from, to, boardId?): Promise<CompletionsReport>
```

---

## FilterContext change

`FilterContext` already exposes `clearLabels`. `BoardContext` calls `useFilter()` inside `BoardProvider` (valid because `FilterProvider` wraps `BoardProvider`) and calls `clearLabels()` from `setActiveBoard` when the board actually changes.

**Wrapping order inside `AppRoutes` in App.tsx:**
```tsx
// AppRoutes return:
<FilterProvider>
  <BoardProvider>        ← useFilter() accessible here
    <BrowserRouter>
      ...
    </BrowserRouter>
  </BoardProvider>
</FilterProvider>
```

Note: `FilterContext.tsx` needs no changes — `clearLabels` already exists.

---

## Test plan

**Unit tests** (`frontend/src/__tests__/`):
- `boards.api.test.ts` — test `getBoards`, `createBoard`, `updateBoard`, `deleteBoard` with mocked `apiFetch`; verify correct URLs, methods, and bodies

No changes to `backend/tests/test_api.py`.

---

## Deployment

Single component — frontend only. Can deploy at any time independently of mobile. Backend is already backward-compatible (omitting `board_id` defaults to user's default board), so deploying this PR first or after mobile PR 3/3 is both safe.

---

---

## Sneezy's Review — 2026-06-27

**Verdict:** Approved with concerns

### Issues

1. **[Risk] `App.tsx` provider nesting vs. actual code (App.tsx:86–101)** — The plan shows `<FilterProvider>` wrapping `<BoardProvider>` wrapping `<BrowserRouter>`. But in the current code, `<FilterProvider>` already wraps `<BrowserRouter>` and everything inside `AppRoutes`. The plan's proposed nesting order adds `<BoardProvider>` between `<FilterProvider>` and `<BrowserRouter>`, which is achievable but requires changing the existing structure inside `AppRoutes`. The plan shows the wrapping order correctly but omits the fact that `AppRoutes` (not `App`) is where `FilterProvider` and `BrowserRouter` currently live. The implementation must modify `AppRoutes`, not `App`. This needs to be explicit or the implementer will wrap at the wrong level.

2. **[Risk] `FilterContext.clearLabels` claim is correct but the cross-context dependency path is underspecified** — The plan says `BoardContext` can call `useFilter()` because `FilterProvider` wraps `BoardProvider`. This is architecturally valid. However, the plan offers two alternative approaches ("passing `clearLabels` as a prop" or "importing `useFilter`") without committing to one. The prop-passing approach would require `BoardProvider` to accept `clearLabels` as a prop, which means the call site (`AppRoutes`) must plumb it through. The `useFilter()` import approach is simpler and is the only one that aligns with the wrapping order shown. The ambiguity risks the wrong approach being chosen and introducing an unnecessary prop interface.

3. **[Gap] `SettingsPage.tsx` loads labels without `board_id` — will silently show the wrong board's labels after multi-board is introduced** — `SettingsPage` (line 234) calls `listLabels('mode')` and `listLabels('type')` with no `boardId`. After this PR, the labels section in Settings must be scoped to the active board, otherwise the user managing Board B's labels while Board A is default will see and edit Board A's labels. The plan adds `boardId` to `listLabels` but does not mention updating `SettingsPage`'s label fetch to pass `activeBoard.id`. The plan also says `createLabel` and `deleteLabel` send no `board_id` — creating a label in Settings would create it in the default board, not the active one.

4. **[Gap] `TaskDetailPage.tsx` is entirely missing from the plan** — `TaskDetailPage` (line 3–4) calls `createTask` and `listTasks` directly, bypassing `useTasks`. The plan correctly modifies `useTasks` to pass `board_id`, but `TaskDetailPage`'s direct calls to `createTask` and `listTasks` (for the pending-tasks fetch used for HP warning) will still default to the user's default board. A user editing a task in Board B while Board A is default would create the task in the wrong board.

5. **[Gap] `ChatPage.tsx` reuses an existing `conversationId` across board switches** — `ChatPage` (line 9) holds `conversationId` in local state. If the user switches boards and then sends a message, `ensureConversation()` (line 20–25) returns the cached `conversationId` from the old board, and the new message goes into that board's conversation context. The plan acknowledges that `ChatPage` passes `boardId` to `createConversation()` when starting a new chat, but does not address resetting the cached `conversationId` on board switch. Without a reset, every message after a board switch continues in the prior board's conversation.

6. **[Gap] `ReportsPage.tsx` fetches on mount and user-triggered "Run Report" — only the latter will get `boardId` from context** — `ReportsPage` (line 47–50) fires `fetchReport()` in a `useEffect` on mount. If `activeBoard` is not yet resolved at mount time (it is `null` while the initial `GET /boards` is in flight), the report will fetch with no `board_id` and show the default board's completions. The plan says `activeBoard` is null only during the initial fetch but does not address the timing race on the Reports page.

7. **[Nit] `Conversation` type in `conversations.ts` (line 3–6) is missing `board_id`** — The plan says "add `board_id` to `Conversation` type" but the current `Conversation` interface only has `id` and `created_at`. The backend now returns `board_id` in `ConversationOut` (per `DATA_MODEL_AND_API.MD`). If `createConversation` is extended to accept and return `board_id`, the `Conversation` interface must also be updated. The plan mentions this but it is worth verifying it is not forgotten during implementation.

8. **[Nit] Board cap error (422) not mentioned in SettingsPage UX** — The plan says `POST /boards` returns `422` when the user already has 5 boards, but the SettingsPage Boards section description only mentions `400` (empty name) as an error case. The `createBoard` call in `BoardContext` should surface this to the user; it is not addressed.

9. **[Risk] `handleDrop` and `handleTogglePriority` in `TasksPage.tsx` call `updateTask` directly with no `board_id`** — `updateTask` (tasks.ts line 67) currently sends no `board_id`. The backend's `PUT /tasks/{id}` is board-agnostic (task is already owned by the board), so this is safe as-is — but it is worth explicitly confirming the plan does NOT require `board_id` in task update calls. The plan is silent on this, which is fine but should be stated.

### Unverified assumptions

1. **"clearLabels already exists in FilterContext"** — Confirmed. `FilterContext.tsx` (line 24–26) already has `clearLabels`. The plan's claim is accurate.

2. **"All data fetches (tasks, labels, conversation start, reports) to the active board by passing `board_id`"** — Partially verified. `useTasks` and `useLabels` are correctly identified. However, `TaskDetailPage` directly calls `listTasks` and `createTask` and is not listed in the modified files — this is a gap, not a verified assumption.

3. **"Board switch resets to default board on every app open — never persisted"** — The plan claims this matches the PRD. The PRD states "when they close the application and come back again, the system sends them back to default board." This is consistent. Verified correct.

4. **"Backend is already backward-compatible (omitting `board_id` defaults to user's default board)"** — Verified via `DATA_MODEL_AND_API.MD` and `ARCHITECTURE.MD`. `resolve_board_id()` handles missing `board_id` by returning the user's default board. Correct.

5. **"New boards created by users start empty (no label seeding)"** — Confirmed by `DATA_MODEL_AND_API.MD` and `ARCHITECTURE.MD`. Correct.

6. **"FilterContext wraps BoardProvider, so BoardContext can call useFilter()"** — The current code has `FilterProvider` wrapping `BrowserRouter` inside `AppRoutes`. If `BoardProvider` is inserted between `FilterProvider` and `BrowserRouter`, then `useFilter()` will be accessible inside `BoardProvider`. This is correct — but the plan does not clarify that the implementation target is `AppRoutes`, not the `App` function.

7. **"Conversation type gets board_id field"** — `conversations.ts` current `Conversation` interface (line 3–6) has no `board_id`. The backend does return it. The plan correctly identifies this as a change but it will not type-check until the interface is updated.

### Suggestions

1. **Commit to `useFilter()` inside `BoardContext`** rather than leaving the prop-passing alternative open. The wrapping order makes `useFilter()` the natural and simpler choice; offering two options risks a messier implementation.

2. **Add `TaskDetailPage` to the modified files table** and explicitly scope `createTask` and `listTasks` calls there to `activeBoard.id`. This is a task-creation gap with real user-facing consequences.

3. **Add SettingsPage label management to the modified files table.** The Boards section is planned for Settings, but the existing Labels section also needs to read/write labels scoped to `activeBoard.id` to be consistent after multi-board is live.

4. **Reset `conversationId` in `ChatPage` when `activeBoard` changes** — subscribe to `activeBoard.id` via `useBoard()` and reset to `null` on change, so each board gets its own chat session.

5. **Guard `ReportsPage`'s on-mount fetch** — only fire `fetchReport()` after `activeBoard` is resolved (not `null`), or add a dependency on `activeBoard.id` to the `useEffect` so the report re-fetches automatically on board switch.

6. **Consider a unit test for `BoardContext`** in `frontend/src/__tests__/` — the initialisation logic (default board selection, stale-filter clearing) has meaningful business rules that would benefit from testing with mocked `apiFetch`.

— *Sneezy*

---

## Grumpy's Response to Sneezy's Review

**[Risk 1] AppRoutes vs App** — Addressed. Plan updated: wrapping is explicitly inside `AppRoutes` (in `App.tsx`), not the `App` function.

**[Risk 2] clearLabels approach** — Addressed. Committed to `useFilter()` inside `BoardContext`. Prop-passing alternative removed from plan.

**[Risk 9] updateTask needs no board_id** — Confirmed and noted explicitly. `PUT /tasks/{id}` is board-agnostic; the backend ignores any `board_id` in the update body since the task already owns its board. No change needed to `updateTask` calls.

**[Gap 3] SettingsPage label management** — Addressed. Added `SettingsPage.tsx` label calls to scope: `listLabels` passes `activeBoard.id`; `createLabel` in the labels section is updated to pass `boardId` (already added `boardId` to `createLabel` signature in `labels.ts`). `deleteLabel` is board-agnostic (label_id is globally unique) — no change needed.

**[Gap 4] TaskDetailPage** — Addressed. Added to modified files table. Direct `createTask` and `listTasks` calls will receive `activeBoard.id` from `useBoard()`.

**[Gap 5] ChatPage conversationId reset** — Addressed. Added to modified files table. A `useEffect` keyed on `activeBoard?.id` will reset `conversationId` to `null` on board switch, forcing `ensureConversation()` to start a new conversation scoped to the new board.

**[Gap 6] ReportsPage mount guard** — Addressed. Added to modified files table. `useEffect` will skip (or bail early) when `activeBoard` is `null`, and include `activeBoard?.id` as a dependency so the report re-fetches on board switch.

**[Nit 7] Conversation type board_id** — Confirmed in scope. `Conversation` interface updated to include `board_id: string`.

**[Nit 8] Board cap 422 error** — Addressed. `createBoard` in `BoardContext` will catch 422 and surface "Board limit reached" to the user (same pattern as other error handling in the Settings UI).
