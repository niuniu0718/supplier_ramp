from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base

if TYPE_CHECKING:
    from .supplier import Material, Supplier


class ExpansionPlan(Base):
    __tablename__ = "expansion_plan"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    material_id: Mapped[str] = mapped_column("materialId", String, ForeignKey("material.id"), index=True)
    supplier_id: Mapped[str] = mapped_column("supplierId", String, ForeignKey("supplier.id"), index=True)
    name: Mapped[str] = mapped_column(String)

    start_date: Mapped[datetime] = mapped_column("startDate", DateTime)
    end_date: Mapped[datetime] = mapped_column("endDate", DateTime)
    target_capacity: Mapped[float] = mapped_column("targetCapacity", Float)
    invested_capex: Mapped[float] = mapped_column("investedCapex", Float, default=0)
    total_capex: Mapped[float] = mapped_column("totalCapex", Float, default=0)
    funding_sources: Mapped[List[str]] = mapped_column("fundingSources", JSON, default=list)
    stage: Mapped[str] = mapped_column(String, default="采购设备")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    expected_progress: Mapped[int] = mapped_column("expectedProgress", Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="GREEN")
    risk_types: Mapped[List[str]] = mapped_column("riskTypes", JSON, default=list)
    risk_description: Mapped[str] = mapped_column("riskDescription", Text, default="")
    owner_id: Mapped[str] = mapped_column("ownerId", String, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    material: Mapped[Material] = relationship(back_populates="expansion_plans")
    supplier: Mapped[Supplier] = relationship(back_populates="expansion_plans")
    items: Mapped[List[ExpansionItem]] = relationship(back_populates="plan", cascade="all, delete-orphan")
    evidence: Mapped[List[EvidenceChain]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class ExpansionItem(Base):
    __tablename__ = "expansion_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[str] = mapped_column("planId", String, ForeignKey("expansion_plan.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    vendor: Mapped[str] = mapped_column(String, default="")
    order_no: Mapped[str] = mapped_column("orderNo", String, default="")
    expected_arrival: Mapped[datetime] = mapped_column("expectedArrival", DateTime)
    actual_arrival: Mapped[Optional[datetime]] = mapped_column("actualArrival", DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String, default="已签")
    delay_days: Mapped[int] = mapped_column("delayDays", Integer, default=0)
    note: Mapped[str] = mapped_column(Text, default="")

    plan: Mapped[ExpansionPlan] = relationship(back_populates="items")


class EvidenceChain(Base):
    __tablename__ = "evidence_chain"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[str] = mapped_column("planId", String, ForeignKey("expansion_plan.id", ondelete="CASCADE"), index=True)
    category: Mapped[str] = mapped_column(String)
    file_name: Mapped[str] = mapped_column("fileName", String)
    stored_name: Mapped[str] = mapped_column("storedName", String)
    mime_type: Mapped[str] = mapped_column("mimeType", String)
    size: Mapped[int] = mapped_column(Integer)
    url: Mapped[str] = mapped_column(String)
    note: Mapped[str] = mapped_column(Text, default="")
    uploaded_by_id: Mapped[str] = mapped_column("uploadedById", String)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    plan: Mapped[ExpansionPlan] = relationship(back_populates="evidence")