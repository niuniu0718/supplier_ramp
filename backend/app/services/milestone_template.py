from __future__ import annotations

MILESTONE_TEMPLATE = [
    {"order": 1, "key": "FEASIBILITY", "name": "立项批复"},
    {"order": 2, "key": "EIA", "name": "环评安评"},
    {"order": 3, "key": "EQUIPMENT_ORDER", "name": "设备采购签约"},
    {"order": 4, "key": "CIVIL", "name": "土建竣工"},
    {"order": 5, "key": "EQUIPMENT_DELIVERY", "name": "设备到货"},
    {"order": 6, "key": "INSTALLATION", "name": "安装调试"},
    {"order": 7, "key": "TRIAL_PRODUCTION", "name": "试生产"},
    {"order": 8, "key": "FULL_PRODUCTION", "name": "正式投产"},
]

MILESTONE_BY_KEY = {m["key"]: m for m in MILESTONE_TEMPLATE}


def milestone_name(key: str) -> str:
    m = MILESTONE_BY_KEY.get(key)
    return m["name"] if m else key