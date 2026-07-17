from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import inspect
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..db import get_db
from ..models import Approval, CommissioningItem, ExpansionItem, ExpansionPlan, EvidenceChain, Material, RampItem, Supplier
from ..security import require_session
from ..services.approval_types import APPROVAL_BY_KEY, APPROVAL_TYPES
from ..services.commissioning_types import COMMISSIONING_BY_KEY, COMMISSIONING_TYPES
from ..services.ramp_phases import RAMP_BY_PHASE, RAMP_PHASES
from ..services.milestone_template import MILESTONE_TEMPLATE, milestone_name
from ..services.risk_engine import (
    calculate_expansion_risk,
    calculate_actual_progress,
    calculate_expected_progress,
)

router = APIRouter(prefix="/api", tags=["expansion"])


def _enrich_plan(plan: ExpansionPlan) -> Dict[str, Any]:
    actual = calculate_actual_progress(plan.items)
    result = calculate_expansion_risk(plan.start_date, plan.end_date, actual)
    # 用户手动覆盖的 plan.status 优先；未设置时回退到自动算出的 result.status
    effective_status = plan.status if plan.status else result.status
    return {
        "id": plan.id,
        "materialId": plan.material_id,
        "materialName": plan.material.name if plan.material else "",
        "supplierId": plan.supplier_id,
        "supplierName": plan.supplier.short_name if plan.supplier else "",
        "supplierCategory": plan.supplier.category if plan.supplier else "",
        "name": plan.name,
        "stage": plan.stage,
        "startDate": plan.start_date.isoformat(),
        "endDate": plan.end_date.isoformat(),
        "targetCapacity": plan.target_capacity,
        "investedCapex": plan.invested_capex,
        "totalCapex": plan.total_capex,
        "fundingSources": plan.funding_sources or [],
        "progress": actual,
        "completedItemCount": sum(1 for it in plan.items if it.status == "已完成"),
        "totalItemCount": len(plan.items),
        "expectedProgress": result.expected_progress,
        "status": effective_status,
        "autoStatus": result.status,
        "lag": result.lag,
        "riskTypes": plan.risk_types or [],
        "riskDescription": plan.risk_description,
        "updatedAt": plan.updated_at.isoformat() if plan.updated_at else None,
        "itemCount": len(plan.items),
        "evidenceCount": len(plan.evidence),
    }


def _enrich_item(it: ExpansionItem, min_start: float, total: float) -> Dict[str, Any]:
    expected_ms = it.expected_arrival.timestamp() * 1000
    overdue = not it.actual_arrival and datetime.utcnow() > it.expected_arrival
    if overdue:
        delay = max(it.delay_days, int((datetime.utcnow().timestamp() * 1000 - expected_ms) / 86_400_000))
    else:
        delay = it.delay_days
    pct = ((expected_ms - min_start) / total) * 100 if total > 0 else 0
    # 候选风险信号：阀点逾期 > 7 天时建议升级为风险
    pending_risk_signal = None
    if overdue and delay > 7:
        pending_risk_signal = {
            "type": "MILESTONE_DELAYED",
            "level": "ORANGE" if delay > 30 else "YELLOW",
            "delayDays": delay,
            "reason": f"阀点「{milestone_name(it.milestone_key)}」已延期 {delay} 天",
        }
    return {
        "id": it.id,
        "name": it.name,
        "type": it.type,
        "vendor": it.vendor,
        "orderNo": it.order_no,
        "status": it.status,
        "expectedArrival": it.expected_arrival.isoformat(),
        "actualArrival": it.actual_arrival.isoformat() if it.actual_arrival else None,
        "delayDays": delay,
        "overdue": overdue,
        "pct": pct,
        "supplierAction": it.supplier_action,
        "procurementAction": it.procurement_action,
        "milestoneKey": it.milestone_key,
        "milestoneOrder": it.milestone_order,
        "milestoneName": milestone_name(it.milestone_key),
        "note": it.note,
        "pendingRiskSignal": pending_risk_signal,
    }


