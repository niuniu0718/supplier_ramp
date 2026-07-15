from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Cookie, HTTPException, Response, status
from pydantic import BaseModel, Field

from ..config import settings
from ..security import (
    SESSION_COOKIE,
    clear_session_cookie,
    is_session_valid,
    revoke_session,
    set_session_cookie,
    create_session,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginBody(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


@router.post("/login")
def login(body: LoginBody, response: Response):
    if body.username != settings.admin_username or body.password != settings.admin_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="账号或密码不正确。")
    token = create_session()
    set_session_cookie(response, token)
    return {"username": body.username}


@router.post("/logout")
def logout(response: Response, session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE)):
    if session:
        revoke_session(session)
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me")
def me(session: Optional[str] = Cookie(default=None, alias=SESSION_COOKIE)):
    if not session or not is_session_valid(session):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录。")
    return {"username": settings.admin_username}