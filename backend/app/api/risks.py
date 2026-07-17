from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import (
    Action,
    Approval,
    CommissioningItem,
    ExpansionItem,
    ExpansionPlan,
    Material,
    RampItem,
    Risk,
)
from ..security import require_session

router = APIRouter(prefix="/api/boards/risks/views", tags=["risks"])

TYPE_LABELS = {
    "SINGLE_SOURCE": "单点依赖",
    "LOW_INVENTORY": "库存不足",
    "PRICE": "价格异常",
    "POLICY": "政策风险",
    "QUALITY": "质量风险",
    # === L2 节点级风险（新增） ===
    "APPROVAL_OVERDUE": "审批逾期",
    "COMMISSIONING_FAIL": "试车不达标",
    "RAMP_BELOW_TARGET": "爬坡未达标",
    "MILESTONE_DELAYED": "阀点延期",
}


def _resolve_source(db: Session, source_kind: str | None, source_id: int | None, source_plan_id: str | None) -> Dict[str, Any] | None:
    """根据 source_kind + source_id 反查源头节点的展示信息。"""
    if not source_kind or not source_id:
        return None
    label = ""
    extra: Dict[str, Any] = {}
    if source_kind == "item":
        it = db.get(ExpansionItem, source_id)
        if it:
            label = f"阀点 {it.milestone_order} · {it.name}"
            extra = {
                "status": it.status,
                "expectedArrival": it.expected_arrival.isoformat() if it.expected_arrival else None,
                "actualArrival": it.actual_arrival.isoformat() if it.actual_arrival else None,
            }
    elif source_kind == "approval":
        a = db.get(Approval, source_id)
        if a:
            label = f"审批 {a.type}"
            extra = {
                "status": "已逾期" if a.expected_at and a.actual_at is None and a.expected_at < datetime.utcnow() else
                         ("已完成" if a.actual_at else ("未开始" if not a.submitted_at else "进行中")),
                "submittedAt": a.submitted_at.isoformat() if a.submitted_at else None,
                "expectedAt": a.expected_at.isoformat() if a.expected_at else None,
                "actualAt": a.actual_at.isoformat() if a.actual_at else None,
            }
    elif source_kind == "commissioning":
        c = db.get(CommissioningItem, source_id)
        if c:
            label = f"试车 {c.type}"
            extra = {
                "status": c.pass_status,
                "verifiedAt": c.verified_at.isoformat() if c.verified_at else None,
            }
    elif source_kind == "ramp":
        r_obj = db.get(RampItem, source_id)
        if r_obj:
            label = f"爬坡 {r_obj.phase}"
            extra = {
                "status": r_obj.status,
                "confirmedAt": r_obj.confirmed_at.isoformat() if r_obj.confirmed_at else None,
            }
    if not label and not source_plan_id:
        return None
    plan_name = ""
    if source_plan_id:
        p = db.get(ExpansionPlan, source_plan_id)
        if p:
            plan_name = p.name
    return {
        "kind": source_kind,
        "id": source_id,
        "planId": source_plan_id or "",
        "planName": plan_name,
        "label": label,
        **extra,
    }


def _serialize_risk(r: Risk, db: Session = None) -> Dict[str, Any]:
    open_actions = sum(1 for a in r.actions if a.status not in ("COMPLETED", "SHELVED"))
    actions = [{
        "id": a.id,
        "type": a.type,
        "taskProgress": a.task.progress if a.task else None,
        "owner": a.owner_id,
        "status": a.status,
    } for a in r.actions]
    source = _resolve_source(db, r.source_kind, r.source_id, r.source_plan_id) if db else None
    return {
        "id": r.id,
        "type": r.type,
        "typeLabel": TYPE_LABELS.get(r.type, r.type),
        "level": r.level,
        "status": r.status,
        "description": r.description,
        "impactScope": r.impact_scope,
        "materialName": r.material.name if r.material else "",
        "supplierName": r.material.supplier.short_name if r.material and r.material.supplier else "",
        "actionCount": len(r.actions),
        "openActionCount": open_actions,
        "discoveredAt": r.discovered_at.isoformat() if r.discovered_at else None,
        "actions": actions,
        "closedAt": r.closed_at.isoformat() if r.closed_at else None,
        "sourceKind": r.source_kind,
        "sourceId": r.source_id,
        "sourcePlanId": r.source_plan_id,
        "source": source,
    }


@router.get("/overview")
def overview(db: Session = Depends(get_db), _: str = Depends(require_session)):
    risks = (
        db.query(Risk)
        .options(joinedload(Risk.material).joinedload(Material.supplier), joinedload(Risk.actions))
        .order_by(Risk.discovered_at.desc())
        .all()
    )
    rows = [_serialize_risk(r, db) for r in risks]
    by_level = {"RED": 0, "ORANGE": 0, "YELLOW": 0, "GREEN": 0}
    for r in rows:
        by_level[r["level"]] += 1
    open_total = sum(1 for r in rows if r["status"] != "CLOSED")
    return {
        "board": "risks",
        "view": "overview",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "kpis": [
            {"label": "风险总数", "value": len(rows), "unit": "条", "tone": "blue"},
            {"label": "红色", "value": by_level["RED"], "unit": "条", "tone": "red", "hint": "需立即处理"},
            {"label": "橙色", "value": by_level["ORANGE"], "unit": "条", "tone": "orange", "hint": "需介入"},
            {"label": "黄色", "value": by_level["YELLOW"], "unit": "条", "tone": "yellow", "hint": "需观察"},
            {"label": "绿色", "value": by_level["GREEN"], "unit": "条", "tone": "green", "hint": "已闭环/稳定"},
            {"label": "待升级", "value": open_total, "unit": "条", "tone": "purple", "hint": "OPEN 状态"},
        ],
        "rows": rows,
    }


