export interface RampPhase {
  order: number
  phase: string
  loadRate: number
  period: string
}

export const RAMP_PHASES: RampPhase[] = [
  { order: 1, phase: 'Phase1', loadRate: 40, period: '第1-2个月' },
  { order: 2, phase: 'Phase2', loadRate: 60, period: '第3-4个月' },
  { order: 3, phase: 'Phase3', loadRate: 80, period: '第5-6个月' },
  { order: 4, phase: 'Phase4', loadRate: 100, period: '第7-8个月' },
]

export const RAMP_BY_PHASE: Record<string, RampPhase> = Object.fromEntries(
  RAMP_PHASES.map((p) => [p.phase, p]),
)

export const RAMP_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; tone: 'pass' | 'fail' | 'progress' | 'pending' }
> = {
  PASS: { label: '已达标', color: 'var(--green)', bg: '#e6f8f1', tone: 'pass' },
  FAIL: { label: '未达标', color: 'var(--red)', bg: '#ffe4e0', tone: 'fail' },
  IN_PROGRESS: { label: '进行中', color: 'var(--orange)', bg: '#fff0e3', tone: 'progress' },
  PENDING: { label: '待开始', color: 'var(--text-muted)', bg: '#eef2f7', tone: 'pending' },
}

export function rampStatusMeta(status: string) {
  return RAMP_STATUS_META[status] ?? {
    label: status,
    color: 'var(--text-muted)',
    bg: '#eef2f7',
    tone: 'pending' as const,
  }
}