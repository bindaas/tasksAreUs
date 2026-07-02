# PREFERENCES.md — Global Collaboration Rules
<!-- Maintained by human only. Claude may edit this file only when explicitly instructed by the user in the current conversation. -->
<!-- GLOBAL: applies to all projects. Lives here temporarily; will move to ~/projects/claude-global-tools/ -->


---

## ENGINEERING ENGAGEMENT STYLE

- **Before any code:** restate the requirement, flag risks/gaps/alternatives, recommend a direction with key tradeoffs, and wait for confirmation. For files likely to exceed ~80 lines, also state assumptions about behaviour and interactions. Required on **all code changes** — feature requests, bug fixes, and refactors alike. No exceptions for "obvious" or "trivial" fixes.
- **Mandatory stop before any code change:** After presenting the pre-implementation checklist, end the message with "Shall I proceed?" and make no further tool calls — no `Edit`, `Write`, or code-producing `Bash` commands — until the user explicitly approves. A user asking a clarifying question is not approval. "Yes", "go ahead", "do it", or equivalent affirmative phrasing is required.
- **Default assumption is planning, not implementation:** Treat every request as a planning request unless explicit approval to implement has been given in the current conversation. Do not attempt to classify the user's intent from phrasing — the burden of triggering implementation is on an explicit approval, not on correctly reading the request.
- **Edge cases:** surface them proactively. Ask only if genuinely ambiguous.
- **Multiple requirements:** present a sequenced development plan first, factoring in token cost (shared context, file reads, round-trips) alongside standard practice. State the reasoning.
- **Data model first:** design DB/schema changes in prose and confirm before writing code.
- **Contract changes:** explicitly call out any API or interface changes before proceeding.
- **Staggered deployment:** whenever multiple components are involved, assume they deploy independently — backward compatibility is required unless explicitly waived.
- **Deployment plan:** whenever changes span multiple components (e.g. backend + mobile, API + frontend), present a deployment order with dependency reasoning before writing code. State which order is safe, what the backward-compat window looks like between deploys, and any rollback risk.
- **Pre-implementation checklist** (state before writing code — mandatory for every code change, regardless of perceived simplicity):
  - Confidence in solution: X/5
  - Regression risk: X/5
  - Data model changes: list or "none"
  - Test changes needed: list or "none"
  - Deployment order: component sequence + safe window or "single component"
  - Mobile update type: **OTA** (`eas update`) if changes are JS/TS only — or **Full rebuild** (`eas build`) if native modules, `app.json`, or `eas.json` change. Omit if no mobile files touched.

---

## DEVELOPMENT PLAN LIFECYCLE

Every non-trivial feature or bug fix follows this four-step sequence before any code is written:

1. **Write the plan file.** Once Grumpy has presented the plan verbally (per ENGINEERING ENGAGEMENT STYLE), he writes it to `development-plans/PLAN-<git-branch-name>.md` — where `<git-branch-name>` is the exact branch that will be created for the work (e.g. `PLAN-feat-add-reminders.md`). The file must contain enough context for an independent agent to review it: scope, data model changes, API changes, files to modify, test plan, and deployment order.

2. **Run Sneezy.** Grumpy spawns the `plan-review` agent (Sneezy) on the plan file. Sneezy appends a structured critique — Verdict / Issues / Unverified assumptions / Suggestions — directly to the bottom of the file. Grumpy does not proceed until Sneezy finishes.

3. **Present and wait.** Grumpy surfaces Sneezy's findings to the user, states the pre-implementation checklist (as defined in ENGINEERING ENGAGEMENT STYLE above), and ends with "Shall I proceed?" No implementation begins until the user explicitly approves.

4. **Address the critique, then implement.** On receiving approval, Grumpy updates the plan file with an inline response to every item Sneezy raised — noting whether it was addressed and, if not, why. Implementation begins only after the plan file is updated. The plan file must be included in the PR.

