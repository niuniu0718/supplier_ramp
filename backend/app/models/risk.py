from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base

if TYPE_CHECKING:
    from .supplier import Material


class Risk(Base):
    __tablename__ = "risk"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    material_id: Mapped[str] = mapped_column("materialId", String, ForeignKey("material.id"), index=True)
    type: Mapped[str] = mapped_column(String, index=True)
    level: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    impact_scope: Mapped[str] = mapped_column("impactScope", String)
    discovered_at: Mapped[datetime] = mapped_column("discoveredAt", DateTime, server_default=func.now())
    creator_id: Mapped[str] = mapped_column("creatorId", String)
    status: Mapped[str] = mapped_column(String, default="OPEN")
    is_auto: Mapped[bool] = mapped_column("isAuto", Boolean, default=False)
    closed_at: Mapped[Optional[datetime]] = mapped_column("closedAt", DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    material: Mapped[Material] = relationship(back_populates="risks")
    actions: Mapped[List[Action]] = relationship(back_populates="risk", cascade="all, delete-orphan")


class Action(Base):
    __tablename__ = "action"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    risk_id: Mapped[str] = mapped_column("riskId", String, ForeignKey("risk.id"), index=True)
    type: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(Text)
    recommender_id: Mapped[str] = mapped_column("recommenderId", String)
    owner_id: Mapped[str] = mapped_column("ownerId", String, index=True)
    start_date: Mapped[Optional[datetime]] = mapped_column("startDate", DateTime, nullable=True)
    deadline: Mapped[datetime] = mapped_column(DateTime)
    priority: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="NOT_STARTED")
    completion: Mapped[int] = mapped_column(default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    risk: Mapped[Risk] = relationship(back_populates="actions")
    task: Mapped[Optional[FollowTask]] = relationship(back_populates="action", uselist=False)