def _enrich_approval(a: Approval) -> Dict[str, Any]:
    tmpl = APPROVAL_BY_KEY.get(a.type, {"order": 99, "name": a.type, "agency": ""})
    if a.actual_at:
        status = "已完成"
        overdue = False
    elif not a.submitted_at:
        status = "未开始"
        overdue = False
    elif a.expected_at and a.expected_at < datetime.utcnow():
        status = "已逾期"
        overdue = True
    else:
        status = "进行中"
        overdue = False
    # 候选风险信号：审批逾期 > 14 天时建议升级为风险
    pending_risk_signal = None
    if overdue and a.expected_at:
        delay = int((datetime.utcnow() - a.expected_at).total_seconds() / 86_400)
        if delay > 14:
            pending_risk_signal = {
                "type": "APPROVAL_OVERDUE",
                "level": "RED" if delay > 30 else "ORANGE",
                "delayDays": delay,
                "reason": f"审批「{tmpl.get('name', a.type)}」已逾期 {delay} 天",
            }
    return {
        "id": a.id,
        "order": tmpl.get("order", 99),
        "type": a.type,
        "name": tmpl.get("name", a.type),
        "agency": tmpl.get("agency", ""),
        "submittedAt": a.submitted_at.isoformat() if a.submitted_at else None,
        "expectedAt": a.expected_at.isoformat() if a.expected_at else None,
        "actualAt": a.actual_at.isoformat() if a.actual_at else None,
        "status": status,
        "overdue": overdue,
        "note": a.note,
        "pendingRiskSignal": pending_risk_signal,
    }


PASS_STATUS_META = {
    "PASS": "合格",
    "FAIL": "不合格",
    "IN_PROGRESS": "进行中",
    "PENDING": "待开始",
}


def _enrich_commissioning(c: CommissioningItem) -> Dict[str, Any]:
    tmpl = COMMISSIONING_BY_KEY.get(c.type, {"order": 99, "name": c.type, "standard": ""})
    # 候选风险信号：试车不合格时建议升级为风险
    pending_risk_signal = None
    if c.pass_status == "FAIL":
        pending_risk_signal = {
            "type": "COMMISSIONING_FAIL",
            "level": "RED",
            "delayDays": 0,
            "reason": f"试车「{tmpl.get('name', c.type)}」判定不合格",
        }
    return {
        "id": c.id,
        "order": tmpl.get("order", 99),
        "type": c.type,
        "name": tmpl.get("name", c.type),
        "standard": tmpl.get("standard", ""),
        "targetValue": c.target_value,
        "actualValue": c.actual_value,
        "passStatus": c.pass_status,
        "passLabel": PASS_STATUS_META.get(c.pass_status, c.pass_status),
        "verifiedAt": c.verified_at.isoformat() if c.verified_at else None,
        "note": c.note,
        "pendingRiskSignal": pending_risk_signal,
    }


RAMP_STATUS_META = {
    "PASS": "已达标",
    "FAIL": "未达标",
    "IN_PROGRESS": "进行中",
    "PENDING": "待开始",
}


def _enrich_ramp(r: RampItem) -> Dict[str, Any]:
    tmpl = RAMP_BY_PHASE.get(r.phase, {"order": 99, "loadRate": r.target_load_rate, "period": ""})
    # 候选风险信号：爬坡未达标（status=FAIL 或 实际 < 目标 80%）
    pending_risk_signal = None
    if r.status == "FAIL":
        pending_risk_signal = {
            "type": "RAMP_BELOW_TARGET",
            "level": "ORANGE",
            "delayDays": 0,
            "reason": f"爬坡阶段「{r.phase}」未达标",
        }
    elif (r.actual_capacity is not None and r.target_capacity > 0
          and r.actual_capacity < r.target_capacity * 0.8):
        pending_risk_signal = {
            "type": "RAMP_BELOW_TARGET",
            "level": "ORANGE",
            "delayDays": 0,
            "reason": f"爬坡阶段「{r.phase}」实际产能 {r.actual_capacity:.0f} < 目标 {r.target_capacity:.0f} 的 80%",
        }
    return {
        "id": r.id,
        "order": tmpl.get("order", 99),
        "phase": r.phase,
        "loadRate": r.target_load_rate,
        "targetCapacity": r.target_capacity,
        "plannedPeriod": r.planned_period or tmpl.get("period", ""),
        "confirmedAt": r.confirmed_at.isoformat() if r.confirmed_at else None,
        "actualCapacity": r.actual_capacity,
        "status": r.status,
        "statusLabel": RAMP_STATUS_META.get(r.status, r.status),
        "note": r.note,
        "pendingRiskSignal": pending_risk_signal,
    }


