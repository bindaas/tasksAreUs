# tasksAreUs — Product Requirements

## Overview

tasksAreUs is a task management app, primarily designed for iPhone with secondary Android support. The conversational UI is the primary interface — users interact through natural language rather than traditional form-based inputs.

---

## Task Model

### Core Fields
- **Title**: short description of the task
- **Notes**: optional longer description
- **Must-do-by date**: hard deadline
- **Target date**: aspirational completion date (e.g. "I want to return library books by Friday, but they're due Sunday")
- **State**: Pending or Done

### Labels
A task can have zero or more labels in fixed system-defined categories. A task may have **multiple labels within the same category** (e.g. both `online` and `email` under Mode).

| Category | Values |
|---|---|
| Frequency | one-time, daily, weekly, monthly, annual |
| Mode | online, phone, outdoor, email |
| Type | household, financial, Raghav, trip |

Users cannot create or modify label categories or values.

### Task Lifecycle

**One-time tasks** (Frequency = one-time or no Frequency label):
- States: Pending → Done; no follow-on task created

**Recurring tasks** (Frequency = daily / weekly / monthly / annual):
- When marked Done, a new task is created for the next due date
- If missed (past due, not completed), no additional tasks are created — only **one pending instance** at a time
- Completion history is preserved so reports accurately show what was done and when

---

## AI Features

### Beliefs
The AI generates suggestions that users validate, following an RLHF-style feedback loop:
- **Suggested labels**: AI suggests which labels to apply given the task title/notes
- **Estimated time**: AI estimates how long the task will take

Users accept or reject each belief. Accepted beliefs carry more weight in future suggestions than pending or rejected ones.

### Conversational Interface
The primary interaction mode. Supported input styles:

1. **Journal-style entries** — freeform natural language:
   - "I need to return books to the library tomorrow" → creates a task with a due date
   - "I did laundry today" → finds the matching pending task and marks it Done
   - The AI determines whether to create or complete a task

2. **Questions** about the user's tasks:
   - "What tasks do I need to do this week?"
   - "What online tasks can I do in the next hour?"

3. Every response must include one or more **suggested follow-up questions** that the app can actually answer and that don't repeat what was just answered.

---

## Frontend

- React Native + Expo; iOS primary, Android secondary
- Expo Go for dev; EAS Build for prod

### Screens / Tabs

1. **Conversational UI** (primary tab) — main interface for all task interaction
2. **Task List** — browsable list of tasks, filterable by label
3. **Reports** — weekly view of completed tasks
4. **Settings** — define up to 5 starter questions shown in the Conversational UI; test backend connectivity

---

## Reports

Users can view a history of completed tasks (e.g. "what did I complete this week?"). Recurring task completions are individually recorded so history is accurate.

---

## Out of Scope (initial build)

- Authentication (Apple, Gmail) — data model placeholder only; no login required initially
- Custom label categories or values
- Trip as a separate entity (trip is a Type label value)
- Admin dashboard for cost tracking
