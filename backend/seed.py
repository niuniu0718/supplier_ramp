from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.db import SessionLocal, init_db
from app.models import (
    Action,
    Attachment,
    ExpansionItem,
    ExpansionPlan,
    FollowTask,
    Material,
    Risk,
    Supplier,
    TaskUpdate,
)


def days_ago(n: int) -> datetime:
    return datetime.utcnow() - timedelta(days=n)


def days_ahead(n: int) -> datetime:
    return datetime.utcnow() + timedelta(days=n)


def months_ago(n: int) -> datetime:
    return datetime.utcnow() - timedelta(days=n * 30)


def months_ahead(n: int) -> datetime:
    return datetime.utcnow() + timedelta(days=n * 30)


SUPPLIERS = [
    {"id": "S_GANFENG", "code": "GF-LIB", "name": "赣锋锂业股份有限公司", "short_name": "赣锋",
     "category": "正极", "contact": "李经理 / 13800001001", "location": "江西新余", "cooperation_years": 5},
    {"id": "S_YUNENG", "code": "YN-LFP", "name": "湖南裕能新能源", "short_name": "裕能",
     "category": "正极", "contact": "王经理 / 13800001002", "location": "湖南湘潭", "cooperation_years": 3},
    {"id": "S_RONGBAI", "code": "RB-NCM", "name": "容百科技", "short_name": "容百",
     "category": "正极", "contact": "张经理 / 13800001003", "location": "浙江余姚", "cooperation_years": 4},
    {"id": "S_BEITERUI", "code": "BT-AG", "name": "贝特瑞新材料", "short_name": "贝特瑞",
     "category": "负极", "contact": "陈经理 / 13800001004", "location": "广东深圳", "cooperation_years": 6},
    {"id": "S_DUOFUDUO", "code": "DFD-6F", "name": "多氟多新材料股份有限公司", "short_name": "多氟多",
     "category": "电解液", "contact": "孙经理 / 13800001005", "location": "河南焦作", "cooperation_years": 3},
]

MATERIALS = [
    {"id": "M001", "name": "电池级碳酸锂", "type": "CATHODE", "supplier_id": "S_GANFENG",
     "demand_monthly": 120, "supply_monthly": 120, "inventory": 36, "safety_stock_months": 0.3,
     "single_source": True, "risk_description": "赣锋独家供应，库存仅 0.3 个月"},
    {"id": "M002", "name": "磷酸铁锂 (LFP)", "type": "CATHODE", "supplier_id": "S_YUNENG",
     "demand_monthly": 800, "supply_monthly": 720, "inventory": 1200, "safety_stock_months": 4,
     "single_source": False, "risk_description": "供需缺口 10%"},
    {"id": "M003", "name": "高镍三元 NCM811", "type": "CATHODE", "supplier_id": "S_RONGBAI",
     "demand_monthly": 350, "supply_monthly": 280, "inventory": 180, "safety_stock_months": 2,
     "single_source": False, "risk_description": "缺口 20%"},
    {"id": "M004", "name": "人造石墨负极", "type": "ANODE", "supplier_id": "S_BEITERUI",
     "demand_monthly": 600, "supply_monthly": 580, "inventory": 900, "safety_stock_months": 5,
     "single_source": False, "risk_description": "良率波动"},
    {"id": "M005", "name": "六氟磷酸锂 (6F)", "type": "ELECTROLYTE", "supplier_id": "S_DUOFUDUO",
     "demand_monthly": 200, "supply_monthly": 200, "inventory": 400, "safety_stock_months": 6,
     "single_source": False, "risk_description": "稳定供应"},
    {"id": "M006", "name": "电池级 PVDF", "type": "BINDER", "supplier_id": "S_RONGBAI",
     "demand_monthly": 50, "supply_monthly": 35, "inventory": 30, "safety_stock_months": 1.5,
     "single_source": False, "risk_description": "进口依赖高"},
    {"id": "M007", "name": "电解液配方 EC", "type": "ELECTROLYTE", "supplier_id": "S_DUOFUDUO",
     "demand_monthly": 80, "supply_monthly": 80, "inventory": 200, "safety_stock_months": 6,
     "single_source": False, "risk_description": "稳定"},
    {"id": "M008", "name": "天然石墨", "type": "ANODE", "supplier_id": "S_BEITERUI",
     "demand_monthly": 200, "supply_monthly": 200, "inventory": 300, "safety_stock_months": 4,
     "single_source": False, "risk_description": "稳定"},
    {"id": "M009", "name": "镍钴锰前驱体", "type": "CATHODE", "supplier_id": "S_RONGBAI",
     "demand_monthly": 150, "supply_monthly": 150, "inventory": 250, "safety_stock_months": 5,
     "single_source": False, "risk_description": "稳定"},
    {"id": "M010", "name": "导电炭黑 Super-P", "type": "ADDITIVE", "supplier_id": "S_YUNENG",
     "demand_monthly": 30, "supply_monthly": 30, "inventory": 60, "safety_stock_months": 6,
     "single_source": False, "risk_description": "稳定"},
]

