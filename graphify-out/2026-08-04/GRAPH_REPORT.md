# Graph Report - tasksAreUs  (2026-08-03)

## Corpus Check
- 217 files · ~243,004 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1441 nodes · 3517 edges · 111 communities (66 shown, 45 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 201 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e5ed1a99`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- update_task
- test_focused_view_service.py
- TaskUpdate
- DATA_MODEL_AND_API.MD — data model & API definitions
- test_labels_router.py
- patch
- PLAN-feat-tasks-view-redesign-mobile.md (external)
- SettingsPage.tsx
- create_task
- TasksScreen.tsx
- Task
- useBoard
- frontend/src/components/BoardGroupedTasks.tsx
- expo
- frontend/src/api/tasks.ts
- get_firebase_claims
- ArchivePage.tsx
- ArchiveScreen.tsx
- mobile/src/utils/taskPriority.ts
- get_completions
- Board
- src/App.tsx
- TasksPage.tsx
- compilerOptions
- models.py
- schemas.py
- TaskFormScreen.tsx
- compilerOptions
- mobile/src/context/BoardContext.tsx
- sync.py
- mobile/src/api/focusedView.ts
- devDependencies
- SettingsScreen.tsx
- dependencies
- dependencies
- Plan: Fix Archive view usability (tabs, task details, reopen, tag order)
- apiFetch
- get_day_view_tasks
- test_api.py
- get_focused_tasks
- mobile/package.json
- @react-navigation/native
- reopen_task
- devDependencies
- settings.py
- _is_hp_eligible_date
- frontend/src/api/client.ts
- _owned_board_id
- _make_board
- StateEnum
- sync_local_to_railway.py
- scripts
- purge_test_data.py
- mobile/tsconfig.json
- frontend/package.json
- metro.config.js
- get_completions
- frontend/tsconfig.json
- markdown-it-task-lists.d.ts
- @eslint/js
- eslint-plugin-react-hooks
- eslint-plugin-react-refresh
- expo-linking
- expo-status-bar
- expo-updates
- expo-web-browser
- firebase
- frontend/index.html — Vite SPA entry HTML
- jsdom
- postcss
- tailwindcss
- @tailwindcss/typography
- @types/node
- @types/react-dom
- typescript-eslint
- markdown-it-task-lists
- migrate_to_railway.sh
- app.config.js
- nativewind-env.d.ts
- nativewind
- react
- react-native
- @react-native-community/datetimepicker
- react-native-gesture-handler
- react-native-reanimated
- react-native-safe-area-context
- @react-navigation/bottom-tabs
- tailwindcss
- backup-railway-db.sh
- migrate-remove-mode-labels.sh
- restore-railway-db.sh
- tasksAreUs Favicon Icon
- icons.svg (Icon Sprite)
- Hero Image (Isometric Purple Tile Logo)
- React Logo (react.svg)
- Vite Logo (vite.svg)
- Adaptive Icon (Mobile App)
- Mobile App Favicon
- Mobile App Icon (Blank/Placeholder)
- Splash Icon (blank/white)
- index.ts

## God Nodes (most connected - your core abstractions)
1. `Task` - 61 edges
2. `update_task()` - 50 edges
3. `StateEnum` - 42 edges
4. `Board` - 38 edges
5. `sync()` - 33 edges
6. `DATA_MODEL_AND_API.MD — data model & API definitions` - 29 edges
7. `apiFetch()` - 27 edges
8. `Label` - 26 edges
9. `TaskUpdate` - 25 edges
10. `apiFetch()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `PRODUCT_REQUIREMENTS_DOCUMENT.MD — product requirements` --semantically_similar_to--> `REQUIREMENTS_HUMAN.MD — tasksAreUs Requirements v2 (human-authored)`  [INFERRED] [semantically similar]
  PRODUCT_REQUIREMENTS_DOCUMENT.MD → REQUIREMENTS_HUMAN.MD
- `README.md — project root dev/run commands` --semantically_similar_to--> `railway_migration.md — Railway production deployment guide`  [INFERRED] [semantically similar]
  README.md → railway_migration.md
- `Overdue View proposal (archived plan; proposed separate /overdue-view/tasks endpoint)` --conceptually_related_to--> `Day View`  [AMBIGUOUS]
  archive/PLAN-feat-overdue-view-colors-actions.md → ARCHITECTURE.MD
- `playwright.md — ad hoc Playwright verification notes` --conceptually_related_to--> `Docker Compose local dev stack (db, api, frontend, pgadmin)`  [INFERRED]
  playwright.md → backend/docker-compose.yml
- `Offline-first sync / last-write-wins conflict resolution` --references--> `tasks table (core task entity)`  [INFERRED]
  REQUIREMENTS_HUMAN.MD → DATA_MODEL_AND_API.MD

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **tasksAreUs agent roster (defined together in CLAUDE.md)** — agent_grumpy, agent_dopey, agent_sleepy, agent_bashful, agent_doc, agent_sneezy [EXTRACTED 1.00]
- **Full-review chain agents (code/test/requirements/architecture review, run in sequence)** — agent_dopey, agent_sleepy, agent_bashful, agent_doc [INFERRED 0.75]
- **Board custom order & derived-default mechanism (PR #62)** — table_boards, concept_board_color_order, concept_task_sort_order [EXTRACTED 1.00]
- **Frequency Label Removal PR Sequence (backend logic → DB migration → type cleanup)** — development_plans_plan_drop_frequency_labels_backend_doc, development_plans_plan_feat_drop_frequency_labels_migration_doc, development_plans_plan_feat_frontend_mobile_type_cleanup_doc [EXTRACTED 1.00]
- **3-PR Focused View Feature Sequence (backend → web → mobile)** — development_plans_plan_feat_focused_view_doc, development_plans_plan_feat_focused_view_web_doc, development_plans_plan_feat_focused_view_mobile_doc [EXTRACTED 1.00]
- **Shared BoardGroupedTasks/board-color rendering pattern across plans** — development_plans_plan_feat_archive_view_doc, development_plans_plan_feat_board_collapse_web_doc, development_plans_plan_feat_board_order_and_color_doc [INFERRED 0.85]
- **Focused/Day-View three-PR epic: backend -> web -> mobile** — development_plans_plan_feat_tasks_day_view_backend_doc, development_plans_plan_feat_tasks_view_redesign_web_doc, development_plans_plan_feat_tasks_view_redesign_mobile_doc [EXTRACTED 1.00]
- **Multi-board feature epic: backend/data-model plan plus mobile follow-on** — development_plans_plan_feat_multi_board_doc, development_plans_plan_feat_multi_board_mobile_doc, development_plans_plan_feat_multi_board_boards_table [INFERRED 0.85]
- **Recurring bug class: conditionally omitting a field on save silently fails to clear it (notes / links)** — development_plans_plan_fix_focused_card_parity_and_notes_bug_notes_truthiness_bug, development_plans_plan_feat_task_links_full_replace_semantics, development_plans_plan_feat_tasks_view_redesign_mobile_notes_bug_foldin [INFERRED 0.80]

## Communities (111 total, 45 thin omitted)

### Community 0 - "update_task"
Cohesion: 0.15
Nodes (5): update_task(), TestUpdateTaskDateClearing, TestUpdateTaskHighPriority, TestUpdateTaskLinks, TestUpdateTaskSortOrder

### Community 1 - "test_focused_view_service.py"
Cohesion: 0.08
Nodes (25): FocusedViewConfig, date_window(), get_day_view_tasks(), get_focused_tasks(), get_or_create_config(), Board, date, Session (+17 more)

### Community 2 - "TaskUpdate"
Cohesion: 0.07
Nodes (37): complete_task(), create_task(), delete_task(), get_task(), list_tasks(), date, delete, get (+29 more)

### Community 3 - "DATA_MODEL_AND_API.MD — data model & API definitions"
Cohesion: 0.08
Nodes (56): Bashful — requirements-review agent, keeps PRODUCT_REQUIREMENTS_DOCUMENT.MD current, Doc — arch-review agent, keeps ARCHITECTURE.MD and DATA_MODEL_AND_API.MD current, Dopey — code-review agent (correctness, architecture fit, security), Grumpy — main assistant (Claude), implements features and creates PRs, Sleepy — test-review agent, owns test_api.py, runs tests, posts QE verdict, Sneezy — plan-review agent, reviews development plan files, ARCHITECTURE.MD — code structure & implementation patterns, PLAN-feat-overdue-view-colors-actions.md (archived development plan) (+48 more)

### Community 4 - "test_labels_router.py"
Cohesion: 0.13
Nodes (20): CategoryEnum, create_label(), delete_label(), list_labels(), delete, get, post, put (+12 more)

### Community 5 - "patch"
Cohesion: 0.17
Nodes (3): patch, TestHighPriorityDailyLimit, TestUpdateTaskBoardId

### Community 6 - "PLAN-feat-tasks-view-redesign-mobile.md (external)"
Cohesion: 0.05
Nodes (48): Rationale: seeding sentinel scoped per-board (ensure_board_seeded), not per-user, so new boards start empty while the original 'General tasks' board still seeds, boards table data model (multi-board feature), PLAN: feat-multi-board — Multiple Boards, Mobile BoardContext (mirrors web BoardContext, no FilterContext equivalent), PLAN: Multi-board Mobile Support (PR 3/3), Rationale: OTA (eas update) deployment for JS/TS-only mobile changes, no native/app.json/eas.json touched, Rationale: partial unique index UNIQUE(user_id) WHERE is_default=true, created via raw SQL in lifespan block since create_all() can't express partial indexes, _resolve_labels(label_ids, user_id, board_id, db) — cross-board label validation (+40 more)

### Community 7 - "SettingsPage.tsx"
Cohesion: 0.12
Nodes (22): UI Naming Change: Type → Tags, Plan: Custom board order + board-color styling + alphabetical tags, Native input[type=color] Auto-Save Picker (routes through setColorBoard), Plan: feat-focused-view-web (PR 2 of 3), PLAN-feat-multi-board-backend (PR #33, external, merged), BoardContext + BoardSwitcher UI Design, PLAN: feat-multi-board-frontend (PR 2/3), Board (+14 more)

### Community 8 - "create_task"
Cohesion: 0.13
Nodes (11): _count_high_priority_for_date(), create_task(), _effective_date(), Any, date, Label, Session, _resolve_labels() (+3 more)

### Community 9 - "TasksScreen.tsx"
Cohesion: 0.14
Nodes (22): DayView(), FocusedView(), TODO: When task-fetching is extended to include done tasks, this pending, TaskCardBody(), BoardViewKey, DisplaySection, TaskGhost(), TaskRow() (+14 more)

### Community 10 - "Task"
Cohesion: 0.21
Nodes (18): Task, TaskLabel, UserSettings, post, sync(), SyncChanges, SyncRequest, _make_db() (+10 more)

### Community 11 - "useBoard"
Cohesion: 0.23
Nodes (11): all_boards Additive Query Param Design, Board-Grouped Collapsible Rendering (mirrors Today view), PLAN: Rename Reports → Archive, add date-range presets and board filtering, Board Color Everywhere (TaskCard/BoardTabs accents), listTasks(), ArchiveBoardTabs(), BoardTabs(), useBoard() (+3 more)

### Community 12 - "frontend/src/components/BoardGroupedTasks.tsx"
Cohesion: 0.13
Nodes (21): BoardCollapseContext (modeled on FilterContext), PLAN: feat-board-collapse-web — Collapsible boards (web), getDayViewTasks(), FocusedBoard, getFocusedViewTasks(), BoardGroupedTasks(), DayView(), EmptyState() (+13 more)

### Community 13 - "expo"
Cohesion: 0.06
Nodes (30): backgroundColor, foregroundImage, adaptiveIcon, package, projectId, expo, android, extra (+22 more)

### Community 14 - "frontend/src/api/tasks.ts"
Cohesion: 0.10
Nodes (36): PLAN-feat-inline-tag-add, Inline Tag Creation from TaskForm (avoid Settings trip), apiFetch(), createLabel(), deleteLabel(), LabelCategory, listLabels(), updateLabel() (+28 more)

### Community 15 - "get_firebase_claims"
Cohesion: 0.14
Nodes (8): get_firebase_claims(), Validate Bearer token and return decoded claims. Does NOT touch the DB. Used by…, _firebase_claims(), _make_db(), Unit tests for dependencies.py — Firebase auth path., TestAuthBypass, TestGetCurrentUser, TestGetFirebaseClaims

### Community 16 - "ArchivePage.tsx"
Cohesion: 0.14
Nodes (18): BoardCompletions, CompletionRecord, CompletionsReport, getCompletions(), GetCompletionsOptions, ArchiveBoardGroups(), CompletionCard(), formatDateTime() (+10 more)

### Community 17 - "ArchiveScreen.tsx"
Cohesion: 0.14
Nodes (17): getCompletions(), GetCompletionsOptions, ArchiveBoardTabs(), boardColor(), PALETTE, ArchiveScreen(), CompletionRow(), formatCompletedAt() (+9 more)

### Community 18 - "mobile/src/utils/taskPriority.ts"
Cohesion: 0.46
Nodes (5): canAddHighPriority(), HIGH_PRIORITY_DAILY_LIMIT, isFormHighPriorityEligible(), isHighPriorityEligible(), splitByPriority()

### Community 19 - "get_completions"
Cohesion: 0.17
Nodes (14): _completions_query(), get_completions(), date, Session, Task, _to_completion_item(), _make_board(), _make_task() (+6 more)

### Community 20 - "Board"
Cohesion: 0.12
Nodes (20): Board, create_board(), ensure_board_seeded(), get_board_or_404(), get_default_board_id(), Board, Session, Board CRUD, seeding, and board-cap enforcement. (+12 more)

### Community 21 - "src/App.tsx"
Cohesion: 0.13
Nodes (16): App(), AppRoutes(), EmailConfirmationPage(), Layout(), NAV_ITEMS, NavItem, AuthContext, AuthContextValue (+8 more)

### Community 22 - "TasksPage.tsx"
Cohesion: 0.08
Nodes (41): Development Plan: Enhance All View with Priority Collapse & Date Display, Monday Column (Friday-only) + Priority Split/Collapse, Narrow Label.category Union / Remove Dead recurrence_group_id Type, Task, FocusedTaskCard(), LABEL_COLORS, LABEL_CATEGORY_ORDER, TaskCard() (+33 more)

### Community 23 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 24 - "models.py"
Cohesion: 0.10
Nodes (29): AICostLog, Base, Belief, BeliefStatusEnum, BeliefTypeEnum, Label, _anthropic_client(), generate_beliefs() (+21 more)

### Community 25 - "schemas.py"
Cohesion: 0.09
Nodes (34): generate_beliefs(), get_task_beliefs(), get, post, put, Session, update_belief(), create_board() (+26 more)

### Community 26 - "TaskFormScreen.tsx"
Cohesion: 0.14
Nodes (19): CATEGORY_LABELS, CATEGORY_ORDER, DateField, newLinkId(), notesMarkdownIt, notesMarkdownRules, notesMarkdownStyle, Props (+11 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "mobile/src/context/BoardContext.tsx"
Cohesion: 0.32
Nodes (9): createBoard(), deleteBoard(), getBoards(), updateBoard(), BoardContext, BoardContextValue, BoardProvider(), mockApiFetch (+1 more)

### Community 29 - "sync.py"
Cohesion: 0.16
Nodes (23): Settings, get_db(), get_current_user(), Session, Evaluated per-request so the flag can be toggled without a server restart., Resolve caller to an internal user_id UUID via Firebase Bearer token. Bypass:…, _test_auth_bypass(), _verify_firebase_token() (+15 more)

### Community 30 - "mobile/src/api/focusedView.ts"
Cohesion: 0.19
Nodes (12): Collapse State Lifted into TasksScreen (mobile, no unmount), PLAN: feat-board-collapse-mobile — Collapsible boards (mobile), Predefined 8-Color Palette (no native color picker, mobile), Plan: feat-focused-view-mobile (PR 3 of 3), getDayViewTasks(), FocusedBoard, getFocusedViewTasks(), boardColor() (+4 more)

### Community 31 - "devDependencies"
Cohesion: 0.12
Nodes (17): autoprefixer, eslint, devDependencies, autoprefixer, eslint, globals, @types/react, typescript (+9 more)

### Community 32 - "SettingsScreen.tsx"
Cohesion: 0.08
Nodes (29): Stale Board State Bug (anon→real uid swap, mobile), NOTE: Mobile Stale Board State Bug, API_BASE_URL, API_V1_URL, ApiError, createLabel(), deleteLabel(), listLabels() (+21 more)

### Community 33 - "dependencies"
Cohesion: 0.13
Nodes (15): @believer/react-native-markdown-display, expo, expo-auth-session, expo-crypto, dependencies, @believer/react-native-markdown-display, expo, expo-auth-session (+7 more)

### Community 34 - "dependencies"
Cohesion: 0.13
Nodes (15): @firebase/app, @firebase/auth, dependencies, @firebase/app, @firebase/auth, react, react-dom, react-markdown (+7 more)

### Community 35 - "Plan: Fix Archive view usability (tabs, task details, reopen, tag order)"
Cohesion: 0.12
Nodes (15): API / contract changes, Data model changes, Deployment order, Files to modify, Fix, Issues, Mobile update type, Plan: Fix Archive view usability (tabs, task details, reopen, tag order) (+7 more)

### Community 36 - "apiFetch"
Cohesion: 0.20
Nodes (16): apiFetch(), completeTask(), createTask(), deleteTask(), getTask(), listTasks(), updateTask(), FocusedTaskCard() (+8 more)

### Community 37 - "get_day_view_tasks"
Cohesion: 0.27
Nodes (7): get_day_view_tasks(), date, get, Session, patch, Unit tests for the day-view router — no database required. Guards against a…, TestGetDayViewTasksWiring

### Community 38 - "test_api.py"
Cohesion: 0.22
Nodes (12): assert_eq(), assert_eq_xfail(), assert_in(), assert_true(), cleanup(), main(), Standalone API test script. - Creates its own test data - Exercises all major…, # NOTE: the backend filters completed_at (TIMESTAMP) against to_date (DATE). (+4 more)

### Community 39 - "get_focused_tasks"
Cohesion: 0.32
Nodes (8): get_config(), get_focused_tasks(), date, get, put, Session, update_config(), FocusedViewConfigOut

### Community 40 - "mobile/package.json"
Cohesion: 0.18
Nodes (10): jest, preset, main, name, scripts, android, ios, start (+2 more)

### Community 42 - "reopen_task"
Cohesion: 0.27
Nodes (3): _sort_order_default(), reopen_task(), TestReopenTask

### Community 43 - "devDependencies"
Cohesion: 0.22
Nodes (9): @babel/core, jest-expo, devDependencies, @babel/core, jest-expo, @types/react, typescript, @types/react (+1 more)

### Community 44 - "settings.py"
Cohesion: 0.42
Nodes (8): _get_or_create_settings(), get_settings(), get, put, Session, update_settings(), SettingsOut, SettingsUpdate

### Community 45 - "_is_hp_eligible_date"
Cohesion: 0.29
Nodes (3): _is_hp_eligible_date(), HP is valid for overdue, today, tomorrow, the day after tomorrow, and — on…, TestIsHpEligibleDate

### Community 46 - "frontend/src/api/client.ts"
Cohesion: 0.15
Nodes (9): getSettings(), Settings, updateSettings(), app, auth, firebaseConfig, useSettings(), mockAuth (+1 more)

### Community 47 - "_owned_board_id"
Cohesion: 0.33
Nodes (6): _owned_board_id(), Any, Session, Validate a sync client's raw links payload, keeping whatever is valid. Sync…, Return board_id if it's a real, non-deleted board owned by user_id, else None.…, _validate_sync_links()

### Community 48 - "_make_board"
Cohesion: 0.23
Nodes (6): delete_board(), update_board(), _make_board(), Board, TestDeleteBoard, TestUpdateBoard

### Community 49 - "StateEnum"
Cohesion: 0.16
Nodes (8): StateEnum, complete_task(), _get_high_priority_limit(), Task, Unit tests for task_service.py — no database required., TestCompleteTask, TestGetHighPriorityLimit, TestSortOrderDefault

### Community 50 - "sync_local_to_railway.py"
Cohesion: 0.43
Nodes (5): bulk_insert(), count_task_labels(), fetch_all_as_dicts(), main(), Fresh sync of all user data from local Postgres → Railway Postgres. Does NOT…

### Community 51 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, test, test:watch

### Community 53 - "mobile/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, paths, strict, extends, expo/tsconfig.base

### Community 54 - "frontend/package.json"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 55 - "metro.config.js"
Cohesion: 0.40
Nodes (4): config, { getDefaultConfig }, path, { withNativeWind }

### Community 56 - "get_completions"
Cohesion: 0.50
Nodes (4): get_completions(), date, get, Session

### Community 112 - "index.ts"
Cohesion: 0.13
Nodes (16): updateSettings(), ArchiveBoardGroups(), boardColor(), CompletionCard(), formatCompletedAt(), LABEL_CATEGORY_ORDER, PALETTE, labelA (+8 more)

## Ambiguous Edges - Review These
- `Day View` → `Overdue View proposal (archived plan; proposed separate /overdue-view/tasks endpoint)`  [AMBIGUOUS]
  archive/PLAN-feat-overdue-view-colors-actions.md · relation: conceptually_related_to

## Knowledge Gaps
- **267 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+262 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Day View` and `Overdue View proposal (archived plan; proposed separate /overdue-view/tasks endpoint)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Development Plan: feat-focused-view (backend, PR 1 of 3)` connect `models.py` to `schemas.py`, `Board`, `mobile/src/api/focusedView.ts`, `SettingsPage.tsx`?**
  _High betweenness centrality (0.173) - this node is a cross-community bridge._
- **Why does `Plan: feat-focused-view-mobile (PR 3 of 3)` connect `mobile/src/api/focusedView.ts` to `SettingsScreen.tsx`, `apiFetch`, `SettingsPage.tsx`, `TasksScreen.tsx`, `models.py`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Why does `Task` connect `Task` to `update_task`, `test_focused_view_service.py`, `TaskUpdate`, `patch`, `create_task`, `reopen_task`, `_is_hp_eligible_date`, `_make_board`, `StateEnum`, `get_completions`, `Board`, `models.py`, `schemas.py`, `sync.py`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Are the 39 inferred relationships involving `Task` (e.g. with `TestCreateBoard` and `TestDeleteBoard`) actually correct?**
  _`Task` has 39 INFERRED edges - model-reasoned connections that need verification._
- **Are the 31 inferred relationships involving `StateEnum` (e.g. with `TestDateWindow` and `TestGetDayViewTasks`) actually correct?**
  _`StateEnum` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `Board` (e.g. with `TestCreateBoard` and `TestDeleteBoard`) actually correct?**
  _`Board` has 20 INFERRED edges - model-reasoned connections that need verification._