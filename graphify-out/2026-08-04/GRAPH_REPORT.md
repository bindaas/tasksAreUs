# Graph Report - tasksAreUs  (2026-08-04)

## Corpus Check
- 232 files · ~253,140 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1539 nodes · 3594 edges · 123 communities (69 shown, 54 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 168 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `62393069`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ._make_db
- _make_board
- TaskUpdate
- DATA_MODEL_AND_API.MD — data model & API definitions
- Label
- PLAN: Remove Beliefs Feature and All LLM/Anthropic Integration
- PLAN-feat-tasks-view-redesign-mobile.md (external)
- frontend/src/context/BoardContext.tsx
- Task
- TasksScreen.tsx
- sync
- useBoard
- TasksPage.tsx
- expo
- frontend/src/api/tasks.ts
- get_firebase_claims
- ArchivePage.tsx
- ArchiveScreen.tsx
- mobile/src/utils/taskPriority.ts
- get_completions
- Board
- src/App.tsx
- frontend/src/utils/taskDateUtils.ts
- compilerOptions
- index.ts
- schemas.py
- TaskFormScreen.tsx
- compilerOptions
- mobile/src/context/BoardContext.tsx
- models.py
- mobile/src/api/focusedView.ts
- devDependencies
- AppNavigator.tsx
- dependencies
- dependencies
- Plan: Fix Archive view usability (tabs, task details, reopen, tag order)
- apiFetch
- get_day_view_tasks
- assert_eq
- PLAN-chore-remove-mode-label-dead-code
- mobile/package.json
- PLAN: Modularize `test_api.py` and Reduce Sleepy's (test-review) Token Cost
- TestCompleteTask
- devDependencies
- StateEnum
- @react-navigation/native
- boards.py
- _is_hp_eligible_date
- TestReopenTask
- focused_view_service.py
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
- _get_high_priority_limit
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
- TaskOut
- PLAN: Drop Frequency Labels — PR 3: DB Migration
- TaskForm.tsx
- frontend/src/api/client.ts
- ViewContext.tsx
- Layout.tsx
- TestDateWindow
- TestCountHighPriorityForDate
- Session
- Board
- date
- Task

## God Nodes (most connected - your core abstractions)
1. `Task` - 51 edges
2. `update_task()` - 50 edges
3. `StateEnum` - 33 edges
4. `sync()` - 33 edges
5. `Board` - 29 edges
6. `DATA_MODEL_AND_API.MD — data model & API definitions` - 29 edges
7. `assert_eq()` - 27 edges
8. `apiFetch()` - 27 edges
9. `assert_in()` - 25 edges
10. `assert_true()` - 25 edges

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

## Communities (123 total, 54 thin omitted)

### Community 0 - "._make_db"
Cohesion: 0.13
Nodes (6): update_task(), patch, TestUpdateTaskBoardId, TestUpdateTaskDateClearing, TestUpdateTaskHighPriority, TestUpdateTaskSortOrder

### Community 1 - "_make_board"
Cohesion: 0.08
Nodes (14): _make_board(), _make_config(), _make_task(), TestGetDayViewTasks, TestGetDayViewTasksDateFilterClause, TestGetFocusedTasks, TestGetOrCreateConfig, TestQueryBoardGroupedTasksOrdering (+6 more)

### Community 2 - "TaskUpdate"
Cohesion: 0.08
Nodes (25): create_task(), put, update_task(), Any, Validate a raw list of link dicts against TaskLink rules. Shared between…, TaskCreate, TaskLink, TaskUpdate (+17 more)

### Community 3 - "DATA_MODEL_AND_API.MD — data model & API definitions"
Cohesion: 0.08
Nodes (56): Bashful — requirements-review agent, keeps PRODUCT_REQUIREMENTS_DOCUMENT.MD current, Doc — arch-review agent, keeps ARCHITECTURE.MD and DATA_MODEL_AND_API.MD current, Dopey — code-review agent (correctness, architecture fit, security), Grumpy — main assistant (Claude), implements features and creates PRs, Sleepy — test-review agent, owns test_api.py, runs tests, posts QE verdict, Sneezy — plan-review agent, reviews development plan files, ARCHITECTURE.MD — code structure & implementation patterns, PLAN-feat-overdue-view-colors-actions.md (archived development plan) (+48 more)

### Community 4 - "Label"
Cohesion: 0.12
Nodes (24): CategoryEnum, Label, create_label(), delete_label(), list_labels(), delete, get, post (+16 more)

### Community 5 - "PLAN: Remove Beliefs Feature and All LLM/Anthropic Integration"
Cohesion: 0.07
Nodes (26): API Contract Changes, Backend (`backend/app/`), Confidence & Risk Assessment, Data Model Changes, Database Schema, Deployment Order, Files to Modify, In Scope (+18 more)

### Community 6 - "PLAN-feat-tasks-view-redesign-mobile.md (external)"
Cohesion: 0.06
Nodes (46): Rationale: seeding sentinel scoped per-board (ensure_board_seeded), not per-user, so new boards start empty while the original 'General tasks' board still seeds, boards table data model (multi-board feature), PLAN: feat-multi-board — Multiple Boards, Mobile BoardContext (mirrors web BoardContext, no FilterContext equivalent), PLAN: Multi-board Mobile Support (PR 3/3), Rationale: OTA (eas update) deployment for JS/TS-only mobile changes, no native/app.json/eas.json touched, Rationale: partial unique index UNIQUE(user_id) WHERE is_default=true, created via raw SQL in lifespan block since create_all() can't express partial indexes, _resolve_labels(label_ids, user_id, board_id, db) — cross-board label validation (+38 more)

### Community 7 - "frontend/src/context/BoardContext.tsx"
Cohesion: 0.21
Nodes (13): Native input[type=color] Auto-Save Picker (routes through setColorBoard), Board, createBoard(), deleteBoard(), getBoards(), updateBoard(), BoardContext, BoardContextValue (+5 more)

### Community 8 - "Task"
Cohesion: 0.13
Nodes (17): _sort_order_default(), Task, complete_task(), _count_high_priority_for_date(), create_task(), _effective_date(), Any, date (+9 more)

### Community 9 - "TasksScreen.tsx"
Cohesion: 0.12
Nodes (30): completeTask(), deleteTask(), listTasks(), DayView(), FocusedTaskCard(), FocusedView(), TODO: When task-fetching is extended to include done tasks, this pending, TaskCardBody() (+22 more)

### Community 10 - "sync"
Cohesion: 0.15
Nodes (24): TaskLabel, UserSettings, _owned_board_id(), _parse_dt(), Any, post, Session, Validate a sync client's raw links payload, keeping whatever is valid. Sync… (+16 more)

### Community 11 - "useBoard"
Cohesion: 0.17
Nodes (15): all_boards Additive Query Param Design, PLAN: Rename Reports → Archive, add date-range presets and board filtering, Board Color Everywhere (TaskCard/BoardTabs accents), Plan: Custom board order + board-color styling + alphabetical tags, PLAN-feat-multi-board-backend (PR #33, external, merged), BoardContext + BoardSwitcher UI Design, PLAN: feat-multi-board-frontend (PR 2/3), ArchiveBoardTabs() (+7 more)

### Community 12 - "TasksPage.tsx"
Cohesion: 0.13
Nodes (24): Board-Grouped Collapsible Rendering (mirrors Today view), BoardCollapseContext (modeled on FilterContext), PLAN: feat-board-collapse-web — Collapsible boards (web), Development Plan: Enhance All View with Priority Collapse & Date Display, Monday Column (Friday-only) + Priority Split/Collapse, Plan: feat-focused-view-web (PR 2 of 3), getDayViewTasks(), FocusedBoard (+16 more)

### Community 13 - "expo"
Cohesion: 0.06
Nodes (30): backgroundColor, foregroundImage, adaptiveIcon, package, projectId, expo, android, extra (+22 more)

### Community 14 - "frontend/src/api/tasks.ts"
Cohesion: 0.09
Nodes (39): UI Naming Change: Type → Tags, Narrow Label.category Union / Remove Dead recurrence_group_id Type, PLAN-feat-inline-tag-add, Inline Tag Creation from TaskForm (avoid Settings trip), apiFetch(), createLabel(), deleteLabel(), LabelCategory (+31 more)

### Community 15 - "get_firebase_claims"
Cohesion: 0.14
Nodes (8): get_firebase_claims(), Validate Bearer token and return decoded claims. Does NOT touch the DB. Used by…, _firebase_claims(), _make_db(), Unit tests for dependencies.py — Firebase auth path., TestAuthBypass, TestGetCurrentUser, TestGetFirebaseClaims

### Community 16 - "ArchivePage.tsx"
Cohesion: 0.12
Nodes (23): BoardCompletions, CompletionRecord, CompletionsReport, getCompletions(), GetCompletionsOptions, ArchiveBoardGroups(), CompletionCard(), formatDateTime() (+15 more)

### Community 17 - "ArchiveScreen.tsx"
Cohesion: 0.11
Nodes (22): getCompletions(), GetCompletionsOptions, ArchiveBoardGroups(), boardColor(), CompletionCard(), formatCompletedAt(), LABEL_CATEGORY_ORDER, PALETTE (+14 more)

### Community 18 - "mobile/src/utils/taskPriority.ts"
Cohesion: 0.46
Nodes (5): canAddHighPriority(), HIGH_PRIORITY_DAILY_LIMIT, isFormHighPriorityEligible(), isHighPriorityEligible(), splitByPriority()

### Community 19 - "get_completions"
Cohesion: 0.19
Nodes (13): _completions_query(), get_completions(), date, Session, _make_board(), _make_task(), Board, patch (+5 more)

### Community 20 - "Board"
Cohesion: 0.10
Nodes (24): Board, create_board(), delete_board(), ensure_board_seeded(), get_board_or_404(), get_default_board_id(), Board, Session (+16 more)

### Community 21 - "src/App.tsx"
Cohesion: 0.22
Nodes (13): App(), AppRoutes(), EmailConfirmationPage(), AuthContext, AuthContextValue, AuthProvider(), useAuthContext(), FilterContext (+5 more)

### Community 22 - "frontend/src/utils/taskDateUtils.ts"
Cohesion: 0.18
Nodes (17): FocusedTaskCard(), LABEL_COLORS, TaskCard(), TaskCardBody(), ColumnPriorityCollapseContext, ColumnPriorityCollapseContextValue, ColumnPriorityCollapseProvider(), useColumnPriorityCollapse() (+9 more)

### Community 23 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 24 - "index.ts"
Cohesion: 0.12
Nodes (19): updateTask(), TaskCardBodyProps, EDIT_CATEGORY_ORDER, LABEL_BG, LABEL_TEXT, TaskQuickEdit(), TaskQuickEditProps, labelA (+11 more)

### Community 25 - "schemas.py"
Cohesion: 0.11
Nodes (30): get_config(), get_focused_tasks(), date, get, put, Session, update_config(), _get_or_create_settings() (+22 more)

### Community 26 - "TaskFormScreen.tsx"
Cohesion: 0.14
Nodes (17): ApiError, createTask(), getTask(), CATEGORY_LABELS, CATEGORY_ORDER, DateField, newLinkId(), notesMarkdownIt (+9 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "mobile/src/context/BoardContext.tsx"
Cohesion: 0.18
Nodes (15): createBoard(), deleteBoard(), getBoards(), updateBoard(), ArchiveBoardTabs(), boardColor(), PALETTE, BoardTabs() (+7 more)

### Community 29 - "models.py"
Cohesion: 0.12
Nodes (27): Settings, get_db(), get_current_user(), Evaluated per-request so the flag can be toggled without a server restart., Resolve caller to an internal user_id UUID via Firebase Bearer token. Bypass:…, _test_auth_bypass(), _verify_firebase_token(), _git_hash() (+19 more)

### Community 30 - "mobile/src/api/focusedView.ts"
Cohesion: 0.19
Nodes (12): Collapse State Lifted into TasksScreen (mobile, no unmount), PLAN: feat-board-collapse-mobile — Collapsible boards (mobile), Predefined 8-Color Palette (no native color picker, mobile), Plan: feat-focused-view-mobile (PR 3 of 3), getDayViewTasks(), FocusedBoard, getFocusedViewTasks(), boardColor() (+4 more)

### Community 31 - "devDependencies"
Cohesion: 0.12
Nodes (17): autoprefixer, eslint, devDependencies, autoprefixer, eslint, globals, @types/react, typescript (+9 more)

### Community 32 - "AppNavigator.tsx"
Cohesion: 0.13
Nodes (16): Stale Board State Bug (anon→real uid swap, mobile), NOTE: Mobile Stale Board State Bug, Bug: anonymous-to-real Firebase identity transition (uid A to uid B, never passing through null) leaves BoardContext/FilterContext referencing the anonymous session's stale board, PLAN-fix-stale-board-state-on-identity-change.md (web, external), AuthContext, AuthContextValue, AuthProvider(), useAuthContext() (+8 more)

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
Cohesion: 0.28
Nodes (11): API_BASE_URL, API_V1_URL, apiFetch(), createLabel(), deleteLabel(), listLabels(), updateLabel(), getSettings() (+3 more)

### Community 37 - "get_day_view_tasks"
Cohesion: 0.33
Nodes (6): get_day_view_tasks(), date, get, Session, patch, TestGetDayViewTasksWiring

### Community 38 - "assert_eq"
Cohesion: 0.09
Nodes (44): assert_eq(), assert_eq_xfail(), assert_in(), assert_true(), Shared assert helpers for the integration suite (Phase 1 of PLAN-chore-…, Like assert_eq, but for a known application bug that the maintainer has…, build_ctx(), cleanup() (+36 more)

### Community 39 - "PLAN-chore-remove-mode-label-dead-code"
Cohesion: 0.13
Nodes (14): API/contract changes, Background, Data model changes, Deployment order, Files to modify, Grumpy's response — 2026-08-03, Issues, PLAN-chore-remove-mode-label-dead-code (+6 more)

### Community 40 - "mobile/package.json"
Cohesion: 0.18
Nodes (10): jest, preset, main, name, scripts, android, ios, start (+2 more)

### Community 41 - "PLAN: Modularize `test_api.py` and Reduce Sleepy's (test-review) Token Cost"
Cohesion: 0.09
Nodes (22): Confidence & Risk Assessment, Current State (verified by direct inspection, not assumed), Deployment Order, Files to Modify (pending resolution of the Open Question), In Scope, Issues, Notes for Reviewers, Open Question — must be resolved before implementation (+14 more)

### Community 43 - "devDependencies"
Cohesion: 0.22
Nodes (9): @babel/core, jest-expo, devDependencies, @babel/core, jest-expo, @types/react, typescript, @types/react (+1 more)

### Community 44 - "StateEnum"
Cohesion: 0.22
Nodes (4): StateEnum, TestHighPriorityDailyLimit, TestUpdateTaskLinks, str

### Community 46 - "boards.py"
Cohesion: 0.21
Nodes (14): create_board(), delete_board(), list_boards(), delete, get, post, put, Session (+6 more)

### Community 47 - "_is_hp_eligible_date"
Cohesion: 0.29
Nodes (3): _is_hp_eligible_date(), HP is valid for overdue, today, tomorrow, the day after tomorrow, and — on…, TestIsHpEligibleDate

### Community 49 - "focused_view_service.py"
Cohesion: 0.31
Nodes (12): FocusedViewConfig, date_window(), get_day_view_tasks(), get_focused_tasks(), get_or_create_config(), Board, date, Session (+4 more)

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

### Community 111 - "TaskOut"
Cohesion: 0.23
Nodes (14): complete_task(), delete_task(), get_task(), list_tasks(), date, delete, get, post (+6 more)

### Community 112 - "PLAN: Drop Frequency Labels — PR 3: DB Migration"
Cohesion: 0.29
Nodes (8): backend/scripts/migrate_drop_frequency_labels.sql, PLAN: Remove Mode Labels Completely, Plan: Remove Frequency Label Logic from Backend (PR 2 of 3), Recurring Task Logic Removal (complete_task always returns None), ensure_seeded() Sentinel Swap (frequency→mode), PLAN: Drop Frequency Labels — PR 3: DB Migration, SQL Migration: purge frequency data + drop enum value + drop recurrence_group_id, PLAN: Frontend & Mobile Type Cleanup (PR 4, follow-up)

### Community 113 - "TaskForm.tsx"
Cohesion: 0.17
Nodes (15): TaskLink, CATEGORY_DISPLAY_NAMES, CATEGORY_ORDER, LabelCategory, newLinkId(), TaskForm(), isBlankLink(), isValidLinkUrl() (+7 more)

### Community 114 - "frontend/src/api/client.ts"
Cohesion: 0.22
Nodes (5): app, auth, firebaseConfig, mockAuth, mockFetch

### Community 115 - "ViewContext.tsx"
Cohesion: 0.27
Nodes (7): useView(), ViewContext, ViewContextValue, ViewProvider(), VIEW_LABELS, viewLabel(), ViewMode

### Community 116 - "Layout.tsx"
Cohesion: 0.25
Nodes (3): Layout(), NAV_ITEMS, NavItem

## Ambiguous Edges - Review These
- `Day View` → `Overdue View proposal (archived plan; proposed separate /overdue-view/tasks endpoint)`  [AMBIGUOUS]
  archive/PLAN-feat-overdue-view-colors-actions.md · relation: conceptually_related_to

## Knowledge Gaps
- **317 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+312 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **54 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Day View` and `Overdue View proposal (archived plan; proposed separate /overdue-view/tasks endpoint)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Development Plan: feat-focused-view (backend, PR 1 of 3)` connect `schemas.py` to `TasksPage.tsx`, `Board`, `models.py`, `mobile/src/api/focusedView.ts`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `Plan: feat-focused-view-mobile (PR 3 of 3)` connect `mobile/src/api/focusedView.ts` to `schemas.py`, `TasksPage.tsx`, `TasksScreen.tsx`, `apiFetch`?**
  _High betweenness centrality (0.136) - this node is a cross-community bridge._
- **Why does `Custom Board Order (sort_order, order-driven default board)` connect `boards.py` to `frontend/src/context/BoardContext.tsx`, `useBoard`, `frontend/src/api/tasks.ts`, `focused_view_service.py`, `Board`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Are the 32 inferred relationships involving `Task` (e.g. with `TestCreateBoard` and `TestDeleteBoard`) actually correct?**
  _`Task` has 32 INFERRED edges - model-reasoned connections that need verification._
- **Are the 24 inferred relationships involving `StateEnum` (e.g. with `TestSyncPullLinks` and `TestSyncPullSortOrder`) actually correct?**
  _`StateEnum` has 24 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _317 weakly-connected nodes found - possible documentation gaps or missing edges._