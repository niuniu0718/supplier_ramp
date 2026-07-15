from __future__ import annotations

import os
import uuid
from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, selectinload

from ..config import settings
from ..db import get_db
from ..models import ExpansionItem, ExpansionPlan, EvidenceChain
from ..security import require_session
from ..services.milestone_template import milestone_name
from ..services.risk_engine import (
    calculate_expansion_risk,
    calculate_expected_progress,
)

router = APIRouter(prefix="/api", tags=["expansion"])


def _enrich_plan(plan: ExpansionPlan) -> Dict[str, Any]:
    result = calculate_expansion_risk(plan.start_date, plan.end_date, plan.progress)
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
        "progress": plan.progress,
        "expectedProgress": result.expected_progress,
        "status": result.status,
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
    }


@router.get("/expansion-plans")
def list_plans(
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    plans = (
        db.query(ExpansionPlan)
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
        .options(selectinload(ExpansionPlan.supplier), selectinload(ExpansionPlan.material),
                selectinload(ExpansionPlan.items))
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
    for p in plans:
        result = calculate_expansion_risk(p.start_date, p.end_date, p.progress)
        sorted_items = sorted(p.items, key=lambda it: (it.milestone_order or 0, it.id))
        items = [_enrich_item(it, min_start, total) for it in sorted_items]
        overdue = sum(1 for i in items if i["overdue"])
        overdue_total += overdue
        item_total += len(items)
        rows.append({
            "id": p.id,
            "name": p.name,
            "supplierName": p.supplier.short_name if p.supplier else "",
            "materialName": p.material.name if p.material else "",
            "startDate": p.start_date.isoformat(),
            "endDate": p.end_date.isoformat(),
            "stage": p.stage,
            "progress": p.progress,
            "expectedProgress": result.expected_progress,
            "status": result.status,
            "lag": result.lag,
            "itemCount": len(items),
            "overdueCount": overdue,
            "items": items,
        })

    invested = sum(p.invested_capex for p in plans) / 10000
    total_capex = sum(p.total_capex for p in plans) / 10000
    months_span = max(1, int((max_end - min_start) / (30 * 86_400_000)))
    return {
        "board": "expansion",
        "view": "timeline",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "kpis": [
            {"label": "计划数量", "value": len(plans), "unit": "项", "tone": "blue"},
            {"label": "里程碑跨度", "value": str(months_span), "unit": "个月", "tone": "green",
             "hint": f"最远至 {datetime.fromtimestamp(max_end/1000).strftime('%Y-Q')[:7]}"},
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
        .options(selectinload(ExpansionPlan.supplier), selectinload(ExpansionPlan.evidence))
        .order_by(ExpansionPlan.updated_at.desc())
        .all()
    )
    plan_groups = []
    total = 0
    by_cat: Dict[str, int] = {}
    for p in plans:
        if not p.evidence:
            continue
        ev = []
        for e in p.evidence:
            ev.append({
                "id": e.id,
                "fileName": e.file_name,
                "category": e.category,
                "url": e.url,
                "note": e.note,
                "uploadedAt": e.uploaded_at.isoformat() if e.uploaded_at else None,
                "uploadedById": e.uploaded_by_id,
                "size": e.size,
                "mimeType": e.mime_type,
            })
            total += 1
            by_cat[e.category] = by_cat.get(e.category, 0) + 1
        plan_groups.append({
            "planId": p.id,
            "planName": p.name,
            "supplierName": p.supplier.short_name if p.supplier else "",
            "evidence": ev,
        })

    return {
        "board": "expansion",
        "view": "evidence",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "kpis": [
            {"label": "证据总数", "value": total, "unit": "份", "tone": "blue"},
            {"label": "覆盖计划", "value": len(plan_groups), "unit": "项", "tone": "green",
             "hint": f"共 {len(plans)} 项"},
            {"label": "设备到货照", "value": by_cat.get("DEVICE_PHOTO", 0), "unit": "份", "tone": "orange"},
            {"label": "合同/凭证", "value": by_cat.get("CONTRACT", 0) + by_cat.get("PAYMENT", 0), "unit": "份",
             "tone": "purple"},
        ],
        "planGroups": plan_groups,
    }


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
    allowed = {"progress", "stage", "risk_description", "expected_progress", "status"}
    for key, value in body.items():
        camel = "".join(p.capitalize() if i else p for i, p in enumerate(key.split("_")))
        if key in allowed or camel in allowed:
            setattr(plan, key, value)
    db.commit()
    db.refresh(plan)
    return {"plan": _enrich_plan(plan)}


@router.post("/expansion-plans/{plan_id}/evidence")
def upload_evidence(
    plan_id: str,
    file: UploadFile = File(...),
    category: str = Form("OTHER"),
    note: str = Form(""),
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    plan = db.get(ExpansionPlan, plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在。")
    if not file.filename:
        raise HTTPException(status_code=400, detail="请选择文件。")
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
    evidence = EvidenceChain(
        plan_id=plan_id,
        category=category,
        file_name=file.filename,
        stored_name=stored_name,
        mime_type=file.content_type or "application/octet-stream",
        size=size,
        url=f"/uploads/{stored_name}",
        note=note,
        uploaded_by_id="admin",
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)
    return {
        "evidence": {
            "id": evidence.id,
            "planId": evidence.plan_id,
            "category": evidence.category,
            "fileName": evidence.file_name,
            "url": evidence.url,
            "note": evidence.note,
            "uploadedAt": evidence.uploaded_at.isoformat() if evidence.uploaded_at else None,
        }
    }