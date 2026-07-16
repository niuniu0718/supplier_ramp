from __future__ import annotations

COMMISSIONING_TYPES = [
    {"order": 1, "key": "SINGLE_TRIAL", "name": "单机试车", "standard": "设备空载运行2h无异常"},
    {"order": 2, "key": "INTEGRATED_TRIAL", "name": "联动试车", "standard": "全流程联动运行8h无异常"},
    {"order": 3, "key": "FEED_TRIAL", "name": "投料试车", "standard": "按配方投料，产出合格产品"},
    {"order": 4, "key": "LOAD_TEST_72H", "name": "72h满负荷考核", "standard": "连续72h达到设计产能的90%以上"},
    {"order": 5, "key": "PRODUCT_QUALITY", "name": "产品质量验证", "standard": "产品检测指标全部符合规格"},
    {"order": 6, "key": "OEE_VERIFICATION", "name": "OEE达标验证", "standard": "OEE≧75%（爬坡期基准）"},
]

COMMISSIONING_BY_KEY = {t["key"]: t for t in COMMISSIONING_TYPES}


def commissioning_name(key: str) -> str:
    t = COMMISSIONING_BY_KEY.get(key)
    return t["name"] if t else key


def commissioning_standard(key: str) -> str:
    t = COMMISSIONING_BY_KEY.get(key)
    return t["standard"] if t else ""