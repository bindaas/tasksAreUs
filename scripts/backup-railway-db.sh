#!/bin/bash

# Backup Railway Database
# Usage: ./scripts/backup-railway-db.sh [backup-dir]
# Default backup-dir: ./backups

set -e

# DATABASE_URL is required (no default fallback for security)
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable not set"
    echo "Usage: DATABASE_URL=... ./scripts/backup-railway-db.sh"
    exit 1
fi

BACKUP_DIR="${1:-./.backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/railway_backup_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "=========================================="
echo "Railway Database Backup"
echo "=========================================="
echo "Backup directory: $BACKUP_DIR"
echo "Backup file: $BACKUP_FILE"
echo "Timestamp: $TIMESTAMP"
echo ""

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo "❌ Error: pg_dump not found. Please install PostgreSQL client tools."
    echo "   On macOS: brew install postgresql"
    echo "   On Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

# Perform backup
echo "Starting backup..."
if pg_dump "$DATABASE_URL" > "$BACKUP_FILE"; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup completed successfully!"
    echo "   File: $BACKUP_FILE"
    echo "   Size: $FILE_SIZE"
    echo ""
    echo "To restore this backup:"
    echo "  psql \"\$DATABASE_URL\" < $BACKUP_FILE"
    echo ""
else
    echo "❌ Backup failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# List recent backups
echo "Recent backups:"
ls -lhS "$BACKUP_DIR" | tail -5 | awk '{print "  " $9 " (" $5 ")"}'
