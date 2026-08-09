# Graph Report - tasksAreUs  (2026-08-09)

## Corpus Check
- 243 files · ~297,618 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1751 nodes · 4090 edges · 123 communities (75 shown, 48 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 217 edges (avg confidence: 0.54)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `24101d94`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ._make_db
- _make_board
- tasks.py
- DATA_MODEL_AND_API.MD — data model & API definitions
- test_board_service.py
- PLAN: Remove Beliefs Feature and All LLM/Anthropic Integration
- PLAN-feat-tasks-view-redesign-mobile.md (external)
- TaskForm.tsx
- StateEnum
- test_labels_router.py
- sync
- TaskUpdate
- frontend/src/components/BoardGroupedTasks.tsx
- expo
- PR 3 — Mobile
- get_current_user
- ArchivePage.tsx
- ArchiveScreen.tsx
- get_completions
- PLAN-feat-tag-filter-single-mode
- Task
- TasksScreen.tsx
- Board
- compilerOptions
- TasksPage.tsx
- boards.py
- TaskFormScreen.tsx
- compilerOptions
- apiFetch
- reopen_task
- mobile/src/api/focusedView.ts
- devDependencies
- src/App.tsx
- dependencies
- dependencies
- Plan: Fix Archive view usability (tabs, task details, reopen, tag order)
- mobile/src/utils/taskPriority.ts
- PLAN: feat-clickable-card-date — Make the due-date text on task cards an inline edit link
- assert_eq
- PLAN-chore-remove-mode-label-dead-code
- mobile/package.json
- PLAN: Modularize `test_api.py` and Reduce Sleepy's (test-review) Token Cost
- PLAN-fix-board-tag-ux-polish
- devDependencies
- patch
- ViewContext.tsx
- SettingsScreen.tsx
- _is_hp_eligible_date
- TestCompleteTask
- PLAN: Board pin + single-board tag filter chips
- PLAN-fix-tag-filter-layout-and-link-wrap
- scripts
- purge_test_data.py
- mobile/tsconfig.json
- frontend/package.json
- metro.config.js
- create_task
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
- create_board
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
- c
- @react-navigation/native
- get_day_view_tasks
- SettingsPage.tsx
- schemas.py
- frontend/src/api/tasks.ts
- Layout.tsx
- _get_high_priority_limit
- sync_local_to_railway.py
- get_completions
- mobile/src/__tests__/taskFilters.test.ts

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

## Communities (123 total, 48 thin omitted)

### Community 0 - "._make_db"
Cohesion: 0.11
Nodes (6): update_task(), TestUpdateTaskDateClearing, TestUpdateTaskHighPriority, TestUpdateTaskLinks, TestUpdateTaskPriorityTiers, TestUpdateTaskSortOrder

### Community 1 - "_make_board"
Cohesion: 0.10
Nodes (19): get_day_view_tasks(), get_focused_tasks(), Board, date, Session, _query_board_grouped_tasks(), Query pending tasks matching `date_filter`, grouped by the given (already-…, update_config() (+11 more)

### Community 2 - "tasks.py"
Cohesion: 0.19
Nodes (15): Settings, get_db(), _git_hash(), health(), _init_firebase(), lifespan(), _migrate_boards(), get (+7 more)

### Community 3 - "DATA_MODEL_AND_API.MD — data model & API definitions"
Cohesion: 0.08
Nodes (56): Bashful — requirements-review agent, keeps PRODUCT_REQUIREMENTS_DOCUMENT.MD current, Doc — arch-review agent, keeps ARCHITECTURE.MD and DATA_MODEL_AND_API.MD current, Dopey — code-review agent (correctness, architecture fit, security), Grumpy — main assistant (Claude), implements features and creates PRs, Sleepy — test-review agent, owns test_api.py, runs tests, posts QE verdict, Sneezy — plan-review agent, reviews development plan files, ARCHITECTURE.MD — code structure & implementation patterns, PLAN-feat-overdue-view-colors-actions.md (archived development plan) (+48 more)

### Community 4 - "test_board_service.py"
Cohesion: 0.11
Nodes (18): delete_board(), ensure_board_seeded(), get_default_board_id(), Session, Ensure is_default matches whichever board is topmost in sort_order. Must re-…, Return board_id after validating ownership, or the default board if board_id is…, Ensure the user has a default board with seeded labels. Returns the default…, _recompute_default() (+10 more)

### Community 5 - "PLAN: Remove Beliefs Feature and All LLM/Anthropic Integration"
Cohesion: 0.07
Nodes (26): API Contract Changes, Backend (`backend/app/`), Confidence & Risk Assessment, Data Model Changes, Database Schema, Deployment Order, Files to Modify, In Scope (+18 more)

### Community 6 - "PLAN-feat-tasks-view-redesign-mobile.md (external)"
Cohesion: 0.05
Nodes (50): Stale Board State Bug (anon→real uid swap, mobile), NOTE: Mobile Stale Board State Bug, Rationale: seeding sentinel scoped per-board (ensure_board_seeded), not per-user, so new boards start empty while the original 'General tasks' board still seeds, boards table data model (multi-board feature), PLAN: feat-multi-board — Multiple Boards, Mobile BoardContext (mirrors web BoardContext, no FilterContext equivalent), PLAN: Multi-board Mobile Support (PR 3/3), Rationale: OTA (eas update) deployment for JS/TS-only mobile changes, no native/app.json/eas.json touched (+42 more)

### Community 7 - "TaskForm.tsx"
Cohesion: 0.21
Nodes (12): PLAN-feat-inline-tag-add, Inline Tag Creation from TaskForm (avoid Settings trip), TaskLink, CATEGORY_DISPLAY_NAMES, CATEGORY_ORDER, LabelCategory, newLinkId(), TaskForm() (+4 more)

### Community 8 - "StateEnum"
Cohesion: 0.18
Nodes (8): StateEnum, _count_high_priority_for_date(), _effective_date(), date, Unit tests for task_service.py — no database required., TestCountHighPriorityForDate, TestEffectiveDate, TestSortOrderDefault

### Community 9 - "test_labels_router.py"
Cohesion: 0.13
Nodes (20): CategoryEnum, create_label(), delete_label(), list_labels(), delete, get, post, put (+12 more)

### Community 10 - "sync"
Cohesion: 0.13
Nodes (27): TaskLabel, UserSettings, _owned_board_id(), Any, post, Session, Validate a sync client's raw links payload, keeping whatever is valid. Sync…, Validate a sync client's raw `priority` value, treating anything invalid (or… (+19 more)

### Community 11 - "TaskUpdate"
Cohesion: 0.07
Nodes (39): complete_task(), create_task(), delete_task(), get_task(), list_tasks(), date, delete, get (+31 more)

### Community 12 - "frontend/src/components/BoardGroupedTasks.tsx"
Cohesion: 0.07
Nodes (37): BoardCollapseContext (modeled on FilterContext), PLAN: feat-board-collapse-web — Collapsible boards (web), getDayViewTasks(), FocusedBoard, getFocusedViewTasks(), BoardGroupedTasks(), DayView(), EmptyState() (+29 more)

### Community 13 - "expo"
Cohesion: 0.06
Nodes (30): backgroundColor, foregroundImage, adaptiveIcon, package, projectId, expo, android, extra (+22 more)

### Community 14 - "PR 3 — Mobile"
Cohesion: 0.07
Nodes (27): API Changes, Backend Unit Tests (`backend/tests/unit/`), Data Model Changes, Decisions Locked In (answered by user before this plan was written), Development Plan: feat-priority-tiers, Files to Modify (PR1), Files to Modify (PR2), Files to Modify (PR3) (+19 more)

### Community 15 - "get_current_user"
Cohesion: 0.13
Nodes (14): get_current_user(), get_firebase_claims(), Session, Evaluated per-request so the flag can be toggled without a server restart., Validate Bearer token and return decoded claims. Does NOT touch the DB. Used by…, Resolve caller to an internal user_id UUID via Firebase Bearer token. Bypass:…, _test_auth_bypass(), _verify_firebase_token() (+6 more)

### Community 16 - "ArchivePage.tsx"
Cohesion: 0.11
Nodes (25): all_boards Additive Query Param Design, Board-Grouped Collapsible Rendering (mirrors Today view), PLAN: Rename Reports → Archive, add date-range presets and board filtering, Board Color Everywhere (TaskCard/BoardTabs accents), BoardCompletions, CompletionRecord, CompletionsReport, getCompletions() (+17 more)

### Community 17 - "ArchiveScreen.tsx"
Cohesion: 0.11
Nodes (22): getCompletions(), GetCompletionsOptions, ArchiveBoardGroups(), boardColor(), CompletionCard(), formatCompletedAt(), LABEL_CATEGORY_ORDER, PALETTE (+14 more)

### Community 18 - "get_completions"
Cohesion: 0.19
Nodes (13): _completions_query(), get_completions(), date, Session, _make_board(), _make_task(), Board, patch (+5 more)

### Community 19 - "PLAN-feat-tag-filter-single-mode"
Cohesion: 0.07
Nodes (28): 1. Shared `FilterMode` type + shared toggle helper (`frontend/src/utils/taskFilters.ts`), 2. `frontend/src/context/FilterContext.tsx` — replaces the flat Set with a per-board map (new), 3. `frontend/src/context/BoardContext.tsx` — remove the now-obsolete `clearLabels()` call, 4. `frontend/src/components/BoardGroupedTasks.tsx` — consume the shared per-board map, locally reconcile the Single-mode invariant, 5. `frontend/src/pages/TasksPage.tsx` — now requires code changes (first draft assumed none; incorrect once the flat Set is replaced), 6. `frontend/src/pages/TaskDetailPage.tsx` — small update for the same reason, 7. `frontend/src/components/LabelFilterChips.tsx`, A. Three filter modes (Single / And / Or) (+20 more)

### Community 20 - "Task"
Cohesion: 0.12
Nodes (24): Base, Label, Task, _parse_dt(), Board CRUD, seeding, and board-cap enforcement., Session, Label seeding helper — called by board_service during board initialisation., Seed all LABEL_SEED entries into a specific board. Idempotent. (+16 more)

### Community 21 - "TasksScreen.tsx"
Cohesion: 0.12
Nodes (29): completeTask(), deleteTask(), DayView(), FocusedTaskCard(), FocusedView(), TODO: When task-fetching is extended to include done tasks, this pending, TaskCardBody(), TaskCardBodyProps (+21 more)

### Community 22 - "Board"
Cohesion: 0.22
Nodes (8): Board, FocusedViewConfig, date_window(), get_or_create_config(), Focused view config management and task filtering., Unit tests for focused_view_service — no database required., TestDateWindow, TestGetOrCreateConfig

### Community 23 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 24 - "TasksPage.tsx"
Cohesion: 0.12
Nodes (35): Development Plan: Enhance All View with Priority Collapse & Date Display, Monday Column (Friday-only) + Priority Split/Collapse, PriorityTier, TaskCard(), DateFieldLine(), DateFieldName, TaskCardBody(), CollapseKey (+27 more)

### Community 25 - "boards.py"
Cohesion: 0.18
Nodes (16): create_board(), delete_board(), list_boards(), delete, get, post, put, Session (+8 more)

### Community 26 - "TaskFormScreen.tsx"
Cohesion: 0.14
Nodes (18): ApiError, createTask(), getTask(), CATEGORY_LABELS, CATEGORY_ORDER, DateField, newLinkId(), notesMarkdownIt (+10 more)

### Community 27 - "compilerOptions"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "apiFetch"
Cohesion: 0.18
Nodes (16): createBoard(), deleteBoard(), getBoards(), updateBoard(), apiFetch(), ArchiveBoardTabs(), boardColor(), PALETTE (+8 more)

### Community 29 - "reopen_task"
Cohesion: 0.27
Nodes (3): _sort_order_default(), reopen_task(), TestReopenTask

### Community 30 - "mobile/src/api/focusedView.ts"
Cohesion: 0.19
Nodes (12): Collapse State Lifted into TasksScreen (mobile, no unmount), PLAN: feat-board-collapse-mobile — Collapsible boards (mobile), Predefined 8-Color Palette (no native color picker, mobile), Plan: feat-focused-view-mobile (PR 3 of 3), getDayViewTasks(), FocusedBoard, getFocusedViewTasks(), boardColor() (+4 more)

### Community 31 - "devDependencies"
Cohesion: 0.12
Nodes (17): autoprefixer, eslint, devDependencies, autoprefixer, eslint, globals, @types/react, typescript (+9 more)

### Community 32 - "src/App.tsx"
Cohesion: 0.20
Nodes (15): App(), AppRoutes(), EmailConfirmationPage(), AuthContext, AuthContextValue, AuthProvider(), useAuthContext(), EMPTY_LABEL_SET (+7 more)

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

### Community 42 - "PLAN-fix-board-tag-ux-polish"
Cohesion: 0.08
Nodes (23): 1. Centered "New Task" button on an empty board, 2. Tag filter link on the same row as the tag chips, 3. Browser tab title, 4. Alphabetical tag order on task cards, all views, 5. AND/OR toggle for tag filtering, 6. Longer link-description text on task cards, API / contract changes, Background / current behavior (+15 more)

### Community 43 - "devDependencies"
Cohesion: 0.22
Nodes (9): @babel/core, jest-expo, devDependencies, @babel/core, jest-expo, @types/react, typescript, @types/react (+1 more)

### Community 44 - "patch"
Cohesion: 0.17
Nodes (3): patch, TestHighPriorityDailyLimit, TestUpdateTaskBoardId

### Community 45 - "ViewContext.tsx"
Cohesion: 0.27
Nodes (7): useView(), ViewContext, ViewContextValue, ViewProvider(), VIEW_LABELS, viewLabel(), ViewMode

### Community 46 - "SettingsScreen.tsx"
Cohesion: 0.09
Nodes (27): API_BASE_URL, API_V1_URL, createLabel(), deleteLabel(), listLabels(), updateLabel(), getSettings(), updateSettings() (+19 more)

### Community 47 - "_is_hp_eligible_date"
Cohesion: 0.29
Nodes (3): _is_hp_eligible_date(), HP is valid for overdue, today, tomorrow, the day after tomorrow, and — on…, TestIsHpEligibleDate

### Community 48 - "TestCompleteTask"
Cohesion: 0.33
Nodes (3): complete_task(), Task, TestCompleteTask

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

### Community 56 - "create_task"
Cohesion: 0.17
Nodes (7): create_task(), Any, Label, Session, _resolve_labels(), TestCreateTaskLinks, TestCreateTaskPriorityTiers

### Community 111 - "index.ts"
Cohesion: 0.17
Nodes (13): updateTask(), EDIT_CATEGORY_ORDER, LABEL_BG, LABEL_TEXT, TaskQuickEdit(), TaskQuickEditProps, REF_DATE, CompleteTaskBody (+5 more)

### Community 114 - "get_day_view_tasks"
Cohesion: 0.33
Nodes (6): get_day_view_tasks(), date, get, Session, patch, TestGetDayViewTasksWiring

### Community 115 - "SettingsPage.tsx"
Cohesion: 0.10
Nodes (25): UI Naming Change: Type → Tags, Plan: Custom board order + board-color styling + alphabetical tags, Native input[type=color] Auto-Save Picker (routes through setColorBoard), Plan: feat-focused-view-web (PR 2 of 3), PLAN-feat-multi-board-backend (PR #33, external, merged), BoardContext + BoardSwitcher UI Design, PLAN: feat-multi-board-frontend (PR 2/3), Board (+17 more)

### Community 116 - "schemas.py"
Cohesion: 0.11
Nodes (33): get_config(), get_focused_tasks(), date, get, put, Session, update_config(), _get_or_create_settings() (+25 more)

### Community 117 - "frontend/src/api/tasks.ts"
Cohesion: 0.10
Nodes (37): Narrow Label.category Union / Remove Dead recurrence_group_id Type, apiFetch(), createLabel(), deleteLabel(), LabelCategory, listLabels(), updateLabel(), completeTask() (+29 more)

### Community 118 - "Layout.tsx"
Cohesion: 0.25
Nodes (3): Layout(), NAV_ITEMS, NavItem

### Community 122 - "sync_local_to_railway.py"
Cohesion: 0.43
Nodes (5): bulk_insert(), count_task_labels(), fetch_all_as_dicts(), main(), Fresh sync of all user data from local Postgres → Railway Postgres. Does NOT…

### Community 123 - "get_completions"
Cohesion: 0.50
Nodes (4): get_completions(), date, get, Session

### Community 125 - "mobile/src/__tests__/taskFilters.test.ts"
Cohesion: 0.40
Nodes (3): labelA, labelB, filterTasks()

## Ambiguous Edges - Review These
- `Day View` → `Overdue View proposal (archived plan; proposed separate /overdue-view/tasks endpoint)`  [AMBIGUOUS]
  archive/PLAN-feat-overdue-view-colors-actions.md · relation: conceptually_related_to

## Knowledge Gaps
- **436 isolated node(s):** `Sneezy's Review — resolutions (Grumpy, 2026-08-09, approved and folded into Design below)`, `Overview`, `Current state (confirmed by reading code)`, `Interaction`, `State ownership` (+431 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **48 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Day View` and `Overdue View proposal (archived plan; proposed separate /overdue-view/tasks endpoint)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Development Plan: feat-focused-view (backend, PR 1 of 3)` connect `schemas.py` to `SettingsPage.tsx`, `Task`, `mobile/src/api/focusedView.ts`?**
  _High betweenness centrality (0.139) - this node is a cross-community bridge._
- **Why does `Plan: feat-focused-view-mobile (PR 3 of 3)` connect `mobile/src/api/focusedView.ts` to `SettingsPage.tsx`, `schemas.py`, `TasksScreen.tsx`, `SettingsScreen.tsx`?**
  _High betweenness centrality (0.137) - this node is a cross-community bridge._
- **Why does `Task` connect `Task` to `._make_db`, `_make_board`, `tasks.py`, `test_board_service.py`, `StateEnum`, `sync`, `TaskUpdate`, `patch`, `_is_hp_eligible_date`, `TestCompleteTask`, `get_completions`, `schemas.py`, `Board`, `create_board`, `create_task`, `_get_high_priority_limit`, `reopen_task`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Are the 44 inferred relationships involving `Task` (e.g. with `TestCreateBoard` and `TestDeleteBoard`) actually correct?**
  _`Task` has 44 INFERRED edges - model-reasoned connections that need verification._
- **Are the 36 inferred relationships involving `StateEnum` (e.g. with `TestDateWindow` and `TestGetDayViewTasks`) actually correct?**
  _`StateEnum` has 36 INFERRED edges - model-reasoned connections that need verification._
- **Are the 21 inferred relationships involving `Board` (e.g. with `TestCreateBoard` and `TestDeleteBoard`) actually correct?**
  _`Board` has 21 INFERRED edges - model-reasoned connections that need verification._