export const EVIDENCE_CATEGORIES = [
  { key: 'DEVICE_PHOTO', label: '设备到货照' },
  { key: 'CONTRACT', label: '合同' },
  { key: 'PAYMENT', label: '付款凭证' },
  { key: 'TEST_REPORT', label: '检测/验证报告' },
  { key: 'SITE_PHOTO', label: '现场照' },
  { key: 'OTHER', label: '其他' },
] as const

export const ITEM_STATUSES = [
  { key: '未开始', label: '未开始' },
  { key: '进行中', label: '进行中' },
  { key: '已完成', label: '已完成' },
  { key: '已逾期', label: '已逾期' },
] as const

export const PLAN_STAGES = [
  { key: '采购设备', label: '采购设备' },
  { key: '安装', label: '安装' },
  { key: '调试', label: '调试' },
  { key: '投产', label: '投产' },
  { key: '验收', label: '验收' },
] as const

export const RISK_LEVELS = [
  { key: 'GREEN', label: '低风险', color: 'var(--green)' },
  { key: 'YELLOW', label: '中风险', color: 'var(--yellow)' },
  { key: 'RED', label: '高风险', color: 'var(--red)' },
] as const

export const PASS_STATUSES = [
  { key: 'PENDING', label: '待开始' },
  { key: 'IN_PROGRESS', label: '进行中' },
  { key: 'PASS', label: '合格' },
  { key: 'FAIL', label: '不合格' },
] as const

export const RAMP_STATUSES = [
  { key: 'PENDING', label: '待开始' },
  { key: 'IN_PROGRESS', label: '进行中' },
  { key: 'PASS', label: '已达标' },
  { key: 'FAIL', label: '未达标' },
] as const

export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 10)
}

export function fromDateInput(value: string): string | null {
  if (!value) return null
  return new Date(value + 'T00:00:00').toISOString()
}