RISKS = [
    {"id": "R001", "material_id": "M001", "type": "SINGLE_SOURCE", "level": "RED",
     "description": "电池级碳酸锂仅赣锋一家供应，安全库存跌破 1 个月警戒线。",
     "impact_scope": "影响全系动力电池产线，预计 Q3 产能损失 8%。",
     "creator_id": "admin", "status": "OPEN"},
    {"id": "R002", "material_id": "M002", "type": "LOW_INVENTORY", "level": "ORANGE",
     "description": "LFP 月缺口 80 吨，6 月排产受影响。",
     "impact_scope": "影响储能产线交付。",
     "creator_id": "admin", "status": "OPEN"},
    {"id": "R003", "material_id": "M006", "type": "PRICE", "level": "ORANGE",
     "description": "PVDF 海外报价 Q3 上调 12%。",
     "impact_scope": "增加 BOM 成本约 0.8 分/Wh。",
     "creator_id": "admin", "status": "OPEN"},
    {"id": "R004", "material_id": "M006", "type": "POLICY", "level": "YELLOW",
     "description": "PVDF 出口许可审查趋严。",
     "impact_scope": "切换国产替代。",
     "creator_id": "admin", "status": "OPEN"},
    {"id": "R005", "material_id": "M004", "type": "QUALITY", "level": "ORANGE",
     "description": "贝特瑞人造石墨良率波动至 88%。",
     "impact_scope": "影响负极一致性。",
     "creator_id": "admin", "status": "OPEN"},
    {"id": "R006", "material_id": "M003", "type": "SINGLE_SOURCE", "level": "YELLOW",
     "description": "容百 NCM811 前驱体 70% 来自单一矿源。",
     "impact_scope": "高镍三元扩产风险。",
     "creator_id": "admin", "status": "OPEN"},
    {"id": "R007", "material_id": "M005", "type": "PRICE", "level": "YELLOW",
     "description": "6F 下游需求恢复，价格上行预期。",
     "impact_scope": "电解液成本上行。",
     "creator_id": "admin", "status": "OPEN"},
    {"id": "R008", "material_id": "M007", "type": "LOW_INVENTORY", "level": "GREEN",
     "description": "EC 库存健康但需关注海运周期。",
     "impact_scope": "无实质影响。",
     "creator_id": "admin", "status": "OPEN"},
    {"id": "R009", "material_id": "M005", "type": "PRICE", "level": "GREEN",
     "description": "LiPF6 4 月价格异动已回落，Q2 长协覆盖 80%。",
     "impact_scope": "无。",
     "creator_id": "admin", "status": "CLOSED", "discovered_at": days_ago(45), "closed_at": days_ago(10)},
    {"id": "R010", "material_id": "M008", "type": "POLICY", "level": "GREEN",
     "description": "NMP 危化品许可 5 月续期完成，运输恢复。",
     "impact_scope": "无。",
     "creator_id": "admin", "status": "CLOSED", "discovered_at": days_ago(60), "closed_at": days_ago(20)},
]

ACTIONS = [
    {"id": "A001", "risk_id": "R001", "type": "SOURCING",
     "description": "启动备份供应商寻源：完成 2 家候选资质初审，6 月内送样。",
     "recommender_id": "admin", "owner_id": "admin", "start_date": days_ago(8),
     "deadline": days_ahead(25), "priority": "P0", "status": "IN_PROGRESS", "completion": 30},
    {"id": "A002", "risk_id": "R002", "type": "STOCK",
     "description": "紧急备货 500 吨 LFP，对接裕能锁定 6 月产能配额。",
     "recommender_id": "admin", "owner_id": "admin", "start_date": days_ago(5),
     "deadline": days_ahead(10), "priority": "P0", "status": "IN_PROGRESS", "completion": 40},
    {"id": "A003", "risk_id": "R003", "type": "PRICE_LOCK",
     "description": "与供应商签订 Q3 锁价长协补充协议，覆盖 70% 用量。",
     "recommender_id": "admin", "owner_id": "admin", "start_date": days_ago(3),
     "deadline": days_ahead(3), "priority": "P1", "status": "NOT_STARTED", "completion": 0},
    {"id": "A004", "risk_id": "R004", "type": "SOURCING",
     "description": "推进国产 PVDF 多源化：3 家国产供应商送样与验证。",
     "recommender_id": "admin", "owner_id": "admin", "start_date": days_ago(15),
     "deadline": days_ago(2), "priority": "P1", "status": "IN_PROGRESS", "completion": 60},
    {"id": "A005", "risk_id": "R005", "type": "OTHER",
     "description": "要求贝特瑞提交 8D 报告并配合现场审计。",
     "recommender_id": "admin", "owner_id": "admin", "start_date": days_ago(20),
     "deadline": days_ago(30), "priority": "P2", "status": "COMPLETED", "completion": 100},
]

