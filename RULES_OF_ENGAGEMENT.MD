# PREFERENCES.md — Global Collaboration Rules
<!-- Maintained by human only. Claude may edit this file only when explicitly instructed by the user in the current conversation. -->
<!-- GLOBAL: applies to all projects. Lives here temporarily; will move to ~/projects/_claude-global/ -->


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

## DATA MODEL DISCIPLINE

- Before implementing features that touch the database: Read PRODUCT_REQUIREMENTS_DOCUMENT.MD and verify table semantics match product intent.
- If a table's purpose is ambiguous, ask — don't assume. Semantic drift is expensive to fix after data exists.
- Schema changes use `ALTER TABLE` only. Never drop and recreate.

## TEST OWNERSHIP

- **Never modify `backend/tests/test_api.py`** — that file is owned exclusively by the `/test-review` skill. Do not add, edit, or delete anything in it, even when implementing a feature that clearly needs API test coverage.
- **Unit tests for frontend and backend are always required** — when adding or changing business logic, write or update unit tests alongside the implementation. No exceptions.
  - Backend unit tests: `backend/tests/unit/` using pytest (no DB required — mock SQLAlchemy sessions with `unittest.mock.MagicMock`)
  - Frontend unit tests: `frontend/src/__tests__/` using Vitest; pure utility functions in `frontend/src/utils/` are the primary target

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

## SESSION MANAGEMENT

- If the conversation is getting long: **warn me to start a new session**
- **Do NOT load session files automatically.** Only load them when the user triggers a skill.

---

## GIT & DESTRUCTIVE ACTIONS

- **Never** commit secrets, credentials, or user-specific paths
- **Never** log or display credential values — confirm set/unset only
- **Always** use a feature or a bug fix branch and create a PR to be merged. The PR comments should have a functional description of teh feature or the bug
- **Always** end every PR body you create with a horizontal rule and signature: `— *Grumpy*`
- **`[skip deploy]` on non-backend commits**: Any commit that contains no backend changes must include `[skip deploy]` in the commit message to prevent a Railway deployment. This applies to mobile (`mobile/`), frontend (`frontend/`), Claude config (`.claude/`), docs, and test-only (`backend/tests/`) commits. Backend code lives in `backend/app/` — anything touching only that directory (or alongside it) does trigger a deploy.
- **`test_api.py` belongs on the feature branch**: Changes made to `backend/tests/test_api.py` (e.g. by Sleepy during a full-review) must be committed to the PR's feature branch and merged via the PR — never committed directly to main outside a PR.
- **Claude config changes belong on the feature branch**: Changes to `.claude/` files made as part of implementing a specific PR (new skills, agent tweaks, permission rules) must be committed to that PR's branch and merged with it. Cross-cutting process improvements unrelated to any specific PR may be committed directly to main.


