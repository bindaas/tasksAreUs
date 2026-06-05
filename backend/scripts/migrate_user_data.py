"""
Strategy 1 migration — update the pointer, not the data.

Deletes the stub user row created on Google sign-in, then links the
existing user row (which holds all the data) to the Google Firebase UID.
No child table rows are touched.

Run: DATABASE_URL=postgresql://... python3 scripts/migrate_user_data.py
"""
import os
import sys
from datetime import datetime

import psycopg2

# User that has all the task data (legacy device-uuid user)
OLD_USER_ID   = "dcb45f1b-5dfe-4028-b2e4-4405d3ff5719"

# Stub row auto-created when Rajiv signed in with Google — will be deleted
STUB_USER_ID  = "8f96760d-97d7-4534-a44a-dc2d7ce7d2eb"
FIREBASE_UID  = "OrjqfaDqZthrjDUkgOvd78qco8Z2"
EMAIL         = "rajiv.narula@gmail.com"
DISPLAY_NAME  = "Rajiv Narula"

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/tasksareus")


def main():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    # Verify both rows exist
    cur.execute("SELECT id, device_uuid, firebase_uid, email FROM users WHERE id = %s", (OLD_USER_ID,))
    old_user = cur.fetchone()
    if not old_user:
        print(f"ERROR: OLD user {OLD_USER_ID} not found.")
        sys.exit(1)

    cur.execute("SELECT id, device_uuid, firebase_uid, email FROM users WHERE id = %s", (STUB_USER_ID,))
    stub_user = cur.fetchone()
    if not stub_user:
        print(f"ERROR: Stub user {STUB_USER_ID} not found.")
        sys.exit(1)

    print("=== Current state ===")
    print(f"  OLD (keep)   id={old_user[0]}  device_uuid={old_user[1]}  firebase_uid={old_user[2]}  email={old_user[3]}")
    print(f"  STUB (delete) id={stub_user[0]}  device_uuid={stub_user[1]}  firebase_uid={stub_user[2]}  email={stub_user[3]}")

    # Show that no child data lives under the stub
    for table in ["tasks", "beliefs", "conversations", "messages", "user_settings", "ai_cost_log"]:
        cur.execute(f"SELECT COUNT(*) FROM {table} WHERE user_id = %s", (STUB_USER_ID,))
        cnt = cur.fetchone()[0]
        if cnt:
            print(f"  WARNING: {table} has {cnt} rows under stub user — investigate before proceeding")

    print("\n=== Plan ===")
    print(f"  1. Backup users table → users_backup_<ts>")
    print(f"  2. DELETE stub user row ({STUB_USER_ID})")
    print(f"  3. UPDATE old user: set firebase_uid='{FIREBASE_UID}', email='{EMAIL}', display_name='{DISPLAY_NAME}'")
    print(f"  No child tables are touched.")

    confirm = input("\nProceed? [y/N] ").strip().lower()
    if confirm != "y":
        print("Aborted.")
        conn.close()
        sys.exit(0)

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    cur.execute(f"CREATE TABLE users_backup_{ts} AS SELECT * FROM users WHERE id IN (%s, %s)",
                (OLD_USER_ID, STUB_USER_ID))
    print(f"  Backup created: users_backup_{ts}")

    cur.execute("DELETE FROM users WHERE id = %s", (STUB_USER_ID,))
    print(f"  Deleted stub user row")

    cur.execute(
        "UPDATE users SET firebase_uid = %s, email = %s, display_name = %s WHERE id = %s",
        (FIREBASE_UID, EMAIL, DISPLAY_NAME, OLD_USER_ID),
    )
    print(f"  Updated old user with Firebase credentials")

    conn.commit()
    cur.close()
    conn.close()

    print(f"""
=== Done ===
User {OLD_USER_ID} is now linked to Firebase UID {FIREBASE_UID} ({EMAIL}).
All existing tasks and data are intact — nothing was moved.

Backup: users_backup_{ts}
To drop it once confirmed:  DROP TABLE users_backup_{ts};
""")


if __name__ == "__main__":
    main()
