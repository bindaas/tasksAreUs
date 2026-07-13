# Mode Label Removal — Database Migration Guide

This guide covers the database phase of removing Mode labels from tasksAreUs.

## Overview

**Current State (Railway Production):**
- 44 Mode labels across 11 users/boards
- 0 task associations (Mode labels are unused)
- 0 belief references
- **Safe to delete entirely**

**Removal Strategy:**
1. Take a full database backup
2. Delete all Mode labels from the database
3. Remove 'mode' from the PostgreSQL ENUM type
4. Verify removal
5. Deploy backend code changes
6. Deploy frontend + mobile code changes

---

## Step 1: Take a Database Backup

**Before doing anything, back up the entire database:**

```bash
./scripts/backup-railway-db.sh
```

This will:
- Create a `./.backups/` directory if it doesn't exist
- Generate a timestamped SQL dump: `railway_backup_YYYYMMDD_HHMMSS.sql`
- Display the backup file path and size

**Example output:**
```
==========================================
Railway Database Backup
==========================================
Backup directory: ./.backups
Backup file: ./.backups/railway_backup_20260713_143022.sql
Timestamp: 20260713_143022

Starting backup...
✅ Backup completed successfully!
   File: ./.backups/railway_backup_20260713_143022.sql
   Size: 2.5M

Recent backups:
  ./.backups/railway_backup_20260713_143022.sql (2.5M)
```

**Keep the backup file safe** — store it in version control or an external backup service.

---

## Step 2: Run the Migration

**Delete all Mode labels and update the schema:**

```bash
export DATABASE_URL="postgresql://postgres:vutcOZXtrMlhjmIPbbNGvamdnLdGwwNJ@interchange.proxy.rlwy.net:38123/railway"
./scripts/migrate-remove-mode-labels.sh
```

The script will:
1. Verify DATABASE_URL is set
2. Show the current label distribution
3. Run pre-migration audit (verify Mode labels have zero task associations)
4. Require confirmation that a backup was taken
5. Require final confirmation to proceed
6. Delete all 44 Mode labels (task_labels associations cascade automatically)
7. Remove 'mode' from the category ENUM type
8. Show the updated label distribution

**Example output:**
```
==========================================
Remove Mode Labels Migration
==========================================

Current label distribution:
 category | count 
----------+-------
 mode     |    44
 type     |   115
(2 rows)

⚠️  WARNING: This will:
   - Delete all 44 mode labels
   - Remove 'mode' from the category ENUM type
   - This cannot be undone without restoring from backup

Have you taken a backup? (type 'yes' to confirm): yes
Are you sure you want to continue? (type 'yes' to confirm): yes

Starting migration...

✅ Migration completed successfully!

Verifying results:
 category | count 
----------+-------
 type     |   115
(1 row)

Mode labels have been removed from the database.
```

---

## Step 3: Verify the Change

Query the database to confirm:

```bash
psql "$DATABASE_URL" -c "
SELECT category, COUNT(*) as count FROM labels GROUP BY category;
"
```

Expected result:
```
 category | count 
----------+-------
 type     |   115
```

---

## Step 4: Restore (If Needed)

If something goes wrong, restore from the backup:

```bash
./scripts/restore-railway-db.sh ./.backups/railway_backup_20260713_143022.sql
```

The script will:
1. Verify the backup file exists
2. Warn that all changes after the backup will be lost
3. Require confirmation (type 'yes')
4. Restore the entire database from the SQL dump

---

## Step 5: Code Deployment

After the database migration succeeds, deploy code changes in this order:

### 5a. Backend Deployment
Deploy the backend code with:
- Removed `mode` value from `CategoryEnum` in `models.py`
- Updated `LABEL_SEED` (mode entries removed)
- Updated label validation to only accept `"type"`
- Updated tests to remove Mode test cases

### 5b. Frontend + Mobile Deployment
After backend is live, deploy frontend and mobile with:
- Updated `LabelCategory` types (only `'type'`)
- Removed Mode label state and UI from Settings
- Removed Mode from form category orders
- Updated tests

---

## Rollback Plan

If you need to undo the migration:

1. **Stop all deployments** immediately
2. **Restore the database backup:**
   ```bash
   ./scripts/restore-railway-db.sh ./.backups/railway_backup_20260713_143022.sql
   ```
3. **Rollback code deployments** (revert to previous commits)
4. **Restart the services**

---

## Backup Retention

Keep backups for at least 30 days. List existing backups:

```bash
ls -lh ./.backups/
```

Clean up old backups manually (do not delete recent backups):

```bash
# Keep only the 5 most recent backups
ls -1t ./.backups/ | tail -n +6 | xargs -I {} rm ./.backups/{}
```

---

## Environment Setup

The scripts use the `DATABASE_URL` environment variable. Set it before running:

```bash
export DATABASE_URL="postgresql://postgres:vutcOZXtrMlhjmIPbbNGvamdnLdGwwNJ@interchange.proxy.rlwy.net:38123/railway"
```

Or pass it inline:

```bash
DATABASE_URL="..." ./scripts/backup-railway-db.sh
```

---

## Prerequisites

- PostgreSQL client tools installed (`pg_dump`, `psql`)
  - **macOS:** `brew install postgresql`
  - **Ubuntu:** `sudo apt-get install postgresql-client`
  - **Other:** https://www.postgresql.org/download/

- Database credentials (provided in DATABASE_URL)
- Network access to `interchange.proxy.rlwy.net:38123`

---

## Timeline

| Phase | Task | Duration | Notes |
|-------|------|----------|-------|
| 1 | Backup database | 5-10 min | `backup-railway-db.sh` |
| 2 | Run migration | 2-5 min | `migrate-remove-mode-labels.sh` |
| 3 | Verify in database | 2 min | Query check |
| 4 | Deploy backend | 5-10 min | Railway CI/CD |
| 5 | Deploy frontend+mobile | 5-10 min | Railway CI/CD |
| **Total** | | **~30 min** | (Most time is deployment waiting) |

---

## Support

If something goes wrong:
1. Check the error message and logs
2. Restore from the backup
3. Verify your database credentials are correct
4. Ensure `psql` and `pg_dump` are installed and in PATH
5. Check network connectivity to Railway

---

**This guide covers only the database phase. Code changes follow in separate PRs.**
