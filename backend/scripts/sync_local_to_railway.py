"""
Fresh sync of all user data from local Postgres → Railway Postgres.
Does NOT touch the users or labels tables on Railway.

Steps:
  1. Show row counts on both sides for review
  2. Backup current Railway data for the user to timestamped tables
  3. Delete Railway data for the user (reverse FK order)
  4. Copy local data to Railway (FK order)

Run:
  LOCAL_DB_URL=postgresql://postgres:postgres@localhost:5432/tasksareus \\
  RAILWAY_DB_URL=postgresql://postgres:...@interchange.proxy.rlwy.net:38123/railway \\
  python3 scripts/sync_local_to_railway.py
"""
import os
import sys
from datetime import datetime

import psycopg2
import psycopg2.extras

USER_ID = "dcb45f1b-5dfe-4028-b2e4-4405d3ff5719"

LOCAL_DB_URL   = os.getenv("LOCAL_DB_URL",   "postgresql://postgres:postgres@localhost:5432/tasksareus")
RAILWAY_DB_URL = os.getenv("RAILWAY_DB_URL", "")

# Tables with user_id, in FK-safe insert order
USER_TABLES = ["tasks", "beliefs", "user_settings", "ai_cost_log"]


def count(cur, table, user_id):
    cur.execute(f"SELECT COUNT(*) FROM {table} WHERE user_id = %s", (user_id,))
    return cur.fetchone()[0]


def count_task_labels(cur, user_id):
    cur.execute(
        "SELECT COUNT(*) FROM task_labels tl JOIN tasks t ON tl.task_id = t.id WHERE t.user_id = %s",
        (user_id,),
    )
    return cur.fetchone()[0]


def fetch_all_as_dicts(cur, query, params=()):
    cur.execute(query, params)
    cols = [d[0] for d in cur.description]
    return cols, cur.fetchall()


def bulk_insert(cur, table, cols, rows):
    if not rows:
        return 0
    placeholders = ",".join(["%s"] * len(cols))
    col_list = ",".join(cols)
    psycopg2.extras.execute_values(
        cur,
        f"INSERT INTO {table} ({col_list}) VALUES %s",
        rows,
        template=f"({placeholders})",
    )
    return len(rows)


def main():
    if not RAILWAY_DB_URL:
        print("ERROR: set RAILWAY_DB_URL env var")
        sys.exit(1)

    local  = psycopg2.connect(LOCAL_DB_URL)
    rail   = psycopg2.connect(RAILWAY_DB_URL)
    rail.autocommit = False
    lc = local.cursor()
    rc = rail.cursor()

    # ── Row count preview ────────────────────────────────────────────────────
    print("=== Row counts ===")
    print(f"  {'table':20s}  {'LOCAL':>6}  {'RAILWAY':>7}")
    for t in USER_TABLES:
        lc.execute(f"SELECT COUNT(*) FROM {t} WHERE user_id = %s", (USER_ID,))
        rc.execute(f"SELECT COUNT(*) FROM {t} WHERE user_id = %s", (USER_ID,))
        print(f"  {t:20s}  {lc.fetchone()[0]:>6}  {rc.fetchone()[0]:>7}")
    print(f"  {'task_labels':20s}  {count_task_labels(lc, USER_ID):>6}  {count_task_labels(rc, USER_ID):>7}")

    confirm = input("\nProceed with backup + sync? [y/N] ").strip().lower()
    if confirm != "y":
        print("Aborted.")
        local.close(); rail.close()
        sys.exit(0)

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    # ── Backup Railway ───────────────────────────────────────────────────────
    print(f"\n=== Backing up Railway data (suffix _{ts}) ===")
    for t in USER_TABLES:
        rc.execute(
            f"CREATE TABLE {t}_backup_{ts} AS SELECT * FROM {t} WHERE user_id = %s",
            (USER_ID,),
        )
        print(f"  {t}_backup_{ts}")

    rc.execute(f"""
        CREATE TABLE task_labels_backup_{ts} AS
        SELECT tl.* FROM task_labels tl
        JOIN tasks t ON tl.task_id = t.id
        WHERE t.user_id = %s
    """, (USER_ID,))
    print(f"  task_labels_backup_{ts}")

    # ── Delete Railway data (reverse FK order) ───────────────────────────────
    print("\n=== Clearing Railway data for user ===")

    rc.execute(
        "DELETE FROM task_labels WHERE task_id IN (SELECT id FROM tasks WHERE user_id = %s)",
        (USER_ID,),
    )
    print(f"  task_labels deleted: {rc.rowcount}")

    for t in ["beliefs", "ai_cost_log", "user_settings", "tasks"]:
        rc.execute(f"DELETE FROM {t} WHERE user_id = %s", (USER_ID,))
        print(f"  {t} deleted: {rc.rowcount}")

    # ── Copy from local → Railway (FK order) ─────────────────────────────────
    print("\n=== Copying local → Railway ===")

    # tasks
    cols, rows = fetch_all_as_dicts(lc, "SELECT * FROM tasks WHERE user_id = %s", (USER_ID,))
    n = bulk_insert(rc, "tasks", cols, rows)
    print(f"  tasks inserted: {n}")

    # task_labels (join to get only this user's labels)
    cols, rows = fetch_all_as_dicts(lc, """
        SELECT tl.* FROM task_labels tl
        JOIN tasks t ON tl.task_id = t.id
        WHERE t.user_id = %s
    """, (USER_ID,))
    n = bulk_insert(rc, "task_labels", cols, rows)
    print(f"  task_labels inserted: {n}")

    # beliefs
    cols, rows = fetch_all_as_dicts(lc, "SELECT * FROM beliefs WHERE user_id = %s", (USER_ID,))
    n = bulk_insert(rc, "beliefs", cols, rows)
    print(f"  beliefs inserted: {n}")

    # user_settings
    cols, rows = fetch_all_as_dicts(lc, "SELECT * FROM user_settings WHERE user_id = %s", (USER_ID,))
    n = bulk_insert(rc, "user_settings", cols, rows)
    print(f"  user_settings inserted: {n}")

    # ai_cost_log
    cols, rows = fetch_all_as_dicts(lc, "SELECT * FROM ai_cost_log WHERE user_id = %s", (USER_ID,))
    n = bulk_insert(rc, "ai_cost_log", cols, rows)
    print(f"  ai_cost_log inserted: {n}")

    rail.commit()
    local.close()
    rail.close()

    print(f"""
=== Done ===
Railway is now in sync with local for user {USER_ID}.

Backup tables (drop when confirmed):
  DROP TABLE tasks_backup_{ts}, task_labels_backup_{ts}, beliefs_backup_{ts},
    user_settings_backup_{ts}, ai_cost_log_backup_{ts};
""")


if __name__ == "__main__":
    main()
