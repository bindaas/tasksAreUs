"""Unit tests for dependencies.py — Firebase auth path."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.dependencies import get_current_user, get_firebase_claims


# ── Helpers ───────────────────────────────────────────────────────────────────

def _make_db(user=None):
    db = MagicMock()
    query = db.query.return_value
    query.filter.return_value.first.return_value = user
    return db


def _firebase_claims(uid="uid123", provider="anonymous", email=None, name=None):
    return {
        "uid": uid,
        "email": email,
        "name": name,
        "firebase": {"sign_in_provider": provider},
    }


# ── get_firebase_claims ────────────────────────────────────────────────────────

class TestGetFirebaseClaims:
    def test_missing_header_raises_401(self):
        with pytest.raises(HTTPException) as exc:
            get_firebase_claims(authorization=None)
        assert exc.value.status_code == 401

    def test_non_bearer_header_raises_401(self):
        with pytest.raises(HTTPException) as exc:
            get_firebase_claims(authorization="Basic abc123")
        assert exc.value.status_code == 401

    def test_valid_token_returns_claims(self):
        claims = _firebase_claims()
        with patch("app.dependencies.firebase_admin.auth.verify_id_token", return_value=claims):
            result = get_firebase_claims(authorization="Bearer valid_token")
        assert result["uid"] == "uid123"

    def test_invalid_token_raises_401(self):
        import firebase_admin.auth as fb_auth
        with patch(
            "app.dependencies.firebase_admin.auth.verify_id_token",
            side_effect=fb_auth.InvalidIdTokenError("bad token"),
        ):
            with pytest.raises(HTTPException) as exc:
                get_firebase_claims(authorization="Bearer bad_token")
        assert exc.value.status_code == 401


# ── get_current_user ───────────────────────────────────────────────────────────

class TestGetCurrentUser:
    def test_bearer_token_existing_user(self):
        existing = MagicMock()
        existing.id = "internal-uuid"
        db = _make_db(user=existing)
        claims = _firebase_claims(uid="uid123")

        with patch("app.dependencies.firebase_admin.auth.verify_id_token", return_value=claims):
            result = get_current_user(authorization="Bearer valid_token", db=db)
        assert result == "internal-uuid"

    def test_bearer_token_new_user_is_created(self):
        db = _make_db(user=None)
        db.add = MagicMock()
        db.commit = MagicMock()
        db.refresh = MagicMock(side_effect=lambda u: setattr(u, "id", "new-uuid"))
        claims = _firebase_claims(uid="new_uid")

        with patch("app.dependencies.firebase_admin.auth.verify_id_token", return_value=claims):
            result = get_current_user(authorization="Bearer valid_token", db=db)
        assert result == "new-uuid"
        db.add.assert_called_once()

    def test_no_auth_raises_401(self):
        db = MagicMock()
        with pytest.raises(HTTPException) as exc:
            get_current_user(authorization=None, db=db)
        assert exc.value.status_code == 401

    def test_invalid_bearer_token_raises_401(self):
        import firebase_admin.auth as fb_auth
        db = MagicMock()
        with patch(
            "app.dependencies.firebase_admin.auth.verify_id_token",
            side_effect=fb_auth.InvalidIdTokenError("bad"),
        ):
            with pytest.raises(HTTPException) as exc:
                get_current_user(authorization="Bearer bad_token", db=db)
        assert exc.value.status_code == 401

    def test_expired_token_raises_401(self):
        import firebase_admin.auth as fb_auth
        db = MagicMock()
        with patch(
            "app.dependencies.firebase_admin.auth.verify_id_token",
            side_effect=fb_auth.ExpiredIdTokenError("expired", None),
        ):
            with pytest.raises(HTTPException) as exc:
                get_current_user(authorization="Bearer expired_token", db=db)
        assert exc.value.status_code == 401