TASKS = [
    {"id": "T001", "action_id": "A001", "title": "备份供应商寻源：候选资质初审",
     "owner_id": "admin", "start_date": days_ago(8), "deadline": days_ahead(25),
     "progress": 60, "status": "IN_PROGRESS", "progress_description": "完成 2 家候选初审，送样中。"},
    {"id": "T002", "action_id": "A002", "title": "LFP 紧急备货 500 吨",
     "owner_id": "admin", "start_date": days_ago(5), "deadline": days_ahead(10),
     "progress": 40, "status": "IN_PROGRESS", "progress_description": "已锁定 200 吨配额。"},
    {"id": "T003", "action_id": "A003", "title": "Q3 PVDF 锁价谈判",
     "owner_id": "admin", "start_date": days_ago(3), "deadline": days_ahead(3),
     "progress": 0, "status": "NOT_STARTED", "progress_description": ""},
    {"id": "T004", "action_id": "A004", "title": "国产 PVDF 多源化验证",
     "owner_id": "admin", "start_date": days_ago(15), "deadline": days_ago(2),
     "progress": 60, "status": "OVERDUE", "progress_description": "3 家国产供应商送样完成，待第二轮评估。"},
    {"id": "T005", "action_id": "A005", "title": "贝特瑞 8D 报告审查",
     "owner_id": "admin", "start_date": days_ago(20), "deadline": days_ago(5),
     "progress": 100, "status": "COMPLETED", "closed_at": days_ago(8),
     "progress_description": "8D 报告已通过审核，措施闭环。"},
]

