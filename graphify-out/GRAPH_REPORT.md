# Graph Report - tasksAreUs  (2026-08-05)

## Corpus Check
- 238 files · ~265,705 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1603 nodes · 3756 edges · 116 communities (70 shown, 46 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 196 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `494c33ca`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ._make_db
- StateEnum
- tasks.py
- DATA_MODEL_AND_API.MD — data model & API definitions
- LabelUpdate
- PLAN: Remove Beliefs Feature and All LLM/Anthropic Integration
- PLAN-feat-tasks-view-redesign-mobile.md (external)
- src/App.tsx
- test_task_service.py
- TasksScreen.tsx
- Task
- _make_board
- frontend/src/components/BoardGroupedTasks.tsx
- expo
- TaskForm.tsx
- get_current_user
- ArchivePage.tsx
- ArchiveScreen.tsx
- Task
- labels.py
- test_board_service.py
- Layout.tsx
- TasksPage.tsx
- compilerOptions
- boards.py
- schemas.py
- index.ts
- compilerOptions
- mobile/src/context/BoardContext.tsx
- main.py
- mobile/src/api/focusedView.ts
- devDependencies
- apiFetch
- dependencies
- dependencies
- Plan: Fix Archive view usability (tabs, task details, reopen, tag order)
- AppNavigator.tsx
- get_day_view_tasks
- datetime
- PLAN-chore-remove-mode-label-dead-code
- mobile/package.json
- PLAN: Modularize `test_api.py` and Reduce Sleepy's (test-review) Token Cost
- PLAN-fix-board-tag-ux-polish
- devDependencies
- patch
- Task
- models.py
- _is_hp_eligible_date
- task_service.py
- PLAN: Board pin + single-board tag filter chips
- PLAN-fix-tag-filter-layout-and-link-wrap
- scripts
- purge_test_data.py
- mobile/tsconfig.json
- frontend/package.json
- metro.config.js
- focused_view.py
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
- frontend/src/api/tasks.ts
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
- get_completions
- frontend/src/api/client.ts
- settings.py
- @react-navigation/native
- _get_high_priority_limit

## God Nodes (most connected - your core abstractions)
1. `Task` - 60 edges
2. `update_task()` - 50 edges
3. `StateEnum` - 42 edges
4. `Board` - 38 edges
5. `sync()` - 33 edges
6. `DATA_MODEL_AND_API.MD — data model & API definitions` - 29 edges
7. `assert_eq()` - 27 edges
8. `apiFetch()` - 27 edges
9. `Label` - 25 edges
10. `TaskUpdate` - 25 edges

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

## Communities (116 total, 46 thin omitted)

### Community 0 - "._make_db"
Cohesion: 0.15
Nodes (5): update_task(), TestUpdateTaskDateClearing, TestUpdateTaskHighPriority, TestUpdateTaskLinks, TestUpdateTaskSortOrder

### Community 1 - "StateEnum"
Cohesion: 0.08
Nodes (27): FocusedViewConfig, StateEnum, date_window(), get_day_view_tasks(), get_focused_tasks(), get_or_create_config(), Board, date (+19 more)

### Community 2 - "tasks.py"
Cohesion: 0.07
Nodes (39): complete_task(), create_task(), delete_task(), get_task(), list_tasks(), date, delete, get (+31 more)

### Community 3 - "DATA_MODEL_AND_API.MD — data model & API definitions"
Cohesion: 0.08
Nodes (56): Bashful — requirements-review agent, keeps PRODUCT_REQUIREMENTS_DOCUMENT.MD current, Doc — arch-review agent, keeps ARCHITECTURE.MD and DATA_MODEL_AND_API.MD current, Dopey — code-review agent (correctness, architecture fit, security), Grumpy — main assistant (Claude), implements features and creates PRs, Sleepy — test-review agent, owns test_api.py, runs tests, posts QE verdict, Sneezy — plan-review agent, reviews development plan files, ARCHITECTURE.MD — code structure & implementation patterns, PLAN-feat-overdue-view-colors-actions.md (archived development plan) (+48 more)

### Community 4 - "LabelUpdate"
Cohesion: 0.27
Nodes (7): put, update_label(), LabelUpdate, _make_label(), Label, TestSeedBoardLabels, TestUpdateLabel

### Community 5 - "PLAN: Remove Beliefs Feature and All LLM/Anthropic Integration"
Cohesion: 0.07
Nodes (26): API Contract Changes, Backend (`backend/app/`), Confidence & Risk Assessment, Data Model Changes, Database Schema, Deployment Order, Files to Modify, In Scope (+18 more)

### Community 6 - "PLAN-feat-tasks-view-redesign-mobile.md (external)"
Cohesion: 0.05
Nodes (48): Rationale: seeding sentinel scoped per-board (ensure_board_seeded), not per-user, so new boards start empty while the original 'General tasks' board still seeds, boards table data model (multi-board feature), PLAN: feat-multi-board — Multiple Boards, Mobile BoardContext (mirrors web BoardContext, no FilterContext equivalent), PLAN: Multi-board Mobile Support (PR 3/3), Rationale: OTA (eas update) deployment for JS/TS-only mobile changes, no native/app.json/eas.json touched, Rationale: partial unique index UNIQUE(user_id) WHERE is_default=true, created via raw SQL in lifespan block since create_all() can't express partial indexes, _resolve_labels(label_ids, user_id, board_id, db) — cross-board label validation (+40 more)

### Community 7 - "src/App.tsx"
Cohesion: 0.09
Nodes (37): Custom Board Order (sort_order, order-driven default board), Plan: Custom board order + board-color styling + alphabetical tags, tasks.sort_order Fractional-Index Precedent (PR #61), Native input[type=color] Auto-Save Picker (routes through setColorBoard), Plan: feat-focused-view-web (PR 2 of 3), PLAN-feat-multi-board-backend (PR #33, external, merged), BoardContext + BoardSwitcher UI Design, PLAN: feat-multi-board-frontend (PR 2/3) (+29 more)

### Community 8 - "test_task_service.py"
Cohesion: 0.13
Nodes (12): _count_high_priority_for_date(), create_task(), _effective_date(), Any, date, Label, Session, _resolve_labels() (+4 more)

### Community 9 - "TasksScreen.tsx"
Cohesion: 0.13
Nodes (27): completeTask(), deleteTask(), DayView(), FocusedTaskCard(), FocusedView(), TODO: When task-fetching is extended to include done tasks, this pending, TaskCardBody(), BoardViewKey (+19 more)

### Community 10 - "Task"
Cohesion: 0.09
Nodes (41): Base, Board, Task, TaskLabel, UserSettings, _owned_board_id(), _parse_dt(), Any (+33 more)

### Community 11 - "_make_board"
Cohesion: 0.23
Nodes (6): delete_board(), update_board(), _make_board(), Board, TestDeleteBoard, TestUpdateBoard

### Community 12 - "frontend/src/components/BoardGroupedTasks.tsx"
Cohesion: 0.10
Nodes (28): Collapse State Lifted into TasksScreen (mobile, no unmount), PLAN: feat-board-collapse-mobile — Collapsible boards (mobile), BoardCollapseContext (modeled on FilterContext), PLAN: feat-board-collapse-web — Collapsible boards (web), getDayViewTasks(), FocusedBoard, getFocusedViewTasks(), BoardGroupedTasks() (+20 more)

### Community 13 - "expo"
Cohesion: 0.06
Nodes (30): backgroundColor, foregroundImage, adaptiveIcon, package, projectId, expo, android, extra (+22 more)

### Community 14 - "TaskForm.tsx"
Cohesion: 0.25
Nodes (10): TaskLink, CATEGORY_DISPLAY_NAMES, CATEGORY_ORDER, LabelCategory, newLinkId(), TaskForm(), isBlankLink(), isValidLinkUrl() (+2 more)

### Community 15 - "get_current_user"
Cohesion: 0.13
Nodes (14): get_current_user(), get_firebase_claims(), Session, Evaluated per-request so the flag can be toggled without a server restart., Validate Bearer token and return decoded claims. Does NOT touch the DB. Used by…, Resolve caller to an internal user_id UUID via Firebase Bearer token. Bypass:…, _test_auth_bypass(), _verify_firebase_token() (+6 more)

### Community 16 - "ArchivePage.tsx"
Cohesion: 0.11
Nodes (26): all_boards Additive Query Param Design, Board-Grouped Collapsible Rendering (mirrors Today view), PLAN: Rename Reports → Archive, add date-range presets and board filtering, Board Color Everywhere (TaskCard/BoardTabs accents), BoardCompletions, CompletionRecord, CompletionsReport, getCompletions() (+18 more)

### Community 17 - "ArchiveScreen.tsx"
Cohesion: 0.10
Nodes (25): getCompletions(), GetCompletionsOptions, ArchiveBoardGroups(), boardColor(), CompletionCard(), formatCompletedAt(), LABEL_CATEGORY_ORDER, PALETTE (+17 more)

### Community 18 - "Task"
Cohesion: 0.14
Nodes (13): TaskCardBodyProps, TaskQuickEditProps, labelA, labelB, REF_DATE, Label, Task, filterTasks() (+5 more)

### Community 19 - "labels.py"
Cohesion: 0.18
Nodes (13): CategoryEnum, create_label(), delete_label(), list_labels(), delete, get, post, Session (+5 more)

### Community 20 - "test_board_service.py"
Cohesion: 0.12
Nodes (16): create_board(), ensure_board_seeded(), get_board_or_404(), get_default_board_id(), Board, Session, Ensure is_default matches whichever board is topmost in sort_order. Must re-…, Return board_id after validating ownership, or the default board if board_id is… (+8 more)

### Community 21 - "Layout.tsx"
Cohesion: 0.25
Nodes (3): Layout(), NAV_ITEMS, NavItem

### Community 22 - "TasksPage.tsx"
Cohesion: 0.14
Nodes (25): Development Plan: Enhance All View with Priority Collapse & Date Display, Monday Column (Friday-only) + Priority Split/Collapse, ColumnPriorityCollapseContext, ColumnPriorityCollapseContextValue, useColumnPriorityCollapse(), useView(), ViewContext, ViewContextValue (+17 more)

### Community 23 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 24 - "boards.py"
Cohesion: 0.26
Nodes (12): create_board(), delete_board(), list_boards(), delete, get, post, put, Session (+4 more)

### Community 25 - "schemas.py"
Cohesion: 0.29
Nodes (12): BoardCompletions, CompletionItem, CompletionsReport, FocusedViewBoardGroup, FocusedViewTasksOut, LabelOut, SyncResponse, TaskLabelSync (+4 more)

### Community 26 - "index.ts"
Cohesion: 0.14
Nodes (20): createTask(), getTask(), CATEGORY_LABELS, CATEGORY_ORDER, DateField, newLinkId(), notesMarkdownIt, notesMarkdownRules (+12 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "mobile/src/context/BoardContext.tsx"
Cohesion: 0.32
Nodes (9): createBoard(), deleteBoard(), getBoards(), updateBoard(), BoardContext, BoardContextValue, BoardProvider(), mockApiFetch (+1 more)

### Community 29 - "main.py"
Cohesion: 0.21
Nodes (14): Settings, get_db(), _git_hash(), health(), _init_firebase(), lifespan(), _migrate_boards(), get (+6 more)

### Community 30 - "mobile/src/api/focusedView.ts"
Cohesion: 0.23
Nodes (9): Predefined 8-Color Palette (no native color picker, mobile), Plan: feat-focused-view-mobile (PR 3 of 3), FocusedBoard, getFocusedViewTasks(), boardColor(), BoardGroupedTasks(), PALETTE, mockApiFetch (+1 more)

### Community 31 - "devDependencies"
Cohesion: 0.12
Nodes (17): autoprefixer, eslint, devDependencies, autoprefixer, eslint, globals, @types/react, typescript (+9 more)

### Community 32 - "apiFetch"
Cohesion: 0.12
Nodes (24): API_BASE_URL, apiFetch(), getDayViewTasks(), createLabel(), deleteLabel(), listLabels(), updateLabel(), getSettings() (+16 more)

### Community 33 - "dependencies"
Cohesion: 0.13
Nodes (15): @believer/react-native-markdown-display, expo, expo-auth-session, expo-crypto, dependencies, @believer/react-native-markdown-display, expo, expo-auth-session (+7 more)

### Community 34 - "dependencies"
Cohesion: 0.13
Nodes (15): @firebase/app, @firebase/auth, dependencies, @firebase/app, @firebase/auth, react, react-dom, react-markdown (+7 more)

### Community 35 - "Plan: Fix Archive view usability (tabs, task details, reopen, tag order)"
Cohesion: 0.12
Nodes (15): API / contract changes, Data model changes, Deployment order, Files to modify, Fix, Issues, Mobile update type, Plan: Fix Archive view usability (tabs, task details, reopen, tag order) (+7 more)

### Community 36 - "AppNavigator.tsx"
Cohesion: 0.12
Nodes (16): Stale Board State Bug (anon→real uid swap, mobile), NOTE: Mobile Stale Board State Bug, API_V1_URL, ApiError, AuthContext, AuthContextValue, AuthProvider(), useAuthContext() (+8 more)

### Community 37 - "get_day_view_tasks"
Cohesion: 0.27
Nodes (7): get_day_view_tasks(), date, get, Session, patch, Unit tests for the day-view router — no database required. Guards against a…, TestGetDayViewTasksWiring

### Community 38 - "datetime"
Cohesion: 0.08
Nodes (50): bulk_insert(), count_task_labels(), fetch_all_as_dicts(), main(), Fresh sync of all user data from local Postgres → Railway Postgres. Does NOT…, assert_eq(), assert_eq_xfail(), assert_in() (+42 more)

### Community 39 - "PLAN-chore-remove-mode-label-dead-code"
Cohesion: 0.13
Nodes (14): API/contract changes, Background, Data model changes, Deployment order, Files to modify, Grumpy's response — 2026-08-03, Issues, PLAN-chore-remove-mode-label-dead-code (+6 more)

### Community 40 - "mobile/package.json"
Cohesion: 0.18
Nodes (10): jest, preset, main, name, scripts, android, ios, start (+2 more)

### Community 41 - "PLAN: Modularize `test_api.py` and Reduce Sleepy's (test-review) Token Cost"
Cohesion: 0.09
Nodes (22): Confidence & Risk Assessment, Current State (verified by direct inspection, not assumed), Deployment Order, Files to Modify (pending resolution of the Open Question), In Scope, Issues, Notes for Reviewers, Open Question — must be resolved before implementation (+14 more)

### Community 42 - "PLAN-fix-board-tag-ux-polish"
Cohesion: 0.08
Nodes (23): 1. Centered "New Task" button on an empty board, 2. Tag filter link on the same row as the tag chips, 3. Browser tab title, 4. Alphabetical tag order on task cards, all views, 5. AND/OR toggle for tag filtering, 6. Longer link-description text on task cards, API / contract changes, Background / current behavior (+15 more)

### Community 43 - "devDependencies"
Cohesion: 0.22
Nodes (9): @babel/core, jest-expo, devDependencies, @babel/core, jest-expo, @types/react, typescript, @types/react (+1 more)

### Community 44 - "patch"
Cohesion: 0.17
Nodes (3): patch, TestHighPriorityDailyLimit, TestUpdateTaskBoardId

### Community 45 - "Task"
Cohesion: 0.14
Nodes (20): Narrow Label.category Union / Remove Dead recurrence_group_id Type, Label, Task, FocusedTaskCard(), LABEL_COLORS, CATEGORY_COLORS, LabelBadge(), LabelBadgeProps (+12 more)

### Community 46 - "models.py"
Cohesion: 0.13
Nodes (17): Label, Board CRUD, seeding, and board-cap enforcement., Session, Label seeding helper — called by board_service during board initialisation., Seed all LABEL_SEED entries into a specific board. Idempotent., seed_board_labels(), backend/scripts/migrate_drop_frequency_labels.sql, PLAN: Remove Mode Labels Completely (+9 more)

### Community 47 - "_is_hp_eligible_date"
Cohesion: 0.29
Nodes (3): _is_hp_eligible_date(), HP is valid for overdue, today, tomorrow, the day after tomorrow, and — on…, TestIsHpEligibleDate

### Community 48 - "task_service.py"
Cohesion: 0.13
Nodes (7): _sort_order_default(), complete_task(), Task, reopen_task(), TestCompleteTask, TestReopenTask, TestSortOrderDefault

### Community 49 - "PLAN: Board pin + single-board tag filter chips"
Cohesion: 0.11
Nodes (18): 1. Pin (`BoardCollapseContext.tsx`), 2. Single-board tag chips (`BoardGroupedTasks.tsx`), 3. Pin button UI (`BoardGroupedTasks.tsx`), Data model changes, Deployment order, Design, Files touched, Grumpy's response to Sneezy's review — 2026-08-04 (+10 more)

### Community 50 - "PLAN-fix-tag-filter-layout-and-link-wrap"
Cohesion: 0.10
Nodes (19): 1. Tag filter row: wrong side, wrong order, 2. Link description on task cards wraps too soon, despite available space, API / contract changes, Background / current behavior, Branch, Data model changes, Deployment, Files to modify (+11 more)

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

### Community 56 - "focused_view.py"
Cohesion: 0.26
Nodes (11): get_config(), get_focused_tasks(), date, get, put, Session, update_config(), FocusedViewConfigOut (+3 more)

### Community 87 - "frontend/src/api/tasks.ts"
Cohesion: 0.13
Nodes (25): PLAN-feat-inline-tag-add, Inline Tag Creation from TaskForm (avoid Settings trip), apiFetch(), createLabel(), deleteLabel(), LabelCategory, listLabels(), updateLabel() (+17 more)

### Community 111 - "get_completions"
Cohesion: 0.50
Nodes (4): get_completions(), date, get, Session

### Community 112 - "frontend/src/api/client.ts"
Cohesion: 0.22
Nodes (5): app, auth, firebaseConfig, mockAuth, mockFetch

### Community 113 - "settings.py"
Cohesion: 0.42
Nodes (8): _get_or_create_settings(), get_settings(), get, put, Session, update_settings(), SettingsOut, SettingsUpdate

## Ambiguous Edges - Review These
- `Day View` → `Overdue View proposal (archived plan; proposed separate /overdue-view/tasks endpoint)`  [AMBIGUOUS]
  archive/PLAN-feat-overdue-view-colors-actions.md · relation: conceptually_related_to

## Knowledge Gaps
- **367 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+362 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **46 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Day View` and `Overdue View proposal (archived plan; proposed separate /overdue-view/tasks endpoint)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Development Plan: feat-focused-view (backend, PR 1 of 3)` connect `focused_view.py` to `schemas.py`, `src/App.tsx`, `models.py`, `mobile/src/api/focusedView.ts`?**
  _High betweenness centrality (0.143) - this node is a cross-community bridge._
- **Why does `Plan: feat-focused-view-mobile (PR 3 of 3)` connect `mobile/src/api/focusedView.ts` to `focused_view.py`, `TasksScreen.tsx`, `apiFetch`, `src/App.tsx`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Why does `Custom Board Order (sort_order, order-driven default board)` connect `src/App.tsx` to `boards.py`, `StateEnum`, `models.py`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Are the 39 inferred relationships involving `Task` (e.g. with `TestCreateBoard` and `TestDeleteBoard`) actually correct?**
  _`Task` has 39 INFERRED edges - model-reasoned connections that need verification._
- **Are the 31 inferred relationships involving `StateEnum` (e.g. with `TestDateWindow` and `TestGetDayViewTasks`) actually correct?**
  _`StateEnum` has 31 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `Board` (e.g. with `TestCreateBoard` and `TestDeleteBoard`) actually correct?**
  _`Board` has 20 INFERRED edges - model-reasoned connections that need verification._