import type { RiskLevel } from '../../types'

const LABELS: Record<RiskLevel, string> = {
  GREEN: '低风险',
  YELLOW: '中风险',
  ORANGE: '中风险',
  RED: '高风险',
}

const SHORT: Record<RiskLevel, string> = {
  GREEN: '低',
  YELLOW: '中',
  ORANGE: '中',
  RED: '高',
}

interface StatusBadgeProps { status: string; short?: boolean }
export function StatusBadge({ status, short = false }: StatusBadgeProps) {
  const tone = (['GREEN', 'YELLOW', 'ORANGE', 'RED'] as RiskLevel[]).includes(status as RiskLevel)
    ? (status as RiskLevel)
    : 'GREEN'
  return (
    <span className={`status-badge status-${tone.toLowerCase()}`}>
      <span className="dot" />
      {short ? SHORT[tone] : LABELS[tone]}
    </span>
  )
}