PLAN_ITEMS = [
    # P001 二期 3 万吨电池级碳酸锂扩产 — 进度 38% / ORANGE
    {"plan_id": "P001", "milestone_key": "FEASIBILITY", "milestone_order": 1,
     "type": "里程碑", "name": "立项批复", "vendor": "集团战略部",
     "order_no": "P001-FT-2024", "expected_arrival": months_ago(8),
     "actual_arrival": months_ago(8), "status": "已完成", "delay_days": 0,
     "supplier_action": "提交扩产可行性研究报告 + 投资测算。",
     "procurement_action": "战略采购评审 + 立项批复文件归档。"},
    {"plan_id": "P001", "milestone_key": "EIA", "milestone_order": 2,
     "type": "里程碑", "name": "环评安评", "vendor": "江西环保研究所",
     "order_no": "P001-EIA-2024", "expected_arrival": months_ago(7),
     "actual_arrival": months_ago(7), "status": "已完成", "delay_days": 0,
     "supplier_action": "提供场地三通一平资料 + 配合现场踏勘。",
     "procurement_action": "EHS 团队对接第三方评估 + 取得批复。"},
    {"plan_id": "P001", "milestone_key": "EQUIPMENT_ORDER", "milestone_order": 3,
     "type": "里程碑", "name": "设备采购签约", "vendor": "江苏鹏飞/海外长协",
     "order_no": "P001-PO-2024", "expected_arrival": months_ago(6),
     "actual_arrival": months_ago(6), "status": "已完成", "delay_days": 0,
     "supplier_action": "完成技术协议 + 商务谈判。",
     "procurement_action": "签订回转窑 + 关键设备长协 + 预付款支付。"},
    {"plan_id": "P001", "milestone_key": "CIVIL", "milestone_order": 4,
     "type": "里程碑", "name": "土建竣工", "vendor": "新余二建",
     "order_no": "P001-CV-2025", "expected_arrival": months_ago(3),
     "actual_arrival": months_ago(3), "status": "已完成", "delay_days": 0,
     "supplier_action": "厂房钢结构 + 设备基础施工交付。",
     "procurement_action": "现场监理 + 中期款支付。"},
    {"plan_id": "P001", "milestone_key": "EQUIPMENT_DELIVERY", "milestone_order": 5,
     "type": "里程碑", "name": "设备到货", "vendor": "江苏鹏飞",
     "order_no": "PF-2025-0312/0313", "expected_arrival": months_ago(1),
     "actual_arrival": None, "status": "部分到货", "delay_days": 30,
     "supplier_action": "回转窑 1# 已到货；2# 主体发货但配套电控柜排产中。",
     "procurement_action": "催交配套件 + 协调电气安装班组待命 + 部分进度款支付。"},
    {"plan_id": "P001", "milestone_key": "INSTALLATION", "milestone_order": 6,
     "type": "里程碑", "name": "安装调试", "vendor": "江苏鹏飞",
     "order_no": "P001-INS-2026", "expected_arrival": months_ahead(2),
     "actual_arrival": None, "status": "进行中", "delay_days": 0,
     "supplier_action": "现场工程师开始回转窑 1# 安装，预计 9 月完成。",
     "procurement_action": "安装监理跟踪 + 节点验收。"},
    {"plan_id": "P001", "milestone_key": "TRIAL_PRODUCTION", "milestone_order": 7,
     "type": "里程碑", "name": "试生产", "vendor": "赣锋",
     "order_no": "P001-TP-2026", "expected_arrival": months_ahead(5),
     "actual_arrival": None, "status": "待开始", "delay_days": 0,
     "supplier_action": "尚未开始。",
     "procurement_action": "工艺方案冻结 + 试生产原料准备。"},
    {"plan_id": "P001", "milestone_key": "FULL_PRODUCTION", "milestone_order": 8,
     "type": "里程碑", "name": "正式投产", "vendor": "赣锋",
     "order_no": "P001-FP-2026", "expected_arrival": months_ahead(6),
     "actual_arrival": None, "status": "待开始", "delay_days": 0,
     "supplier_action": "尚未开始。",
     "procurement_action": "产能爬坡对账 + 量产验收。"},

    # P002 三期 8 万吨 LFP 扩产 — 进度 52% / YELLOW
    {"plan_id": "P002", "milestone_key": "FEASIBILITY", "milestone_order": 1,
     "type": "里程碑", "name": "立项批复", "vendor": "集团战略部",
     "order_no": "P002-FT-2025", "expected_arrival": months_ago(5),
     "actual_arrival": months_ago(5), "status": "已完成", "delay_days": 0,
     "supplier_action": "提交可研报告 + 投资测算。",
     "procurement_action": "立项审批 + 文件归档。"},
    {"plan_id": "P002", "milestone_key": "EIA", "milestone_order": 2,
     "type": "里程碑", "name": "环评安评", "vendor": "湖南环保研究所",
     "order_no": "P002-EIA-2025", "expected_arrival": months_ago(4),
     "actual_arrival": months_ago(4), "status": "已完成", "delay_days": 0,
     "supplier_action": "场地资料 + 现场踏勘配合。",
     "procurement_action": "取得环评批复。"},
    {"plan_id": "P002", "milestone_key": "EQUIPMENT_ORDER", "milestone_order": 3,
     "type": "里程碑", "name": "设备采购签约", "vendor": "德国耐驰",
     "order_no": "P002-PO-2025", "expected_arrival": months_ago(3),
     "actual_arrival": months_ago(3), "status": "已完成", "delay_days": 0,
     "supplier_action": "技术谈判 + 商务报价。",
     "procurement_action": "砂磨机长协 + 预付款。"},
    {"plan_id": "P002", "milestone_key": "CIVIL", "milestone_order": 4,
     "type": "里程碑", "name": "土建竣工", "vendor": "湘潭建工",
     "order_no": "P002-CV-2025", "expected_arrival": months_ago(2),
     "actual_arrival": months_ago(2), "status": "已完成", "delay_days": 0,
     "supplier_action": "厂房交付。",
     "procurement_action": "现场验收。"},
    {"plan_id": "P002", "milestone_key": "EQUIPMENT_DELIVERY", "milestone_order": 5,
     "type": "里程碑", "name": "设备到货", "vendor": "德国耐驰",
     "order_no": "NE-2026-001/002", "expected_arrival": months_ago(1),
     "actual_arrival": None, "status": "部分到货", "delay_days": 25,
     "supplier_action": "砂磨机 1# 已到场，2# 主机身到场 + 研磨介质海运中。",
     "procurement_action": "每周对账催货 + 工艺验证排期 8 月第二周。"},
    {"plan_id": "P002", "milestone_key": "INSTALLATION", "milestone_order": 6,
     "type": "里程碑", "name": "安装调试", "vendor": "德国耐驰",
     "order_no": "P002-INS-2026", "expected_arrival": months_ahead(1),
     "actual_arrival": None, "status": "进行中", "delay_days": 0,
     "supplier_action": "砂磨机 1# 调试完成；2# 安装排期中。",
     "procurement_action": "工艺验证 + 浆料粒度匹配测试。"},
    {"plan_id": "P002", "milestone_key": "TRIAL_PRODUCTION", "milestone_order": 7,
     "type": "里程碑", "name": "试生产", "vendor": "裕能",
     "order_no": "P002-TP-2026", "expected_arrival": months_ahead(2),
     "actual_arrival": None, "status": "待开始", "delay_days": 0,
     "supplier_action": "尚未开始。",
     "procurement_action": "试生产原料 + 工艺规程准备。"},
    {"plan_id": "P002", "milestone_key": "FULL_PRODUCTION", "milestone_order": 8,
     "type": "里程碑", "name": "正式投产", "vendor": "裕能",
     "order_no": "P002-FP-2026", "expected_arrival": months_ahead(3),
     "actual_arrival": None, "status": "待开始", "delay_days": 0,
     "supplier_action": "尚未开始。",
     "procurement_action": "量产爬坡对账。"},

    # P003 高镍三元产线技改 — 进度 35% / RED
    {"plan_id": "P003", "milestone_key": "FEASIBILITY", "milestone_order": 1,
     "type": "里程碑", "name": "立项批复", "vendor": "集团战略部",
     "order_no": "P003-FT-2025", "expected_arrival": months_ago(6),
     "actual_arrival": months_ago(6), "status": "已完成", "delay_days": 0,
     "supplier_action": "技改方案 + 投资测算。",
     "procurement_action": "立项审批。"},
    {"plan_id": "P003", "milestone_key": "EIA", "milestone_order": 2,
     "type": "里程碑", "name": "环评安评", "vendor": "余姚环保所",
     "order_no": "P003-EIA-2025", "expected_arrival": months_ago(5),
     "actual_arrival": months_ago(5), "status": "已完成", "delay_days": 0,
     "supplier_action": "技改场地资料。",
     "procurement_action": "取得环评批复。"},
    {"plan_id": "P003", "milestone_key": "EQUIPMENT_ORDER", "milestone_order": 3,
     "type": "里程碑", "name": "设备采购签约", "vendor": "苏州博华",
     "order_no": "P003-PO-2025", "expected_arrival": months_ago(4),
     "actual_arrival": months_ago(4), "status": "已完成", "delay_days": 0,
     "supplier_action": "技术协议 + 商务谈判。",
     "procurement_action": "烧结炉采购合同 + 60% 首付。"},
    {"plan_id": "P003", "milestone_key": "CIVIL", "milestone_order": 4,
     "type": "里程碑", "name": "土建竣工", "vendor": "余姚二建",
     "order_no": "P003-CV-2025", "expected_arrival": months_ago(1),
     "actual_arrival": months_ago(1), "status": "已完成", "delay_days": 0,
     "supplier_action": "烧结炉基础 + 配套管线交付。",
     "procurement_action": "土建验收。"},
    {"plan_id": "P003", "milestone_key": "EQUIPMENT_DELIVERY", "milestone_order": 5,
     "type": "里程碑", "name": "设备到货", "vendor": "苏州博华",
     "order_no": "BH-2026-008", "expected_arrival": months_ahead(2),
     "actual_arrival": None, "status": "已签", "delay_days": 0,
     "supplier_action": "技术协议确认后进入制造阶段，预计 9 月中旬发货。",
     "procurement_action": "跟踪制造进度 + 安装场地准备。"},
    {"plan_id": "P003", "milestone_key": "INSTALLATION", "milestone_order": 6,
     "type": "里程碑", "name": "安装调试", "vendor": "苏州博华",
     "order_no": "P003-INS-2026", "expected_arrival": months_ahead(3),
     "actual_arrival": None, "status": "待开始", "delay_days": 0,
     "supplier_action": "尚未开始。",
     "procurement_action": "安装方案 + 监理排期。"},
    {"plan_id": "P003", "milestone_key": "TRIAL_PRODUCTION", "milestone_order": 7,
     "type": "里程碑", "name": "试生产", "vendor": "容百",
     "order_no": "P003-TP-2026", "expected_arrival": months_ahead(4),
     "actual_arrival": None, "status": "待开始", "delay_days": 0,
     "supplier_action": "尚未开始。",
     "procurement_action": "尚未约定。"},
    {"plan_id": "P003", "milestone_key": "FULL_PRODUCTION", "milestone_order": 8,
     "type": "里程碑", "name": "正式投产", "vendor": "容百",
     "order_no": "P003-FP-2026", "expected_arrival": months_ahead(5),
     "actual_arrival": None, "status": "待开始", "delay_days": 0,
     "supplier_action": "尚未开始。",
     "procurement_action": "尚未约定。"},

    # P004 云南 5 万吨石墨化扩产 — 进度 72% / ORANGE
    {"plan_id": "P004", "milestone_key": "FEASIBILITY", "milestone_order": 1,
     "type": "里程碑", "name": "立项批复", "vendor": "集团战略部",
     "order_no": "P004-FT-2024", "expected_arrival": months_ago(10),
     "actual_arrival": months_ago(10), "status": "已完成", "delay_days": 0,
     "supplier_action": "可研 + 投资测算。",
     "procurement_action": "立项批复。"},
    {"plan_id": "P004", "milestone_key": "EIA", "milestone_order": 2,
     "type": "里程碑", "name": "环评安评", "vendor": "云南环保所",
     "order_no": "P004-EIA-2024", "expected_arrival": months_ago(9),
     "actual_arrival": months_ago(9), "status": "已完成", "delay_days": 0,
     "supplier_action": "场地资料。",
     "procurement_action": "环评批复。"},
    {"plan_id": "P004", "milestone_key": "EQUIPMENT_ORDER", "milestone_order": 3,
     "type": "里程碑", "name": "设备采购签约", "vendor": "湖南顶立",
     "order_no": "P004-PO-2024", "expected_arrival": months_ago(8),
     "actual_arrival": months_ago(8), "status": "已完成", "delay_days": 0,
     "supplier_action": "技术协议 + 商务谈判。",
     "procurement_action": "石墨化炉采购合同。"},
    {"plan_id": "P004", "milestone_key": "CIVIL", "milestone_order": 4,
     "type": "里程碑", "name": "土建竣工", "vendor": "云南建工",
     "order_no": "P004-CV-2025", "expected_arrival": months_ago(6),
     "actual_arrival": months_ago(6), "status": "已完成", "delay_days": 0,
     "supplier_action": "厂房 + 炉基交付。",
     "procurement_action": "监理验收。"},
    {"plan_id": "P004", "milestone_key": "EQUIPMENT_DELIVERY", "milestone_order": 5,
     "type": "里程碑", "name": "设备到货", "vendor": "湖南顶立",
     "order_no": "DL-2026-005", "expected_arrival": months_ago(4),
     "actual_arrival": months_ago(4), "status": "已完成", "delay_days": 0,
     "supplier_action": "石墨化炉 1# 到场验收。",
     "procurement_action": "现场验货 + 进度款。"},
    {"plan_id": "P004", "milestone_key": "INSTALLATION", "milestone_order": 6,
     "type": "里程碑", "name": "安装调试", "vendor": "湖南顶立",
     "order_no": "P004-INS-2026", "expected_arrival": months_ago(3),
     "actual_arrival": months_ago(3), "status": "已完成", "delay_days": 0,
     "supplier_action": "工程师现场完成安装调试。",
     "procurement_action": "调试报告审核。"},
    {"plan_id": "P004", "milestone_key": "TRIAL_PRODUCTION", "milestone_order": 7,
     "type": "里程碑", "name": "试生产", "vendor": "贝特瑞",
     "order_no": "P004-TP-2026", "expected_arrival": months_ago(2),
     "actual_arrival": months_ago(2), "status": "已完成", "delay_days": 0,
     "supplier_action": "陪产 2 周完成投产爬坡 + 操作 SOP 交付。",
     "procurement_action": "周度产能爬坡数据跟踪 + 良率抽检对接。"},
    {"plan_id": "P004", "milestone_key": "FULL_PRODUCTION", "milestone_order": 8,
     "type": "里程碑", "name": "正式投产", "vendor": "贝特瑞",
     "order_no": "P004-FP-2026", "expected_arrival": months_ahead(1),
     "actual_arrival": None, "status": "进行中", "delay_days": 0,
     "supplier_action": "1# 炉量产爬坡中，单炉日产能 150 吨。",
     "procurement_action": "量产验收 + 8D 良率波动问题跟进。"},

    # P005 2 万吨 6F 电解液扩产 — 进度 45% / GREEN
    {"plan_id": "P005", "milestone_key": "FEASIBILITY", "milestone_order": 1,
     "type": "里程碑", "name": "立项批复", "vendor": "集团战略部",
     "order_no": "P005-FT-2025", "expected_arrival": months_ago(5),
     "actual_arrival": months_ago(5), "status": "已完成", "delay_days": 0,
     "supplier_action": "可研报告。",
     "procurement_action": "立项批复。"},
    {"plan_id": "P005", "milestone_key": "EIA", "milestone_order": 2,
     "type": "里程碑", "name": "环评安评", "vendor": "焦作环保所",
     "order_no": "P005-EIA-2025", "expected_arrival": months_ago(4),
     "actual_arrival": months_ago(4), "status": "已完成", "delay_days": 0,
     "supplier_action": "场地资料。",
     "procurement_action": "环评批复。"},
    {"plan_id": "P005", "milestone_key": "EQUIPMENT_ORDER", "milestone_order": 3,
     "type": "里程碑", "name": "设备采购签约", "vendor": "江苏乐科",
     "order_no": "P005-PO-2025", "expected_arrival": months_ago(3),
     "actual_arrival": months_ago(3), "status": "已完成", "delay_days": 0,
     "supplier_action": "技术协议。",
     "procurement_action": "反应釜采购合同 + 预付款。"},
    {"plan_id": "P005", "milestone_key": "CIVIL", "milestone_order": 4,
     "type": "里程碑", "name": "土建竣工", "vendor": "焦作建工",
     "order_no": "P005-CV-2026", "expected_arrival": months_ahead(2),
     "actual_arrival": None, "status": "进行中", "delay_days": 0,
     "supplier_action": "反应釜基础 + 防爆车间施工中。",
     "procurement_action": "现场监理 + 中期款。"},
    {"plan_id": "P005", "milestone_key": "EQUIPMENT_DELIVERY", "milestone_order": 5,
     "type": "里程碑", "name": "设备到货", "vendor": "江苏乐科",
     "order_no": "LK-2026-001", "expected_arrival": months_ahead(4),
     "actual_arrival": None, "status": "已签", "delay_days": 0,
     "supplier_action": "图纸会签后 60 天出厂，分体发运至焦作。",
     "procurement_action": "技术协议细化 + 工艺管线对接方案评审。"},
    {"plan_id": "P005", "milestone_key": "INSTALLATION", "milestone_order": 6,
     "type": "里程碑", "name": "安装调试", "vendor": "江苏乐科",
     "order_no": "P005-INS-2026", "expected_arrival": months_ahead(6),
     "actual_arrival": None, "status": "待开始", "delay_days": 0,
     "supplier_action": "尚未开始。",
     "procurement_action": "尚未约定。"},
    {"plan_id": "P005", "milestone_key": "TRIAL_PRODUCTION", "milestone_order": 7,
     "type": "里程碑", "name": "试生产", "vendor": "多氟多",
     "order_no": "P005-TP-2027", "expected_arrival": months_ahead(9),
     "actual_arrival": None, "status": "待开始", "delay_days": 0,
     "supplier_action": "尚未开始。",
     "procurement_action": "尚未约定。"},
    {"plan_id": "P005", "milestone_key": "FULL_PRODUCTION", "milestone_order": 8,
     "type": "里程碑", "name": "正式投产", "vendor": "多氟多",
     "order_no": "P005-FP-2027", "expected_arrival": months_ahead(11),
     "actual_arrival": None, "status": "待开始", "delay_days": 0,
     "supplier_action": "尚未开始。",
     "procurement_action": "尚未约定。"},
]

