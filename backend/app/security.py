from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

from fastapi import Cookie, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db

SESSION_COOKIE = settings.session_cookie


def _hash_password(password: str, salt: Optional[bytes] = None) -> str:
    salt = salt or os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)
    return f"pbkdf2_sha256$120000${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt_hex, digest_hex = stored.split("$")
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    salt = bytes.fromhex(salt_hex)
    expected = bytes.fromhex(digest_hex)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iters))
    return hmac.compare_digest(digest, expected)


def hash_new_password(password: str) -> str:
    return _hash_password(password)


def make_session_token() -> str:
    return secrets.token_urlsafe(32)


SESSION_TTL = timedelta(days=settings.session_ttl_days)
_sessions: Dict[str, datetime] = {}


def create_session() -> str:
    token = make_session_token()
    _sessions[token] = datetime.now(timezone.utc) + SESSION_TTL
    return token


def is_session_valid(token: str) -> bool:
    expires = _sessions.get(token)
    if not expires:
        return False
    if expires < datetime.now(timezone.utc):
        _sessions.pop(token, None)
        return False
    return True


def revoke_session(token: str) -> None:
    _sessions.pop(token, None)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=int(SESSION_TTL.total_seconds()),
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


def require_session(
    session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE),
) -> str:
    if not session or not is_session_valid(session):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="请先登录。")
    return session


SessionDep = Depends(require_session)


def get_db_dep() -> Session:  # placeholder for type alias
    raise NotImplementedError