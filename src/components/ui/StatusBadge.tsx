import type { RiskLevel } from '../../types'

const LABELS: Record<RiskLevel, string> = {
  GREEN: '绿色 · 健康',
  YELLOW: '黄色 · 关注',
  ORANGE: '橙色 · 警告',
  RED: '红色 · 危险',
}

const SHORT: Record<RiskLevel, string> = {
  GREEN: '绿',
  YELLOW: '黄',
  ORANGE: '橙',
  RED: '红',
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