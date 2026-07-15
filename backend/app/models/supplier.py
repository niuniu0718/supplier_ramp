from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base

if TYPE_CHECKING:
    from .expansion import ExpansionItem, ExpansionPlan
    from .risk import Material, Risk


class Supplier(Base):
    __tablename__ = "supplier"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    code: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    short_name: Mapped[str] = mapped_column("shortName", String)
    category: Mapped[str] = mapped_column(String)
    contact: Mapped[str] = mapped_column(String, default="")
    location: Mapped[str] = mapped_column(String, default="")
    cooperation_years: Mapped[int] = mapped_column("cooperationYears", Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    materials: Mapped[List["Material"]] = relationship(back_populates="supplier")
    expansion_plans: Mapped[List["ExpansionPlan"]] = relationship(back_populates="supplier")


class Material(Base):
    __tablename__ = "material"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String)
    supplier_id: Mapped[str] = mapped_column(
        "supplierId", String, ForeignKey("supplier.id"), index=True
    )

    demand_monthly: Mapped[float] = mapped_column("demandMonthly", Float)
    supply_monthly: Mapped[float] = mapped_column("supplyMonthly", Float)
    inventory: Mapped[float] = mapped_column(Float)
    safety_stock_months: Mapped[float] = mapped_column("safetyStockMonths", Float)
    single_source: Mapped[bool] = mapped_column("singleSource", default=False)
    risk_level: Mapped[str] = mapped_column("riskLevel", String, default="GREEN")
    risk_description: Mapped[str] = mapped_column("riskDescription", String, default="")

    supplier: Mapped[Supplier] = relationship(back_populates="materials")
    risks: Mapped[List["Risk"]] = relationship(back_populates="material")
    expansion_plans: Mapped[List["ExpansionPlan"]] = relationship(back_populates="material")