# PLAN: Modularize `test_api.py` and Reduce Sleepy's (test-review) Token Cost

**Branch:** `chore/modularize-test-suite`
**Status:** Planning phase

---

## Summary

`backend/tests/test_api.py` is a single 3,413-line script that Sleepy (the `/test-review` agent) must read in full and actually execute against a live Docker Postgres+API stack on every PR review. This plan restructures the suite to reduce that cost, without changing what it verifies. It does **not** attempt a full pytest migration in this pass — investigation below shows the current script has real cross-section state coupling that makes that a much larger, riskier project, addressed as a deferred Phase 3.

**Rationale (from conversation):** A recent plan-review (Sneezy) burned ~160K tokens largely on exhaustive full-file verification reads; test-review pays a similar or larger cost on `test_api.py` alone, plus real command-execution overhead (Docker, live HTTP calls, verbose stdout) that nothing else in the `/full-review` chain incurs. The two highest-leverage levers identified: (1) don't force a full linear read of one giant file, and (2) don't force a full-suite re-run with verbose per-assertion output on every fix/verify iteration.

---

## Current State (verified by direct inspection, not assumed)

- **Size:** 3,413 lines, one `main()` function (`test_api.py:97`–`3412`), invoked as `python3 tests/test_api.py` per `CLAUDE.md`'s Dev section (not a pytest-collected file — `backend/tests/unit/` is the only pytest-based suite in this repo).
- **Structure:** ~45 sequential sections marked by `# ── Section Name (PR #NN) ──` comments (e.g. Health, Auth, Boards, Labels, Task CRUD, High-priority rules, Soft delete, Beliefs, Reports, Settings, Sync, Focused View, Day View, Overdue View), each annotated with the PR that introduced it — this file doubles as a running regression log, not just a test suite.
- **Assertion style:** hand-rolled `assert_eq`/`assert_in`/`assert_true`/`assert_eq_xfail` helpers (`test_api.py:31-68`) that **do not raise** — they append to a module-level `_failures` list and keep executing, printing a colored ✓/✗ line per assertion. A final `── Summary ──` section (line 3399) reports pass/fail counts. This is a deliberate "run everything, report everything" design, not an accident.
- **State coupling is real and significant — confirmed, not assumed.** `default_board_id`, created once at `test_api.py:173` inside the Boards section, is still read directly at `test_api.py:2147` inside the Reports section — nearly 2,000 lines and ~15 sections later. `task_id` created at line 735 (Task CRUD) is likewise threaded forward into later sections. Every section shares one `httpx.Client` instance (authenticated once, near the top of `main()`) and a single `test_user_id`. **This means the file cannot be mechanically split into independent, arbitrarily-orderable test functions/files — sections have genuine forward data dependencies on earlier sections**, not just a shared-fixture-that-could-be-recreated-per-test pattern.
- **`cleanup()` (`test_api.py:70-94`)** does a raw `psycopg2` per-table `DELETE FROM ... WHERE user_id = %s` and runs both before `main()` starts and via `atexit` — it already carries a comment (lines 79-81) documenting the exact "table was dropped, deleting from it now crashes the suite" failure mode Sneezy flagged as a live blocker in the sibling beliefs-removal plan (`PLAN-chore-remove-beliefs-and-llm.md`).
- **Ownership constraint (critical for execution, not just design):** per `CLAUDE.md`, *"Never modify `backend/tests/test_api.py` — owned exclusively by the `/test-review` skill (Sleepy)."* I (Grumpy) am not permitted to edit this file under any circumstances the project's own rules currently allow. I searched for a locally-editable definition of the `test-review` skill/agent (to see if I could instead change *how* Sleepy reads/runs it) under both `~/.claude/skills/` and this repo's `.claude/`, and found neither — only `~/.claude/skills/graphify` and this project's `.claude/skills/run/SKILL.md` exist locally. The `test-review` (and `code-review`/`arch-review`/etc.) skills referenced in this project are not present as local files I can inspect or edit, which means **I cannot directly change Sleepy's review process, only the artifact she operates on** — and per the ownership rule above, not even that, without a scope decision from you (see Open Question below).

---

## Open Question — must be resolved before implementation

`test_api.py` is explicitly off-limits to me. This plan's own restructuring work (splitting the file, changing output verbosity) targets exactly that file. Three ways to resolve this, none of which I should pick unilaterally:

