from __future__ import annotations

APPROVAL_TYPES = [
    {"order": 1, "key": "EIA", "name": "环境影响评价（环评）", "agency": "生态环境局"},
    {"order": 2, "key": "SAFETY_PRE", "name": "安全预评价（安评）", "agency": "应急管理局"},
    {"order": 3, "key": "EMISSION_PERMIT", "name": "排污许可证", "agency": "生态环境局"},
    {"order": 4, "key": "ENERGY_REVIEW", "name": "节能审查", "agency": "发改委"},
    {"order": 5, "key": "HAZMAT_PRODUCTION", "name": "危险化学品生产许可", "agency": "应急管理局"},
    {"order": 6, "key": "LAND_USE", "name": "建设用地规划许可", "agency": "自然资源局"},
]

APPROVAL_BY_KEY = {t["key"]: t for t in APPROVAL_TYPES}


def approval_name(key: str) -> str:
    t = APPROVAL_BY_KEY.get(key)
    return t["name"] if t else key


def approval_agency(key: str) -> str:
    t = APPROVAL_BY_KEY.get(key)
    return t["agency"] if t else ""