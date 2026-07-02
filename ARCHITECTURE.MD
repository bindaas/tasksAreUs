# tasksAreUs — Architecture

## System Overview

- **Backend**: Python / FastAPI / PostgreSQL; Docker for dev
- **Frontend (web)**: React 19 + Vite + TypeScript + Tailwind CSS; runs in the browser
- **Frontend (mobile)**: React Native + Expo SDK 54 (managed workflow) + TypeScript + NativeWind v4; runs on iOS and Android
- **Multi-tenant**: every table includes `user_id`; full data isolation per user

## Identity

**Phase 2 (current):** Firebase Auth is the primary identity mechanism end-to-end. The backend initializes the Firebase Admin SDK using `FIREBASE_SERVICE_ACCOUNT_JSON` (fail-fast if missing). Both the web frontend and mobile app use the Firebase JS/RN SDK initialised from `VITE_FIREBASE_*` / `EXPO_PUBLIC_FIREBASE_*` env vars respectively. On first load, `AuthContext` silently calls `signInAnonymously()` — zero-friction UX identical to Phase 1. Named sign-in (Google or magic link) is offered in Settings. Authenticated requests from `client.ts` (web) and `apiFetch` (mobile) send `Authorization: Bearer <firebase_id_token>` obtained via `auth.currentUser?.getIdToken()`.

**Backend auth:** `get_current_user()` in `dependencies.py` verifies the Bearer token with the Firebase Admin SDK, looks up the user by `firebase_uid`, and auto-creates a new user row on first sign-in. Bearer token is the only accepted auth path. The same `/api/v1` endpoints serve both web and mobile clients.

## Code Structure

