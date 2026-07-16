export interface ApprovalType {
  order: number
  key: string
  name: string
  agency: string
  cycle: string
}

export const APPROVAL_TYPES: ApprovalType[] = [
  { order: 1, key: 'EIA', name: '环境影响评价（环评）', agency: '生态环境局', cycle: '6-18 个月' },
  { order: 2, key: 'SAFETY_PRE', name: '安全预评价（安评）', agency: '应急管理局', cycle: '3-6 个月' },
  { order: 3, key: 'EMISSION_PERMIT', name: '排污许可证', agency: '生态环境局', cycle: '3-6 个月' },
  { order: 4, key: 'ENERGY_REVIEW', name: '节能审查', agency: '发改委', cycle: '2-4 个月' },
  { order: 5, key: 'HAZMAT_PRODUCTION', name: '危险化学品生产许可', agency: '应急管理局', cycle: '3-6 个月' },
  { order: 6, key: 'LAND_USE', name: '建设用地规划许可', agency: '自然资源局', cycle: '6-12 个月' },
]

export const APPROVAL_CYCLE_BY_KEY: Record<string, string> = Object.fromEntries(
  APPROVAL_TYPES.map((t) => [t.key, t.cycle]),
)

export const APPROVAL_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; ring: string; tone: 'done' | 'progress' | 'pending' | 'overdue' }
> = {
  已完成: { label: '已完成', color: 'var(--green)', bg: '#e6f8f1', ring: '#18a875', tone: 'done' },
  进行中: { label: '进行中', color: 'var(--orange)', bg: '#fff0e3', ring: '#ef7d32', tone: 'progress' },
  未开始: { label: '未开始', color: 'var(--text-muted)', bg: '#eef2f7', ring: '#9ca3af', tone: 'pending' },
  已逾期: { label: '已逾期', color: 'var(--red)', bg: '#ffe4e0', ring: '#dc3f4c', tone: 'overdue' },
}

export function approvalStatusMeta(status: string) {
  return APPROVAL_STATUS_META[status] ?? {
    label: status,
    color: 'var(--text-muted)',
    bg: '#eef2f7',
    ring: '#9ca3af',
    tone: 'pending' as const,
  }
}