PLANS = [
    {"id": "P001", "material_id": "M001", "supplier_id": "S_GANFENG", "name": "二期 3 万吨电池级碳酸锂扩产",
     "start_date": months_ago(8), "end_date": months_ahead(6), "target_capacity": 30000,
     "invested_capex": 18000, "total_capex": 45000, "funding_sources": ["自筹", "银行贷款"],
     "stage": "安装", "progress": 38, "risk_types": ["SINGLE_SOURCE"],
     "risk_description": "设备到货滞后 1 个月", "owner_id": "admin"},
    {"id": "P002", "material_id": "M002", "supplier_id": "S_YUNENG", "name": "三期 8 万吨 LFP 扩产",
     "start_date": months_ago(5), "end_date": months_ahead(3), "target_capacity": 80000,
     "invested_capex": 42000, "total_capex": 80000, "funding_sources": ["自筹", "战略投资"],
     "stage": "调试", "progress": 52, "risk_types": ["LOW_INVENTORY"],
     "risk_description": "砂磨机调试延期", "owner_id": "admin"},
    {"id": "P003", "material_id": "M003", "supplier_id": "S_RONGBAI", "name": "高镍三元产线技改",
     "start_date": months_ago(6), "end_date": months_ahead(2), "target_capacity": 15000,
     "invested_capex": 22000, "total_capex": 38000, "funding_sources": ["自筹"],
     "stage": "采购设备", "progress": 35, "risk_types": ["SINGLE_SOURCE"],
     "risk_description": "烧结炉供应商单点", "owner_id": "admin"},
    {"id": "P004", "material_id": "M004", "supplier_id": "S_BEITERUI", "name": "云南 5 万吨石墨化扩产",
     "start_date": months_ago(10), "end_date": months_ahead(1), "target_capacity": 50000,
     "invested_capex": 35000, "total_capex": 50000, "funding_sources": ["自筹", "政府补贴"],
     "stage": "投产", "progress": 72, "risk_types": ["QUALITY"],
     "risk_description": "良率波动", "owner_id": "admin"},
    {"id": "P005", "material_id": "M005", "supplier_id": "S_DUOFUDUO", "name": "2 万吨 6F 电解液扩产",
     "start_date": months_ago(5), "end_date": months_ahead(11), "target_capacity": 20000,
     "invested_capex": 18000, "total_capex": 32000, "funding_sources": ["自筹"],
     "stage": "采购设备", "progress": 45, "risk_types": [],
     "risk_description": "", "owner_id": "admin"},
]