```
backend/
  app/
    main.py          # FastAPI + lifespan (Firebase Admin SDK init, create_all, legacy ALTER TABLE migrations, 4-step board migration: add board_id columns as nullable → create boards_user_id_default_key partial unique index + swap labels uniqueness to board_id → DML populate boards for existing users via _migrate_boards() → tighten board_id to NOT NULL; ALTER TABLE boards ADD COLUMN IF NOT EXISTS color VARCHAR(7); registers boards + focused_view routers)
    config.py        # pydantic-settings (DATABASE_URL, ANTHROPIC_API_KEY, CLAUDE_MODEL, cost rates, FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_PROJECT_ID)
    database.py      # engine, SessionLocal, get_db()
    models.py        # ORM models + LABEL_SEED
    schemas.py       # Pydantic v2 schemas; BoardOut + BoardUpdate include color field (BoardUpdate has field_validator for hex format); FocusedViewConfigOut, FocusedViewConfigUpdate, FocusedViewBoardGroup, FocusedViewTasksOut added in PR #36
    dependencies.py  # get_current_user() — Bearer token (Firebase); get_firebase_claims() — token-only, no DB
    routers/         # one file per resource, mounted at /api/v1
      users.py       # (no public endpoints — user rows are auto-created by get_current_user())
      boards.py      # GET /boards (calls ensure_board_seeded first — seeds default board for brand-new users who have never hit any other endpoint); POST /boards; PUT /boards/{id} (rename/set-default/set-color — sentinel via model_fields_set + _UNSET); DELETE /boards/{id} (soft-delete, guarded)
      focused_view.py  # GET /focused-view/config; PUT /focused-view/config; GET /focused-view/tasks?reference_date=YYYY-MM-DD
      labels.py      # GET /labels (board-scoped); POST /labels (create mode/type label, board-scoped); PUT /labels/{id} (rename, owner only); DELETE /labels/{id} (delete, owner only)
      tasks.py       # CRUD + complete endpoint
      beliefs.py     # beliefs generate/list/update
      conversations.py  # conversations + messages
      reports.py     # GET /reports/completions
      settings.py    # GET/PUT /settings
      sync.py        # POST /sync
    services/
      board_service.py # Board CRUD, cap enforcement (MAX_BOARDS_PER_USER = 10), default-board resolution; get_default_board_id(), resolve_board_id(), ensure_board_seeded(), get_board_or_404(), create_board(), update_board() (accepts color=_UNSET sentinel — _UNSET means "not provided", None means "clear"), delete_board()
      focused_view_service.py  # Focused view logic; get_or_create_config() (lazy insert with IntegrityError race-safety), update_config() (validates board_selection/day_range/selected_board_ids), date_window() (returns list of dates for a day_range), get_focused_tasks() (filters is_high_priority pending tasks by date window and board scope, groups by board alphabetically)
      task_service.py  # create_task(), update_task(), complete_task(); high-priority limit; _get_high_priority_limit() reads user settings; _resolve_labels() filters by both user_id and board_id; recurrence logic removed in PR #30
      ai_service.py    # Claude calls (beliefs + conversations); _format_task_line() helper; label queries scoped to board_id in both generate_beliefs() and handle_conversation_message()
      label_service.py # seed_board_labels(db, board_id, user_id): seeds mode+type labels from LABEL_SEED (9 entries) into a specific board; called by board_service during board initialisation
  tests/
    test_api.py      # standalone integration test: creates data, tests all endpoints, cleans up
    unit/
      test_task_service.py   # pytest unit tests for task_service (no DB — mocked)
      test_ai_service.py     # pytest unit tests for ai_service helpers
      test_dependencies.py   # pytest unit tests for auth dependencies (Firebase Bearer auth, token expiry/invalidity)
      test_labels_router.py  # pytest unit tests for labels router (no DB — mocked): seed (TestSeedBoardLabels), create, update, delete
      test_board_service.py  # pytest unit tests for board_service (no DB — mocked): 21 tests covering get_default_board_id, resolve_board_id, ensure_board_seeded, create_board, update_board, delete_board
      test_focused_view_service.py  # pytest unit tests for focused_view_service (no DB — mocked): 16 tests covering config create/update/validation and task filtering (day windows, high-priority filter, board scoping, board omission when zero tasks, alphabetical ordering)
  scripts/
    purge_test_data.py               # DB maintenance: remove test-generated rows
    migrate_drop_frequency_labels.sql  # One-time production SQL migration (PR #31): deletes all frequency label rows, drops recurrence_group_id column, and removes the 'frequency' value from the categoryenum Postgres type. Must be run against the production DB before deploying this PR.

development-plans/
  PLAN-feat-multi-board.md           # Development plan for multi-board backend (PR #33); includes Sneezy's review and Grumpy's inline responses
  PLAN-feat-multi-board-frontend.md  # Development plan for multi-board web frontend (PR #34); includes Sneezy's review and Grumpy's inline responses
  PLAN-feat-multi-board-mobile.md    # Development plan for multi-board mobile (PR #35); includes Sneezy's review and Grumpy's inline responses
  PLAN-feat-focused-view.md          # Development plan for focused view (backend PR #36, web frontend PR #37, mobile PR #38); includes Sneezy's review and Grumpy's inline responses
  PLAN-feat-focused-view-web.md      # Development plan for focused view web frontend (PR #37 — board color picker, FocusedViewConfigEditor in Settings, Detailed/Focused toggle in TasksPage, FocusedView component)
  PLAN-feat-focused-view-mobile.md   # Development plan for focused view mobile (PR #38 — color swatches in Settings/Boards, FocusedViewConfigSection in SettingsScreen, All/Focus toggle in TasksScreen, FocusedView and FocusedTaskCard components, mobile focusedView.ts API module); includes Sneezy's review

frontend/
  src/
    firebase.ts          # Firebase app + auth initialisation from VITE_FIREBASE_* env vars
    api/
      client.ts        # base fetch wrapper — attaches Authorization: Bearer <firebase_id_token> via auth.currentUser?.getIdToken(); parses FastAPI error detail
      boards.ts        # Board interface (includes color?: string | null added in PR #37) + getBoards, createBoard, updateBoard (body accepts color?: string | null), deleteBoard
      tasks.ts         # CRUD, complete; Task interface includes is_high_priority and board_id; listTasks/createTask accept optional boardId
      labels.ts        # listLabels(category?, boardId?); createLabel(category, value, boardId?), updateLabel(), deleteLabel()
      conversations.ts # createConversation(boardId?); Conversation type includes board_id
      settings.ts
      reports.ts       # getCompletions(from, to, boardId?) — boardId scopes results to a specific board
      focusedView.ts   # FocusedViewConfig + FocusedBoard interfaces; getFocusedViewConfig(), updateFocusedViewConfig(), getFocusedViewTasks(referenceDate?) — wrappers for GET/PUT /focused-view/config and GET /focused-view/tasks
    components/
      Layout.tsx        # nav shell: sidebar on desktop, bottom bar on mobile; embeds BoardSwitcher in desktop sidebar header and mobile top header
      BoardSwitcher.tsx # dropdown for switching boards and creating new boards (inline text input); renders in both desktop and mobile layouts; calls setActiveBoard on selection
      LabelBadge.tsx    # colored chip by category (mode/type)
      TaskCard.tsx      # task card with inline complete/delete; shows "High" badge when is_high_priority
      TaskForm.tsx      # create/edit form with label picker and high-priority checkbox; no label pre-selection (web derives context from column)
      FocusedView.tsx   # fetches GET /focused-view/tasks on mount (passes dateOnly(new Date()) as reference_date for local-timezone correctness); renders a card grid grouped by board with color-coded board headers (board_color or 8-color fallback palette); empty state + error/Retry handling; board color from board_color or PALETTE[index % 8]
      FocusedTaskCard.tsx  # compact task card with colored left border (boardColor prop), ★ High badge (is_high_priority), date chip (red tint when overdue, gray otherwise), label badges (green for mode, purple for type); click navigates to /tasks/:id
    context/
      FilterContext.tsx  # React context holding selected label IDs; persists across navigation; exposes clearLabels() — called by BoardContext on board switch
      AuthContext.tsx   # Firebase auth state via onAuthStateChanged; auto-signs in anonymously on first load; handles magic-link callbacks (same-device and cross-device); exposes signInWithGoogle, sendMagicLink, signOut, confirmEmailSignIn
      BoardContext.tsx  # tracks all boards + activeBoard (initialised to default board on app open, never persisted); exposes setActiveBoard (clears label filters on switch), createBoard, renameBoard, setDefaultBoard, setColorBoard (calls updateBoard({color}) then fetchBoards), deleteBoard, refetch; wraps children inside FilterProvider so clearLabels is accessible
    hooks/
      useAuth.ts        # thin re-export of useAuthContext — primary auth hook for all components
      useTasks.ts       # fetches tasks for activeBoard from BoardContext; bails early when activeBoard is null (initial load); re-fetches when board changes
      useLabels.ts      # fetches labels for activeBoard from BoardContext; cancellation token prevents stale updates on rapid board switches; re-fetches when board changes
      useSettings.ts    # fetches GET /settings; exposes highPriorityDailyLimit (default 3)
    pages/
      TasksPage.tsx     # 6-column kanban (Overdue/Today/Tomorrow/Day After Tomorrow/Upcoming/No Date) with drag-drop, search, label filters; Overdue column hidden when empty; Upcoming and Overdue columns are read-only drop targets (dropping blocked, "Read-only" placeholder shown); Detailed/Focused session-only pill toggle in header (visible when !showDone, resets to Detailed when switching to "Show done"); label filter chips hidden in focused mode (viewMode !== 'focused' guard); loading spinner and error banner also gated on viewMode !== 'focused'; renders <FocusedView /> when !showDone && viewMode === 'focused'
      TaskDetailPage.tsx  # create (/tasks/new) and edit (/tasks/:id); passes activeBoard.id to createTask and listTasks (HP pending-tasks fetch)
      ChatPage.tsx      # AI conversation with suggested-question chips; resets conversationId and messages when activeBoard changes; passes boardId to createConversation
      ReportsPage.tsx   # completions by date range; guards mount fetch until activeBoard is resolved; re-fetches and passes boardId on board switch
      SettingsPage.tsx  # Boards section (BoardEditor component — inline rename/set-default/delete/add; each board row includes an inline color swatch: hidden <input type="color"> triggered by a visible swatch button, auto-saves via 300ms debounced handleSetColor, × button clears the color) at top; Focused View section (FocusedViewConfigEditor component — board selection radio All/Selected + checkboxes, day range radio, dedicated Save button; loaded via getFocusedViewConfig() in parallel with other settings on mount) between Boards and Labels; Labels section (LabelEditor for mode/type) scoped to activeBoard.id; High Priority Daily Limit numeric input; starter questions editor; Connection section; Account section
      LoginPage.tsx     # shown only after deliberate sign-out; Google + magic-link sign-in options
    utils/
      taskDateUtils.ts  # date helpers: getColumn(), getDropDate(), getEffectiveDate(), getEffectiveDateField(), formatDate(); ColumnKey covers 'overdue'|'today'|'tomorrow'|'day_after_tomorrow'|'upcoming'|'nodate'; getEffectiveDate() returns earliest of must_do_by / target_date when both are set
      taskFilters.ts    # filterTasks() — applies label and text search filters
      taskPriority.ts   # isHighPriorityEligible(), splitByPriority(), canAddHighPriority(highTasks, droppedTask, limit)
    __tests__/
      taskDateUtils.test.ts
      taskFilters.test.ts
      taskPriority.test.ts
      client.test.ts    # 6 unit tests for apiFetch: Bearer header presence/absence, Content-Type, URL construction, error handling, 204 No Content
      boards.api.test.ts  # 9 unit tests for boards API (getBoards, createBoard, updateBoard, deleteBoard) with mocked apiFetch; includes 2 tests for updateBoard color (hex string and null clear) added in PR #37
    App.tsx             # wraps AppRoutes in AuthProvider; AppRoutes renders EmailConfirmationPage (cross-device magic link), LoginPage (post-sign-out), or FilterProvider → BoardProvider → BrowserRouter → Layout
    main.tsx
  .env.example          # VITE_FIREBASE_* env var template
  vite.config.ts        # proxies /api → http://localhost:8000 in dev; VITE_API_TARGET for Docker

mobile/                 # React Native + Expo SDK 54 managed workflow
  app.json              # Expo config: slug "tasksareus", deep-link scheme "tasksareus://", bundle ID "com.bindaas.tasksareus", New Architecture enabled
  eas.json              # EAS build profiles: development (dev-client, reads EXPO_PUBLIC_API_URL from .env) and production (ad-hoc distribution, bakes in https://tasksareus-production.up.railway.app as EXPO_PUBLIC_API_URL)
  App.tsx               # Entry point: wraps AppNavigator in AuthProvider
  src/
    firebase.ts         # Firebase app + auth initialisation from EXPO_PUBLIC_FIREBASE_* env vars; uses getReactNativePersistence(AsyncStorage) so auth state survives app restarts
    context/
      AuthContext.tsx   # Mirrors web AuthContext: auto-signs in anonymously on first load; deliberate sign-out uses module-level flag (replaces sessionStorage — resets on force-quit); Google OAuth via expo-auth-session; magic-link via deep linking + AsyncStorage; cross-device link triggers pendingEmailConfirmation state
      BoardContext.tsx  # BoardProvider + useBoard(): fetches boards via GET /boards on mount; tracks activeBoard (initialised to default board, preserved across mutations); exposes setActiveBoard, createBoard, renameBoard, setDefaultBoard, setColorBoard (calls updateBoard(id, { color }) then fetchBoards() — added in PR #38), deleteBoard, refetch; mounted in AppNavigator inside the authenticated branch (after !user guard)
    hooks/
      useAuth.ts        # Thin re-export of useAuthContext
    navigation/
      AppNavigator.tsx  # Root navigator: shows loading shimmer → EmailConfirmation screen (cross-device magic link) → LoginScreen (post sign-out) → BoardProvider → bottom tab navigator (Tasks / Chat / Reports / Settings)
    components/
      FocusedView.tsx     # Fetches GET /focused-view/tasks on mount using dateOnly(new Date()) for local-timezone correctness; renders board sections in a ScrollView (vertical stack — single column, appropriate for phone widths); 8-color PALETTE fallback (`['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#ec4899','#14b8a6']`) used when board_color is null; boardColor(board, index) returns board.board_color ?? PALETTE[index % 8]; loading spinner (ActivityIndicator), error banner + Retry, empty state ("No focused tasks for this period") + Refresh; board section header shows colored dot + board name + task count badge; each task rendered as FocusedTaskCard; accepts key={focusedViewKey} from TasksScreen to force remount on tab re-focus; onEditPress prop threaded to FocusedTaskCard for opening TaskFormScreen modal
      FocusedTaskCard.tsx  # Compact task card with 4px colored left border (borderLeftColor: boardColor prop); ★ High badge (amber) when is_high_priority; task title (2-line clamp); effective date chip using getEffectiveDate (red if isOverdue, gray otherwise); label badges (mode=green, type=purple) from task.labels; tapping calls onPress(id) which opens TaskFormScreen in edit mode via handleEditPress in TasksScreen; no drag-and-drop; same NativeWind-safe LABEL_BG/LABEL_TEXT inline-style pattern as TasksScreen
    screens/
      LoginScreen.tsx   # Google Sign-In + magic link; shown only after deliberate sign-out
      TasksScreen.tsx   # Full implementation: grouped SectionList (Overdue → Today → Tomorrow → Day After Tomorrow → Upcoming → No Date); section headers are tappable to collapse/expand (Today and Overdue start expanded; others start collapsed; count shown when collapsed); Expand/Collapse all text button in header (hidden in focused mode); board switcher in header (active board name is tappable, shows ▾ chevron when >1 board exists, opens inline dropdown overlay listing all boards — checkmark on active, star on default; tapping a board calls setActiveBoard() and closes the dropdown); filter reset on board switch (useEffect([activeBoard?.id]) clears selectedLabelIds, searchQuery, showDone); two-button pill toggle ("All" | "Focus") in header (hidden when showDone is true; switching to "Show done" resets viewMode to "detailed"; switching to focused resets filterOpen to false); filter panel (☰ icon hidden in focused mode, turns indigo when active) with text search (title + notes, case-insensitive), label chips grouped by category (OR semantics), "Show completed" switch (re-fetches all tasks; done rows appear faded with strikethrough title and no complete/HP decorations), and "Clear filters" link; when viewMode === "focused" AND !showDone renders <FocusedView key={focusedViewKey} onEditPress={handleEditPress} /> in place of the SectionList (FocusedView fetches its own data); focusedViewKey counter incremented on every useFocusEffect to force FocusedView remount and re-fetch when the Tasks tab regains focus (prevents stale data after Settings changes); TaskRow component with effective-date chip, high-priority amber top bar + star badge (suppressed for done tasks), label badges; DraggableTaskRow wraps TaskRow with a react-native-gesture-handler Pan gesture (activateAfterLongPress 500ms) — on long-press a TaskGhost floats above the list (react-native-reanimated shared values for position/visibility), original row dims to 30% opacity; section headers highlight in indigo and record their Y position via onLayout for hit-testing; on drop, performDrop() sets target_date only (matching web behaviour) via PUT /tasks/{id}, with optimistic update + revert on error; dropping onto Overdue or Upcoming is silently rejected (neither section highlights during a drag); HP limit (fetched from GET /settings on every tab focus) is enforced for today/tomorrow drops of already-HP tasks with an Alert; list auto-scrolls when finger is within 80px of top/bottom edge; scroll is disabled (scrollEnabled=false) during drag; tapping a row opens TaskFormScreen in edit mode; + button in header opens TaskFormScreen in create mode (passes active label filter IDs as initialLabelIds — labels are pre-selected in the new task form when filters are active; edit mode always uses the task's own labels); complete (optimistic remove + silent re-fetch) and delete (confirmation dialog + optimistic remove) actions; pull-to-refresh via RefreshControl; useFocusEffect re-fetches tasks, labels, and settings on every tab focus (guarded — exits early if activeBoard is null); loading spinner, error + Retry, and context-aware empty-state views ("No tasks match your filters" vs "No pending tasks")
      TaskFormScreen.tsx  # Create/edit form presented as a slide-up pageSheet Modal (not a stack navigator screen). Props: taskId? (undefined = create mode), onSave, onCancel, initialLabelIds? (optional string array — seeds selectedLabelIds in create mode only; ignored in edit mode). Fields: title (required), notes, must-do-by, target-date, high-priority checkbox (conditional), labels. Uses @react-native-community/datetimepicker — iOS renders inline calendar; Android renders system dialog. 422 high-priority-limit error is caught via ApiError.status and surfaced as an Alert with the checkbox auto-unchecked.
      ChatScreen.tsx    # Full implementation: per-session conversation with optimistic user messages, typing indicator (ActivityIndicator), suggested follow-up chips rendered as horizontally-scrollable pressable chips, KeyboardAvoidingView (behavior="padding" on iOS / "height" on Android), ScrollView with onContentSizeChange for auto-scroll to latest message, inline error banner on send failure; loads starter questions from GET /settings on mount and shows them as indigo chips in the empty state (falls back to plain text prompt if none configured); resets conversationIdRef and clears messages on board switch (useEffect([activeBoard?.id])) so the next message creates a fresh conversation scoped to the new board; passes activeBoard?.id to createConversation
      ReportsScreen.tsx # Full implementation: date-range picker (From/To text inputs, ISO YYYY-MM-DD, defaults to last 7 days), lazy-fetch Go button, ActivityIndicator spinner, summary bar (N completions), scrollable list of CompletionRow cards (title, formatted completion timestamp, label badges sorted Mode→Type), empty state, pre-fetch prompt, dismissable inline error banner; local-timezone date helpers (toLocalISO, todayISO, sevenDaysAgoISO, formatCompletedAt) defined inline; passes activeBoard?.id to getCompletions
      SettingsScreen.tsx  # Full implementation: KeyboardAvoidingView + ScrollView shell; Boards section at top (BoardSection sub-component — calls useBoard() directly for all mutations including setColorBoard; board count badge N/10, list of boards with default star, inline rename/set-default/delete/add; each board row shows a horizontal row of 8 color swatches (20×20 circles from COLOR_PALETTE) plus a "None" swatch at position 0; tapping a swatch sets the board color via setColorBoard, tapping the active swatch or "None" clears it to null; active swatch highlighted with a border ring; delete guarded — UI hides Delete when only one board; backend errors surfaced as inline text; new board via inline "+ Add board" input capped at 10 boards); Focused View config section between Boards and Labels (FocusedViewConfigSection sub-component — loads getFocusedViewConfig() on mount; board selection radio All/Selected with per-board checkboxes sourced from useBoard() when "Selected" is chosen; day range radio Today/Today+Tomorrow/Today+2 days; dedicated Save button calls updateFocusedViewConfig with all three fields required; inline error and success banners; independent busy and error state); Connection section (environment badge, Test Connection button); Labels section with LabelSection sub-component (inline add/edit/delete for Mode and Type labels; labels scoped to activeBoard?.id; Frequency labels hidden); High Priority Daily Limit stepper (− / + buttons, min 1); Starter Questions editor (up to 5, stable-id state, add/remove/inline-edit, saved via PUT /settings); Save Settings button persists HP limit + questions together with a 3-second "Settings saved" confirmation banner; Account section — anonymous users see Google sign-in + email sign-in (magic link) options; named users see display name/email and Sign out
    api/
      client.ts         # apiFetch<T>: attaches Bearer token via auth.currentUser?.getIdToken(); parses FastAPI error detail; base URL from EXPO_PUBLIC_API_URL (default http://localhost:8000). Exports ApiError class (subclass of Error) with a readonly .status: number property — callers can instanceof-check and branch on HTTP status (e.g. 422 high-priority limit in TaskFormScreen). Also exports API_BASE_URL (raw base URL) and API_V1_URL (base URL + /api/v1) for use by screens that need to display or directly call the API URL (e.g. SettingsScreen connection test)
      boards.ts         # getBoards, createBoard, updateBoard (body includes color?: string | null added in PR #38), deleteBoard
      tasks.ts          # Task CRUD + complete; listTasks(state?, boardId?) and createTask(body, boardId?) accept optional boardId
      labels.ts         # Label list/create/update/delete; listLabels(category?, boardId?) and createLabel(category, value, boardId?) accept optional boardId
      conversations.ts  # Conversations + messages; createConversation(boardId?) accepts optional boardId
      reports.ts        # GET /reports/completions; getCompletions(from, to, boardId?) accepts optional boardId
      settings.ts       # GET/PUT /settings
      focusedView.ts    # FocusedViewConfig (id, board_selection, selected_board_ids, day_range) and FocusedBoard (board_id, board_name, board_color, tasks) interfaces; getFocusedViewConfig(), updateFocusedViewConfig() (all three fields required — board_selection, selected_board_ids, day_range), getFocusedViewTasks(referenceDate?) — wrappers for GET/PUT /focused-view/config and GET /focused-view/tasks; all use apiFetch from ./client
    types/
      index.ts          # Shared TypeScript interfaces (Board, Task, Label, Conversation, Message, etc.); Board interface added in PR #35; Task.board_id and Conversation.board_id added to match API response shape; color: string | null added to Board interface in PR #38
    utils/
      taskDateUtils.ts  # Copied from frontend/ — getColumn(), getDropDate(), getEffectiveDate(), etc. getEffectiveDate() returns earliest of must_do_by / target_date when both are set (bug fix — previously always returned target_date)
      taskFilters.ts    # Copied from frontend/ — filterTasks()
      taskPriority.ts   # Copied from frontend/ — isHighPriorityEligible(), splitByPriority(), canAddHighPriority(); plus mobile-only isFormHighPriorityEligible(mustDoBy, targetDate, todayStr, tomorrowStr) — returns true when at least one of the two date strings is non-empty and falls on today or tomorrow (used by TaskFormScreen to conditionally show the high-priority checkbox)
      taskGrouping.ts   # groupTasksForList(tasks, referenceDate?) → TaskSection[] for SectionList; buckets tasks into SECTION_ORDER (overdue → today → tomorrow → day_after_tomorrow → upcoming → nodate); empty sections omitted
      chatUtils.ts      # Pure message-state helpers for ChatScreen: buildOptimisticMessage() creates a local-only Message with a temp ID and 'sending' status; confirmMessages() replaces the optimistic entry with the server-confirmed message; rollbackMessage() removes the optimistic entry on send failure — all three return new arrays (no mutation)
    __tests__/
      taskDateUtils.test.ts   # Jest tests (updated for earliest-date semantics)
      taskFilters.test.ts     # 70 Jest tests
      taskPriority.test.ts    # 97 Jest tests
      taskGrouping.test.ts    # 11 Jest unit tests for groupTasksForList
      chatUtils.test.ts       # 9 Jest unit tests for chatUtils (buildOptimisticMessage, confirmMessages, rollbackMessage)
      boards.api.test.ts      # 9 Jest unit tests for boards API (getBoards, createBoard, updateBoard, deleteBoard); includes 2 tests for updateBoard color (hex string and null clear) added in PR #38
      focusedView.api.test.ts  # 7 Jest unit tests for focusedView API (getFocusedViewConfig, updateFocusedViewConfig with all required fields, getFocusedViewTasks with and without referenceDate) — added in PR #38
  .env.example          # EXPO_PUBLIC_FIREBASE_*, EXPO_PUBLIC_GOOGLE_*_CLIENT_ID, EXPO_PUBLIC_API_URL
  package.json          # includes @react-native-community/datetimepicker (Expo-compatible native date picker)
  babel.config.js       # NativeWind v4 preset + reanimated plugin
  metro.config.js       # NativeWind v4 CSS interop wired via withNativeWind()
  tailwind.config.js    # NativeWind Tailwind config pointing at src/**
  tsconfig.json         # Extends expo/tsconfig.base
```

