import type { RiskLevel } from '../../types'

const labels: Record<string, string> = {
  GREEN: '健康',
  YELLOW: '关注',
  ORANGE: '警告',
  RED: '危险',
  PENDING: '待评估',
  ASSESSING: '待评估',
  ACTION_DEFINED: '措施已定',
  IN_PROGRESS: '进行中',
  CLOSED: '已闭环',
  IGNORED: '已忽略',
  NOT_STARTED: '待启动',
  COMPLETED: '已完成',
  OVERDUE: '已逾期',
  ON_HOLD: '已搁置',
}

export function StatusBadge({ status, showDot = true }: { status: string; showDot?: boolean }) {
  const color = (['GREEN', 'YELLOW', 'ORANGE', 'RED'] as RiskLevel[]).includes(status as RiskLevel)
    ? status.toLowerCase()
    : status === 'COMPLETED' || status === 'CLOSED' ? 'green'
      : status === 'OVERDUE' ? 'red'
        : status === 'IN_PROGRESS' || status === 'ACTION_DEFINED' ? 'blue'
          : 'neutral'
  return (
    <span className={`status-badge status-${color}`}>
      {showDot && <span className="status-dot" />}
      {labels[status] ?? status}
    </span>
  )
}

export function riskLabel(level: RiskLevel) {
  return labels[level]
}

export function statusLabel(status: string) {
  return labels[status] ?? status
}
