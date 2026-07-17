import type { RiskLevel, RiskTypeKey } from '../types'

// 与后端 backend/app/api/risks.py TYPE_LABELS 一一对应
export const RISK_TYPE_LABELS: Record<RiskTypeKey, string> = {
  SINGLE_SOURCE: '单点依赖',
  LOW_INVENTORY: '库存不足',
  PRICE: '价格异常',
  POLICY: '政策风险',
  QUALITY: '质量风险',
  APPROVAL_OVERDUE: '审批逾期',
  COMMISSIONING_FAIL: '试车不达标',
  RAMP_BELOW_TARGET: '爬坡未达标',
  MILESTONE_DELAYED: '阀点延期',
}

export const RISK_TYPE_TONE: Record<RiskTypeKey, 'red' | 'orange' | 'yellow' | 'purple' | 'gray'> = {
  SINGLE_SOURCE: 'purple',
  LOW_INVENTORY: 'orange',
  PRICE: 'orange',
  POLICY: 'gray',
  QUALITY: 'red',
  APPROVAL_OVERDUE: 'red',
  COMMISSIONING_FAIL: 'red',
  RAMP_BELOW_TARGET: 'orange',
  MILESTONE_DELAYED: 'yellow',
}

// === 4 档等级（后端 enum）===
// UI 暴露 3 档：红 / 黄 / 绿；ORANGE 与 YELLOW 合并显示为黄
export const LEVEL_LABEL: Record<RiskLevel, string> = {
  RED: '红',
  ORANGE: '黄',
  YELLOW: '黄',
  GREEN: '绿',
}

export const LEVEL_TONE: Record<RiskLevel, 'red' | 'orange' | 'yellow' | 'green' | 'gray'> = {
  RED: 'red',
  ORANGE: 'orange',
  YELLOW: 'yellow',
  GREEN: 'green',
  // 不直接使用，仅占位
}

export const LEVEL_UI_TONE: Record<RiskLevel, 'red' | 'yellow' | 'green'> = {
  RED: 'red',
  ORANGE: 'yellow',
  YELLOW: 'yellow',
  GREEN: 'green',
}

export const LEVEL_ORDER: RiskLevel[] = ['RED', 'ORANGE', 'YELLOW', 'GREEN']

export function typeBadgeMeta(type: string): { label: string; tone: string } {
  const t = type as RiskTypeKey
  return {
    label: RISK_TYPE_LABELS[t] ?? type,
    tone: RISK_TYPE_TONE[t] ?? 'gray',
  }
}

export function levelBadgeMeta(level: RiskLevel): { label: string; tone: 'red' | 'yellow' | 'green' } {
  return { label: LEVEL_LABEL[level], tone: LEVEL_UI_TONE[level] }
}

// 4 档 → 3 档 UI 等级（按项目约定：ORANGE/YELLOW 同显为黄）
export function uiLevel(level: RiskLevel): 'red' | 'yellow' | 'green' {
  return LEVEL_UI_TONE[level]
}