## Key Implementation Patterns

**Schema management**: `Base.metadata.create_all()` on startup. No migrations file — all schema changes run as idempotent `ALTER TABLE` / `CREATE INDEX IF NOT EXISTS` / `DROP INDEX IF EXISTS` statements in `main.py`'s lifespan block. The `boards` table is created by `create_all()` on first run; the partial unique index on `(user_id) WHERE is_default = true AND is_deleted = false` is created separately via raw SQL because SQLAlchemy `UniqueConstraint` does not support partial indexes.

**Board scoping**: All resources (tasks, labels, conversations) belong to exactly one board. `board_service.resolve_board_id(db, user_id, board_id?)` is the single entry point for board resolution in all routers — it validates ownership when `board_id` is supplied and calls `ensure_board_seeded()` when it is omitted, returning the user's default board and lazily creating "General tasks" + seeding 9 default labels for brand-new users. New boards created by users via `POST /boards` start empty (no label seeding). `MAX_BOARDS_PER_USER = 10` is enforced by `board_service.create_board()`.

**Active board (web frontend)**: `BoardContext` tracks the user's currently selected board in React state. On mount, `BoardProvider` calls `GET /boards` and sets `activeBoard` to the board with `is_default === true`. Active board is never persisted to `localStorage` — every app open resets to the default board. `setActiveBoard` calls `FilterContext.clearLabels()` when the board actually changes (labels from one board are not valid in another). All data-fetching hooks (`useTasks`, `useLabels`) and direct API calls in pages (`TaskDetailPage`, `ChatPage`, `ReportsPage`, `SettingsPage`) read `activeBoard.id` and pass it as `board_id` to their API calls. Every `BoardContext` mutation (create, rename, set-default, set-color, delete) awaits `fetchBoards()` to refresh the full boards list — no local-state patching. `setColorBoard(id, color)` calls `updateBoard(id, { color })` then `fetchBoards()` so the board list (and swatches) reflect the new color immediately.