@router.get("/by-type")
def by_type(db: Session = Depends(get_db), _: str = Depends(require_session)):
    risks = (
        db.query(Risk)
        .options(joinedload(Risk.material).joinedload(Material.supplier), joinedload(Risk.actions))
        .all()
    )
    buckets: Dict[str, Dict[str, Any]] = {}
    for r in risks:
        b = buckets.setdefault(r.type, {
            "type": r.type,
            "label": TYPE_LABELS.get(r.type, r.type),
            "total": 0, "red": 0, "orange": 0, "yellow": 0, "green": 0,
            "openActions": 0,
            "risks": [],
        })
        b["total"] += 1
        b[r.level.lower()] += 1
        b["openActions"] += sum(1 for a in r.actions if a.status not in ("COMPLETED", "SHELVED"))
        b["risks"].append({
            "id": r.id,
            "level": r.level,
            "status": r.status,
            "materialName": r.material.name if r.material else "",
            "supplierName": r.material.supplier.short_name if r.material and r.material.supplier else "",
            "description": r.description,
            "openActions": sum(1 for a in r.actions if a.status not in ("COMPLETED", "SHELVED")),
        })
    rows = list(buckets.values())
    return {
        "board": "risks",
        "view": "by-type",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "kpis": [
            {"label": "风险类型", "value": len(rows), "unit": "类", "tone": "blue"},
            {"label": "总数", "value": sum(b["total"] for b in rows), "unit": "条", "tone": "purple"},
            {"label": "需介入", "value": sum(b["red"] + b["orange"] for b in rows), "unit": "条", "tone": "red"},
        ],
        "rows": rows,
    }


@router.get("/escalation")
def escalation(db: Session = Depends(get_db), _: str = Depends(require_session)):
    risks = (
        db.query(Risk)
        .options(joinedload(Risk.material).joinedload(Material.supplier), joinedload(Risk.actions))
        .all()
    )
    pending = []
    active = []
    closed = []
    for r in risks:
        item = _serialize_risk(r, db)
        if r.status == "CLOSED":
            closed.append(item)
        elif r.level in ("RED", "ORANGE"):
            active.append(item)
        else:
            pending.append(item)
    return {
        "board": "risks",
        "view": "escalation",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "kpis": [
            {"label": "待升级", "value": len(pending), "unit": "条", "tone": "yellow"},
            {"label": "已升级", "value": len(active), "unit": "条", "tone": "red"},
            {"label": "已关闭", "value": len(closed), "unit": "条", "tone": "green"},
        ],
        "pending": pending,
        "active": active,
        "closed": closed,
    }


@router.get("/closure")
def closure(db: Session = Depends(get_db), _: str = Depends(require_session)):
    risks = (
        db.query(Risk)
        .options(joinedload(Risk.material).joinedload(Material.supplier), joinedload(Risk.actions))
        .all()
    )
    closed = [r for r in risks if r.status == "CLOSED" and r.closed_at]
    rows = []
    type_counts: Dict[str, int] = {}
    for r in closed:
        days = (r.closed_at - r.discovered_at).days if r.discovered_at else 0
        rows.append({
            "id": r.id,
            "type": r.type,
            "materialName": r.material.name if r.material else "",
            "supplierName": r.material.supplier.short_name if r.material and r.material.supplier else "",
            "discoveredAt": r.discovered_at.isoformat() if r.discovered_at else None,
            "closedAt": r.closed_at.isoformat(),
            "durationDays": days,
        })
        type_counts[r.type] = type_counts.get(r.type, 0) + 1
    by_type = [{"type": t, "count": c} for t, c in type_counts.items()]
    return {
        "board": "risks",
        "view": "closure",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "kpis": [
            {"label": "已闭环", "value": len(rows), "unit": "条", "tone": "green"},
            {"label": "平均时长", "value": f"{(sum(r['durationDays'] for r in rows) / max(1, len(rows))):.0f}",
             "unit": "天", "tone": "blue"},
            {"label": "闭环率", "value": f"{len(closed) * 100 // max(1, len(risks))}%", "unit": "",
             "tone": "purple", "hint": f"{len(closed)}/{len(risks)}"},
        ],
        "rows": rows,
        "byType": by_type,
    }


# =====================================================================
# 风险 CRUD（与视图并列）
# =====================================================================

crud_router = APIRouter(prefix="/api/risks", tags=["risks"])


_VALID_SOURCE_KINDS = {"item", "approval", "commissioning", "ramp"}


