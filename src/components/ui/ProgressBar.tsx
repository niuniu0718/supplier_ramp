export function ProgressBar({ value, expected, status, compact = false }: {
  value: number
  expected?: number
  status?: string
  compact?: boolean
}) {
  const color = status?.toLowerCase() ?? (value === 100 ? 'green' : 'blue')
  return (
    <div className={`progress-wrap ${compact ? 'compact' : ''}`}>
      <div className="progress-track">
        <div className={`progress-fill progress-${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
        {expected !== undefined && <span className="progress-marker" style={{ left: `${Math.min(100, Math.max(0, expected))}%` }} />}
      </div>
      {!compact && <div className="progress-labels"><strong>{value}%</strong>{expected !== undefined && <span>预期 {expected}%</span>}</div>}
    </div>
  )
}