**Label seeding (board-scoped)**: `label_service.seed_board_labels(db, board_id, user_id)` seeds the 9 LABEL_SEED entries into a specific board. It is called only during initial board creation (via `ensure_board_seeded` in `board_service`). New boards created by users are NOT seeded. The sentinel is "this board has 0 labels" — checked per-board, not per-user.

**API proxy**: Vite dev server proxies `/api` to `http://localhost:8000`, so the frontend makes same-origin requests and CORS is not an issue in development.

**AI conversations** (`handle_conversation_message`): builds a system prompt with the user's pending tasks (up to 100) and all labels scoped to the conversation's `board_id`, then runs a Claude tool-use loop (max 8 turns) with tools `create_task`, `complete_task`, and `respond_to_user`. Loop exits when Claude calls `respond_to_user`, which also carries `suggested_questions`. Task context is formatted by `_format_task_line()`, which includes both `must_do_by` and `target_date` when set. Tasks created by the AI tool are assigned to the conversation's board.

**AI beliefs** (`generate_beliefs`): single JSON-mode Claude call; response parsed for `label_suggestions` (label_id + rationale) and `time_estimate_minutes`.

**High-priority tasks**: `is_high_priority` is only valid when the task's effective date (earliest of `must_do_by` / `target_date`) is today, tomorrow, or in the past (overdue). Auto-reset to `false` on any update that moves the date outside that window. The daily cap is user-configurable via `user_settings.high_priority_daily_limit` (default 3, min 1); `_get_high_priority_limit()` in `task_service.py` reads it on each create/update, falling back to 3. HTTP 422 is raised when the cap is exceeded. The cap does not apply within the Overdue column — tasks retain their existing priority there, but the cap re-engages when a task is dragged to Today or Tomorrow. When a column exceeds the limit, the column header shows an amber ⚠ N/M high badge (warning only — no retroactive enforcement).