@router.get("/expansion-plans")
def list_plans(
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    plans = (
        db.query(ExpansionPlan)
        .filter(ExpansionPlan.archived_at.is_(None))
        .options(selectinload(ExpansionPlan.material), selectinload(ExpansionPlan.supplier),
                selectinload(ExpansionPlan.items), selectinload(ExpansionPlan.evidence))
        .order_by(ExpansionPlan.start_date.asc())
        .all()
    )
    return {"plans": [_enrich_plan(p) for p in plans]}


@router.get("/boards/expansion/views/overview")
def expansion_overview(
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    plans = (
        db.query(ExpansionPlan)
        .filter(ExpansionPlan.archived_at.is_(None))
        .options(selectinload(ExpansionPlan.supplier), selectinload(ExpansionPlan.material),
                selectinload(ExpansionPlan.items), selectinload(ExpansionPlan.evidence))
        .order_by(ExpansionPlan.updated_at.desc())
        .all()
    )
    enriched = [_enrich_plan(p) for p in plans]
    by_status = {"RED": 0, "ORANGE": 0, "YELLOW": 0, "GREEN": 0}
    for p in enriched:
        by_status[p["status"]] += 1
    total_capex = sum(p["totalCapex"] for p in enriched) / 10000
    return {
        "board": "expansion",
        "view": "overview",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "kpis": [
            {"label": "扩产计划", "value": len(enriched), "unit": "项", "tone": "blue",
             "hint": f"{len({p['supplierId'] for p in enriched})} 家供应商"},
            {"label": "绿色推进", "value": by_status["GREEN"], "unit": "项", "tone": "green", "hint": "进度正常"},
            {"label": "关注", "value": by_status["YELLOW"], "unit": "项", "tone": "yellow", "hint": "需观察"},
            {"label": "警告", "value": by_status["ORANGE"], "unit": "项", "tone": "orange", "hint": "需介入"},
            {"label": "危险", "value": by_status["RED"], "unit": "项", "tone": "red", "hint": "需升级"},
            {"label": "总投资", "value": f"{total_capex:.1f}", "unit": "亿元", "tone": "purple",
             "hint": "CAPEX 总预算"},
        ],
        "cards": enriched,
    }


@router.get("/boards/expansion/views/timeline")
def expansion_timeline(
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    plans = (
        db.query(ExpansionPlan)
        .filter(ExpansionPlan.archived_at.is_(None))
        .options(selectinload(ExpansionPlan.supplier), selectinload(ExpansionPlan.material),
                selectinload(ExpansionPlan.items), selectinload(ExpansionPlan.approvals),
                selectinload(ExpansionPlan.commissionings), selectinload(ExpansionPlan.ramps))
        .order_by(ExpansionPlan.start_date.asc())
        .all()
    )
    if not plans:
        return {"board": "expansion", "view": "timeline", "generatedAt": datetime.utcnow().isoformat() + "Z",
                "kpis": [], "rows": []}

    starts = [p.start_date.timestamp() * 1000 for p in plans]
    ends = [p.end_date.timestamp() * 1000 for p in plans]
    min_start = min(starts)
    max_end = max(ends)
    total = max_end - min_start

    rows = []
    overdue_total = 0
    item_total = 0
    plan_ids = [p.id for p in plans]
    evidence_by_node: Dict[tuple, List[EvidenceChain]] = {}
    if plan_ids:
        all_evidence = db.query(EvidenceChain).filter(EvidenceChain.plan_id.in_(plan_ids)).all()
        for e in all_evidence:
            key = (e.plan_id, e.target_kind, e.target_id)
            evidence_by_node.setdefault(key, []).append(e)
    for p in plans:
        actual = calculate_actual_progress(p.items)
        result = calculate_expansion_risk(p.start_date, p.end_date, actual)
        effective_status = p.status if p.status else result.status
        sorted_items = sorted(p.items, key=lambda it: (it.milestone_order or 0, it.id))
        items = []
        for it in sorted_items:
            row = _enrich_item(it, min_start, total)
            row["evidence"] = [_enrich_evidence(e) for e in evidence_by_node.get((p.id, "item", it.id), [])]
            items.append(row)
        approvals = [_enrich_approval(a) for a in sorted(p.approvals, key=lambda x: APPROVAL_BY_KEY.get(x.type, {}).get("order", 99))]
        for a in approvals:
            a["evidence"] = [_enrich_evidence(e) for e in evidence_by_node.get((p.id, "approval", a["id"]), [])]
        commissionings = [_enrich_commissioning(c) for c in sorted(p.commissionings, key=lambda x: COMMISSIONING_BY_KEY.get(x.type, {}).get("order", 99))]
        for c in commissionings:
            c["evidence"] = [_enrich_evidence(e) for e in evidence_by_node.get((p.id, "commissioning", c["id"]), [])]
        ramps = [_enrich_ramp(r) for r in sorted(p.ramps, key=lambda x: RAMP_BY_PHASE.get(x.phase, {}).get("order", 99))]
        for r in ramps:
            r["evidence"] = [_enrich_evidence(e) for e in evidence_by_node.get((p.id, "ramp", r["id"]), [])]
        overdue = sum(1 for i in items if i["overdue"])
        overdue_total += overdue
        item_total += len(items)
        plan_evidence = [_enrich_evidence(e) for e in evidence_by_node.get((p.id, "plan", None), [])]
        rows.append({
            "id": p.id,
            "name": p.name,
            "supplierName": p.supplier.short_name if p.supplier else "",
            "materialName": p.material.name if p.material else "",
            "materialId": p.material_id,
            "startDate": p.start_date.isoformat(),
            "endDate": p.end_date.isoformat(),
            "stage": p.stage,
            "progress": actual,
            "completedItemCount": sum(1 for it in p.items if it.status == "已完成"),
            "totalItemCount": len(p.items),
            "expectedProgress": result.expected_progress,
            "status": effective_status,
            "autoStatus": result.status,
            "lag": result.lag,
            "riskDescription": p.risk_description,
            "itemCount": len(items),
            "overdueCount": overdue,
            "approvals": approvals,
            "commissionings": commissionings,
            "ramps": ramps,
            "items": items,
            "evidence": plan_evidence,
        })

    invested = sum(p.invested_capex for p in plans) / 10000
    total_capex = sum(p.total_capex for p in plans) / 10000
    months_span = max(1, int((max_end - min_start) / (30 * 86_400_000)))
    # 最远结束时间：算出季度（按月分），便于一眼看清落在哪一季度
    latest_dt = datetime.fromtimestamp(max_end / 1000)
    latest_quarter = (latest_dt.month - 1) // 3 + 1
    latest_hint = f"{latest_dt.year}年Q{latest_quarter} · {latest_dt.year}/{latest_dt.month:02d}"
    return {
        "board": "expansion",
        "view": "timeline",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "kpis": [
            {"label": "计划数量", "value": len(plans), "unit": "项", "tone": "blue"},
            {"label": "里程碑跨度", "value": str(months_span), "unit": "个月", "tone": "green",
             "hint": f"最远至 {latest_hint}"},
            {"label": "已投 CAPEX", "value": f"{invested:.1f}", "unit": "亿元", "tone": "purple"},
            {"label": "总 CAPEX", "value": f"{total_capex:.1f}", "unit": "亿元", "tone": "orange"},
            {"label": "逾期阀点", "value": f"{overdue_total}/{item_total}", "unit": "", "tone": "red" if overdue_total else "green",
             "hint": "需介入" if overdue_total else "全部按时"},
        ],
        "rows": rows,
    }


@router.get("/boards/expansion/views/evidence")
def expansion_evidence(
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    plans = (
        db.query(ExpansionPlan)
        .filter(ExpansionPlan.archived_at.is_(None))
        .options(
            selectinload(ExpansionPlan.supplier),
            selectinload(ExpansionPlan.items),
            selectinload(ExpansionPlan.approvals),
            selectinload(ExpansionPlan.commissionings),
            selectinload(ExpansionPlan.ramps),
        )
        .order_by(ExpansionPlan.start_date.asc())
        .all()
    )
    plan_groups = []
    total = 0
    pending_count = 0
    rejected_count = 0
    plans_with_evidence = 0
    node_labels: Dict[tuple, str] = {}
    for p in plans:
        plan_groups.append({
            "planId": p.id,
            "planName": p.name,
            "supplierName": p.supplier.short_name if p.supplier else "",
            "nodes": [],
        })
    for p in plans:
        items_by_id = {it.id: it for it in p.items}
        approvals_by_id = {a.id: a for a in p.approvals}
        commissionings_by_id = {c.id: c for c in p.commissionings}
        ramps_by_id = {r.id: r for r in p.ramps}
        evidence_rows = (
            db.query(EvidenceChain)
            .filter(EvidenceChain.plan_id == p.id)
            .order_by(EvidenceChain.uploaded_at.desc())
            .all()
        )
        if not evidence_rows:
            continue
        plans_with_evidence += 1
        # Build nodes list
        nodes_map: Dict[str, Dict[str, Any]] = {}
        for e in evidence_rows:
            total += 1
            if e.requires_verification:
                pending_count += 1
            if e.requires_verification and e.verification_status == "REJECTED":
                rejected_count += 1
            key = e.target_kind
            target_id = e.target_id
            if key == "plan":
                node_key = "plan"
                label = "整计划"
            elif key == "item" and target_id in items_by_id:
                node_key = f"item:{target_id}"
                it = items_by_id[target_id]
                label = f"阀点 {it.milestone_order or '-'} · {it.name}"
            elif key == "approval" and target_id in approvals_by_id:
                node_key = f"approval:{target_id}"
                a = approvals_by_id[target_id]
                tmpl = APPROVAL_BY_KEY.get(a.type, {})
                label = f"审批 · {tmpl.get('name', a.type)}"
            elif key == "commissioning" and target_id in commissionings_by_id:
                node_key = f"commissioning:{target_id}"
                c = commissionings_by_id[target_id]
                tmpl = COMMISSIONING_BY_KEY.get(c.type, {})
                label = f"试车 · {tmpl.get('name', c.type)}"
            elif key == "ramp" and target_id in ramps_by_id:
                node_key = f"ramp:{target_id}"
                r = ramps_by_id[target_id]
                tmpl = RAMP_BY_PHASE.get(r.phase, {})
                label = f"爬坡 · {r.phase} ({tmpl.get('loadRate', '-')}%)"
            else:
                node_key = f"{key}:{target_id or 0}"
                label = f"{key} #{target_id or '-'}"
            node = nodes_map.setdefault(node_key, {
                "kind": key,
                "targetId": target_id,
                "label": label,
                "evidence": [],
            })
            node["evidence"].append(_enrich_evidence(e))
        # Find this plan's group (last one for p.id)
        target_group = next((g for g in plan_groups if g["planId"] == p.id), None)
        if target_group is None:
            continue
        target_group["nodes"] = list(nodes_map.values())
        target_group["evidenceCount"] = total if False else len(evidence_rows)

    plan_groups = [g for g in plan_groups if g["nodes"]]

    return {
        "board": "expansion",
        "view": "evidence",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "kpis": [
            {"label": "证据总数", "value": total, "unit": "份", "tone": "blue"},
            {"label": "覆盖计划", "value": plans_with_evidence, "unit": "项", "tone": "green",
             "hint": f"共 {len(plans)} 项"},
            {"label": "待认证", "value": pending_count, "unit": "份", "tone": "orange",
             "hint": "供应商上传的佐证需责任采购再认证"},
            {"label": "已退回", "value": rejected_count, "unit": "份", "tone": "red"},
        ],
        "planGroups": plan_groups,
    }


def _apply_partial(obj, allowed: set, body: dict, datetime_fields: set = None) -> None:
    datetime_fields = datetime_fields or set()
    mapper = inspect(obj.__class__)
    for key, value in body.items():
        camel = "".join(p.capitalize() if i else p for i, p in enumerate(key.split("_")))
        target_key = key if key in allowed or key in datetime_fields else camel
        if target_key not in allowed and target_key not in datetime_fields:
            continue
        if value is None or value == "":
            # 仅当列可空时才把空字符串 / null 置为 None；
            # 不可空的 Text 列（如 expansion_item.note）保留空字符串，避免 NOT NULL 约束报错
            column = mapper.columns.get(target_key)
            if column is None or column.nullable:
                setattr(obj, target_key, None)
            else:
                setattr(obj, target_key, "")
            continue
        if target_key in datetime_fields and isinstance(value, str):
            cleaned = value.replace("Z", "").strip()
            try:
                value = datetime.fromisoformat(cleaned)
            except ValueError:
                try:
                    value = datetime.strptime(cleaned, "%Y-%m-%d")
                except ValueError:
                    continue
        setattr(obj, target_key, value)


@router.patch("/expansion-plans/{plan_id}")
def update_plan(
    plan_id: str,
    body: dict,
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    plan = db.get(ExpansionPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在。")
    _apply_partial(plan, {"risk_description"}, body)
    db.commit()
    db.refresh(plan)
    return {"plan": _enrich_plan(plan)}


@router.patch("/expansion-items/{item_id}")
def update_item(
    item_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    item = db.get(ExpansionItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="阀点不存在。")
    _apply_partial(item, {
        "status", "supplier_action", "procurement_action", "note",
    }, body, datetime_fields={"expected_arrival", "actual_arrival"})
    db.commit()
    db.refresh(item)
    starts = ends = [item.expected_arrival.timestamp() * 1000]
    return {"item": _enrich_item(item, starts[0], 0)}


@router.patch("/approvals/{approval_id}")
def update_approval(
    approval_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    a = db.get(Approval, approval_id)
    if not a:
        raise HTTPException(status_code=404, detail="审批事项不存在。")
    _apply_partial(a, {"note"}, body,
                   datetime_fields={"submitted_at", "expected_at", "actual_at"})
    db.commit()
    db.refresh(a)
    return {"approval": _enrich_approval(a)}


@router.patch("/commissionings/{commissioning_id}")
def update_commissioning(
    commissioning_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    c = db.get(CommissioningItem, commissioning_id)
    if not c:
        raise HTTPException(status_code=404, detail="试车验证项不存在。")
    _apply_partial(c, {
        "target_value", "actual_value", "pass_status", "note",
    }, body, datetime_fields={"verified_at"})
    db.commit()
    db.refresh(c)
    return {"commissioning": _enrich_commissioning(c)}


@router.patch("/ramps/{ramp_id}")
def update_ramp(
    ramp_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    r = db.get(RampItem, ramp_id)
    if not r:
        raise HTTPException(status_code=404, detail="爬坡阶段不存在。")
    _apply_partial(r, {
        "actual_capacity", "status", "note",
    }, body, datetime_fields={"confirmed_at"})
    db.commit()
    db.refresh(r)
    return {"ramp": _enrich_ramp(r)}


EVIDENCE_TARGET_KINDS = {"plan", "item", "approval", "commissioning", "ramp"}
EVIDENCE_VERIFICATION_STATUS = {"PENDING", "VERIFIED", "REJECTED"}


def _enrich_evidence(e) -> Dict[str, Any]:
    return {
        "id": e.id,
        "planId": e.plan_id,
        "targetKind": e.target_kind,
        "targetId": e.target_id,
        "name": e.name,
        "fileName": e.file_name,
        "url": e.url,
        "note": e.note,
        "size": e.size,
        "mimeType": e.mime_type,
        "uploadedAt": e.uploaded_at.isoformat() if e.uploaded_at else None,
        "uploadedById": e.uploaded_by_id,
        "uploadedByRole": e.uploaded_by_role,
        "requiresVerification": bool(e.requires_verification),
        "verificationStatus": e.verification_status,
        "verifiedById": e.verified_by_id,
        "verifiedAt": e.verified_at.isoformat() if e.verified_at else None,
        "verifiedNote": e.verified_note,
    }


def _resolve_target_plan_id(db: Session, kind: str, target_id) -> str | None:
    if kind not in EVIDENCE_TARGET_KINDS:
        return None
    if kind == "plan":
        obj = db.get(ExpansionPlan, target_id)
    elif kind == "item":
        obj = db.get(ExpansionItem, target_id)
    elif kind == "approval":
        obj = db.get(Approval, target_id)
    elif kind == "commissioning":
        obj = db.get(CommissioningItem, target_id)
    elif kind == "ramp":
        obj = db.get(RampItem, target_id)
    return obj.plan_id if obj and hasattr(obj, "plan_id") else (obj.id if obj and kind == "plan" else None)


@router.post("/evidence")
def upload_evidence(
    file: UploadFile = File(...),
    target_kind: str = Form("plan"),
    target_id: str = Form(""),
    name: str = Form(""),
    note: str = Form(""),
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="请选择文件。")
    if target_kind not in EVIDENCE_TARGET_KINDS:
        raise HTTPException(status_code=400, detail=f"不支持的目标类型：{target_kind}")
    if target_kind == "plan":
        plan_id = target_id
    else:
        try:
            parsed_id = int(target_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="请提供有效的目标节点 ID。")
        plan_id = _resolve_target_plan_id(db, target_kind, parsed_id)
    if not plan_id:
        raise HTTPException(status_code=404, detail="目标节点不存在。")
    plan = db.get(ExpansionPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在。")
    # 佐证名称：未填时回退到文件名（去掉扩展名）
    display_name = (name or "").strip() or os.path.splitext(file.filename)[0]
    ext = os.path.splitext(file.filename)[1].lower()
    stored_name = f"{uuid.uuid4().hex}{ext}"
    target = settings.upload_dir / stored_name
    size = 0
    with target.open("wb") as f:
        while True:
            chunk = file.file.read(64 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > settings.max_upload_bytes:
                f.close()
                target.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="文件过大。")
            f.write(chunk)
    node_id = int(target_id) if target_kind != "plan" and target_id else None
    evidence = EvidenceChain(
        plan_id=plan_id,
        target_kind=target_kind,
        target_id=node_id,
        name=display_name,
        file_name=file.filename,
        stored_name=stored_name,
        mime_type=file.content_type or "application/octet-stream",
        size=size,
        url=f"/uploads/{stored_name}",
        note=note,
        uploaded_by_id="admin",
        uploaded_by_role="PROCUREMENT",
        requires_verification=False,
        verification_status="VERIFIED",
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return {"evidence": _enrich_evidence(evidence)}


@router.patch("/evidence/{evidence_id}")
def update_evidence(
    evidence_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    """编辑佐证名称 / 备注"""
    e = db.get(EvidenceChain, evidence_id)
    if not e:
        raise HTTPException(status_code=404, detail="佐证不存在。")
    _apply_partial(e, {"name", "note"}, body)
    db.commit()
    db.refresh(e)
    return {"evidence": _enrich_evidence(e)}


@router.patch("/evidence/{evidence_id}/verify")
def verify_evidence(
    evidence_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    """再认证：通过 / 退回供应商上传的佐证"""
    e = db.get(EvidenceChain, evidence_id)
    if not e:
        raise HTTPException(status_code=404, detail="佐证不存在。")
    action = body.get("action")
    if action not in ("verify", "reject"):
        raise HTTPException(status_code=400, detail="action 必须为 verify 或 reject。")
    if not e.requires_verification:
        raise HTTPException(status_code=400, detail="该佐证不需要再认证。")
    e.verification_status = "VERIFIED" if action == "verify" else "REJECTED"
    e.verified_by_id = "admin"
    e.verified_at = datetime.utcnow()
    e.verified_note = body.get("note", "")
    db.commit()
    db.refresh(e)
    return {"evidence": _enrich_evidence(e)}


def _parse_iso_date(value) -> datetime | None:
    if not value:
        return None
    cleaned = str(value).replace("Z", "").strip()
    try:
        return datetime.fromisoformat(cleaned)
    except ValueError:
        try:
            return datetime.strptime(cleaned, "%Y-%m-%d")
        except ValueError:
            return None


def _build_milestone_dates(start: datetime, end: datetime) -> List[datetime]:
    """把 8 个阀点按时间均匀分布在 [start, end] 内。"""
    if end <= start:
        return [start] * len(MILESTONE_TEMPLATE)
    span = (end - start).total_seconds()
    n = len(MILESTONE_TEMPLATE)
    return [start + timedelta(seconds=span * (i + 1) / (n + 1)) for i in range(n)]


def _build_approval_expected_dates(start: datetime, end: datetime) -> List[datetime]:
    """6 项审批按与里程碑相近的节奏排布在前 2/3 时段。"""
    if end <= start:
        return [start] * len(APPROVAL_TYPES)
    span = (end - start).total_seconds()
    # 审批集中在前 2/3 时段（环评最先，建设用地最后）
    return [start + timedelta(seconds=span * (i + 1) / (len(APPROVAL_TYPES) + 2)) for i in range(len(APPROVAL_TYPES))]


def _build_ramp_confirmed_dates(start: datetime, end: datetime) -> List[datetime]:
    """4 阶段爬坡均分在最后 1/3 时段。"""
    if end <= start:
        return [start] * len(RAMP_PHASES)
    span = (end - start).total_seconds()
    base = start + timedelta(seconds=span * 2 / 3)
    return [base + timedelta(seconds=span * (i + 1) / (3 * (len(RAMP_PHASES) + 1))) for i in range(len(RAMP_PHASES))]


def _build_commissioning_dates(start: datetime, end: datetime) -> List[datetime]:
    """6 项试车验证按里程碑节奏，前 5 项在最后 1/3 时段起点之后。"""
    if end <= start:
        return [start] * len(COMMISSIONING_TYPES)
    span = (end - start).total_seconds()
    base = start + timedelta(seconds=span * 5 / 6)
    return [base + timedelta(seconds=span * (i + 1) / (6 * (len(COMMISSIONING_TYPES) + 1))) for i in range(len(COMMISSIONING_TYPES))]


@router.get("/expansion-meta")
def expansion_meta(
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    """供前端「新增扩产计划」表单使用的元数据（供应商 / 物料 / 模板）。"""
    suppliers = db.query(Supplier).order_by(Supplier.id.asc()).all()
    materials = db.query(Material).order_by(Material.id.asc()).all()
    return {
        "suppliers": [
            {"id": s.id, "shortName": s.short_name, "name": s.name, "category": s.category}
            for s in suppliers
        ],
        "materials": [
            {
                "id": m.id, "name": m.name, "type": m.type,
                "supplierId": m.supplier_id, "demandMonthly": m.demand_monthly,
            }
            for m in materials
        ],
        "milestoneTemplate": [
            {"order": m["order"], "key": m["key"], "name": m["name"]}
            for m in MILESTONE_TEMPLATE
        ],
        "approvalTemplate": APPROVAL_TYPES,
        "commissioningTemplate": COMMISSIONING_TYPES,
        "rampTemplate": RAMP_PHASES,
    }


@router.post("/expansion-plans")
def create_plan(
    body: dict,
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    """创建扩产计划，可同时按模板生成 4 个 L2 子模块的子节点。"""
    material_id = body.get("materialId") or body.get("material_id")
    supplier_id = body.get("supplierId") or body.get("supplier_id")
    name = (body.get("name") or "").strip()
    start_date = _parse_iso_date(body.get("startDate") or body.get("start_date"))
    end_date = _parse_iso_date(body.get("endDate") or body.get("end_date"))
    if not (material_id and supplier_id and name and start_date and end_date):
        raise HTTPException(status_code=400, detail="请填写物料、供应商、计划名称、起止日期。")
    if end_date <= start_date:
        raise HTTPException(status_code=400, detail="结束日期必须晚于开始日期。")
    if not db.get(Material, material_id):
        raise HTTPException(status_code=400, detail="物料不存在。")
    if not db.get(Supplier, supplier_id):
        raise HTTPException(status_code=400, detail="供应商不存在。")

    target_capacity = float(body.get("targetCapacity") or body.get("target_capacity") or 0)
    invested_capex = float(body.get("investedCapex") or body.get("invested_capex") or 0)
    total_capex = float(body.get("totalCapex") or body.get("total_capex") or 0)
    funding_sources = body.get("fundingSources") or body.get("funding_sources") or []
    # 新建计划的初始阶段：新创建时统一为「立项」，不再由用户手动指定；
    # 阶段字段后续可在编辑阀点状态时由后端自动推断
    stage = "立项"
    status = body.get("status") or None
    risk_types = body.get("riskTypes") or body.get("risk_types") or []
    risk_description = body.get("riskDescription") or body.get("risk_description") or ""

    # 4 个子模块生成开关，默认全部生成
    generate = body.get("generate") or {}
    gen_items = generate.get("items", True)
    gen_approvals = generate.get("approvals", True)
    gen_commissionings = generate.get("commissionings", True)
    gen_ramps = generate.get("ramps", True)

    new_id = f"P{uuid.uuid4().hex[:6].upper()}"
    while db.get(ExpansionPlan, new_id):
        new_id = f"P{uuid.uuid4().hex[:6].upper()}"

    plan = ExpansionPlan(
        id=new_id,
        material_id=material_id,
        supplier_id=supplier_id,
        name=name,
        start_date=start_date,
        end_date=end_date,
        target_capacity=target_capacity,
        invested_capex=invested_capex,
        total_capex=total_capex,
        funding_sources=funding_sources,
        stage=stage,
        progress=0,
        expected_progress=0,
        status=status,
        risk_types=risk_types,
        risk_description=risk_description,
        owner_id="admin",
    )
    db.add(plan)
    db.flush()

    if gen_items:
        dates = _build_milestone_dates(start_date, end_date)
        for tmpl, dt in zip(MILESTONE_TEMPLATE, dates):
            db.add(ExpansionItem(
                plan_id=new_id,
                type="里程碑",
                name=tmpl["name"],
                vendor="",
                order_no="",
                expected_arrival=dt,
                actual_arrival=None,
                status="未开始",
                delay_days=0,
                note="",
                supplier_action="",
                procurement_action="",
                milestone_key=tmpl["key"],
                milestone_order=tmpl["order"],
            ))

    if gen_approvals:
        dates = _build_approval_expected_dates(start_date, end_date)
        for tmpl, dt in zip(APPROVAL_TYPES, dates):
            db.add(Approval(
                plan_id=new_id,
                type=tmpl["key"],
                submitted_at=None,
                expected_at=dt,
                actual_at=None,
                note="",
            ))

    if gen_commissionings:
        dates = _build_commissioning_dates(start_date, end_date)
        for tmpl, dt in zip(COMMISSIONING_TYPES, dates):
            db.add(CommissioningItem(
                plan_id=new_id,
                type=tmpl["key"],
                target_value=tmpl.get("standard", ""),
                actual_value="",
                pass_status="PENDING",
                verified_at=None,
                note="",
            ))

    if gen_ramps:
        dates = _build_ramp_confirmed_dates(start_date, end_date)
        for tmpl, dt in zip(RAMP_PHASES, dates):
            db.add(RampItem(
                plan_id=new_id,
                phase=tmpl["phase"],
                target_load_rate=tmpl["loadRate"],
                target_capacity=target_capacity * tmpl["loadRate"] / 100,
                planned_period=tmpl["period"],
                confirmed_at=dt,
                actual_capacity=None,
                status="PENDING",
                note="",
            ))

    db.commit()
    db.refresh(plan)
    return {"plan": _enrich_plan(plan)}


@router.delete("/expansion-plans/{plan_id}")
def delete_plan(
    plan_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    """归档扩产计划（软删除）：保留所有数据，仅打上 archived_at 时间戳。
    列表类接口会自动过滤已归档计划；数据未真正删除，未来可恢复。"""
    plan = db.get(ExpansionPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在。")
    if plan.archived_at is not None:
        # 幂等：重复归档也直接返回
        return {"ok": True, "planId": plan_id, "archivedAt": plan.archived_at.isoformat()}
    plan.archived_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)
    return {"ok": True, "planId": plan_id, "archivedAt": plan.archived_at.isoformat()}