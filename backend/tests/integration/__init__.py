"""Modularized API integration test suite.

Replaces the old monolithic `backend/tests/test_api.py` (see
`development-plans/PLAN-chore-modularize-test-suite.md` for the rationale and
the exact section->module mapping). Each `test_*.py` module exposes a single
`run(ctx)` function corresponding to one or more of the original file's
`# ── Section ──` blocks, executed by `run_all.py` in the same order the
original `main()` ran them, against a shared `ctx.Ctx` object.

Entry point:
    cd backend && python3 -m tests.integration.run_all

See `run_all.py`'s module docstring for env vars (DATABASE_URL, BASE_URL,
VERBOSE).
"""
