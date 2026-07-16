export interface CommissioningType {
  order: number
  key: string
  name: string
  standard: string
}

export const COMMISSIONING_TYPES: CommissioningType[] = [
  { order: 1, key: 'SINGLE_TRIAL', name: '单机试车', standard: '设备空载运行2h无异常' },
  { order: 2, key: 'INTEGRATED_TRIAL', name: '联动试车', standard: '全流程联动运行8h无异常' },
  { order: 3, key: 'FEED_TRIAL', name: '投料试车', standard: '按配方投料，产出合格产品' },
  { order: 4, key: 'LOAD_TEST_72H', name: '72h满负荷考核', standard: '连续72h达到设计产能的90%以上' },
  { order: 5, key: 'PRODUCT_QUALITY', name: '产品质量验证', standard: '产品检测指标全部符合规格' },
  { order: 6, key: 'OEE_VERIFICATION', name: 'OEE达标验证', standard: 'OEE≧75%（爬坡期基准）' },
]

export const COMMISSIONING_BY_KEY: Record<string, CommissioningType> = Object.fromEntries(
  COMMISSIONING_TYPES.map((t) => [t.key, t]),
)

export const COMMISSIONING_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; tone: 'pass' | 'fail' | 'progress' | 'pending' }
> = {
  PASS: { label: '合格', color: 'var(--green)', bg: '#e6f8f1', tone: 'pass' },
  FAIL: { label: '不合格', color: 'var(--red)', bg: '#ffe4e0', tone: 'fail' },
  IN_PROGRESS: { label: '进行中', color: 'var(--orange)', bg: '#fff0e3', tone: 'progress' },
  PENDING: { label: '待开始', color: 'var(--text-muted)', bg: '#eef2f7', tone: 'pending' },
}

export function commissioningStatusMeta(status: string) {
  return COMMISSIONING_STATUS_META[status] ?? {
    label: status,
    color: 'var(--text-muted)',
    bg: '#eef2f7',
    tone: 'pending' as const,
  }
}