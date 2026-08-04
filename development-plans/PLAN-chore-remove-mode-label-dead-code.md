# PLAN-chore-remove-mode-label-dead-code

## Scope

Remove dead code left over from the `mode` and `frequency` label-category removals (`mode`: PR #51; `frequency`: three-PR effort, PRs #29-31). This is cleanup only — no live functionality changes.

## Background

The user asked to find and remove unused "type category" code left over from a prior UI refactor. Investigation (Explore agent, 2026-08-03) found the premise needed correction: `type` is not dead — it's the sole surviving `CategoryEnum` value, fully wired end-to-end, and is what the UI now labels "Tags." The actual dead code is leftover from removing the *other* two categories, `mode` and `frequency`:

- `backend/app/models.py:30-31` — `CategoryEnum` already has only `type` as a member; no model change needed here.
- `backend/app/main.py:214-233` — a startup migration block (`DELETE FROM labels WHERE category = 'mode'` + Postgres enum rebuild to drop `'mode'`) that ran once at PR #51's deploy and is now a permanent idempotent no-op on every subsequent boot.
- `mobile/src/utils/labelColors.ts:1-9` — `LABEL_BG`/`LABEL_TEXT` maps still define `mode` color entries, unreachable since `mobile/src/types/index.ts` narrows `category` to `'type'` only.
- `backend/scripts/migrate_drop_frequency_labels.sql` — a one-time manual script for the `frequency` removal; already executed (the Postgres enum has no `frequency` value left per `models.py`), not referenced by any automated path.

Not in scope: `PRODUCT_REQUIREMENTS_DOCUMENT.MD`'s stale mobile-UI prose describing `mode` as still-renderable (lines ~45, 100, 122, 128, 392, 434, 457, 476) — that file is owned by the `requirements-review` agent (Bashful); flag for a follow-up sweep rather than hand-edit here.

## Files to modify

1. `backend/app/main.py` — delete the mode-removal startup migration block (~lines 214-233, the `# ── Mode label removal migration ──` section).
2. `mobile/src/utils/labelColors.ts` — remove the `mode` keys from `LABEL_BG` and `LABEL_TEXT`.
3. `backend/scripts/migrate_drop_frequency_labels.sql` — delete outright (user confirmed: no archive needed).

## Data model changes

None. `CategoryEnum` already contains only `type`; no `ALTER TYPE` needed — the enum was already narrowed by the migration block being deleted (that migration already ran in production).

## API/contract changes

None. No schema, router, or Pydantic model touched.

## Test plan

- No existing test in `backend/tests/test_api.py` or `backend/tests/unit/` exercises the startup migration block directly — coverage only asserts the *resulting* state (`category=mode` → 400), which is unaffected by deleting the already-executed migration.
- After removing the `main.py` block: run the backend test suite locally to confirm the app still boots and all existing tests pass.
- `mobile/src/utils/labelColors.ts` has no test coverage of the `mode` keys (visual-only); manual smoke check that Tags still render with the existing purple color after the change.

## Deployment order

- Backend (`main.py`) and mobile (`labelColors.ts`) are independent components with independent deploys; the script deletion has no runtime/deploy impact (not imported or executed by any running process).
- No ordering dependency between backend and mobile changes — the backend block is already a no-op in production, and the mobile map entries are already unreachable, so either can ship first or independently with no backward-compat window needed.
- Mobile update type: **OTA** (`eas update`) — `labelColors.ts` is JS/TS only, no native/`app.json`/`eas.json` changes.

## Risk

Low — deleting confirmed-dead/no-op code, no schema or contract changes. Only residual risk: if some deployed environment has never rebooted since PR #51 merged, it could still hold `mode` rows in `labels`, and removing the migration block would leave those rows stranded (harmless — orphaned rows with a category the UI no longer reads, no FK/data-loss risk). Production has deployed many times since PR #51 (subsequent PRs #55, #60, #61, #62, #63, #64, #65 all shipped after), so this is treated as negligible.

---

## Sneezy's Review — 2026-08-03

**Tier:** FULL — per spawn instruction: the plan touches two independently-deployed components (backend `main.py` and mobile `labelColors.ts`), so "Deployment order ≠ single component" triggers Full tier under `RULES_OF_ENGAGEMENT.MD`'s tier-gate rule even though no model/schema/router file is in the file list and Data model changes = none.

**Verdict:** Changes required

### Issues

1. **[Blocker] The plan's central "no ALTER TYPE needed / already ran in production" claim is unverified and is contradicted by a real bug in the code being deleted.** `backend/app/main.py:223` checks `IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'category_enum')` (underscore) before doing the `ALTER TYPE`/rebuild. But `Label.category` is declared as `Column(Enum(CategoryEnum), ...)` in `backend/app/models.py:83` with no explicit `name=` argument, and SQLAlchemy's default naming for `Enum(CategoryEnum)` is the lowercased class name **with no underscore** — verified directly:
   ```
   >>> from sqlalchemy import Enum; import enum
   >>> class CategoryEnum(str, enum.Enum): type = 'type'
   >>> Enum(CategoryEnum).name
   'categoryenum'
   ```
   `category_enum` (main.py's check) never matches the real type name `categoryenum`, so the `DO $$ ... END $$` block's `ALTER TYPE`/`CREATE TYPE`/swap logic (lines 224-228) has in all likelihood **never executed, in any environment, ever** — only the standalone `DELETE FROM labels WHERE category = 'mode'` on line 219 (outside the `IF`, unaffected by the typo) has ever run. This directly undercuts the plan's "Data model changes: None ... the enum was already narrowed by the migration block being deleted (that migration already ran in production)" reasoning (line 26) — the enum-narrowing half of that migration was very likely never narrowed by this code path at all.

   This gets more concerning, not less, on inspection of `scripts/MODE_LABEL_REMOVAL.md` and `scripts/migrate-remove-mode-labels.sh` (found while checking whether some other path did the narrowing): these describe a **separate, manually-run** production migration for the mode removal — and that script guesses a **third, also-wrong** enum type name: `ALTER TYPE category RENAME TO category_old` (bare `category`, no suffix at all). If this script was in fact run against production as the doc describes, that `ALTER TYPE` statement would fail with "type category does not exist," and since the whole thing is one `BEGIN;...COMMIT;` block that also wraps the label `DELETE`, the failure would abort the transaction and roll back the delete too — i.e. it's plausible the manual script never succeeded either, and `mode` rows may still physically exist in `labels` in production today.

   Practical implication if `mode` rows do still exist: `routers/labels.py`'s `list_labels()` (the plain `GET /labels?board_id=...` path with no `category` filter — the normal label-picker call) does `db.query(Label).filter(...).all()` with no category filter and lets SQLAlchemy deserialize every row's `category` into `CategoryEnum`. Since `CategoryEnum` no longer has a `mode` member, a lingering `mode` row would raise a `LookupError` on ORM load — a 500, not "harmless orphaned rows" as the plan's Risk section (line 46) characterizes it.

   **Before deleting this block**, verify directly against production:
   ```sql
   SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'categoryenum';
   SELECT category, COUNT(*) FROM labels GROUP BY category;
   ```
   If `mode` shows up in either result, this plan needs a corrective one-time migration (using the *correct* type name, `categoryenum`) before the safety-net block is removed — deleting it first forecloses the only (if currently broken) automated path that ever attempts this cleanup.

2. **[Gap]** `main.py:216-217`'s own comment ("Idempotent — safely handles fresh databases... and existing databases where the type has both 'type' and 'mode'") shows the original PR #51 author *intended* this check to work on existing databases. That intent, combined with the confirmed name mismatch, makes this a genuine bug rather than an intentional no-op — the plan should not treat "that migration already ran in production" as settled fact (see Issue 1).

3. **[Gap]** The plan explicitly flags `PRODUCT_REQUIREMENTS_DOCUMENT.MD`'s stale mode-related prose as out-of-scope-but-flagged for Bashful (line 16), but doesn't extend the same treatment to `ARCHITECTURE.MD`, which documents `backend/scripts/migrate_drop_frequency_labels.sql` in its Code Structure section (`scripts/` listing) — deleting that file (Files to modify, item 3) leaves that doc entry pointing at a nonexistent file. Worth a one-line "flag for Doc" note alongside the existing PRD note, for consistency.

### Unverified assumptions

- **"That migration already ran in production" (main.py mode-removal block, line 26 and line 46).** Could not verify against the actual production database from this review. Static analysis of the code strongly suggests the `ALTER TYPE` half of this migration never ran successfully anywhere due to the `category_enum` vs. `categoryenum` typo (see Issue 1) — the claim as stated is more likely false than true.
- **"Production has deployed many times since PR #51 ... so this is treated as negligible" (line 46).** This reboot-count argument doesn't actually bear on the risk: the migration block fails its own `IF EXISTS` check identically on every single boot regardless of how many times it has run, so redeploy count provides no additional assurance. The real question is whether `mode` rows exist right now, which requires a direct query, not an inference from deploy count.
- **Whether `scripts/migrate-remove-mode-labels.sh` was ever actually executed against production, and whether it succeeded.** `scripts/MODE_LABEL_REMOVAL.md`'s "Example output" block reads as illustrative documentation, not a captured transcript of an actual run — and the script's own type-name guess (`category`) is also wrong per the same SQLAlchemy-naming check in Issue 1. Not verifiable from the codebase alone.
- **"if some deployed environment has never rebooted since PR #51 merged, it could still hold mode rows... harmless" (line 46).** As explained in Issue 1, if `mode` rows exist, this is not obviously harmless — it's a plausible live 500 on the unfiltered `GET /labels` path. This should be downgraded from "harmless" to "needs verification" pending the production query above.

### Suggestions

- Run the two verification queries in Issue 1 against production before implementing this plan. If `mode` rows or enum members are found, add a corrective one-time migration (with the correct `categoryenum` type name) as a preliminary step, let it run and be confirmed clean, and only then delete the now-truly-dead safety-net block — rather than deleting a migration that may never have completed its job.
- Regardless of the outcome, consider filing a short follow-up note about the `category_enum`/`categoryenum`/`category` three-way naming mismatch across `main.py`, `migrate-remove-mode-labels.sh`, and `migrate_drop_frequency_labels.sql` — it's a real latent defect independent of this cleanup PR, and worth Doc/Grumpy knowing about even if not fixed here.
- Add the same "flag for follow-up sweep" note for `ARCHITECTURE.MD` (Doc) that the plan already gives `PRODUCT_REQUIREMENTS_DOCUMENT.MD` (Bashful), covering the soon-to-be-stale `migrate_drop_frequency_labels.sql` doc reference.
- Everything else in the plan checked out on inspection: the `main.py:214-233` line range is exactly correct (block runs from the `# ── Mode label removal migration ──` comment through the `logger.info(...)` call, followed by a blank line before the next migration section); `mobile/src/utils/labelColors.ts`'s `mode` keys are confirmed unreachable (`mobile/src/types/index.ts:14,18` types `category`/`LabelCategory` as `'type'` only, and a sibling component, `mobile/src/components/TaskQuickEdit.tsx:9-10`, already has its own local `LABEL_BG`/`LABEL_TEXT` scoped to `type` only — evidence this cleanup was already done once elsewhere and simply missed in `labelColors.ts`); no other `mode`-category references exist anywhere in `backend/app`, `frontend/src`, or `mobile/src` outside the files the plan already lists; `backend/tests/test_api.py` and all `backend/tests/unit/*` files were checked and confirmed to only assert the *resulting* 400/absent-category behavior, never the migration block itself, matching the plan's Test plan claim; the web frontend's equivalent (`frontend/src/components/LabelBadge.tsx`) was independently confirmed already `type`-only with no dead code, consistent with the plan's decision not to touch web.

— *Sneezy*

---

## Grumpy's response — 2026-08-03

Ran Sneezy's two verification queries directly against production (`DATABASE_URL` supplied by user, not persisted to any file):

```sql
SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'categoryenum';
-- mode, type

SELECT category, COUNT(*) FROM labels GROUP BY category;
-- type | 129   (zero mode rows)
```

**Issue 1 (Blocker) — addressed.** Confirmed: `categoryenum` still carries `mode` as an unused Postgres-level enum member (the `ALTER TYPE` rebuild in `main.py` never ran, exactly as Sneezy's static analysis predicted — the `category_enum` vs `categoryenum` name mismatch is real). However, `labels` has **zero** `mode` rows in production — the unconditional `DELETE FROM labels WHERE category = 'mode'` (outside the broken `IF EXISTS` check) already did its job on a prior boot. So the specific live risk Sneezy raised — a lingering `mode` row triggering `LookupError`/500 on the unfiltered `GET /labels` path — does not apply; there's no data to strand. Plan proceeds as originally scoped: delete the `main.py` block. The residual DB-level cruft (enum type still permitting an unused `mode` value) is a separate, out-of-scope corrective migration (fixing the `category_enum`/`categoryenum` typo) — not required for this cleanup and not being done here, to keep scope minimal.

**Gap 2 — addressed.** Risk section's "already ran in production" framing was imprecise (conflated the DELETE, which ran, with the ALTER TYPE, which didn't) — corrected by the verification above; the plan's outcome is unchanged but the reasoning is now accurate rather than assumed.

**Gap 3 — addressed.** Adding `ARCHITECTURE.MD` to the follow-up-flag list alongside `PRODUCT_REQUIREMENTS_DOCUMENT.MD`: after implementation, both `arch-review` (Doc) and `requirements-review` (Bashful) should be flagged — Doc for the stale `scripts/` listing referencing the deleted `migrate_drop_frequency_labels.sql`, Bashful for the stale mobile-`mode` prose.

**Suggestion — latent typo defect.** Noting for the record (not fixing in this PR): `main.py` checks `category_enum`, `scripts/migrate-remove-mode-labels.sh` checks/renames `category` (no suffix), and the real Postgres type name (SQLAlchemy default for `Column(Enum(CategoryEnum))` with no explicit `name=`) is `categoryenum`. All three disagree. Worth a future one-off ticket to fix the naming and run a real corrective migration to strip `mode` from the enum type — orthogonal to this cleanup.

Proceeding with implementation as scoped: `main.py` migration block, `mobile/src/utils/labelColors.ts` mode entries, and `backend/scripts/migrate_drop_frequency_labels.sql` deletion.