**Null-clearing on update**: `PUT /tasks/{task_id}` uses Pydantic `model_fields_set` to distinguish "field not provided" from "field explicitly set to null". `clear_must_do_by` and `clear_target_date` flags are passed to `update_task` to allow clearing date fields to null. The `TaskForm` component sends an explicit `null` when a previously-set date is cleared via the × button, ensuring the backend actually clears the field.

**Overdue column**: Tasks whose effective date is strictly in the past are assigned to the `overdue` column bucket (`ColumnKey = 'overdue' | 'today' | 'tomorrow' | 'day_after_tomorrow' | 'upcoming' | 'nodate'`). The Overdue column uses a red accent style and is **hidden entirely when it contains no tasks**. Dropping tasks *into* the Overdue column is blocked; tasks can only drag *out* to other columns. `getDropDate('overdue')` returns `null` (same as `nodate`). `isHighPriorityEligible` returns `true` for `overdue` so existing high-priority flags are preserved.

**Upcoming column (read-only drop target)**: The Upcoming column (and Upcoming section on mobile) is **blocked as a drop target** — dragging a task over it shows no highlight, and dropping is a no-op. The column placeholder shows "Read-only" on web (mobile: the section header does not highlight during drag). This matches the Overdue blocking. Tasks naturally fall into Upcoming by having a `target_date` beyond tomorrow+1; that date is not settable by drag.

