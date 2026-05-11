# tasksAreUs — Requirements v2

## Overview

tasksAreUs is a task management app, primarily designed for iPhone with secondary Android support. The conversational UI is the primary interface — users interact with the app primarily through natural language rather than traditional form-based inputs.

---

## Task Model

### Core Fields
- **Title**: short description of the task
- **Notes**: optional longer description
- **Must-do-by date**: hard deadline
- **Target date**: aspirational completion date (e.g. "I want to return library books by Friday, but they're due Sunday")
- **State**: Pending or Done
- **Created at**, **Updated at**: timestamps used for sync conflict resolution

### Labels
A task can have zero or more labels. Labels are organized into fixed categories. A task may have **multiple labels within the same category** (e.g. a task can be both "online" and "email" under Mode; both "household" and "trip" under Type).

**Fixed label categories and their values:**

| Category | Values |
|---|---|
| Frequency | one-time, daily, weekly, monthly, annual |
| Mode | online, phone, outdoor, email |
| Type | household, financial, Raghav, trip |

Label categories and values are **system-defined** — users cannot create new ones.

### Task States and Lifecycle

**One-time tasks** (no Frequency label, or Frequency = one-time):
- States: Pending → Done
- Once marked Done, no new task is created

**Recurring tasks** (Frequency = daily / weekly / monthly / annual):
- When marked Done, a new task is automatically created for the next due date
- If a task is **missed** (past its due date and not completed), no additional tasks are created — there is still only **one pending instance** at a time
- Completion history is preserved so that reports can show what was done and when

---

## AI Intelligence

### Beliefs System
The AI generates "beliefs" — suggestions that the user validates. This follows an RLHF-style feedback loop:
- **Suggested labels**: given a task title/description, the AI suggests which labels to apply
- **Estimated time to complete**: AI estimates how long the task will take

Users can **accept** or **reject** each belief. Validated (accepted) beliefs carry more weight than unvalidated ones in future suggestions.

### Conversational Interface
The conversational UI is the **primary** way users interact with the app.

**Supported input styles:**

1. **Journal-style entries** — freeform natural language:
   - "I need to return books to the library tomorrow" → creates a new task with a due date
   - "I did laundry today" → finds the matching pending task and marks it Done
   - The AI determines whether to create a new task or mark an existing one complete

2. **Questions** — the user can ask about their tasks:
   - "What tasks do I need to do this week?"
   - "What online tasks do I need to do today?"
   - "I have one hour this evening — what online tasks can I do?"

3. **Every response** must include one or more **suggested follow-up questions**:
   - Must be questions the app has the ability to answer
   - Must not repeat something already answered in the current response

---

## Architecture

### Offline-First
- The app is fully functional without a network connection
- All data is stored locally on the device (SQLite)
- When the device comes online, local data is synced to the backend
- **Conflict resolution**: last-write-wins based on `updated_at` timestamp

### Multi-Tenancy
- Every data record includes a `user_id` from day one
- The system is designed to support multiple users (tenants) with complete data isolation
- Authentication is **not** in scope for the initial build, but the data model and API must accommodate it

### Identity (initial)
- On first launch, the app generates a **UUID** and uses it as the `user_id`
- No login required initially
- Future: Apple Sign-In, Gmail Sign-In, unauthenticated (guest) mode

---

## Backend

- **Language**: Python
- **Framework**: FastAPI
- **Datastore**: PostgreSQL
- **Deployment**: Docker (dev), Railway (prod)

### API Design
- RESTful API
- All endpoints are tenant-scoped via `user_id`
- API is designed so authentication can be layered on later without breaking changes

### Cost Tracking
- Every Claude API call is logged to the database with:
  - `user_id`
  - Feature name (e.g. "label_suggestion", "conversational_query", "time_estimate")
  - Token count (input + output)
  - Estimated cost
- Not exposed in the UI — queryable directly from the database

---

## Frontend

- **Framework**: React Native + Expo
- **Platform**: iOS (primary), Android (secondary)
- **Dev**: Expo Go
- **Prod**: EAS Build

### Screens / Tabs

1. **Conversational UI** (primary tab) — the main interface for all task interaction
2. **Task List** — browsable list of tasks, filterable by label
3. **Reports** — weekly view of completed tasks
4. **Settings**
   - Define 5 starter questions shown in the Conversational UI
   - Test backend connectivity

---

## Reports

- Users can view a history of completed tasks (e.g. "what did I do this week?")
- Recurring task completions are individually recorded so the history is accurate

---

## Dev / Prod Configuration

| Setting | Dev | Prod |
|---|---|---|
| Mobile runtime | Expo Go | EAS Build |
| Backend | Docker on laptop | Railway |
| Anthropic API key | Dev key | Prod key |

---

## Testing

### API Test Script (Python)
- A standalone Python script that exercises the full API layer
- Creates its own test data during the run
- **Deletes all created data** at the end of the run
- Covers: task CRUD, label assignment, state transitions, recurring task logic, conversational endpoints

### Unit Tests
- Backend: unit tests for all business logic (task lifecycle, recurring rules, belief weighting)
- Frontend: unit tests for key components and logic

---

## Out of Scope (for initial build)

- Authentication (Apple, Gmail) — data model placeholder only
- Custom label categories / values
- Trip as a separate entity (trip is a Type label value)
- Admin dashboard for cost tracking
