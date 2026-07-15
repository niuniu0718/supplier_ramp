from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import Action, Material, Risk
from ..security import require_session

router = APIRouter(prefix="/api/boards/risks/views", tags=["risks"])

TYPE_LABELS = {
    "SINGLE_SOURCE": "单点依赖",
    "LOW_INVENTORY": "库存不足",
    "PRICE": "价格异常",
    "POLICY": "政策风险",
    "QUALITY": "质量风险",
}


def _serialize_risk(r: Risk) -> Dict[str, Any]:
    open_actions = sum(1 for a in r.actions if a.status not in ("COMPLETED", "SHELVED"))
    actions = [{
        "id": a.id,
        "type": a.type,
        "taskProgress": a.task.progress if a.task else None,
        "owner": a.owner_id,
        "status": a.status,
    } for a in r.actions]
    return {
        "id": r.id,
        "type": r.type,
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
    }


@router.get("/overview")
def overview(db: Session = Depends(get_db), _: str = Depends(require_session)):
    risks = (
        db.query(Risk)
        .options(joinedload(Risk.material).joinedload(Material.supplier), joinedload(Risk.actions))
        .order_by(Risk.discovered_at.desc())
        .all()
    )
    rows = [_serialize_risk(r) for r in risks]
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
        item = _serialize_risk(r)
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