**Day After Tomorrow column**: `getColumn()` detects tasks whose effective date falls on today+2 and assigns them to the `day_after_tomorrow` bucket. `getDropDate('day_after_tomorrow')` returns today+2. `isHighPriorityEligible` returns `false` for `day_after_tomorrow` — the HP split is intentionally limited to today and tomorrow only.

**Drag-and-drop date semantics**: When a task is dragged to a dated column, `TasksPage` always updates `target_date` only — `must_do_by` is never modified by drag-and-drop. This preserves any hard deadline the user set explicitly. When dragging to the `nodate` column, only `target_date` is cleared (set to `null`); `must_do_by` is left untouched. `getEffectiveDateField()` exists in `taskDateUtils.ts` but is not used in the drag-drop path.

**Firebase Auth flow (Phase 2 frontend):** `AuthContext` mounts a single `onAuthStateChanged` listener. When `firebaseUser === null` and no deliberate sign-out is recorded in `sessionStorage` (`auth_signed_out`), it calls `signInAnonymously()` automatically — the user never sees a login screen. Deliberate sign-out sets `sessionStorage.auth_signed_out = '1'`, which prevents the auto-sign-in on the next listener fire; `LoginPage` is shown instead. Magic-link callbacks are handled on page load: if `localStorage.emailForSignIn` is present (same device), sign-in completes immediately; otherwise `EmailConfirmationPage` (an inline component in `App.tsx`) prompts the user for their email before completing the cross-device sign-in.

