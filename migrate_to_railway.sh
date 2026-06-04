#!/usr/bin/env bash
set -euo pipefail

LOCAL_URL="postgresql://postgres:postgres@localhost:5432/tasksareus"
RAILWAY_URL="postgresql://postgres:vutcOZXtrMlhjmIPbbNGvamdnLdGwwNJ@interchange.proxy.rlwy.net:38123/railway"

DUMP_FILE="/tmp/tasksareus_dump_$(date +%Y%m%d_%H%M%S).sql"

echo "==> Dumping local database..."
pg_dump --no-owner --no-acl "$LOCAL_URL" -f "$DUMP_FILE"
echo "    Dump written to $DUMP_FILE ($(wc -c < "$DUMP_FILE") bytes)"

echo "==> Wiping Railway schema..."
psql "$RAILWAY_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "==> Restoring to Railway..."
psql "$RAILWAY_URL" -f "$DUMP_FILE"

echo "==> Done. Removing dump file."
rm "$DUMP_FILE"
