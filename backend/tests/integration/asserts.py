"""Shared assert helpers for the integration suite (Phase 1 of
PLAN-chore-modularize-test-suite.md: quiet-by-default output).

Quiet-mode rule (do not re-derive naively): each helper prints its PASS-glyph
line only when the call did NOT append to `_failures` (VERBOSE=1 overrides
this and restores today's full per-assertion output). A failure line always
prints regardless of VERBOSE, since suppressing it would hide the reason a
run is red.

`assert_eq_xfail`'s polarity is inverted from the other three helpers:
`actual == expected` is the XPASS case — a known bug appears fixed, and it
*is* appended to `_failures` (it's the diagnostically important "remove the
xfail marker" signal). `actual != expected` is the normal XFAIL case, not
appended. Keying quiet-mode off "was this appended to `_failures`" (rather
than off the raw boolean, which is inverted for this one helper) makes XPASS
always print and XFAIL go quiet — correct by construction, no special-casing
needed.
"""
import os

VERBOSE = os.getenv("VERBOSE") == "1"

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"

_failures = []


def assert_eq(label: str, actual, expected):
    if actual == expected:
        if VERBOSE:
            print(f"  {PASS} {label}")
    else:
        _failures.append(label)
        print(f"  {FAIL} {label}: expected {expected!r}, got {actual!r}")


def assert_in(label: str, key, collection):
    if key in collection:
        if VERBOSE:
            print(f"  {PASS} {label}")
    else:
        _failures.append(label)
        print(f"  {FAIL} {label}: {key!r} not in {collection!r}")


def assert_true(label: str, condition: bool):
    if condition:
        if VERBOSE:
            print(f"  {PASS} {label}")
    else:
        _failures.append(label)
        print(f"  {FAIL} {label}: condition is False")


def assert_eq_xfail(label: str, actual, expected, reason: str):
    """Like assert_eq, but for a known application bug that the maintainer has
    explicitly decided NOT to fix in the current PR (a tracked, deferred gap
    rather than a false-green). Does not count toward suite failures while the
    bug remains present. If the underlying code is later fixed and the
    assertion starts passing, this flags loudly (XPASS) so the marker gets
    noticed and removed / converted back to a normal assert_eq."""
    if actual == expected:
        _failures.append(f"{label} (XPASS: bug appears fixed — remove xfail marker; {reason})")
        print(f"  {FAIL} XPASS {label}: expected the known-bug value but got {actual!r} == {expected!r} — "
              f"bug may be fixed, remove xfail. {reason}")
    else:
        if VERBOSE:
            print(f"  {PASS} XFAIL {label} (known bug, not fixed here: expected {expected!r}, got {actual!r}) — {reason}")