def seed(db: Session) -> None:
    db.query(TaskUpdate).delete()
    db.query(Attachment).delete()
    db.query(FollowTask).delete()
    db.query(Action).delete()
    db.query(Risk).delete()
    db.query(ExpansionItem).delete()
    from app.models.expansion import EvidenceChain
    db.query(EvidenceChain).delete()
    db.query(ExpansionPlan).delete()
    db.query(Material).delete()
    db.query(Supplier).delete()

    for s in SUPPLIERS:
        db.add(Supplier(**s))
    for m in MATERIALS:
        db.add(Material(**m))
    db.flush()

    for r in RISKS:
        db.add(Risk(**r))
    for a in ACTIONS:
        db.add(Action(**a))
    db.flush()

    for t in TASKS:
        db.add(FollowTask(**t))
    db.flush()

    db.add(TaskUpdate(task_id="T001", progress=30, description="完成候选名单确认",
                       author_id="admin", created_at=days_ago(5)))
    db.add(TaskUpdate(task_id="T001", progress=60, description="送样进行中",
                       author_id="admin", created_at=days_ago(2)))
    db.add(TaskUpdate(task_id="T005", progress=50, description="8D 报告提交",
                       author_id="admin", created_at=days_ago(15)))
    db.add(TaskUpdate(task_id="T005", progress=100, description="报告通过",
                       author_id="admin", created_at=days_ago(8)))

    db.add(Attachment(task_id="T005", category="TEST_REPORT", file_name="8D报告.pdf",
                      stored_name="8d-report.pdf", mime_type="application/pdf", size=2048,
                      url="/uploads/8d-report.pdf", uploaded_by_id="admin"))

    for p in PLANS:
        db.add(ExpansionPlan(**p))
    db.flush()

    for it in PLAN_ITEMS:
        db.add(ExpansionItem(**it))

    from app.models.expansion import EvidenceChain
    evidence_rows = [
        {"plan_id": "P001", "category": "DEVICE_PHOTO", "file_name": "窑炉1号到货验收.jpg",
         "stored_name": "kiln1.jpg", "mime_type": "image/jpeg", "size": 350_000,
         "url": "/uploads/kiln1.jpg", "note": "回转窑 1# 到货验收现场", "uploaded_by_id": "admin",
         "uploaded_at": days_ago(8)},
        {"plan_id": "P001", "category": "CONTRACT", "file_name": "鹏飞采购合同.pdf",
         "stored_name": "pf-contract.pdf", "mime_type": "application/pdf", "size": 540_000,
         "url": "/uploads/pf-contract.pdf", "note": "江苏鹏飞采购合同正本", "uploaded_by_id": "admin",
         "uploaded_at": months_ago(3)},
        {"plan_id": "P002", "category": "PAYMENT", "file_name": "耐驰设备付款凭证.pdf",
         "stored_name": "netzsch-pay.pdf", "mime_type": "application/pdf", "size": 210_000,
         "url": "/uploads/netzsch-pay.pdf", "note": "砂磨机 1# 尾款付款凭证", "uploaded_by_id": "admin",
         "uploaded_at": months_ago(1)},
        {"plan_id": "P002", "category": "TEST_REPORT", "file_name": "工艺验证报告v2.pdf",
         "stored_name": "lfp-validation.pdf", "mime_type": "application/pdf", "size": 800_000,
         "url": "/uploads/lfp-validation.pdf", "note": "LFP 工艺验证第二轮报告", "uploaded_by_id": "admin",
         "uploaded_at": months_ago(1)},
        {"plan_id": "P004", "category": "SITE_PHOTO", "file_name": "云南石墨化炉现场.jpg",
         "stored_name": "graphitization.jpg", "mime_type": "image/jpeg", "size": 420_000,
         "url": "/uploads/graphitization.jpg", "note": "石墨化炉 1# 投产现场", "uploaded_by_id": "admin",
         "uploaded_at": months_ago(2)},
        {"plan_id": "P005", "category": "CONTRACT", "file_name": "江苏乐科采购合同.pdf",
         "stored_name": "lk-contract.pdf", "mime_type": "application/pdf", "size": 380_000,
         "url": "/uploads/lk-contract.pdf", "note": "反应釜采购合同", "uploaded_by_id": "admin",
         "uploaded_at": months_ago(1)},
    ]
    # fix syntax typo
    for row in evidence_rows:
        db.add(EvidenceChain(**row))

    db.commit()


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        seed(db)
        print("Seed 完成。")
    finally:
        db.close()


if __name__ == "__main__":
    main()