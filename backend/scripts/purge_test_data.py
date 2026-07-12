"""
Delete all data for every user EXCEPT the preserved user.
Run: DATABASE_URL=postgresql://... python3 scripts/purge_test_data.py
"""
import os
import sys

import psycopg2

KEEP_USER_ID = "1f991d09-3ecd-466e-8691-9072ac180609"
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/tasksareus")


def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute("SELECT id FROM users WHERE id != %s", (KEEP_USER_ID,))
    to_delete = [r[0] for r in cur.fetchall()]

    if not to_delete:
        print("No other users found — nothing to delete.")
        conn.close()
        return

    print(f"Users to delete: {to_delete}")
    confirm = input(f"Delete all data for {len(to_delete)} user(s)? [y/N] ").strip().lower()
    if confirm != "y":
        print("Aborted.")
        conn.close()
        return

    for uid in to_delete:
        cur.execute(
            "DELETE FROM task_labels WHERE task_id IN (SELECT id FROM tasks WHERE user_id = %s)",
            (uid,),
        )
        for table in ["ai_cost_log", "beliefs", "tasks", "user_settings"]:
            cur.execute(f"DELETE FROM {table} WHERE user_id = %s", (uid,))
        cur.execute("DELETE FROM users WHERE id = %s", (uid,))
        print(f"  Deleted user {uid}")

    conn.commit()
    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
