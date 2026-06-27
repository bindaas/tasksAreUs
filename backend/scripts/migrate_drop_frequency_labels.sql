-- migrate_drop_frequency_labels.sql
-- Final step of the three-PR frequency label removal (PR #29 UI, PR #30 backend logic, this).
--
-- Run this BEFORE deploying the new Python code.
-- SQLAlchemy cannot deserialise category='frequency' rows once CategoryEnum.frequency
-- is removed from Python — run → verify → deploy.
--
-- Pre-flight: confirm actual enum type name (should be 'categoryenum'):
--   SELECT typname FROM pg_type WHERE typtype = 'e';
--
-- Pre-flight: confirm FK cascade exists on task_labels (the explicit DELETE below
-- handles it either way, but good to know):
--   \d task_labels

BEGIN;

-- 1. Null out beliefs referencing frequency labels (no ON DELETE CASCADE on this FK)
UPDATE beliefs
SET label_id = NULL
WHERE label_id IN (
    SELECT id FROM labels WHERE category = 'frequency'
);

-- 2a. Explicitly delete task_labels rows for frequency labels
--     (safety net in case the ON DELETE CASCADE was not created at the DB level)
DELETE FROM task_labels
WHERE label_id IN (
    SELECT id FROM labels WHERE category = 'frequency'
);

-- 2b. Delete all frequency labels
DELETE FROM labels WHERE category = 'frequency';

-- 3. Remove 'frequency' from the Postgres enum type.
--    If the type name below does not match, update it to match the output of
--    SELECT typname FROM pg_type WHERE typtype = 'e';
ALTER TYPE categoryenum RENAME TO categoryenum_old;
CREATE TYPE categoryenum AS ENUM ('mode', 'type');
ALTER TABLE labels
    ALTER COLUMN category TYPE categoryenum
    USING category::text::categoryenum;
DROP TYPE categoryenum_old;

-- 4. Drop recurrence_group_id column and its index.
--    IF EXISTS makes both statements safe to re-run.
DROP INDEX IF EXISTS ix_tasks_recurrence_group_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS recurrence_group_id;

COMMIT;

-- Post-migration verification:
--   SELECT count(*) FROM labels WHERE category = 'frequency';   -- must be 0
--   SELECT count(*) FROM task_labels tl
--     LEFT JOIN labels l ON l.id = tl.label_id
--     WHERE l.id IS NULL;                                        -- must be 0 (no orphans)
--   \d tasks                                                     -- recurrence_group_id must be absent
--   SELECT typname, enumlabel FROM pg_enum
--     JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
--     WHERE typname = 'categoryenum';                            -- must show only 'mode' and 'type'
