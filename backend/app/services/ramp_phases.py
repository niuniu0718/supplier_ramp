from __future__ import annotations

RAMP_PHASES = [
    {"order": 1, "phase": "Phase1", "loadRate": 40, "period": "第1-2个月"},
    {"order": 2, "phase": "Phase2", "loadRate": 60, "period": "第3-4个月"},
    {"order": 3, "phase": "Phase3", "loadRate": 80, "period": "第5-6个月"},
    {"order": 4, "phase": "Phase4", "loadRate": 100, "period": "第7-8个月"},
]

RAMP_BY_PHASE = {p["phase"]: p for p in RAMP_PHASES}