@crud_router.post("")
def create_risk(
    body: dict,
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    """创建一条风险。

    支持 5 种物料级 + 4 种 L2 节点级类型。L2 节点级风险须同时给出
    sourceKind / sourceId / sourcePlanId，后端做存在性校验。
    """
    material_id = body.get("materialId")
    risk_type = body.get("type")
    level = body.get("level")
    description = body.get("description", "")
    impact_scope = body.get("impactScope", "")
    creator_id = body.get("creatorId", "")
    source_kind = body.get("sourceKind")
    source_id = body.get("sourceId")
    source_plan_id = body.get("sourcePlanId")

    if not material_id or not risk_type or not level:
        raise HTTPException(status_code=400, detail="materialId / type / level 为必填。")
    if risk_type not in TYPE_LABELS:
        raise HTTPException(status_code=400, detail=f"不支持的风险类型：{risk_type}")
    if level not in {"RED", "ORANGE", "YELLOW", "GREEN"}:
        raise HTTPException(status_code=400, detail=f"不支持的风险等级：{level}")
    if not db.get(Material, material_id):
        raise HTTPException(status_code=404, detail="物料不存在。")

    # L2 节点级风险：必须提供 source 三元组并校验存在
    is_l2_type = risk_type in {"APPROVAL_OVERDUE", "COMMISSIONING_FAIL", "RAMP_BELOW_TARGET", "MILESTONE_DELAYED"}
    if is_l2_type:
        if source_kind not in _VALID_SOURCE_KINDS or not source_id:
            raise HTTPException(
                status_code=400,
                detail="L2 节点级风险必须提供 sourceKind / sourceId。",
            )
        model = {
            "item": ExpansionItem,
            "approval": Approval,
            "commissioning": CommissioningItem,
            "ramp": RampItem,
        }[source_kind]
        if not db.get(model, source_id):
            raise HTTPException(status_code=404, detail=f"{source_kind}#{source_id} 不存在。")
        if source_plan_id and not db.get(ExpansionPlan, source_plan_id):
            raise HTTPException(status_code=404, detail=f"plan#{source_plan_id} 不存在。")

    # Upsert：同一 source 三元组已有风险则覆盖（不重复创建）
    # 优先选 OPEN/IN_PROGRESS；CLOSED 也复用并重开（保留"已升级"标记）
    existing = None
    if is_l2_type and source_plan_id:
        existing = (
            db.query(Risk)
            .filter(
                Risk.source_kind == source_kind,
                Risk.source_id == source_id,
                Risk.source_plan_id == source_plan_id,
            )
            .order_by(
                # OPEN/IN_PROGRESS 排前面
                (Risk.status == "CLOSED").asc(),
                Risk.discovered_at.desc(),
            )
            .first()
        )
    if existing is not None:
        existing.level = level
        existing.description = description
        existing.impact_scope = impact_scope
        if existing.status == "CLOSED":
            # 重开（清掉 closedAt，让前端 toast 能识别"重新升级"）
            existing.status = "IN_PROGRESS"
            existing.closed_at = None
        db.commit()
        db.refresh(existing)
        return _serialize_risk(existing, db)

    import uuid

    risk = Risk(
        id=str(uuid.uuid4()),
        material_id=material_id,
        type=risk_type,
        level=level,
        description=description,
        impact_scope=impact_scope,
        creator_id=creator_id,
        source_kind=source_kind,
        source_id=source_id,
        source_plan_id=source_plan_id,
        status="OPEN",
        is_auto=False,
    )
    db.add(risk)
    db.commit()
    db.refresh(risk)
    return _serialize_risk(risk, db)


@crud_router.get("/{risk_id}")
def get_risk(
    risk_id: str,
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    risk = (
        db.query(Risk)
        .options(joinedload(Risk.material).joinedload(Material.supplier), joinedload(Risk.actions))
        .filter(Risk.id == risk_id)
        .first()
    )
    if not risk:
        raise HTTPException(status_code=404, detail="风险不存在。")
    return _serialize_risk(risk, db)


@crud_router.patch("/{risk_id}")
def update_risk(
    risk_id: str,
    body: dict,
    db: Session = Depends(get_db),
    _: str = Depends(require_session),
):
    """部分更新风险字段（level / status / description / impactScope / closedAt）。"""
    risk = db.get(Risk, risk_id)
    if not risk:
        raise HTTPException(status_code=404, detail="风险不存在。")
    if "level" in body and body["level"] in {"RED", "ORANGE", "YELLOW", "GREEN"}:
        risk.level = body["level"]
    if "status" in body and body["status"] in {"OPEN", "IN_PROGRESS", "CLOSED"}:
        risk.status = body["status"]
        if body["status"] == "CLOSED" and not risk.closed_at:
            risk.closed_at = datetime.utcnow()
        elif body["status"] != "CLOSED":
            risk.closed_at = None
    if "description" in body:
        risk.description = body["description"]
    if "impactScope" in body:
        risk.impact_scope = body["impactScope"]
    db.commit()
    db.refresh(risk)
    return _serialize_risk(risk, db)