**Firebase Auth flow (mobile):** Mirrors the web pattern with React Native–specific adaptations. `AsyncStorage` replaces `localStorage`/`sessionStorage`. Auth persistence uses `getReactNativePersistence(AsyncStorage)` so the Firebase session survives app restarts. The deliberate-sign-out flag is a module-level variable (resets on force-quit — correct behaviour for a mobile app). Magic-link deep links are received via `expo-linking`: `Linking.getInitialURL()` handles cold-start links; `Linking.addEventListener('url', ...)` handles links while the app is open. Google Sign-In uses `expo-auth-session/providers/google` with separate web/iOS/Android client IDs from `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` env vars. In Expo Go, the Google OAuth redirect is `exp://[local-ip]:8081` and must be added to Google Cloud Console. Magic link deep linking only works fully in standalone builds; Expo Go cannot redirect back from the browser.

**Mobile form navigation (pageSheet Modal):** `TaskFormScreen` is not registered in the navigator; it is presented as a React Native `<Modal animationType="slide" presentationStyle="pageSheet">` owned by `TasksScreen`. This avoids a nested stack navigator and keeps the form decoupled — `TasksScreen` tracks `formVisible: boolean` and `editingTaskId: string | undefined` in local state. `onSave` and `onCancel` callbacks close the modal and trigger a silent re-fetch. When opening in create mode, `TasksScreen` passes `initialLabelIds={[...selectedLabelIds]}` to pre-select the currently active label filters in the form; in edit mode, `initialLabelIds` is `undefined` so the form always reflects the task's own labels. This pattern is the approved approach for full-screen forms in the mobile app.

**Mobile API error handling (ApiError):** `mobile/src/api/client.ts` exports an `ApiError` class (extends `Error`) with a readonly `status: number` property equal to the HTTP response status code. All `apiFetch` errors are thrown as `ApiError`. Callers use `instanceof ApiError` to branch on specific HTTP statuses (e.g. `err.status === 422` to catch the high-priority daily limit and display a user-friendly `Alert` without treating it as a generic failure). This pattern replaces the old practice of parsing error strings.

**Mobile drag-drop (TasksScreen):** Long-pressing a pending task for 500ms activates a `react-native-gesture-handler` Pan gesture via `GestureDetector`. A `TaskGhost` component floats at the finger position using `react-native-reanimated` shared values (`ghostY`, `ghostVisible`) updated in worklets to avoid JS-thread jank. The JS thread receives `runOnJS` callbacks (`onDragActivate`, `onDragMove`, `onDragEnd`) for target hit-testing and state updates. Section header Y positions are recorded via `onLayout`; hit-testing maps the finger's scroll-adjusted Y coordinate to the nearest section. On drop, only `target_date` is updated via `PUT /tasks/{id}` — matching web behaviour (`must_do_by` is never modified by drag). Dropping onto Overdue or Upcoming is rejected — `updateDragTarget` maps both to `null` (no highlight); `performDrop` returns early for both. The HP daily limit (fetched from `GET /settings` on every focus) is enforced client-side for today/tomorrow drops of already-HP tasks. Auto-scroll uses a 16ms `setInterval` that drives `getScrollResponder().scrollTo()` (an internal RN API used because `SectionList.scrollToLocation` does not support arbitrary Y offsets).

