"""
Recover deleted user and tasks from dead heap tuples.
Extracted from PostgreSQL heap files before VACUUM.

Run: DATABASE_URL=postgresql://... python3 scripts/recover_data.py
"""
import os
from datetime import datetime, timezone

import psycopg2

DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/tasksareus")

REAL_USER_ID     = "dcb45f1b-5dfe-4028-b2e4-4405d3ff5719"
REAL_DEVICE_UUID = "8bc5910b-39ff-4663-8992-4104e9deaed1"

NOW = datetime.now(timezone.utc)

# Recovered from dead heap tuples (strings on pgdata heap files).
# Each tuple: (task_id, title, notes)
TASKS = [
    ("ec9a4b24-858b-4fa7-aa4d-d3db619a3d37", "Rocket Money",                   None),
    ("16b3ef7b-28ad-4eda-9fcd-ba1990bc9cff", "Return-Costco",                  "toilet paper\ndetergent\nunderwear\nshorts"),
    ("1af6cd59-ddef-4e10-a513-892f5bc2bb4c", "Setup-Ear pods",                 None),
    ("231e65b5-33f0-4006-ad17-265c50231c24", "Renew-Driving License",           None),
    ("e0c308b5-df46-4a65-b560-f4b30a225c7c", "Return-Kohls",                   None),
    ("a0f76321-b6df-4604-bafd-8e4d2c126365", "Dental-schedule (kiddo)",        None),
    ("bfcbe850-c2d1-49c6-9a0b-29053b9ddf8c", "HSA-Transfer",                   None),
    ("fa36cccd-ab1d-44b8-b46a-a5bc0143e4aa", "Blood work",                     None),
    ("1406ed9f-6cbb-4ad8-89b7-9353463b9595", "Medical reimbursement-Vivian",   None),
    ("fedbfc25-ecfe-4b78-b937-f7021f0b8b19", "Medical Reimbursement-Ellison",  None),
    ("697d9942-a683-48f3-9dd2-7e7f5372d5bf", "Dismantle-Christmas tree",       None),
    ("829c0b4c-96d6-40df-a18e-341edd39291a", "Costcco-Recliner",               None),
    ("d9f52515-982c-4052-a311-365de4747967", "Water plant",                    None),
    ("1a3945c0-7f19-4a0f-9c42-2294633f6c37", "Discontinue-Pearson",            None),
    ("8c63a567-38ac-44ce-a5c2-07c5b9c79926", "Disability services-Followup",   None),
    ("dcf76ec5-5b2f-40b7-8fbf-7a4a1b364cb7", "Uber-Review",                    None),
    ("de141805-1d65-4722-8b2b-26a8e196b2f7", "Schedule-Colonoscopy",           None),
    ("0b15953d-5417-4893-8bee-810bf784ee36", "Schedule-Dental hole",           None),
    ("d974f067-a8bd-46ac-9d82-56653930e12a", "Salary-Review",                  None),
    ("42dc9177-4665-4ebc-a849-5ec380176af2", "Mental Health Services",         None),
    ("c9c4104c-6569-49cb-8c14-8eaf3cf9c56c", "IRA-Review",                     None),
    ("f8f2624f-03a8-4ff5-9bf6-b104437712e5", "HSA-Review",                     None),
    ("b17ba55c-2233-48c3-a324-181dd7121c07", "401K- Review",                   None),
    ("cc5ce0fe-ad16-48ae-8457-10940988a88a", "Disability Services-Followup",   None),
    ("1f3e63fd-6f97-4110-8ef1-9ccbb0eecbb3", "Setup-Speakers",                 None),
    ("c64e4b12-af42-4db1-82b1-910d1f8dbb56", "SNOW-RSU",                       None),
    ("b2a6e239-517b-407f-a581-9fdc54c370b0", "Work-Expense Report",            None),
]


def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Re-create the user
    cur.execute(
        """
        INSERT INTO users (id, device_uuid, created_at, updated_at)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING
        """,
        (REAL_USER_ID, REAL_DEVICE_UUID, NOW, NOW),
    )
    print(f"User inserted: {REAL_USER_ID}")

    # Re-create user_settings with defaults
    import uuid as _uuid
    cur.execute(
        """
        INSERT INTO user_settings (id, user_id, created_at, updated_at)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id) DO NOTHING
        """,
        (str(_uuid.uuid4()), REAL_USER_ID, NOW, NOW),
    )

    # Re-insert tasks
    inserted = 0
    for task_id, title, notes in TASKS:
        cur.execute(
            """
            INSERT INTO tasks
              (id, user_id, title, notes, state, is_deleted, is_high_priority, created_at, updated_at)
            VALUES (%s, %s, %s, %s, 'pending', false, false, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (task_id, REAL_USER_ID, title, notes, NOW, NOW),
        )
        if cur.rowcount:
            print(f"  + {title}")
            inserted += 1
        else:
            print(f"  - skipped (already exists): {title}")

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nDone. {inserted}/{len(TASKS)} tasks restored.")


if __name__ == "__main__":
    main()