1. **One-time scope waiver:** you explicitly authorize me to do this specific restructuring as an infrastructure/tooling change (not a feature PR), on the reasoning that the ownership rule exists to prevent Grumpy from quietly weakening test coverage while implementing a feature, not to block a deliberate, reviewed refactor of the harness itself.
2. **Sleepy does the migration herself**, invoked specifically for this purpose rather than in her usual "review a PR" mode — untested territory, since her normal workflow is reactive (review diff → update tests → run → report), not "perform a large structural rewrite of your own owned file."
3. **You do it, or hand it to a separate mechanism** outside this session.

**Recommendation (revised per Sneezy's review below): option 2 — Sleepy performs the split herself.** `CLAUDE.md`'s ownership rule ("owned exclusively by the `/test-review` skill") has no stated exceptions. Option 1 (a Grumpy-executed scope waiver) relies on reading an exception into the rule's *intent* rather than following its *letter*; option 2 follows the rule as written, even though it's untested territory for Sleepy's usual reactive "review a diff, update tests" workflow rather than a large self-directed structural rewrite. This plan should be handed to Sleepy directly when picked back up, rather than implemented by Grumpy.

---

## Proposed Approach — phased, ordered by risk/effort vs. payoff

### Phase 1 (do first, near-zero risk, high ROI): Quiet-by-default output
Currently every single passing assertion prints a `✓` line. For hundreds of assertions across 3,413 lines, an all-green run still produces a large stdout block that lands fully in Sleepy's context on every execution. Change the quiet-mode rule to key off **whether the call appended to `_failures`**, not off the raw boolean condition — this one rule is correct for all four helpers without special-casing:
- `assert_eq`/`assert_in`/`assert_true`: appends to `_failures` only on mismatch → quiet mode prints only mismatches, exactly as intended.
- `assert_eq_xfail`: **polarity is inverted from the other three** — `actual == expected` is the XPASS case (line 62-65), which *is* appended to `_failures` and is the diagnostically important "a known bug appears silently fixed, remove this marker" alert; `actual != expected` is the normal XFAIL case, *not* appended, currently printed with a `PASS` glyph. Keying quiet mode off "was this appended to `_failures`" (rather than off the raw boolean, which is inverted for this helper) means XPASS still always prints and XFAIL goes quiet — correct by construction, no separate rule needed. *(This precision was added in response to Sneezy's review below — a naive "print only when the boolean is false" refactor would have gotten this helper backwards and silenced the exact signal it exists to surface.)*

Existing `── Section ──` headers are kept (cheap, useful for locating a failure) and the final Summary line is kept. A `VERBOSE=1` env var restores full per-assertion output for local debugging. This alone cuts the token cost of *every* test run — not just Sleepy's — for the common case where the suite is green, with no change to what's tested or how failures are reported.

### Phase 2 (moderate effort, moderate risk): Mechanical, behavior-preserving file split
Split `main()`'s 50 sections into per-domain files under a new `backend/tests/integration/` package, each exposing a `run(ctx)` function. A thin orchestrator (replacing today's `main()`) creates the shared `httpx.Client`/`test_user_id`/`default_board_id` once into a `ctx` object, then calls each module's `run(ctx)` **in the same order as today**, aggregating `_failures` exactly as now. This is explicitly **not** a pytest migration — execution order and shared state are preserved byte-for-byte in spirit, just relocated. Payoff: Sleepy (or anyone) can read and edit only the module relevant to a given PR's diff instead of the whole 3,413-line file, without touching the order-dependent state model that makes reordering risky.

**Revised module list (corrected per Sneezy's review — the original list left 4 of 50 sections with no home and let one module balloon):**
- `ctx.py` — owns Health and Auth (client setup, authentication) as part of context construction, not a standalone test module
- `test_boards.py`, `test_labels.py`, `test_high_priority.py`, `test_sync.py`, `test_focused_view.py`, `test_day_view.py`, `test_overdue_view.py`, `test_reports.py`, `test_settings.py` — as originally proposed
- `test_tasks.py` split further into `test_task_crud.py`, `test_task_scheduling.py` (dates/drag-drop/column ordering/due-date filters), and `test_task_lifecycle.py` (completion/recurring/reopen/soft delete) — the original single `test_tasks.py` would have absorbed ~17 of 50 sections (~900 lines), undercutting the "read only the relevant ~300-line module" pitch for anything touching task behavior
- **Beliefs section (`test_api.py:1997`) and "Conversations — removed" section (`test_api.py:2046`) are not assigned a module** — see the sequencing note below
- `test_api.py:2274` reads `task_id` set in `test_task_crud.py`'s territory from within what becomes `test_reports.py`, and `test_api.py:1984-1995` reads `rec_task_id` set in `test_task_lifecycle.py`'s territory from Soft Delete — both are handled the same way as `default_board_id`: passed forward via the shared `ctx` object, not recreated per-module.

**Sequencing dependency with `PLAN-chore-remove-beliefs-and-llm.md`:** that sibling plan requires Sleepy to remove the `── Beliefs ──` test block from `test_api.py` entirely (its Sleepy briefing). If beliefs-removal lands first, the Beliefs section simply won't exist by the time this Phase 2 split happens, resolving that section's "no assigned module" gap for free. **Recommendation: land the beliefs-removal PR before starting this plan's Phase 2**, to avoid doing the same section-placement work twice or conflicting edits to the same file. The trivial "Conversations — removed" section (a handful of 404-assertion lines) can fold into `ctx.py` as a one-off smoke check, or into whichever module ends up adjacent to it positionally — low stakes either way.

### Phase 3 (deferred, out of scope for this PR): True pytest migration
Converting to real `pytest` test functions with fixtures would additionally unlock selective execution (`pytest -k`) — the single biggest remaining cost lever, since Sleepy currently must re-run the *entire* suite on every fix/verify iteration regardless of what changed. This requires actually untangling the forward state dependencies found above (e.g., making the Reports section create its own board instead of reusing one from Boards, 2,000 lines earlier) — a materially larger, higher-risk effort that changes what each section implicitly depends on and could mask or introduce coverage gaps if done carelessly. Recommend treating this as its own future plan, attempted only after Phase 2 has proven stable across a few real PR cycles, and reviewed at Full tier given the correctness stakes.

---

## Scope of This Plan (Phases 1 + 2 only)

### In Scope
- Rewrite the four assert helpers for quiet-by-default output (Phase 1)
- Split `main()` into `backend/tests/integration/test_*.py` domain modules + a shared `ctx`/orchestrator, preserving exact current execution order and failure-aggregation behavior (Phase 2)
- Update `CLAUDE.md`'s Dev section invocation command and any docs referencing `test_api.py`'s location/structure (`ARCHITECTURE.MD` — flagged for Doc, not edited directly, per existing ownership convention)
- Update `RULES_OF_ENGAGEMENT.MD`'s test-ownership language if the Open Question above resolves toward option 1 (scope waiver) or a permanent location/ownership change

### Out of Scope
- Full pytest migration / selective test execution (Phase 3 — separate future plan)
- Any change to `backend/tests/unit/` — already pytest-based, already modular, not part of the cost problem being addressed
- Any change to actual product code, models, or API contracts — this is test-infrastructure-only
- Changing Sleepy's own review process/instructions — no locally-editable definition found (see Current State above)

---

## Files to Modify (pending resolution of the Open Question)

- `backend/tests/test_api.py` → deleted, replaced by `backend/tests/integration/` package (see Phase 2) — **blocked on Open Question**
- `backend/tests/integration/__init__.py`, `ctx.py`, `test_boards.py`, `test_labels.py`, `test_tasks.py`, `test_high_priority.py`, `test_sync.py`, `test_focused_view.py`, `test_day_view.py`, `test_overdue_view.py`, `test_reports.py`, `test_settings.py`, `run_all.py` (new orchestrator, replaces today's `if __name__ == "__main__":` entry point) — **blocked on Open Question**
- `CLAUDE.md` — update the Dev section's test invocation command (`python3 tests/test_api.py` → new orchestrator path)
- `RULES_OF_ENGAGEMENT.MD` — only if ownership language needs updating
- `README.md` — lines 25 and 50 both give the literal `python3 tests/test_api.py` command (local and Railway variants); both go stale the moment the file is replaced *(added per Sneezy's review)*
- `railway_migration.md` — references `test_api.py` by name at lines 76, 82, 88, 94, including a claim about how it creates the system test user *(added per Sneezy's review)*
- `.claude/settings.local.json` — ~9 pre-approved Bash permission patterns (lines 27, 71, 91, 126, 166, 189, 212, 223-224, 278) are keyed to the literal string `python3 tests/test_api.py` in various env-var/timeout/pipe combinations. None will match the new orchestrator invocation, so every future test run hits a fresh permission prompt until equivalent patterns are added. Not a correctness issue, but worth doing in the same PR so it isn't a mid-implementation surprise *(added per Sneezy's review)*

---

## Test Plan

No new test *behavior* — this plan's entire point is that the same assertions run, in the same order, against the same endpoints, just reorganized and quieter. Verification consists of:
1. Running the restructured suite against a local Docker stack and diffing the **sorted list of assertion labels** (not just the pass/fail count) against a run of the current `test_api.py` on the same seed data, before deleting the original — a count-only diff could pass by coincidence if two sections were mis-transcribed in offsetting ways. Running both old and new suites under `VERBOSE=1` and diffing line-for-line directly targets this. *(Strengthened per Sneezy's review — the original plan compared counts only.)*
2. Confirming the `VERBOSE=1` escape hatch reproduces today's full per-assertion output for local debugging.
3. Sleepy running a full `/test-review` pass on the restructured suite itself, since she owns it, before this is considered done.

---

## Deployment Order

**Single component, and low blast radius even within that component.** Per `CLAUDE.md`'s deploy-trigger rules, `backend/tests/` changes do not trigger a Railway deploy — this entire refactor is invisible to production. No staggered deployment concerns.

---

## Confidence & Risk Assessment

| Metric | Rating | Notes |
|--------|--------|-------|
| **Confidence in solution** | 4/5 for Phase 1 (mechanical, low-risk); 3/5 for Phase 2 (larger surface, but behavior-preserving by design) |
| **Regression risk** | 1/5 Phase 1 (output-only change); 3/5 Phase 2 (relocating ~3,400 lines risks transcription errors even with preserved order — needs a careful pass/fail-count diff against the original before cutover) |
| **Data model changes** | None |
| **Test changes needed** | This plan *is* the test change; see Test Plan above |
| **Deployment order** | Single component, no production impact |

---

## Success Criteria

- Phase 1: an all-green run of the suite produces materially less stdout than today, with `VERBOSE=1` available for full detail
- Phase 2: `backend/tests/integration/` modules exist, `test_api.py` is gone, pass/fail counts match the pre-refactor baseline exactly, and Sleepy can review/edit a single domain module without reading the other ~3,000 lines
- `CLAUDE.md`'s Dev section reflects the new invocation command
- No change in actual test coverage (verified by the before/after pass-count diff, not just "no errors")

---

## Notes for Reviewers

**Dopey (Code Review):** Verify the orchestrator preserves exact section execution order from today's `main()` — a reordering could surface latent cross-section state bugs that the current design accidentally masks.

**Sleepy (QE/Test Review):** This plan proposes changes to a file you exclusively own. Required: run the restructured suite yourself and confirm the pass/fail summary matches today's baseline before accepting the split as complete — this is not a change Grumpy can self-certify given the ownership boundary.

**Doc (Architecture Review):** `ARCHITECTURE.MD`'s references to `test_api.py`'s location and structure need updating to describe the new `backend/tests/integration/` package layout.

---

## Sneezy's Review — 2026-08-04

**Tier:** LIGHT — no proposed file falls under a model/schema/router/API-contract area, the plan declares no data model changes, and deployment is single-component with zero production impact. Confirmed on inspection: this is genuinely test-infrastructure-only (no `backend/app/` or `frontend/` files touched), so no escalation to FULL.

**Verdict:** Approved with concerns

### Issues

1. **[Risk] Phase 1's "print only failures" change has a real inversion trap in `assert_eq_xfail` that the plan does not mention.** `test_api.py:31-67` — `assert_eq`, `assert_in`, and `assert_true` all follow the same polarity: `actual == expected` → pass → quiet-able; mismatch → fail → must print. `assert_eq_xfail` (line 55-67) is inverted: `actual == expected` is the **XPASS** case (line 62-65) — a known bug appears fixed, it's appended to `_failures`, and it is the diagnostically important event that must always print. `actual != expected` is the **XFAIL** case (line 66-67) — the normal, expected, non-failure outcome, printed today with the `PASS` glyph. If Phase 1 is implemented by parameterizing a shared "print only when the boolean condition is False" helper across all four functions — the natural mechanical refactor the plan's wording invites — `assert_eq_xfail` gets it backwards: XFAIL (boring, expected) would print, and XPASS (the "a bug got silently fixed, come remove this marker" alert this mechanism exists to catch) would go silent. That would quietly defeat the one piece of this file's design built specifically to surface silent problems. The plan rates Phase 1 as "near-zero risk, mechanical" (line 41) and 1/5 regression risk (line 97); this specific function needs its own explicit quiet-mode rule (key off `_failures.append()`, not off the raw boolean), not the same treatment as the other three helpers.

2. **[Gap] Files-to-Modify list omits two files that hardcode the exact invocation being replaced.** `README.md:25` and `README.md:50` both give `... python3 tests/test_api.py` as the literal command to run the suite (local and Railway variants). `railway_migration.md:76,82,88,94` references `test_api.py` by name, including a claim about how the system test user gets created ("`test_api.py` creates the system test user... via `POST /users`"). Neither file appears in "Files to Modify" (plan lines 68-74), which lists only `CLAUDE.md` and conditionally `RULES_OF_ENGAGEMENT.MD`. Both would go stale the moment `test_api.py` is deleted and replaced by a new orchestrator entry point.

3. **[Gap] `.claude/settings.local.json` has ~9 pre-approved Bash permission patterns keyed to the literal string `python3 tests/test_api.py`** (lines 27, 71, 91, 126, 166, 189, 212, 223-224, 278 in that file), covering different env-var/timeout/pipe combinations. None of these will match a new orchestrator invocation path (`run_all.py` or similar per plan line 71). Not a correctness bug, but every future test run will hit a fresh permission prompt until someone re-adds equivalent patterns — worth a line in the plan's scope so it isn't discovered as a surprise mid-implementation.

4. **[Gap] Phase 2's proposed module list doesn't account for all 50 section headers, only the large domain ones.** Counted directly: `test_api.py` has 50 `# ── ... ──` section headers, not quite "~45" (plan line 18/44 — close enough, not itself an issue). But four sections have no home in the ten proposed files (`test_boards.py`, `test_labels.py`, `test_tasks.py`, `test_high_priority.py`, `test_sync.py`, `test_focused_view.py`, `test_day_view.py`, `test_overdue_view.py`, `test_reports.py`, `test_settings.py`): **Health** (`:101`), **Auth** (`:129`), **Beliefs** (`:1997`), and **Conversations — removed** (`:2046`). Health/Auth plausibly belong in `ctx.py`/the orchestrator setup, but the plan doesn't say so. Beliefs and Conversations-removed have no obvious module at all. Separately, `test_tasks.py` looks set to absorb ~17 of the 50 sections (Task CRUD, Links, notes semantics ×2, drag-drop, board scoping, move-between-boards, column ordering ×2, due-date filters, completion, recurring, reopen ×2, soft delete, target-date-only) spanning roughly 900 of the file's 3,413 lines — still a large win over one 3,413-line file, but the biggest of the ten by a wide margin, partially undercutting the "read only the ~300-line module relevant to your PR" pitch for anything touching core task behavior.

5. **[Nit]** Plan line 18 cites `main()` as `test_api.py:97–3412`. `main()`'s body actually ends at line 3409 (`sys.exit(1)`); line 3412 is the `if __name__ == "__main__":` guard that calls `main()`, not part of the function itself.

### Unverified assumptions

- **Confirmed, not just unverified:** the plan's claim (line 23) that no locally-editable `test-review`/Sleepy definition exists under `~/.claude/skills/` or this repo's `.claude/` — independently re-checked via `find`, no matches. The system's agent roster does define `test-review` (owns the integration test file, reviews PRs, runs tests) but it is not a local file the plan author (or I) can inspect/edit, consistent with the plan's finding.
- **Not independently checked (LIGHT tier skips `ARCHITECTURE.MD`):** the plan's claim that `ARCHITECTURE.MD` currently documents `test_api.py`'s location/structure and will need a Doc pass. Plausible given `CLAUDE.md`'s own pointer to that file, but not verified by this review.
- Whether Sleepy (the `test-review` agent) is actually capable of performing a large structural multi-file rewrite of her own owned file (Open Question, option 2) is genuinely unknown — the plan itself calls this "untested territory," which is an honest characterization rather than an unverified claim presented as fact.
- The state-coupling claims in "Current State" (lines 21-22) were verified and, if anything, *understated*: beyond the cited `default_board_id` (`:173`, read again as late as `:2979`) and `task_id` (`:735`, read as late as `:2274` in Reports), a third variable — `rec_task_id`, created in the Recurring-task section (~`:1796`) — is read again in the Soft Delete section (`:1984-1995`), ~190 lines and 2 sections later. The cross-section coupling is real, pervasive, and correctly identified as the reason Phase 3 (true pytest migration) is deferred.

### Suggestions

- Verify Phase 2 equivalence with more than a pass/fail **count** diff (Test Plan step 1, line 80). Two mis-transcribed sections could coincidentally produce matching counts while checking the wrong thing. Diff the actual sorted list of assertion labels (or run both old and new suites under `VERBOSE=1` and diff line-for-line) — this directly targets the "transcription errors" risk the plan itself flags at 3/5 for Phase 2 (line 97).
- On the Open Question: consider whether option 2 (Sleepy performs the split herself) is actually closer to the letter of the ownership rule ("owned exclusively by the `/test-review` skill... under no circumstances") than option 1 (a one-time waiver based on inferring the rule's *intent*). The plan's own recommendation (option 1) requires reading an exception into a rule written with no stated exceptions; that's a reasonable ask to put to the user, but worth flagging that it's an interpretive stretch, not a mechanical reading.
- Add README.md, railway_migration.md, and `.claude/settings.local.json` to the Files-to-Modify list (or an explicit "also touches" note) so the new invocation command is discoverable everywhere the old one was documented or pre-approved.

— *Sneezy*

---

## Response to Sneezy's Review — 2026-08-04

1. **[Risk] `assert_eq_xfail` polarity inversion** — **Addressed.** Phase 1's description now specifies the correct quiet-mode rule explicitly (key off `_failures.append()`, not the raw boolean), which is correct-by-construction for all four helpers including the inverted one. This was a real near-miss — the original wording ("print only failures") would have naturally been implemented as "print only when the boolean is false," which gets this specific helper backwards.
2. **[Gap] README.md / railway_migration.md hardcode the old invocation** — **Addressed.** Both added to Files to Modify.
3. **[Gap] `.claude/settings.local.json` permission patterns go stale** — **Addressed.** Added to Files to Modify with the specific line numbers Sneezy identified.
4. **[Gap] Module list left 4 sections unhomed and one module oversized** — **Addressed.** Phase 2 now explicitly assigns Health/Auth to `ctx.py`, splits `test_tasks.py` into three smaller modules, and calls out the two additional cross-section variables (`rec_task_id`, and `task_id`'s reuse in Reports) to be threaded through `ctx` alongside `default_board_id`. Beliefs and Conversations-removed are handled via a new sequencing note (below) rather than forced into a module.
5. **[Nit] `main()` line range** — Not corrected in the body text (cosmetic, low value to chase further); noted here for completeness.
6. **New: sequencing dependency with the beliefs-removal plan** — **Addressed.** Added an explicit recommendation to land `PLAN-chore-remove-beliefs-and-llm.md` before starting this plan's Phase 2, since that plan already tasks Sleepy with deleting the Beliefs test block from the same file this plan restructures — sequencing avoids duplicate work or conflicting edits.
7. **Suggestion: strengthen Phase 2 verification beyond a count diff** — **Addressed** in the Test Plan section (label-list diff / line-for-line `VERBOSE=1` diff instead of count-only).
8. **Suggestion: reconsider which Open Question option is actually closer to the rule's letter** — **Addressed — recommendation revised.** Sneezy's point stands: `CLAUDE.md`'s ownership rule has no stated exceptions, so option 1 (a Grumpy-executed scope waiver) was an interpretive reading of the rule's *intent*, while option 2 (Sleepy performs the split herself) follows its *letter*. Per user instruction, the Open Question section now recommends option 2 instead of option 1.

**Implementation status:** Not started. Plan is finalized and reviewed (Light tier, Approved with concerns — all concerns addressed above, recommendation updated to option 2). Per explicit user instruction, this is picked up in a later session — hand to Sleepy for execution rather than Grumpy.

— *Grumpy*
