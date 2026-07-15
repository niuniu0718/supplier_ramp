from __future__ import annotations

from fastapi import APIRouter, Depends

from ..security import require_session

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def list_notifications(_: str = Depends(require_session)):
    return {"notifications": []}


@router.post("/read-all")
def read_all(_: str = Depends(require_session)):
    return {"ok": True}