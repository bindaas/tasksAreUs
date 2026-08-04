"""Orchestrator entry point for the modularized integration suite. Replaces
the old monolithic `backend/tests/test_api.py` (removed — see
`development-plans/PLAN-chore-modularize-test-suite.md` for the rationale
and the exact section->module mapping).

Builds a shared Ctx (httpx client, test user id, cross-section state:
default_board_id / task_id / type_labels) via ctx.build_ctx(), then calls
each domain module's run(ctx) in exactly test_api.py's original section
order, aggregating `_failures` in asserts.py the same way the old main() did.

Usage:
    pip install httpx psycopg2-binary
    cd backend
    DATABASE_URL=postgresql://... BASE_URL=http://localhost:8000 python3 -m tests.integration.run_all

    # Full per-assertion PASS output (today's default, pre-modularization):
    VERBOSE=1 python3 -m tests.integration.run_all

Also runnable as a plain script (`python3 tests/integration/run_all.py`) from
the `backend/` directory — the sys.path bootstrap below makes the `tests`
package importable either way.
"""
import os
import sys

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from tests.integration import ctx as ctx_module  # noqa: E402
from tests.integration.asserts import FAIL, PASS, _failures  # noqa: E402
from tests.integration import (  # noqa: E402
    test_boards,
    test_labels,
    test_task_crud,
    test_task_scheduling,
    test_high_priority,
    test_task_lifecycle,
    test_reports,
    test_settings,
    test_sync,
    test_focused_view,
    test_day_view,
    test_overdue_view,
)


def main():
    c = ctx_module.build_ctx()

    # Exactly test_api.py's original main() section order.
    test_boards.run(c)
    test_labels.run(c)
    test_task_crud.run(c)
    test_task_scheduling.run(c)
    test_high_priority.run(c)
    test_task_lifecycle.run(c)
    test_reports.run(c)
    test_settings.run(c)
    test_sync.run(c)
    test_focused_view.run(c)
    test_day_view.run(c)
    test_overdue_view.run(c)

    # ── Summary ────────────────────────────────────────────────────────────────
    print("\n── Results ─────────────────────────────────────────────")
    if _failures:
        print(f"  {FAIL} {len(_failures)} failure(s):")
        for f in _failures:
            print(f"    - {f}")
    else:
        print(f"  {PASS} All tests passed")

    if _failures:
        sys.exit(1)


if __name__ == "__main__":
    main()
