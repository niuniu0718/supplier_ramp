import type { LucideIcon } from 'lucide-react'

export function KpiCard({
  label,
  value,
  unit,
  hint,
  icon: Icon,
  tone = 'blue',
}: {
  label: string
  value: string | number
  unit?: string
  hint?: string
  icon: LucideIcon
  tone?: 'blue' | 'cyan' | 'green' | 'orange' | 'red' | 'purple'
}) {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon tone-${tone}`}><Icon size={21} /></div>
      <div className="kpi-content">
        <span className="kpi-label">{label}</span>
        <div className="kpi-value-row">
          <strong className="kpi-value">{value}</strong>
          {unit && <span className="kpi-unit">{unit}</span>}
        </div>
        {hint && <span className="kpi-hint">{hint}</span>}
      </div>
    </div>
  )
}
