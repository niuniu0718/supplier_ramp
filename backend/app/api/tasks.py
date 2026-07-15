from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import Action, Attachment, FollowTask, Material, Risk
from ..security import require_session

router = APIRouter(prefix="/api/boards/tasks/views", tags=["tasks"])


def _serialize_task(t: FollowTask) -> Dict[str, Any]:
    action: Action = t.action
    risk: Risk = action.risk if action else None
    material: Material = risk.material if risk else None
    deadline_dt = t.deadline
    now = datetime.utcnow()
    days_to_deadline = (deadline_dt - now).days if deadline_dt else 0
    days_overdue = max(0, (now - deadline_dt).days) if deadline_dt and now > deadline_dt else 0
    overdue_days = (now - deadline_dt).days if deadline_dt and now > deadline_dt else 0
    return {
        "id": t.id,
        "title": t.title,
        "ownerName": "我",
        "ownerId": t.owner_id,
        "progress": t.progress,
        "status": t.status,
        "deadline": deadline_dt.isoformat() if deadline_dt else None,
        "startDate": t.start_date.isoformat() if t.start_date else None,
        "daysToDeadline": days_to_deadline,
        "daysOverdue": days_overdue,
        "riskId": risk.id if risk else None,
        "riskLevel": risk.level if risk else "GREEN",
        "riskType": risk.type if risk else None,
        "materialName": material.name if material else None,
        "supplierName": material.supplier.short_name if material and material.supplier else None,
        "actionType": action.type if action else None,
        "priority": action.priority if action else None,
        "attachmentCount": len(t.attachments),
        "progressDescription": t.progress_description,
        "overdueBy": max(0, overdue_days),
    }


@router.get("/my-todo")
def my_todo(db: Session = Depends(get_db), _: str = Depends(require_session)):
    tasks = (
        db.query(FollowTask)
        .options(
            joinedload(FollowTask.action).joinedload(Action.risk).joinedload(Risk.material).joinedload(Material.supplier),
            joinedload(FollowTask.attachments),
        )
        .filter(FollowTask.status.in_(["NOT_STARTED", "IN_PROGRESS"]))
        .order_by(FollowTask.deadline.asc())
        .all()
    )
    rows = [_serialize_task(t) for t in tasks]
    return {
        "board": "tasks",
        "view": "my-todo",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "kpis": [
            {"label": "进行中", "value": sum(1 for r in rows if r["status"] == "IN_PROGRESS"), "unit": "项",
             "tone": "blue"},
            {"label": "未开始", "value": sum(1 for r in rows if r["status"] == "NOT_STARTED"), "unit": "项",
             "tone": "yellow"},
            {"label": "3 天内到期", "value": sum(1 for r in rows if 0 <= r["daysToDeadline"] <= 3), "unit": "项",
             "tone": "orange"},
            {"label": "已逾期", "value": sum(1 for r in rows if r["daysOverdue"] > 0), "unit": "项",
             "tone": "red"},
        ],
        "rows": rows,
    }


@router.get("/overdue")
def overdue(db: Session = Depends(get_db), _: str = Depends(require_session)):
    now = datetime.utcnow()
    tasks = (
        db.query(FollowTask)
        .options(
            joinedload(FollowTask.action).joinedload(Action.risk).joinedload(Risk.material).joinedload(Material.supplier),
            joinedload(FollowTask.attachments),
        )
        .filter(FollowTask.deadline < now)
        .filter(FollowTask.status.in_(["NOT_STARTED", "IN_PROGRESS", "OVERDUE"]))
        .order_by(FollowTask.deadline.asc())
        .all()
    )
    rows = [_serialize_task(t) for t in tasks]
    return {
        "board": "tasks",
        "view": "overdue",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "kpis": [
            {"label": "逾期任务", "value": len(rows), "unit": "项", "tone": "red"},
            {"label": "红色等级", "value": sum(1 for r in rows if r["riskLevel"] == "RED"), "unit": "项",
             "tone": "red"},
            {"label": "平均逾期", "value": f"{sum(r['daysOverdue'] for r in rows) / max(1, len(rows)):.0f}",
             "unit": "天", "tone": "orange"},
        ],
        "rows": rows,
    }


@router.get("/escalation")
def escalation(db: Session = Depends(get_db), _: str = Depends(require_session)):
    now = datetime.utcnow()
    tasks = (
        db.query(FollowTask)
        .options(
            joinedload(FollowTask.action).joinedload(Action.risk).joinedload(Risk.material).joinedload(Material.supplier),
            joinedload(FollowTask.attachments),
        )
        .filter(FollowTask.status.in_(["NOT_STARTED", "IN_PROGRESS", "OVERDUE"]))
        .order_by(FollowTask.deadline.asc())
        .all()
    )
    remind: List[Dict[str, Any]] = []
    over: List[Dict[str, Any]] = []
    escalated: List[Dict[str, Any]] = []
    for t in tasks:
        item = _serialize_task(t)
        if t.deadline and t.deadline < now:
            overdue_by = (now - t.deadline).days
            if overdue_by >= 7:
                escalated.append(item)
            else:
                over.append(item)
        else:
            remind.append(item)
    return {
        "board": "tasks",
        "view": "escalation",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "kpis": [
            {"label": "3 天内", "value": len(remind), "unit": "项", "tone": "yellow"},
            {"label": "已逾期", "value": len(over), "unit": "项", "tone": "orange"},
            {"label": "升级", "value": len(escalated), "unit": "项", "tone": "red"},
        ],
        "remind": remind,
        "overdue": over,
        "escalated": escalated,
    }


@router.get("/closure")
def closure(db: Session = Depends(get_db), _: str = Depends(require_session)):
    tasks = (
        db.query(FollowTask)
        .options(
            joinedload(FollowTask.action).joinedload(Action.risk),
        )
        .filter(FollowTask.status == "COMPLETED")
        .order_by(FollowTask.closed_at.desc())
        .all()
    )
    rows: List[Dict[str, Any]] = []
    priority_counts: Dict[str, int] = {}
    for t in tasks:
        days = (t.closed_at - t.start_date).days if t.closed_at and t.start_date else 0
        priority = t.action.priority if t.action else "NORMAL"
        priority_counts[priority] = priority_counts.get(priority, 0) + 1
        rows.append({
            "id": t.id,
            "title": t.title,
            "ownerName": "我",
            "priority": priority,
            "riskType": t.action.risk.type if t.action and t.action.risk else None,
            "closedAt": t.closed_at.isoformat() if t.closed_at else None,
            "durationDays": days,
        })
    priority_order = ["P0", "P1", "P2", "P3"]
    by_priority = [
        {"priority": p, "count": priority_counts.get(p, 0)}
        for p in priority_order if priority_counts.get(p, 0) > 0
    ]
    return {
        "board": "tasks",
        "view": "closure",
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "kpis": [
            {"label": "已闭环", "value": len(rows), "unit": "项", "tone": "green"},
            {"label": "本周", "value": sum(1 for r in rows if r["closedAt"]
                                            and (datetime.utcnow() - datetime.fromisoformat(r["closedAt"])).days <= 7),
             "unit": "项", "tone": "blue"},
            {"label": "平均耗时", "value": f"{sum(r['durationDays'] for r in rows) / max(1, len(rows)):.0f}",
             "unit": "天", "tone": "purple"},
        ],
        "rows": rows,
        "byPriority": by_priority,
    }