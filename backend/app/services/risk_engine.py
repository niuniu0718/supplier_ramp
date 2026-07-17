from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional

RiskLevel = Literal["GREEN", "YELLOW", "ORANGE", "RED"]


@dataclass(frozen=True)
class MaterialRiskInput:
    demand_monthly: float
    supply_monthly: float
    inventory: float
    safety_stock_months: float
    single_source: bool
    expansion_delayed_days: int = 0


def calculate_material_risk(input_: MaterialRiskInput) -> RiskLevel:
    gap_ratio = max(0.0, input_.demand_monthly - input_.supply_monthly) / input_.demand_monthly \
        if input_.demand_monthly > 0 else 0.0
    inventory_coverage = input_.inventory / input_.demand_monthly \
        if input_.demand_monthly > 0 else float("inf")

    if input_.single_source and input_.safety_stock_months < 3:
        return "RED"
    if input_.single_source and input_.safety_stock_months < 6:
        return "ORANGE"
    if inventory_coverage < 1:
        return "ORANGE"
    if gap_ratio > 0.3:
        return "ORANGE"
    if input_.expansion_delayed_days > 60:
        return "YELLOW"
    return "GREEN"


def calculate_expected_progress(start: datetime, end: datetime, now: Optional[datetime] = None) -> int:
    now = now or datetime.utcnow()
    if now <= start:
        return 0
    if now >= end:
        return 100
    total = (end - start).total_seconds()
    if total <= 0:
        return 100
    elapsed = (now - start).total_seconds()
    return min(100, round((elapsed / total) * 100))


def calculate_actual_progress(items) -> int:
    """每个阀点（8 个）已完成算 1/8，未完成算 0；总进度 = 已完成 / 8 * 100"""
    if not items:
        return 0
    total = len(items)
    completed = sum(1 for it in items if getattr(it, "status", None) == "已完成")
    return round(completed / total * 100)


@dataclass(frozen=True)
class ExpansionRiskResult:
    expected_progress: int
    status: RiskLevel
    lag: int


def calculate_expansion_risk(
    start: datetime, end: datetime, progress: int, now: Optional[datetime] = None
) -> ExpansionRiskResult:
    now = now or datetime.utcnow()
    expected = calculate_expected_progress(start, end, now)
    lag = max(0, expected - progress)
    overdue = now > end and progress < 100

    # 阈值：滞后 ≥ 25% → 高风险；8% ≤ 滞后 < 25% → 中风险；< 8% → 低风险
    if overdue:
        return ExpansionRiskResult(expected, "RED", lag)
    if lag >= 25:
        return ExpansionRiskResult(expected, "RED", lag)
    if lag >= 8:
        return ExpansionRiskResult(expected, "ORANGE", lag)
    return ExpansionRiskResult(expected, "GREEN", lag)