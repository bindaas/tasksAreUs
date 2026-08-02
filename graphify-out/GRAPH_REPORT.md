# Graph Report - .  (2026-08-02)

## Corpus Check
- 228 files · ~237,201 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1412 nodes · 3452 edges · 111 communities (65 shown, 46 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 194 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- High Priority Task Logic
- Focused View Service (Backend)
- Task Schema & Validation
- Project Docs & Agent Roster
- Board Service (Backend)
- Label Router (Backend)
- Multi-Board Design Plans
- Frontend Boards API
- Task Model & Service
- Mobile Focused/Day View Components
- Sync Router & Models
- Frontend Tasks API
- Frontend Day/Focused View
- Mobile App Config (app.json)
- Column Priority Collapse
- Backend Auth Dependencies
- Archive View Feature
- Mobile Archive View
- Mobile Task Quick Edit
- Reports Service (Completions)
- Board Color & View Context
- Multi-Board Frontend Setup
- Stale Board State Bug
- Frontend TS App Config
- AI Beliefs & Cost Models
- Focused View Router
- Mobile Task Form Screen
- Frontend TS Node Config
- Mobile Boards & Archive Tabs
- Backend App Bootstrap
- Board Collapse & Focused View Mobile
- Frontend Dev Dependencies
- Mobile API Client & Labels
- Mobile Runtime Dependencies (Expo)
- Frontend Runtime Dependencies
- Backend Tasks Router
- Frontend Task Form & Links
- Day View Router & Tests
- Integration Test Script
- Backend Boards Router
- Mobile Package Scripts
- Beliefs Router
- Inline Tag Add Feature
- Mobile Dev Dependencies
- Settings Router
- Sync Router Helpers
- Frequency Label Removal
- Frontend Layout & Navigation
- Mobile Task Priority Utils
- High Priority Limit Tests
- Railway Sync Script
- Frontend Package Scripts
- Backend Maintenance Scripts
- Mobile TS Config
- Frontend Package Metadata
- Mobile Metro Config
- Backend Reports Router
- Frontend TS Config Root
- Mobile Markdown Type Defs
- @eslint/js (Frontend Dep)
- eslint-plugin-react-hooks (Frontend Dep)
- eslint-plugin-react-refresh (Frontend Dep)
- expo-linking (Mobile Dep)
- expo-status-bar (Mobile Dep)
- expo-updates (Mobile Dep)
- expo-web-browser (Mobile Dep)
- Firebase (Mobile Dep)
- Frontend Entry Docs
- jsdom (Frontend Dep)
- PostCSS (Frontend Dep)
- Tailwind CSS (Frontend Dep)
- @tailwindcss/typography (Frontend Dep)
- @types/node (Frontend Dep)
- @types/react-dom (Frontend Dep)
- typescript-eslint (Frontend Dep)
- markdown-it-task-lists (Mobile Dep)
- migrate_to_railway.sh Script
- Mobile App Config Script
- NativeWind Env Types
- NativeWind (Mobile Dep)
- React (Mobile Dep)
- React Native Core (Mobile Dep)
- React Native DateTimePicker (Mobile Dep)
- React Native Gesture Handler (Mobile Dep)
- React Native Reanimated (Mobile Dep)
- React Native Safe Area Context (Mobile Dep)
- React Navigation Bottom Tabs (Mobile Dep)
- React Navigation Native (Mobile Dep)
- Tailwind CSS (Mobile Dep)
- backup-railway-db.sh Script
- migrate-remove-mode-labels.sh Script
- restore-railway-db.sh Script
- tasksAreUs Favicon Icon
- Icon Sprite (icons.svg)
- Hero Image (Branding Graphic)
- React Logo Asset
- Vite Logo Asset
- Mobile Adaptive Icon
- Mobile Favicon
- Mobile App Icon (Placeholder)
- Mobile Splash Icon

## God Nodes (most connected - your core abstractions)
1. `Task` - 59 edges
2. `update_task()` - 50 edges
3. `StateEnum` - 40 edges
4. `Board` - 38 edges
5. `sync()` - 33 edges
6. `DATA_MODEL_AND_API.MD — data model & API definitions` - 29 edges
7. `Label` - 26 edges
8. `apiFetch()` - 26 edges
9. `apiFetch()` - 25 edges
10. `get_current_user()` - 24 edges

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

## Communities (111 total, 46 thin omitted)

### Community 0 - "High Priority Task Logic"
Cohesion: 0.08
Nodes (12): _is_hp_eligible_date(), Any, HP is valid for overdue, today, tomorrow, the day after tomorrow, and — on…, update_task(), patch, TestHighPriorityDailyLimit, TestIsHpEligibleDate, TestUpdateTaskBoardId (+4 more)

### Community 1 - "Focused View Service (Backend)"
Cohesion: 0.08
Nodes (25): FocusedViewConfig, date_window(), get_day_view_tasks(), get_focused_tasks(), get_or_create_config(), Board, date, Session (+17 more)

### Community 2 - "Task Schema & Validation"
Cohesion: 0.08
Nodes (23): put, update_task(), Any, Validate a raw list of link dicts against TaskLink rules. Shared between…, TaskCreate, TaskLink, TaskUpdate, validate_task_links() (+15 more)

### Community 3 - "Project Docs & Agent Roster"
Cohesion: 0.08
Nodes (56): Bashful — requirements-review agent, keeps PRODUCT_REQUIREMENTS_DOCUMENT.MD current, Doc — arch-review agent, keeps ARCHITECTURE.MD and DATA_MODEL_AND_API.MD current, Dopey — code-review agent (correctness, architecture fit, security), Grumpy — main assistant (Claude), implements features and creates PRs, Sleepy — test-review agent, owns test_api.py, runs tests, posts QE verdict, Sneezy — plan-review agent, reviews development plan files, ARCHITECTURE.MD — code structure & implementation patterns, PLAN-feat-overdue-view-colors-actions.md (archived development plan) (+48 more)

### Community 4 - "Board Service (Backend)"
Cohesion: 0.09
Nodes (26): Board, delete_board(), delete, create_board(), delete_board(), ensure_board_seeded(), get_board_or_404(), get_default_board_id() (+18 more)

### Community 5 - "Label Router (Backend)"
Cohesion: 0.11
Nodes (29): CategoryEnum, Label, create_label(), delete_label(), list_labels(), delete, get, post (+21 more)

### Community 6 - "Multi-Board Design Plans"
Cohesion: 0.06
Nodes (46): Rationale: seeding sentinel scoped per-board (ensure_board_seeded), not per-user, so new boards start empty while the original 'General tasks' board still seeds, boards table data model (multi-board feature), PLAN: feat-multi-board — Multiple Boards, Mobile BoardContext (mirrors web BoardContext, no FilterContext equivalent), PLAN: Multi-board Mobile Support (PR 3/3), Rationale: OTA (eas update) deployment for JS/TS-only mobile changes, no native/app.json/eas.json touched, Rationale: partial unique index UNIQUE(user_id) WHERE is_default=true, created via raw SQL in lifespan block since create_all() can't express partial indexes, _resolve_labels(label_ids, user_id, board_id, db) — cross-board label validation (+38 more)

### Community 7 - "Frontend Boards API"
Cohesion: 0.09
Nodes (28): Native input[type=color] Auto-Save Picker (routes through setColorBoard), Plan: feat-focused-view-web (PR 2 of 3), Board, createBoard(), deleteBoard(), getBoards(), updateBoard(), apiFetch() (+20 more)

### Community 8 - "Task Model & Service"
Cohesion: 0.10
Nodes (21): _sort_order_default(), StateEnum, Task, Focused view config management and task filtering., complete_task(), _count_high_priority_for_date(), create_task(), _effective_date() (+13 more)

### Community 9 - "Mobile Focused/Day View Components"
Cohesion: 0.12
Nodes (30): completeTask(), deleteTask(), listTasks(), DayView(), FocusedTaskCard(), FocusedView(), TODO: When task-fetching is extended to include done tasks, this pending, TaskCardBody() (+22 more)

### Community 10 - "Sync Router & Models"
Cohesion: 0.21
Nodes (17): TaskLabel, UserSettings, post, sync(), SyncChanges, SyncRequest, _make_db(), _make_task() (+9 more)

### Community 11 - "Frontend Tasks API"
Cohesion: 0.12
Nodes (24): completeTask(), CompleteTaskBody, CompleteTaskResponse, createTask(), CreateTaskBody, deleteTask(), Label, listTasks() (+16 more)

### Community 12 - "Frontend Day/Focused View"
Cohesion: 0.14
Nodes (20): BoardCollapseContext (modeled on FilterContext), PLAN: feat-board-collapse-web — Collapsible boards (web), getDayViewTasks(), FocusedBoard, getFocusedViewTasks(), BoardGroupedTasks(), DayView(), EmptyState() (+12 more)

### Community 13 - "Mobile App Config (app.json)"
Cohesion: 0.06
Nodes (30): backgroundColor, foregroundImage, adaptiveIcon, package, projectId, expo, android, extra (+22 more)

### Community 14 - "Column Priority Collapse"
Cohesion: 0.15
Nodes (22): Development Plan: Enhance All View with Priority Collapse & Date Display, Monday Column (Friday-only) + Priority Split/Collapse, TaskCardBody(), ColumnPriorityCollapseContext, ColumnPriorityCollapseContextValue, ColumnPriorityCollapseProvider(), useColumnPriorityCollapse(), TasksPage() (+14 more)

### Community 15 - "Backend Auth Dependencies"
Cohesion: 0.13
Nodes (14): get_current_user(), get_firebase_claims(), Session, Evaluated per-request so the flag can be toggled without a server restart., Validate Bearer token and return decoded claims. Does NOT touch the DB. Used by…, Resolve caller to an internal user_id UUID via Firebase Bearer token. Bypass:…, _test_auth_bypass(), _verify_firebase_token() (+6 more)

### Community 16 - "Archive View Feature"
Cohesion: 0.12
Nodes (22): all_boards Additive Query Param Design, Board-Grouped Collapsible Rendering (mirrors Today view), PLAN: Rename Reports → Archive, add date-range presets and board filtering, BoardCompletions, CompletionRecord, CompletionsReport, getCompletions(), GetCompletionsOptions (+14 more)

### Community 17 - "Mobile Archive View"
Cohesion: 0.11
Nodes (22): getCompletions(), GetCompletionsOptions, ArchiveBoardGroups(), boardColor(), CompletionCard(), formatCompletedAt(), LABEL_CATEGORY_ORDER, PALETTE (+14 more)

### Community 18 - "Mobile Task Quick Edit"
Cohesion: 0.12
Nodes (19): updateTask(), TaskCardBodyProps, EDIT_CATEGORY_ORDER, LABEL_BG, LABEL_TEXT, TaskQuickEdit(), TaskQuickEditProps, labelA (+11 more)

### Community 19 - "Reports Service (Completions)"
Cohesion: 0.17
Nodes (14): _completions_query(), get_completions(), date, Session, Task, _to_completion_item(), _make_board(), _make_task() (+6 more)

### Community 20 - "Board Color & View Context"
Cohesion: 0.16
Nodes (16): Board Color Everywhere (TaskCard/BoardTabs accents), ArchiveBoardTabs(), BoardTabs(), useBoard(), useView(), ViewContext, ViewContextValue, ViewProvider() (+8 more)

### Community 21 - "Multi-Board Frontend Setup"
Cohesion: 0.16
Nodes (18): Plan: Custom board order + board-color styling + alphabetical tags, PLAN-feat-multi-board-backend (PR #33, external, merged), BoardContext + BoardSwitcher UI Design, PLAN: feat-multi-board-frontend (PR 2/3), App(), AppRoutes(), EmailConfirmationPage(), frontend/src/components/BoardSwitcher.tsx (+10 more)

### Community 22 - "Stale Board State Bug"
Cohesion: 0.13
Nodes (16): Stale Board State Bug (anon→real uid swap, mobile), NOTE: Mobile Stale Board State Bug, Bug: anonymous-to-real Firebase identity transition (uid A to uid B, never passing through null) leaves BoardContext/FilterContext referencing the anonymous session's stale board, PLAN-fix-stale-board-state-on-identity-change.md (web, external), AuthContext, AuthContextValue, AuthProvider(), useAuthContext() (+8 more)

### Community 23 - "Frontend TS App Config"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+14 more)

### Community 24 - "AI Beliefs & Cost Models"
Cohesion: 0.15
Nodes (15): AICostLog, Base, Belief, BeliefStatusEnum, BeliefTypeEnum, _anthropic_client(), generate_beliefs(), _log_cost() (+7 more)

### Community 25 - "Focused View Router"
Cohesion: 0.18
Nodes (20): get_config(), get_focused_tasks(), date, get, put, Session, update_config(), BoardCompletions (+12 more)

### Community 26 - "Mobile Task Form Screen"
Cohesion: 0.14
Nodes (17): ApiError, createTask(), getTask(), CATEGORY_LABELS, CATEGORY_ORDER, DateField, newLinkId(), notesMarkdownIt (+9 more)

### Community 27 - "Frontend TS Node Config"
Cohesion: 0.10
Nodes (20): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+12 more)

### Community 28 - "Mobile Boards & Archive Tabs"
Cohesion: 0.18
Nodes (15): createBoard(), deleteBoard(), getBoards(), updateBoard(), ArchiveBoardTabs(), boardColor(), PALETTE, BoardTabs() (+7 more)

### Community 29 - "Backend App Bootstrap"
Cohesion: 0.21
Nodes (14): Settings, get_db(), _git_hash(), health(), _init_firebase(), lifespan(), _migrate_boards(), get (+6 more)

### Community 30 - "Board Collapse & Focused View Mobile"
Cohesion: 0.19
Nodes (12): Collapse State Lifted into TasksScreen (mobile, no unmount), PLAN: feat-board-collapse-mobile — Collapsible boards (mobile), Predefined 8-Color Palette (no native color picker, mobile), Plan: feat-focused-view-mobile (PR 3 of 3), getDayViewTasks(), FocusedBoard, getFocusedViewTasks(), boardColor() (+4 more)

### Community 31 - "Frontend Dev Dependencies"
Cohesion: 0.12
Nodes (17): autoprefixer, eslint, devDependencies, autoprefixer, eslint, globals, @types/react, typescript (+9 more)

### Community 32 - "Mobile API Client & Labels"
Cohesion: 0.28
Nodes (11): API_BASE_URL, API_V1_URL, apiFetch(), createLabel(), deleteLabel(), listLabels(), updateLabel(), getSettings() (+3 more)

### Community 33 - "Mobile Runtime Dependencies (Expo)"
Cohesion: 0.13
Nodes (15): @believer/react-native-markdown-display, expo, expo-auth-session, expo-crypto, dependencies, @believer/react-native-markdown-display, expo, expo-auth-session (+7 more)

### Community 34 - "Frontend Runtime Dependencies"
Cohesion: 0.13
Nodes (15): @firebase/app, @firebase/auth, dependencies, @firebase/app, @firebase/auth, react, react-dom, react-markdown (+7 more)

### Community 35 - "Backend Tasks Router"
Cohesion: 0.29
Nodes (13): complete_task(), create_task(), delete_task(), get_task(), list_tasks(), date, delete, get (+5 more)

### Community 36 - "Frontend Task Form & Links"
Cohesion: 0.25
Nodes (10): TaskLink, CATEGORY_DISPLAY_NAMES, CATEGORY_ORDER, LabelCategory, newLinkId(), TaskForm(), isBlankLink(), isValidLinkUrl() (+2 more)

### Community 37 - "Day View Router & Tests"
Cohesion: 0.27
Nodes (7): get_day_view_tasks(), date, get, Session, patch, Unit tests for the day-view router — no database required. Guards against a…, TestGetDayViewTasksWiring

### Community 38 - "Integration Test Script"
Cohesion: 0.22
Nodes (12): assert_eq(), assert_eq_xfail(), assert_in(), assert_true(), cleanup(), main(), Standalone API test script. - Creates its own test data - Exercises all major…, # NOTE: the backend filters completed_at (TIMESTAMP) against to_date (DATE). (+4 more)

### Community 39 - "Backend Boards Router"
Cohesion: 0.31
Nodes (10): create_board(), list_boards(), get, post, put, Session, update_board(), BoardCreate (+2 more)

### Community 40 - "Mobile Package Scripts"
Cohesion: 0.18
Nodes (10): jest, preset, main, name, scripts, android, ios, start (+2 more)

### Community 41 - "Beliefs Router"
Cohesion: 0.33
Nodes (9): generate_beliefs(), get_task_beliefs(), get, post, put, Session, update_belief(), BeliefOut (+1 more)

### Community 42 - "Inline Tag Add Feature"
Cohesion: 0.36
Nodes (7): PLAN-feat-inline-tag-add, Inline Tag Creation from TaskForm (avoid Settings trip), getSettings(), useFilter(), useLabels(), useSettings(), TaskDetailPage()

### Community 43 - "Mobile Dev Dependencies"
Cohesion: 0.22
Nodes (9): @babel/core, jest-expo, devDependencies, @babel/core, jest-expo, @types/react, typescript, @types/react (+1 more)

### Community 44 - "Settings Router"
Cohesion: 0.42
Nodes (8): _get_or_create_settings(), get_settings(), get, put, Session, update_settings(), SettingsOut, SettingsUpdate

### Community 45 - "Sync Router Helpers"
Cohesion: 0.31
Nodes (8): _owned_board_id(), _parse_dt(), Any, Session, Validate a sync client's raw links payload, keeping whatever is valid. Sync…, Return board_id if it's a real, non-deleted board owned by user_id, else None.…, _validate_sync_links(), datetime

### Community 46 - "Frequency Label Removal"
Cohesion: 0.29
Nodes (8): backend/scripts/migrate_drop_frequency_labels.sql, Plan: Remove Frequency Label Logic from Backend (PR 2 of 3), Recurring Task Logic Removal (complete_task always returns None), ensure_seeded() Sentinel Swap (frequency→mode), PLAN: Drop Frequency Labels — PR 3: DB Migration, SQL Migration: purge frequency data + drop enum value + drop recurrence_group_id, PLAN: Frontend & Mobile Type Cleanup (PR 4, follow-up), Narrow Label.category Union / Remove Dead recurrence_group_id Type

### Community 47 - "Frontend Layout & Navigation"
Cohesion: 0.25
Nodes (3): Layout(), NAV_ITEMS, NavItem

### Community 48 - "Mobile Task Priority Utils"
Cohesion: 0.46
Nodes (5): canAddHighPriority(), HIGH_PRIORITY_DAILY_LIMIT, isFormHighPriorityEligible(), isHighPriorityEligible(), splitByPriority()

### Community 50 - "Railway Sync Script"
Cohesion: 0.43
Nodes (5): bulk_insert(), count_task_labels(), fetch_all_as_dicts(), main(), Fresh sync of all user data from local Postgres → Railway Postgres. Does NOT…

### Community 51 - "Frontend Package Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, test, test:watch

### Community 53 - "Mobile TS Config"
Cohesion: 0.33
Nodes (5): compilerOptions, paths, strict, extends, expo/tsconfig.base

### Community 54 - "Frontend Package Metadata"
Cohesion: 0.40
Nodes (4): name, private, type, version

### Community 55 - "Mobile Metro Config"
Cohesion: 0.40
Nodes (4): config, { getDefaultConfig }, path, { withNativeWind }

### Community 56 - "Backend Reports Router"
Cohesion: 0.50
Nodes (4): get_completions(), date, get, Session

## Ambiguous Edges - Review These
- `Day View` → `Overdue View proposal (archived plan; proposed separate /overdue-view/tasks endpoint)`  [AMBIGUOUS]
  archive/PLAN-feat-overdue-view-colors-actions.md · relation: conceptually_related_to

## Knowledge Gaps
- **254 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+249 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **46 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Day View` and `Overdue View proposal (archived plan; proposed separate /overdue-view/tasks endpoint)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `Development Plan: feat-focused-view (backend, PR 1 of 3)` connect `Focused View Router` to `Board Service (Backend)`, `Board Collapse & Focused View Mobile`, `Frontend Boards API`?**
  _High betweenness centrality (0.175) - this node is a cross-community bridge._
- **Why does `Plan: feat-focused-view-mobile (PR 3 of 3)` connect `Board Collapse & Focused View Mobile` to `Mobile API Client & Labels`, `Focused View Router`, `Mobile Focused/Day View Components`, `Frontend Boards API`?**
  _High betweenness centrality (0.163) - this node is a cross-community bridge._
- **Why does `Task` connect `Task Model & Service` to `High Priority Task Logic`, `Focused View Service (Backend)`, `Task Schema & Validation`, `Backend Tasks Router`, `Board Service (Backend)`, `Sync Router & Models`, `Sync Router Helpers`, `High Priority Limit Tests`, `Reports Service (Completions)`, `AI Beliefs & Cost Models`, `Backend App Bootstrap`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **Are the 37 inferred relationships involving `Task` (e.g. with `TestCreateBoard` and `TestDeleteBoard`) actually correct?**
  _`Task` has 37 INFERRED edges - model-reasoned connections that need verification._
- **Are the 29 inferred relationships involving `StateEnum` (e.g. with `TestDateWindow` and `TestGetDayViewTasks`) actually correct?**
  _`StateEnum` has 29 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `Board` (e.g. with `TestCreateBoard` and `TestDeleteBoard`) actually correct?**
  _`Board` has 20 INFERRED edges - model-reasoned connections that need verification._