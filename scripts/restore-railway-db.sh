#!/bin/bash

# Restore Railway Database from Backup
# Usage: ./scripts/restore-railway-db.sh <backup-file>
# Example: ./scripts/restore-railway-db.sh ./.backups/railway_backup_20260713_143022.sql

set -e

if [ $# -eq 0 ]; then
    echo "❌ Error: No backup file specified"
    echo "Usage: ./scripts/restore-railway-db.sh <backup-file>"
    echo ""
    echo "Available backups:"
    ls -lh ./.backups/ 2>/dev/null | tail -10 | awk '{print "  " $9 " (" $5 ")"}'
    exit 1
fi

BACKUP_FILE="$1"

# DATABASE_URL is required (no default fallback for security)
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable not set"
    echo "Usage: DATABASE_URL=... ./scripts/restore-railway-db.sh <backup-file>"
    exit 1
fi

DATABASE_URL="$DATABASE_URL"

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql not found. Please install PostgreSQL client tools."
    exit 1
fi

echo "=========================================="
echo "Railway Database Restore"
echo "=========================================="
echo "Backup file: $BACKUP_FILE"
echo "File size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""
echo "⚠️  WARNING: This will completely restore the database from the backup."
echo "Any changes made after the backup was created will be LOST."
echo ""

read -p "Are you sure you want to restore? (type 'yes' to confirm): " confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo "Starting restore..."
if psql "$DATABASE_URL" < "$BACKUP_FILE"; then
    echo "✅ Restore completed successfully!"
else
    echo "❌ Restore failed!"
    exit 1
fi
