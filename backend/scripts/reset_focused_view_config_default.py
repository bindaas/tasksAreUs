"""
One-off fix: reset the existing user's saved Focused View config to the new default
(day_range="today") now that get_or_create_config() defaults new configs to "today"
instead of "today_tomorrow". Only affects the single pre-existing active user — new
users already get the new default via get_or_create_config().
Run: DATABASE_URL=postgresql://... python3 scripts/reset_focused_view_config_default.py
"""
import os
import sys

import psycopg2

from purge_test_data import KEEP_USER_ID  # same active user, avoid a second drifting copy

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/tasksareus")


def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    cur.execute(
        "SELECT id, board_selection, selected_board_ids, day_range "
        "FROM focused_view_configs WHERE user_id = %s",
        (KEEP_USER_ID,),
    )
    rows = cur.fetchall()

    if not rows:
        print(f"No focused_view_configs row found for user {KEEP_USER_ID} — nothing to do.")
        conn.close()
        return

    print("Row(s) that will change:")
    for row in rows:
        print(f"  {row}")

    confirm = input("Reset to board_selection='all', day_range='today'? [y/N] ").strip().lower()
    if confirm != "y":
        print("Aborted.")
        conn.close()
        return

    cur.execute(
        "UPDATE focused_view_configs "
        "SET day_range = 'today', board_selection = 'all', selected_board_ids = '[]' "
        "WHERE user_id = %s",
        (KEEP_USER_ID,),
    )
    conn.commit()
    cur.close()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
