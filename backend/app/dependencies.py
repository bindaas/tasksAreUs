import logging
from typing import Optional

import firebase_admin.auth
from fastapi import Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import User

logger = logging.getLogger(__name__)


def _test_auth_bypass() -> bool:
    """Evaluated per-request so the flag can be toggled without a server restart."""
    return settings.TEST_AUTH_BYPASS


def _verify_firebase_token(token: str) -> dict:
    try:
        return firebase_admin.auth.verify_id_token(token)
    except firebase_admin.auth.ExpiredIdTokenError:
        raise HTTPException(status_code=401, detail="Firebase token expired")
    except firebase_admin.auth.InvalidIdTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid Firebase token: {e}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {e}")


def get_firebase_claims(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
) -> dict:
    """Validate Bearer token and return decoded claims. Does NOT touch the DB.
    Used by endpoints that need the firebase_uid without auto-creating a user.

    Note: get_firebase_claims and get_current_user bypass paths are intentionally
    disconnected — the synthetic uid returned here cannot be resolved to a User row.
    No endpoint in the integration test suite (backend/tests/integration/) routes
    through get_firebase_claims, so this branch exists only for completeness."""
    if _test_auth_bypass() and x_user_id:
        return {"uid": f"test-bypass-{x_user_id}", "email": None, "name": None, "firebase": {"sign_in_provider": "test"}}
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Bearer token required")
    return _verify_firebase_token(authorization[7:])


def get_current_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    db: Session = Depends(get_db),
) -> str:
    """Resolve caller to an internal user_id UUID via Firebase Bearer token.

    Bypass: when TEST_AUTH_BYPASS=true, X-User-ID is accepted directly and the
    user row must already exist (no auto-create). The integration test suite
    (backend/tests/integration/) uses the seeded system user
    (00000000-0000-0000-0000-000000000000) which is inserted at server startup,
    so no extra setup step is required."""
    if _test_auth_bypass() and x_user_id:
        user = db.query(User).filter(User.id == x_user_id).first()
        if user is None:
            raise HTTPException(status_code=401, detail="Test bypass: unknown user ID")
        return str(user.id)

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    claims = _verify_firebase_token(authorization[7:])
    firebase_uid = claims["uid"]

    user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
    if user is not None:
        return user.id

    provider = claims.get("firebase", {}).get("sign_in_provider", "anonymous")
    new_user = User(
        firebase_uid=firebase_uid,
        email=claims.get("email"),
        display_name=claims.get("name"),
        auth_provider=provider,
    )
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        user = db.query(User).filter(User.firebase_uid == firebase_uid).first()
        if user is None:
            raise HTTPException(status_code=500, detail="User creation failed")
        return user.id
    return new_user.id
