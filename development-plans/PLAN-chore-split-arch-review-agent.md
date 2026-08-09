# PLAN-chore-split-arch-review-agent

**Status:** Captured for later — not started. Originated from a `/usage` cost question (arch-review/"Doc" was 28% of subagent spend).

**Note:** this plan touches tooling config in the separate `claude-global-tools` repo (`~/projects/claude-global-tools/.claude/agents/` and `.claude/commands/`), not `tasksAreUs` application code. Filed here per project convention since that's where dev plans live.

## Scope

Split the `arch-review` agent ("Doc") into two chained agents so the judgment-heavy work stays on Sonnet and the mechanical execution work moves to Haiku, cutting cost without degrading review quality.

## Current state

`~/projects/claude-global-tools/.claude/agents/arch-review.md` (model: sonnet) does 9 steps in one flat agent context, invoked via `/full-review <PR>` or `/arch-review <PR>` (`~/projects/claude-global-tools/.claude/commands/`):

1. Read `ARCHITECTURE.MD`, `DATA_MODEL_AND_API.MD`, `RULES_OF_ENGAGEMENT.MD` in full
2. Fetch PR metadata + diff
3. Read every changed file in full
3.5. Optional graphify knowledge-graph queries
4. Audit both docs against the diff (covered/stale/missing/removed) — includes a "fix any staleness you spot, even unrelated to this PR" mandate (4d)
5. Architectural critique across 6 dimensions (API design, data model, back-compat, testability, security, performance)
6. Post one PR comment per critique concern
7. Update `ARCHITECTURE.MD`
8. Update `DATA_MODEL_AND_API.MD`
9. Post summary comment, commit + push both docs

Of the 5 review agents (code-review, test-review, plan-review, arch-review all on `sonnet`; requirements-review on `haiku`), arch-review is the only one that reads two full reference docs plus every changed file in full and rewrites two docs every run — hence its outsized share of spend.

## Proposed change

Split into two agents, following the same bundle-handoff pattern `/full-review` already uses between its four top-level reviewers:

- **`arch-audit`** (model: sonnet) — Steps 1–6. Does all the reading and judgment (doc audit, staleness scan, 6-dimension critique), posts critique comments as today, and instead of directly editing the docs, writes an exact, ready-to-apply edit spec to a handoff file (e.g. `$BUNDLE_DIR/doc-edits.json` or a markdown patch — exact insert/replace/remove text per doc, not abstract instructions).
- **`arch-write`** (model: haiku) — Steps 7–9. Reads the edit spec, applies it verbatim to `ARCHITECTURE.MD`/`DATA_MODEL_AND_API.MD` via the Edit tool, posts the summary comment (assembled from the spec + critique count), commits and pushes.

## Known tradeoffs / open questions

- **Savings are bounded.** Steps 1 and 3 (full doc + full changed-file reads) are the dominant token cost and must stay on Sonnet regardless, since Step 4/5 judgment needs that context. This split only moves Steps 7–9 to the cheaper rate — expect a modest cut, not proportional to "3 of 9 steps moved."
- **The handoff must be a literal patch, not a summary.** For arch-write to apply changes correctly on Haiku with no judgment of its own, `arch-audit`'s spec has to already contain the exact markdown to insert/replace — i.e. `arch-audit` is still effectively drafting the doc text, not just "deciding." Verify this doesn't just relocate cost rather than cut it (the draft text has to be generated somewhere, and generating precise technical prose may need Sonnet-quality output regardless of which agent applies it).
- **Alternative/complementary lever (higher leverage, discussed but not chosen yet):** gate whether arch-review runs at all — skip it in `/full-review` for PRs that don't touch backend/models/schema/routers (pure frontend-styling or doc-only PRs). Not mutually exclusive with this split; worth evaluating together when this is picked back up.
- Should confirm empirically (e.g. via `/usage` before/after) that Haiku reliably applies the literal edit spec without introducing formatting drift in the two docs, before trusting it unsupervised.

## Files to modify (when implemented)

- `~/projects/claude-global-tools/.claude/agents/arch-review.md` → split into `arch-audit.md` (sonnet) and `arch-write.md` (haiku)
- `~/projects/claude-global-tools/.claude/commands/full-review.md` — step 5 updated to spawn `arch-audit` then `arch-write` in sequence, passing the edit-spec handoff path
- `~/projects/claude-global-tools/.claude/commands/arch-review.md` — same two-stage spawn for standalone `/arch-review <PR>` invocations

## Test plan

Run `/arch-review` on a real merged PR before/after the split and diff the resulting `ARCHITECTURE.MD`/`DATA_MODEL_AND_API.MD` changes and critique comments against a pre-split baseline run, to confirm no quality regression. Check `/usage` to confirm the expected cost shift.

## Deployment order

N/A — tooling/config change only, no app code, no Railway deploy.