**Active board (mobile):** `BoardContext` tracks the user's currently selected board in React state. On mount, `BoardProvider` calls `GET /boards` and sets `activeBoard` to the default board (or the first board if no default exists). Active board is never persisted to `AsyncStorage` — every app open resets to the default board. `setActiveBoard` is called directly from the board switcher in `TasksScreen`; no label clearing happens in `BoardContext` itself. Instead, each screen uses `useEffect([activeBoard?.id])` to react to board changes: `TasksScreen` clears label filters, search query, and show-done toggle; `ChatScreen` resets the conversation ref and clears messages. All data-fetching calls in screens read `activeBoard?.id` and pass it as an optional `boardId` parameter. `useFocusEffect` in `TasksScreen` is guarded — it exits early if `activeBoard` is null (initial load). Every `BoardContext` mutation (create, rename, set-default, set-color, delete) awaits `fetchBoards()` to refresh the full boards list — no local-state patching. `setColorBoard(id, color)` calls `updateBoard(id, { color })` then `fetchBoards()` so the board list (and swatches in SettingsScreen) reflect the new color immediately.

**No shared module between web and mobile:** TypeScript types (`types/index.ts`) and pure utility functions (`taskDateUtils`, `taskFilters`, `taskPriority`) are duplicated from `frontend/src/` into `mobile/src/`. This is intentional — avoids monorepo complexity at the cost of keeping them in sync manually. `taskGrouping.ts` is mobile-only (no web equivalent) because the web app uses a kanban column layout rather than a grouped list. `isFormHighPriorityEligible` is also mobile-only — the web app's `TaskForm` derives eligibility from the selected column context rather than inspecting raw date strings.

**Mobile label badge colors (NativeWind):** Dynamic Tailwind class interpolation is unsafe in NativeWind v4. `TasksScreen.tsx` uses inline `style` props (`backgroundColor`, `color`) driven by lookup objects (`LABEL_BG`, `LABEL_TEXT`) keyed by label category, rather than dynamic class strings. This is the approved pattern for per-category colors in mobile components.

For auth, soft deletes, recurring task rules, beliefs storage, sync protocol, and cost tracking see `DATA_MODEL_AND_API.MD`.

## Dev

```bash
# Full stack (Docker): db + api + frontend + pgAdmin
cd backend && docker-compose up -d
# API at http://localhost:8000, frontend at http://localhost:5173, pgAdmin at http://localhost:5050

# Backend only (no Docker):
cd backend && uvicorn app.main:app --reload

# Frontend only (no Docker):
cd frontend && npm run dev   # http://localhost:5173
```

Copy `backend/.env.example` → `backend/.env`; set `ANTHROPIC_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON` (full JSON string of the Firebase service account key), and `FIREBASE_PROJECT_ID`. The app will refuse to start without `FIREBASE_SERVICE_ACCOUNT_JSON`. pgAdmin credentials are also configured in `.env`.

Copy `frontend/.env.example` → `frontend/.env`; set all `VITE_FIREBASE_*` env vars (API key, auth domain, project ID, storage bucket, messaging sender ID, app ID). The frontend build requires these to initialise Firebase Auth — anonymous sign-in on first load will fail silently without them. In production (Railway), set these as frontend service env vars.

Copy `mobile/.env.example` → `mobile/.env`; set all `EXPO_PUBLIC_FIREBASE_*` env vars and `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` env vars. Set `EXPO_PUBLIC_API_URL` to your machine's local IP (e.g. `http://192.168.1.100:8000`) — `localhost` does not resolve from a physical device or emulator to the host machine. For Google Sign-In in Expo Go, add the `exp://[local-ip]:8081` redirect URI to Google Cloud Console → Authorized redirect URIs.

```bash
# Mobile (Expo Go — no custom dev client needed):
cd mobile && npm install && npx expo start
# Scan QR with Expo Go on iOS/Android
```

## Testing

**API integration tests** (`tests/test_api.py`): standalone Python script; creates its own test data, exercises all endpoints (CRUD, label assignment, state transitions, high-priority limit, conversational endpoints), deletes all created data at the end. Run with:
```bash
cd backend && DATABASE_URL=... python3 tests/test_api.py
```

**Backend unit tests** (`tests/unit/`): pytest-based, no DB required (mock SQLAlchemy sessions). Cover `task_service` (create, update, complete, recurring, high-priority limit), `ai_service` helpers (`_format_task_line`), `dependencies` (Firebase Bearer auth, token expiry/invalidity, migrate edge cases), `labels` router (seed via `TestSeedBoardLabels`, create, update, delete — ownership + category guards), `board_service` (21 tests: board cap, default swap, deletion guards, seeding idempotency), and `focused_view_service` (16 tests: config create/update/validation, task day-window filtering, board-scope filtering, alphabetical ordering). 119 total. Run with:
```bash
cd backend && python3 -m pytest tests/unit/ -v
```

**Frontend unit tests** (`src/__tests__/`): Vitest. Cover `taskDateUtils` (including overdue and day_after_tomorrow column logic), `taskFilters`, `taskPriority` utilities, `client.ts` auth header behaviour, and `boards` API (75 tests total). Run with:
```bash
cd frontend && npx vitest run
```

**Mobile unit tests** (`mobile/src/__tests__/`): Jest (jest-expo preset). Cover the three utility modules copied from `frontend/`: `taskDateUtils` (24 tests, updated for earliest-date semantics; includes 6 tests for `getDropDate`), `taskFilters` (8 tests), `taskPriority` (17 tests, includes `isFormHighPriorityEligible`); plus `taskGrouping` (12 tests), `chatUtils` (9 tests), `boards` API (9 tests — includes 2 color tests added in PR #38), and `focusedView` API (7 tests — added in PR #38). 86 mobile unit tests pass in total. Run with:
```bash
cd mobile && npm test
```
