from __future__ import annotations

MILESTONE_TEMPLATE = [
    {"order": 1, "key": "FEASIBILITY", "name": "需求确认与可行性研究"},
    {"order": 2, "key": "EIA", "name": "项目立项与审批"},
    {"order": 3, "key": "EQUIPMENT_ORDER", "name": "工艺设计与工程"},
    {"order": 4, "key": "CIVIL", "name": "政府审批与许可"},
    {"order": 5, "key": "EQUIPMENT_DELIVERY", "name": "施工建设与安装"},
    {"order": 6, "key": "INSTALLATION", "name": "试车验证与考核"},
    {"order": 7, "key": "TRIAL_PRODUCTION", "name": "客户认证与审核"},
    {"order": 8, "key": "FULL_PRODUCTION", "name": "量产爬坡与优化"},
]

MILESTONE_BY_KEY = {m["key"]: m for m in MILESTONE_TEMPLATE}


def milestone_name(key: str) -> str:
    m = MILESTONE_BY_KEY.get(key)
    return m["name"] if m else key