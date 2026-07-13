#!/bin/bash

# Remove Mode Labels from Railway Database
# This script:
# 1. Deletes all mode labels and their associations
# 2. Removes 'mode' from the category ENUM type
#
# REQUIRES: A backup should be taken BEFORE running this script
# Usage: ./scripts/migrate-remove-mode-labels.sh

set -e

# DATABASE_URL is required (no default fallback for security)
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable not set"
    echo "Usage: DATABASE_URL=... ./scripts/migrate-remove-mode-labels.sh"
    exit 1
fi

DATABASE_URL="$DATABASE_URL"

echo "=========================================="
echo "Remove Mode Labels Migration"
echo "=========================================="
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql not found. Please install PostgreSQL client tools."
    exit 1
fi

# Show current state
echo "Current label distribution:"
psql "$DATABASE_URL" -c "
SELECT category, COUNT(*) as count
FROM labels
GROUP BY category
ORDER BY category;"

echo ""
echo "⚠️  WARNING: This will:"
echo "   - Delete all 44 mode labels"
echo "   - Remove 'mode' from the category ENUM type"
echo "   - This cannot be undone without restoring from backup"
echo ""

read -p "Have you taken a backup? (type 'yes' to confirm): " backup_confirmed

if [ "$backup_confirmed" != "yes" ]; then
    echo "Migration cancelled. Please run: ./scripts/backup-railway-db.sh"
    exit 0
fi

read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Migration cancelled."
    exit 0
fi

echo ""
echo "Pre-migration audit: verifying Mode labels have no task associations..."
MODE_TASK_COUNT=$(psql "$DATABASE_URL" -t -c "
SELECT COUNT(*) FROM task_labels tl
JOIN labels l ON tl.label_id = l.id
WHERE l.category = 'mode';")

if [ "$MODE_TASK_COUNT" -gt 0 ]; then
    echo "❌ Migration aborted: Found $MODE_TASK_COUNT task associations with Mode labels"
    echo "This should not happen (Mode labels are unused). Investigate before retrying."
    exit 1
fi

echo "✅ Audit passed: Mode labels have no task associations"
echo ""
echo "Starting migration..."
echo ""

# Execute migration SQL
psql "$DATABASE_URL" << 'EOF'
-- Begin transaction for atomic migration
BEGIN;

-- Step 1: Delete all mode labels (task_labels associations cascade automatically)
DELETE FROM labels WHERE category = 'mode';

-- Step 2: Remove 'mode' from the category enum type
ALTER TYPE category RENAME TO category_old;
CREATE TYPE category AS ENUM ('type');
ALTER TABLE labels ALTER COLUMN category TYPE category USING category::text::category;
DROP TYPE category_old;

-- Commit transaction
COMMIT;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "Verifying results:"
    psql "$DATABASE_URL" -c "
SELECT category, COUNT(*) as count
FROM labels
GROUP BY category
ORDER BY category;"

    echo ""
    echo "Mode labels have been removed from the database."
else
    echo ""
    echo "❌ Migration failed!"
    exit 1
fi
