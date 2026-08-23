# Graph Report - tasksAreUs  (2026-08-22)

## Corpus Check
- 255 files · ~328,392 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1914 nodes · 4289 edges · 133 communities (85 shown, 48 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 217 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e5b1715a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ._make_db
- _make_board
- get_current_user
- DATA_MODEL_AND_API.MD — data model & API definitions
- _effective_date
- PLAN: Remove Beliefs Feature and All LLM/Anthropic Integration
- PLAN-feat-tasks-view-redesign-mobile.md (external)
- frontend/src/api/tasks.ts
- board_service.py
- labels.py
- sync
- TaskUpdate
- reports_service.py
- expo
- PR 3 — Mobile
- PLAN-feat-priority-stepper-and-card-parity
- ArchivePage.tsx
- ArchiveScreen.tsx
- src/App.tsx
- PLAN-feat-tag-filter-single-mode
- TasksPage.tsx
- TasksScreen.tsx
- AppNavigator.tsx
- compilerOptions
- PLAN: feat-archive-bulk-uncomplete — Bulk un-complete/delete on the Archive page, plus an "All" date filter and checkmark removal
- PLAN-fix-collapsed-priority-drop-target
- TaskFormScreen.tsx
- compilerOptions
- apiFetch
- Task
- mobile/src/api/focusedView.ts
- devDependencies
- TaskForm.tsx
- dependencies
- dependencies
- Plan: Fix Archive view usability (tabs, task details, reopen, tag order)
- mobile/src/utils/taskPriority.ts
- PLAN: feat-clickable-card-date — Make the due-date text on task cards an inline edit link
- datetime
- PLAN-chore-remove-mode-label-dead-code
- mobile/package.json
- PLAN: Modularize `test_api.py` and Reduce Sleepy's (test-review) Token Cost
- PLAN-fix-board-tag-ux-polish
- devDependencies
- PLAN-fix-task-form-ux-polish
- PLAN: Drop Frequency Labels — PR 3: DB Migration
- SettingsScreen.tsx
- schemas.py
- PLAN: feat-hide-unhide-columns — Per-column hide/unhide toggle on the "All" kanban board, plus neutral Overdue column background
- PLAN: Board pin + single-board tag filter chips
- PLAN-fix-tag-filter-layout-and-link-wrap
- scripts
- purge_test_data.py
- mobile/tsconfig.json
- frontend/package.json
- metro.config.js
- StateEnum
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
- PLAN-chore-split-arch-review-agent
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
- PLAN-fix-overdue-shading-and-tag-filter-scrollbar
- c
- PLAN-feat-taskcard-priority-shading-layout
- frontend/src/utils/taskPriority.ts
- SettingsPage.tsx
- _link
- frontend/src/utils/taskDateUtils.ts
- dependencies.py
- useBoard
- ViewContext.tsx
- _make_board
- TaskLink
- _make_config
- tasks.py
- index.ts
- get_day_view_tasks
- test_labels_router.py
- _owned_board_id
- Layout.tsx
- TestDateWindow
- TestGetDayViewTasksDateFilterClause
- @react-navigation/native

## God Nodes (most connected - your core abstractions)
1. `Task` - 65 edges
2. `update_task()` - 63 edges
3. `StateEnum` - 47 edges
4. `sync()` - 45 edges
5. `Board` - 39 edges
6. `TaskUpdate` - 29 edges
7. `_sync_request()` - 29 edges
8. `DATA_MODEL_AND_API.MD — data model & API definitions` - 29 edges
9. `_make_db()` - 28 edges
10. `assert_eq()` - 27 edges

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

## Communities (133 total, 48 thin omitted)

### Community 0 - "._make_db"
Cohesion: 0.06
Nodes (14): _is_hp_eligible_date(), HP is valid for overdue, today, tomorrow, the day after tomorrow, and — on…, update_task(), patch, TestCreateTaskPriorityTiers, TestHighPriorityDailyLimit, TestIsHpEligibleDate, TestReopenTask (+6 more)

### Community 1 - "_make_board"
Cohesion: 0.13
Nodes (15): get_day_view_tasks(), get_focused_tasks(), Board, date, Session, _query_board_grouped_tasks(), Query pending tasks matching `date_filter`, grouped by the given (already-…, _make_board() (+7 more)

### Community 2 - "get_current_user"
Cohesion: 0.13
Nodes (14): get_current_user(), get_firebase_claims(), Session, Evaluated per-request so the flag can be toggled without a server restart., Validate Bearer token and return decoded claims. Does NOT touch the DB. Used by…, Resolve caller to an internal user_id UUID via Firebase Bearer token. Bypass:…, _test_auth_bypass(), _verify_firebase_token() (+6 more)

### Community 3 - "DATA_MODEL_AND_API.MD — data model & API definitions"
Cohesion: 0.08
Nodes (56): Bashful — requirements-review agent, keeps PRODUCT_REQUIREMENTS_DOCUMENT.MD current, Doc — arch-review agent, keeps ARCHITECTURE.MD and DATA_MODEL_AND_API.MD current, Dopey — code-review agent (correctness, architecture fit, security), Grumpy — main assistant (Claude), implements features and creates PRs, Sleepy — test-review agent, owns test_api.py, runs tests, posts QE verdict, Sneezy — plan-review agent, reviews development plan files, ARCHITECTURE.MD — code structure & implementation patterns, PLAN-feat-overdue-view-colors-actions.md (archived development plan) (+48 more)

### Community 4 - "_effective_date"
Cohesion: 0.22
Nodes (5): _count_high_priority_for_date(), _effective_date(), date, TestCountHighPriorityForDate, TestEffectiveDate

### Community 5 - "PLAN: Remove Beliefs Feature and All LLM/Anthropic Integration"
Cohesion: 0.07
Nodes (26): API Contract Changes, Backend (`backend/app/`), Confidence & Risk Assessment, Data Model Changes, Database Schema, Deployment Order, Files to Modify, In Scope (+18 more)

### Community 6 - "PLAN-feat-tasks-view-redesign-mobile.md (external)"
Cohesion: 0.05
Nodes (48): Rationale: seeding sentinel scoped per-board (ensure_board_seeded), not per-user, so new boards start empty while the original 'General tasks' board still seeds, boards table data model (multi-board feature), PLAN: feat-multi-board — Multiple Boards, Mobile BoardContext (mirrors web BoardContext, no FilterContext equivalent), PLAN: Multi-board Mobile Support (PR 3/3), Rationale: OTA (eas update) deployment for JS/TS-only mobile changes, no native/app.json/eas.json touched, Rationale: partial unique index UNIQUE(user_id) WHERE is_default=true, created via raw SQL in lifespan block since create_all() can't express partial indexes, _resolve_labels(label_ids, user_id, board_id, db) — cross-board label validation (+40 more)

### Community 7 - "frontend/src/api/tasks.ts"
Cohesion: 0.17
Nodes (16): PLAN-feat-inline-tag-add, Inline Tag Creation from TaskForm (avoid Settings trip), CompleteTaskBody, CompleteTaskResponse, createTask(), CreateTaskBody, getTask(), listTasks() (+8 more)

### Community 8 - "board_service.py"
Cohesion: 0.11
Nodes (22): Label, create_board(), ensure_board_seeded(), get_board_or_404(), get_default_board_id(), Board, Session, Board CRUD, seeding, and board-cap enforcement. (+14 more)

### Community 9 - "labels.py"
Cohesion: 0.15
Nodes (16): CategoryEnum, delete_label(), list_labels(), delete, get, put, Session, update_label() (+8 more)

### Community 10 - "sync"
Cohesion: 0.18
Nodes (9): post, sync(), _make_db(), _make_task(), Task, A db mock that no-ops for every model except Task, which is configurable.…, Field-resolution rule for the tri-state `priority` field, exercised via the…, _sync_request() (+1 more)

### Community 11 - "TaskUpdate"
Cohesion: 0.21
Nodes (17): create_task(), put, update_task(), TaskCreate, TaskUpdate, _link(), _make_task(), patch (+9 more)

### Community 12 - "reports_service.py"
Cohesion: 0.14
Nodes (18): CompletionItem, _completions_query(), get_completions(), date, Session, Task, Completions report query logic for the Archive view., _to_completion_item() (+10 more)

### Community 13 - "expo"
Cohesion: 0.06
Nodes (30): backgroundColor, foregroundImage, adaptiveIcon, package, projectId, expo, android, extra (+22 more)

### Community 14 - "PR 3 — Mobile"
Cohesion: 0.07
Nodes (27): API Changes, Backend Unit Tests (`backend/tests/unit/`), Data Model Changes, Decisions Locked In (answered by user before this plan was written), Development Plan: feat-priority-tiers, Files to Modify (PR1), Files to Modify (PR2), Files to Modify (PR3) (+19 more)

### Community 15 - "PLAN-feat-priority-stepper-and-card-parity"
Cohesion: 0.10
Nodes (20): 1. Priority badge — always shown, same everywhere, 2. Priority stepper — replaces the star everywhere, 3. Action-button position — unify on top, Background, Branch, Current behavior (all three items root-caused by code trace), Data model changes, Deployment order (+12 more)

### Community 16 - "ArchivePage.tsx"
Cohesion: 0.12
Nodes (22): BoardCompletions, CompletionRecord, CompletionsReport, getCompletions(), GetCompletionsOptions, deleteTask(), Label, reopenTask() (+14 more)

### Community 17 - "ArchiveScreen.tsx"
Cohesion: 0.11
Nodes (22): getCompletions(), GetCompletionsOptions, ArchiveBoardGroups(), boardColor(), CompletionCard(), formatCompletedAt(), LABEL_CATEGORY_ORDER, PALETTE (+14 more)

### Community 18 - "src/App.tsx"
Cohesion: 0.14
Nodes (19): App(), AppRoutes(), EmailConfirmationPage(), AuthContext, AuthContextValue, AuthProvider(), useAuthContext(), BoardCollapseProvider() (+11 more)

### Community 19 - "PLAN-feat-tag-filter-single-mode"
Cohesion: 0.07
Nodes (28): 1. Shared `FilterMode` type + shared toggle helper (`frontend/src/utils/taskFilters.ts`), 2. `frontend/src/context/FilterContext.tsx` — replaces the flat Set with a per-board map (new), 3. `frontend/src/context/BoardContext.tsx` — remove the now-obsolete `clearLabels()` call, 4. `frontend/src/components/BoardGroupedTasks.tsx` — consume the shared per-board map, locally reconcile the Single-mode invariant, 5. `frontend/src/pages/TasksPage.tsx` — now requires code changes (first draft assumed none; incorrect once the flat Set is replaced), 6. `frontend/src/pages/TaskDetailPage.tsx` — small update for the same reason, 7. `frontend/src/components/LabelFilterChips.tsx`, A. Three filter modes (Single / And / Or) (+20 more)

### Community 20 - "TasksPage.tsx"
Cohesion: 0.08
Nodes (40): Collapse State Lifted into TasksScreen (mobile, no unmount), PLAN: feat-board-collapse-mobile — Collapsible boards (mobile), BoardCollapseContext (modeled on FilterContext), PLAN: feat-board-collapse-web — Collapsible boards (web), Development Plan: Enhance All View with Priority Collapse & Date Display, Monday Column (Friday-only) + Priority Split/Collapse, getDayViewTasks(), FocusedBoard (+32 more)

### Community 21 - "TasksScreen.tsx"
Cohesion: 0.12
Nodes (29): completeTask(), deleteTask(), DayView(), FocusedTaskCard(), FocusedView(), TODO: When task-fetching is extended to include done tasks, this pending, TaskCardBody(), TaskCardBodyProps (+21 more)

### Community 22 - "AppNavigator.tsx"
Cohesion: 0.20
Nodes (10): Stale Board State Bug (anon→real uid swap, mobile), NOTE: Mobile Stale Board State Bug, AuthContext, AuthContextValue, AuthProvider(), useAuthContext(), AppNavigator(), RootTabParamList (+2 more)

### Community 23 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 24 - "PLAN: feat-archive-bulk-uncomplete — Bulk un-complete/delete on the Archive page, plus an "All" date filter and checkmark removal"
Cohesion: 0.10
Nodes (19): 1. "All" date preset (`dateRangePresets.ts`, `ArchivePage.tsx`), 2. Remove the checkmark (`ArchivePage.tsx`, `ArchiveBoardGroups.tsx`), 3. Selection state, bulk actions, and per-card buttons, Current state (confirmed by reading code), Data model / API changes, Deployment order, Design, Error handling (+11 more)

### Community 25 - "PLAN-fix-collapsed-priority-drop-target"
Cohesion: 0.11
Nodes (18): Background, Branch, Current behavior — All view kanban, priority tier zones, Data model changes, Deployment order, Files to modify, Fix, Grumpy's response to Sneezy's review — 2026-08-09 (+10 more)

### Community 26 - "TaskFormScreen.tsx"
Cohesion: 0.14
Nodes (18): ApiError, createTask(), getTask(), CATEGORY_LABELS, CATEGORY_ORDER, DateField, newLinkId(), notesMarkdownIt (+10 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "apiFetch"
Cohesion: 0.18
Nodes (16): createBoard(), deleteBoard(), getBoards(), updateBoard(), apiFetch(), ArchiveBoardTabs(), boardColor(), PALETTE (+8 more)

### Community 29 - "Task"
Cohesion: 0.19
Nodes (26): _git_hash(), health(), _init_firebase(), lifespan(), _migrate_boards(), get, Session, Create 'General tasks' board for all existing users who have none. Runs after… (+18 more)

### Community 30 - "mobile/src/api/focusedView.ts"
Cohesion: 0.23
Nodes (10): Predefined 8-Color Palette (no native color picker, mobile), Plan: feat-focused-view-mobile (PR 3 of 3), getDayViewTasks(), FocusedBoard, getFocusedViewTasks(), boardColor(), BoardGroupedTasks(), PALETTE (+2 more)

### Community 31 - "devDependencies"
Cohesion: 0.12
Nodes (17): autoprefixer, eslint, devDependencies, autoprefixer, eslint, globals, @types/react, typescript (+9 more)

### Community 32 - "TaskForm.tsx"
Cohesion: 0.19
Nodes (13): TaskLink, CATEGORY_DISPLAY_NAMES, CATEGORY_ORDER, LabelCategory, newLinkId(), TaskForm(), computeSyncedScrollTop(), ScrollMetrics (+5 more)

### Community 33 - "dependencies"
Cohesion: 0.13
Nodes (15): @believer/react-native-markdown-display, expo, expo-auth-session, expo-crypto, dependencies, @believer/react-native-markdown-display, expo, expo-auth-session (+7 more)

### Community 34 - "dependencies"
Cohesion: 0.13
Nodes (15): @firebase/app, @firebase/auth, dependencies, @firebase/app, @firebase/auth, react, react-dom, react-markdown (+7 more)

### Community 35 - "Plan: Fix Archive view usability (tabs, task details, reopen, tag order)"
Cohesion: 0.12
Nodes (15): API / contract changes, Data model changes, Deployment order, Files to modify, Fix, Issues, Mobile update type, Plan: Fix Archive view usability (tabs, task details, reopen, tag order) (+7 more)

### Community 36 - "mobile/src/utils/taskPriority.ts"
Cohesion: 0.44
Nodes (6): canAddHighPriority(), HIGH_PRIORITY_DAILY_LIMIT, isFormPriorityEligible(), isPriorityEligible(), PRIORITY_CYCLE, resolveNextPriorityTier()

### Community 37 - "PLAN: feat-clickable-card-date — Make the due-date text on task cards an inline edit link"
Cohesion: 0.10
Nodes (19): Current state (confirmed by reading code), Data model / API changes, Deployment order, Design, Files to modify, Interaction, Issues, Overview (+11 more)

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

### Community 44 - "PLAN-fix-task-form-ux-polish"
Cohesion: 0.09
Nodes (22): 1. Copy-to-clipboard button next to the Notes read-only preview box, 2. New Task — cursor autofocuses Title on open, 3. Edit Task — cursor autofocuses Notes on open, 4. Cmd+S (Mac) / Ctrl+S (Windows) triggers Save, API / contract changes, Background / current behavior, Branch, Data model changes (+14 more)

### Community 45 - "PLAN: Drop Frequency Labels — PR 3: DB Migration"
Cohesion: 0.20
Nodes (11): backend/scripts/migrate_drop_frequency_labels.sql, PLAN: Remove Mode Labels Completely, Mode Label Removal, UI Naming Change: Type → Tags, Plan: Remove Frequency Label Logic from Backend (PR 2 of 3), Recurring Task Logic Removal (complete_task always returns None), ensure_seeded() Sentinel Swap (frequency→mode), PLAN: Drop Frequency Labels — PR 3: DB Migration (+3 more)

### Community 46 - "SettingsScreen.tsx"
Cohesion: 0.12
Nodes (20): API_BASE_URL, API_V1_URL, createLabel(), deleteLabel(), listLabels(), updateLabel(), updateTask(), EDIT_CATEGORY_ORDER (+12 more)

### Community 47 - "schemas.py"
Cohesion: 0.12
Nodes (30): create_board(), delete_board(), list_boards(), delete, get, post, put, Session (+22 more)

### Community 48 - "PLAN: feat-hide-unhide-columns — Per-column hide/unhide toggle on the "All" kanban board, plus neutral Overdue column background"
Cohesion: 0.10
Nodes (19): 1. Hidden-column state, 2. Per-column "hide" button, 3. Skip rendering hidden columns, 4. "Hidden columns" indicator row, 5. Overdue column neutral background, Current state (confirmed by reading code), Data model / API changes, Deployment order (+11 more)

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

### Community 56 - "StateEnum"
Cohesion: 0.08
Nodes (23): _sort_order_default(), StateEnum, Focused view config management and task filtering., complete_task(), create_task(), _get_high_priority_limit(), Any, Label (+15 more)

### Community 87 - "PLAN-chore-split-arch-review-agent"
Cohesion: 0.22
Nodes (8): Current state, Deployment order, Files to modify (when implemented), Known tradeoffs / open questions, PLAN-chore-split-arch-review-agent, Proposed change, Scope, Test plan

### Community 111 - "PLAN-fix-overdue-shading-and-tag-filter-scrollbar"
Cohesion: 0.11
Nodes (18): API / contract changes, Background / current behavior, Branch, Data model changes, Deployment, Files to modify, Grumpy's response — 2026-08-14, Issues (+10 more)

### Community 113 - "PLAN-feat-taskcard-priority-shading-layout"
Cohesion: 0.12
Nodes (15): API/contract changes, Background, Data model changes, Deployment order, Files to modify, Grumpy's response to Sneezy's review — 2026-08-11, Issues, PLAN-feat-taskcard-priority-shading-layout (+7 more)

### Community 114 - "frontend/src/utils/taskPriority.ts"
Cohesion: 0.16
Nodes (20): PriorityTier, TaskCardProps, CollapseKey, ColumnPriorityCollapseContext, ColumnPriorityCollapseContextValue, ColumnPriorityCollapseProvider(), useColumnPriorityCollapse(), makeTask() (+12 more)

### Community 115 - "SettingsPage.tsx"
Cohesion: 0.11
Nodes (25): Native input[type=color] Auto-Save Picker (routes through setColorBoard), Plan: feat-focused-view-web (PR 2 of 3), Board, createBoard(), deleteBoard(), getBoards(), updateBoard(), apiFetch() (+17 more)

### Community 116 - "_link"
Cohesion: 0.15
Nodes (4): _link(), Unit tests for schemas.py — TaskLink validation. No database required., TestTaskLinksCap, TestTaskLinkValidation

### Community 117 - "frontend/src/utils/taskDateUtils.ts"
Cohesion: 0.12
Nodes (29): Narrow Label.category Union / Remove Dead recurrence_group_id Type, completeTask(), DateFieldName, FocusedTaskCard(), LABEL_COLORS, DateFieldName, LABEL_CATEGORY_ORDER, TaskCard() (+21 more)

### Community 118 - "dependencies.py"
Cohesion: 0.17
Nodes (15): Settings, get_db(), get_completions(), date, get, Session, _get_or_create_settings(), get_settings() (+7 more)

### Community 119 - "useBoard"
Cohesion: 0.19
Nodes (13): Board-Grouped Collapsible Rendering (mirrors Today view), PLAN: Rename Reports → Archive, add date-range presets and board filtering, Board Color Everywhere (TaskCard/BoardTabs accents), Plan: Custom board order + board-color styling + alphabetical tags, PLAN-feat-multi-board-backend (PR #33, external, merged), BoardContext + BoardSwitcher UI Design, PLAN: feat-multi-board-frontend (PR 2/3), ArchiveBoardTabs() (+5 more)

### Community 120 - "ViewContext.tsx"
Cohesion: 0.27
Nodes (7): useView(), ViewContext, ViewContextValue, ViewProvider(), VIEW_LABELS, viewLabel(), ViewMode

### Community 121 - "_make_board"
Cohesion: 0.23
Nodes (6): delete_board(), update_board(), _make_board(), Board, TestDeleteBoard, TestUpdateBoard

### Community 122 - "TaskLink"
Cohesion: 0.19
Nodes (6): Any, Validate a raw list of link dicts against TaskLink rules. Shared between…, TaskLink, validate_task_links(), TestValidateTaskLinks, field_validator

### Community 123 - "_make_config"
Cohesion: 0.29
Nodes (6): FocusedViewConfig, get_or_create_config(), update_config(), _make_config(), TestGetOrCreateConfig, TestUpdateConfig

### Community 124 - "tasks.py"
Cohesion: 0.28
Nodes (14): complete_task(), delete_task(), get_task(), list_tasks(), date, delete, get, post (+6 more)

### Community 125 - "index.ts"
Cohesion: 0.13
Nodes (15): getSettings(), updateSettings(), listTasks(), TasksScreen(), labelA, labelB, REF_DATE, CompleteTaskBody (+7 more)

### Community 126 - "get_day_view_tasks"
Cohesion: 0.27
Nodes (7): get_day_view_tasks(), date, get, Session, patch, Unit tests for the day-view router — no database required. Guards against a…, TestGetDayViewTasksWiring

### Community 127 - "test_labels_router.py"
Cohesion: 0.38
Nodes (5): create_label(), post, LabelCreate, Unit tests for labels router — no database required., TestCreateLabel

### Community 128 - "_owned_board_id"
Cohesion: 0.22
Nodes (9): _owned_board_id(), _parse_dt(), Any, Session, Validate a sync client's raw links payload, keeping whatever is valid. Sync…, Validate a sync client's raw `priority` value, treating anything invalid (or…, Return board_id if it's a real, non-deleted board owned by user_id, else None.…, _validate_sync_links() (+1 more)

### Community 129 - "Layout.tsx"
Cohesion: 0.25
Nodes (3): Layout(), NAV_ITEMS, NavItem

## Ambiguous Edges - Review These
- `Day View` → `Overdue View proposal (archived plan; proposed separate /overdue-view/tasks endpoint)`  [AMBIGUOUS]
  archive/PLAN-feat-overdue-view-colors-actions.md · relation: conceptually_related_to

## Knowledge Gaps
- **557 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+552 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **48 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Day View` and `Overdue View proposal (archived plan; proposed separate /overdue-view/tasks endpoint)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Development Plan: feat-focused-view (backend, PR 1 of 3)` connect `schemas.py` to `board_service.py`, `SettingsPage.tsx`, `mobile/src/api/focusedView.ts`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Why does `Plan: feat-focused-view-mobile (PR 3 of 3)` connect `mobile/src/api/focusedView.ts` to `SettingsPage.tsx`, `TasksScreen.tsx`, `SettingsScreen.tsx`, `schemas.py`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `Task` connect `Task` to `._make_db`, `_make_board`, `TestDateWindow`, `TestGetDayViewTasksDateFilterClause`, `_effective_date`, `board_service.py`, `sync`, `TaskUpdate`, `reports_service.py`, `StateEnum`, `_make_board`, `_make_config`, `tasks.py`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Are the 44 inferred relationships involving `Task` (e.g. with `TestCreateBoard` and `TestDeleteBoard`) actually correct?**
  _`Task` has 44 INFERRED edges - model-reasoned connections that need verification._
- **Are the 36 inferred relationships involving `StateEnum` (e.g. with `TestDateWindow` and `TestGetDayViewTasks`) actually correct?**
  _`StateEnum` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `Board` (e.g. with `TestCreateBoard` and `TestDeleteBoard`) actually correct?**
  _`Board` has 21 INFERRED edges - model-reasoned connections that need verification._