---

## DATA MODEL DISCIPLINE

- Before implementing features that touch the database: Read PRODUCT_REQUIREMENTS_DOCUMENT.MD and verify table semantics match product intent.
- If a table's purpose is ambiguous, ask — don't assume. Semantic drift is expensive to fix after data exists.
- Schema changes use `ALTER TABLE` only. Never drop and recreate.

## TEST OWNERSHIP

- **The integration test file is owned exclusively by the `/test-review` skill** — do not modify it directly. Its location is documented in `ARCHITECTURE.MD`.
- **Unit tests are always required** when adding or changing business logic — write or update them alongside the implementation. Paths and frameworks are documented in `ARCHITECTURE.MD`.

---

## TOOL USAGE

- **Never use `find`, `ls`, or `grep` as Bash commands** to explore files. Use `Glob` for file listing and `Grep` tool for content search. `find` returns `.git/objects/` noise and wastes tokens.

---

## FILE READING DISCIPLINE

- Use `head` on large files to check structure before reading fully
- For "where is X configured?" — reason about it first, read at most 1–2 candidates
- Never read frontend/UI files to answer backend/config questions
- **Bug fix verification:** grep for the specific symbol or pattern first — only full-read the file if the grep is ambiguous or returns nothing
- **Candidate files in a directory:** read the first 10–15 lines (file header / docstring) to confirm relevance before pulling the full file

---

## AGENT & SKILL NEUTRALITY

Agents (`.claude/agents/`) and commands (`.claude/commands/`) must be project-neutral so they can be shared across projects without modification.

**Rules:**
- Do not hardcode project-specific file paths (e.g. `backend/tests/test_api.py`, `backend/app/`). Reference `ARCHITECTURE.MD` or `CLAUDE.md` for project-specific paths.
- Do not hardcode database URLs, connection strings, or environment variables. Reference `ARCHITECTURE.MD` or `CLAUDE.md` for the correct test run command.
- Do not hardcode project names in agent body text. Use "this project" instead.
- Do not hardcode domain-specific rules (e.g. recurring task rules, specific table names). Reference `DATA_MODEL_AND_API.MD` for domain invariants at runtime.
- Do not hardcode auth patterns (e.g. specific header names or function names). Reference `ARCHITECTURE.MD` for the auth pattern.
- Document names that are uniform across projects (`ARCHITECTURE.MD`, `DATA_MODEL_AND_API.MD`, `PRODUCT_REQUIREMENTS_DOCUMENT.MD`, `RULES_OF_ENGAGEMENT.MD`) are explicitly allowed in agents and commands.
- Agent signatures (Dopey, Sleepy, Bashful, Doc, Grumpy) are uniform across projects and are explicitly allowed.

**Neutrality test:** before adding or modifying an agent or command, ask: would this work unmodified in a different project that follows the same document conventions? If not, remove the project-specific reference.

---

## SESSION MANAGEMENT

- If the conversation is getting long: **warn me to start a new session**
- **Do NOT load session files automatically.** Only load them when the user triggers a skill.

---

## GIT & DESTRUCTIVE ACTIONS

- **Never** commit secrets, credentials, or user-specific paths
- **Never** log or display credential values — confirm set/unset only
- **Always** use a feature or a bug fix branch and create a PR to be merged. The PR comments should have a functional description of the feature or the bug
- **CI/CD deploy tagging**: consult `CLAUDE.md` for which commit paths trigger a deployment and what tag to include to skip it.
- **The integration test file belongs on the feature branch**: changes made by Sleepy during a full-review must be committed to the PR branch and merged via PR — never committed directly to main.
- **Claude config changes belong on the feature branch**: Changes to `.claude/` files made as part of implementing a specific PR (new skills, agent tweaks, permission rules) must be committed to that PR's branch and merged with it. Cross-cutting process improvements unrelated to any specific PR may be committed directly to main.
